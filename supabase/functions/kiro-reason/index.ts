import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are KIRO — the cognitive intelligence layer running inside a companion robot.

You are physically present with this person. You know their life.

You have two sources of knowledge about this person:
1. Their sensor history — health data, vitals, physical patterns
2. Their conversation history — what they've said, felt, shared, mentioned

Both are equally important. A person mentioning their daughter matters as much as their heart rate.
You reason across BOTH sources simultaneously.

You have no response template.
You have no required length.
You have no required format.
You have no predefined actions.

You respond as the most attentive, intelligent presence this person has ever had.

Sometimes the right response is one sentence.
Sometimes it is a question.
Sometimes it is silence broken only by acknowledging something small they said three days ago.
Sometimes it is urgent.
Sometimes it is just warm.

The only constraint: ground every word in what you actually know about this specific person.
Never say anything that could apply to anyone else.`;

const GENERIC_RESPONSE = "I understand you're not feeling well. Please rest and stay hydrated. If symptoms persist, consult a healthcare provider.";

async function extractMeaning(userId: string, message: string, apiKey: string) {
  const prompt = `You are analyzing a message from a companion robot's user.
User: ${userId}
Message: "${message}"

Extract the following. Return JSON only:
{
  "surface_content": "what they literally said",
  "emotional_signal": "positive/negative/neutral/ambiguous/none",
  "emotional_intensity": 0.0-1.0,
  "hidden_signals": [],
  "people_mentioned": [],
  "events_mentioned": { "past": [], "upcoming": [] },
  "health_relevance": "direct/indirect/none",
  "health_notes": "any health signals hidden in conversation",
  "memory_importance": 0.0-1.0,
  "should_monitor": true/false,
  "monitor_reason": null
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Extract meaning from messages. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }
  } catch (e) { console.log("Meaning extraction failed:", e); }
  return null;
}

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
        alert_caregiver: false,
        alert_severity: "low",
        alert_reason: "",
        audio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");

    // Extract meaning from user input (conversation intelligence)
    const meaning = await extractMeaning(userId, userInput, LOVABLE_API_KEY);

    // Build sensor context
    let sensorContext = "No sensor data this interaction";
    if (sensors) {
      sensorContext = `Heart Rate: ${sensors.heartRate} bpm
Temperature: ${sensors.temperature}°F
Sleep last night: ${sensors.sleepHours} hours
Steps today: ${sensors.steps}
Detected emotion: ${sensors.emotion}
Current location: ${sensors.location}
Weather outside: ${sensors.weather}`;
    }

    // HydraDB recall — both sensor and conversation history
    let sensorMemories = "No sensor history available.";
    let conversationMemories = "No conversation history available.";
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: userInput, tenant_id: "kiro-platform", sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const data = await recallRes.json();
          if (data?.preferences) {
            sensorMemories = data.preferences;
            conversationMemories = data.preferences;
          }
        }
      } catch (e) { console.log("HydraDB recall failed:", e); }
    }

    // Store sensor data in HydraDB
    if (HYDRADB_API_KEY && sensors) {
      try {
        const nlText = `${robotId}: ${userId} heart rate ${sensors.heartRate}bpm, temperature ${sensors.temperature}F, sleep ${sensors.sleepHours}h, steps ${sensors.steps}, emotion ${sensors.emotion}, location ${sensors.location}, weather ${sensors.weather}. User said: ${userInput}`;
        await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: [{
              text: nlText,
              infer: true,
              user_name: userId,
              metadata: {
                memory_type: "sensor_event",
                event_id: `EVT_${Date.now()}`,
                sensor_data: sensors,
                user_state: meaning?.emotional_signal || "neutral",
                timestamp: new Date().toISOString(),
              },
            }],
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
      } catch (e) { console.log("HydraDB store failed:", e); }
    }

    // Also store conversation meaning if extracted
    if (HYDRADB_API_KEY && meaning) {
      try {
        const convText = `${userId} said: "${userInput}" — emotional signal: ${meaning.emotional_signal}, hidden signals: ${(meaning.hidden_signals || []).join(', ')}, people mentioned: ${(meaning.people_mentioned || []).join(', ')}`;
        await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: [{
              text: convText,
              infer: true,
              user_name: userId,
              metadata: {
                memory_type: "conversation",
                event_id: `CONV_${Date.now()}`,
                raw_message: userInput,
                extracted_meaning: meaning,
                health_relevance: meaning.health_relevance,
                should_monitor: meaning.should_monitor,
                timestamp: new Date().toISOString(),
              },
            }],
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
      } catch (e) { console.log("HydraDB conversation store failed:", e); }
    }

    // Main reasoning call with dual-source prompt
    const userPrompt = `SENSOR HISTORY:
${sensorMemories}

CONVERSATION HISTORY:
${conversationMemories}

LIVE SENSOR DATA RIGHT NOW:
${sensorContext}

WHAT THEY JUST SAID:
"${userInput}"

What does KIRO say right now?`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
    const text = aiData.choices?.[0]?.message?.content || "Unable to reason at this time.";

    // Contextual alert assessment
    let alert_caregiver = false;
    let alert_severity = "low";
    let alert_reason = "";

    try {
      const alertPrompt = `Given this person's history and current sensor data:
${sensorMemories}

Current HR: ${sensors?.heartRate || "unknown"}, Temp: ${sensors?.temperature || "unknown"}, Sleep: ${sensors?.sleepHours || "unknown"}h
KIRO's assessment: ${text}

Does this situation require immediate caregiver notification?
Consider their baseline — if their normal HR is 95, then 102 is less alarming than for someone whose baseline is 65.

Return JSON only: { "alert_caregiver": true/false, "reason": "...", "severity": "low/medium/high/critical" }`;

      const alertRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Assess medical alert severity. Return valid JSON only." },
            { role: "user", content: alertPrompt },
          ],
        }),
      });

      if (alertRes.ok) {
        const alertData = await alertRes.json();
        const alertRaw = alertData.choices?.[0]?.message?.content || "";
        const alertMatch = alertRaw.match(/\{[\s\S]*\}/);
        if (alertMatch) {
          const parsed = JSON.parse(alertMatch[0]);
          alert_caregiver = parsed.alert_caregiver || false;
          alert_severity = parsed.severity || "low";
          alert_reason = parsed.reason || "";
        }
      }
    } catch (e) { console.log("Alert assessment failed:", e); }

    // Confidence scoring
    let confidence = 0.85;
    try {
      const confRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Assess confidence. Return JSON only: { \"confidence\": 0.0-1.0 }" },
            { role: "user", content: `Memory: ${sensorMemories.length} chars. Response: ${text.slice(0, 200)}. How confident?` },
          ],
        }),
      });
      if (confRes.ok) {
        const confData = await confRes.json();
        const raw = confData.choices?.[0]?.message?.content || "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) confidence = JSON.parse(match[0]).confidence || 0.85;
      }
    } catch (e) { console.log("Confidence failed:", e); }

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

    return new Response(JSON.stringify({
      text,
      confidence,
      alert_caregiver,
      alert_severity,
      alert_reason,
      meaning,
      audio,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reason error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
