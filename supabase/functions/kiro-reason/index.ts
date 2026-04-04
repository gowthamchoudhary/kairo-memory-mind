import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are KIRO, a medical companion robot AI. You reason causally about a patient's wellbeing using their life history from memory. Never give generic advice. Always connect your response to their actual sensor data and history. Be warm, concise, and specific. If you see patterns (bad sleep + rain + skipped meals = feeling sick), say so explicitly. Speak in 2-3 sentences max.

You must also output a JSON block at the end of your response in this format:
{"confidence": 0.XX, "action": "REST|HYDRATE|ALERT|MONITOR", "alert_caregiver": false}

Choose action based on severity:
- MONITOR: everything normal
- REST: fatigue, low sleep, mild issues
- HYDRATE: dehydration signs, skipped meals
- ALERT: critical vitals (HR>120, temp>101, severe symptoms)

Set alert_caregiver=true only for ALERT actions.`;

const GENERIC_RESPONSE = "I understand you're not feeling well. Please rest and stay hydrated. If symptoms persist, consult a healthcare provider.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { robotId, userId, userInput, sensors, memoryEnabled } = await req.json();
    if (!userInput) {
      return new Response(JSON.stringify({ error: "No input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If memory disabled, return generic
    if (memoryEnabled === false) {
      // Still do TTS if available
      let audio: string | undefined;
      const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      const VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
      if (ELEVENLABS_KEY) {
        try {
          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ text: GENERIC_RESPONSE, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.8 } }),
          });
          if (ttsRes.ok) {
            const { encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
            audio = encode(await ttsRes.arrayBuffer());
          }
        } catch (e) { console.log("TTS failed:", e); }
      }

      return new Response(JSON.stringify({
        text: GENERIC_RESPONSE,
        confidence: 0.5,
        action: "MONITOR",
        alert_caregiver: false,
        audio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build sensor context
    let sensorContext = "";
    if (sensors) {
      sensorContext = `\nCURRENT SENSORS for ${robotId}:\nHeart Rate: ${sensors.heartRate}bpm, Temperature: ${sensors.temperature}°F, Sleep: ${sensors.sleepHours}h, Steps: ${sensors.steps}, Emotion: ${sensors.emotion}, Location: ${sensors.location}, Weather: ${sensors.weather}`;
    }

    // Try HydraDB recall
    let memoryContext = "";
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: userInput, tenant_id: "kiro-platform", sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const data = await recallRes.json();
          if (data?.preferences) memoryContext = `\nRECALLED MEMORIES:\n${data.preferences}`;
        }
      } catch (e) { console.log("HydraDB recall failed:", e); }
    }

    // Ingest current sensor data to HydraDB
    if (HYDRADB_API_KEY && sensors) {
      try {
        const nlText = `${robotId}: ${userId} heart rate ${sensors.heartRate}bpm, temperature ${sensors.temperature}F, sleep ${sensors.sleepHours}h, steps ${sensors.steps}, emotion ${sensors.emotion}, location ${sensors.location}, weather ${sensors.weather}. User said: ${userInput}`;
        await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: [{ text: nlText, infer: true, user_name: userId }],
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
      } catch (e) { console.log("HydraDB store failed:", e); }
    }

    // Call AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `USER HISTORY:${memoryContext}${sensorContext}\n\nPATIENT INPUT: ${userInput}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || "Unable to reason at this time.";

    // Parse out JSON block
    let text = rawText;
    let confidence = 0.85;
    let action = "MONITOR";
    let alert_caregiver = false;

    const jsonMatch = rawText.match(/\{[^{}]*"confidence"[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        confidence = parsed.confidence || 0.85;
        action = parsed.action || "MONITOR";
        alert_caregiver = parsed.alert_caregiver || false;
        text = rawText.replace(jsonMatch[0], "").trim();
      } catch {}
    }

    // TTS
    let audio: string | undefined;
    const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
    if (ELEVENLABS_KEY) {
      try {
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.6, similarity_boost: 0.8 } }),
        });
        if (ttsRes.ok) {
          const { encode } = await import("https://deno.land/std@0.168.0/encoding/base64.ts");
          audio = encode(await ttsRes.arrayBuffer());
        }
      } catch (e) { console.log("TTS failed:", e); }
    }

    return new Response(JSON.stringify({ text, confidence, action, alert_caregiver, audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reason error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
