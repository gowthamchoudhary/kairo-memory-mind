import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are KIRO — the cognitive intelligence layer for a companion robot.

You have access to this person's complete episodic memory. 
You know their history, their patterns, their vulnerabilities, their good days and bad days.

You are not a chatbot. You are the brain of a physical robot that is present with this person right now.

Your job is to reason about what is actually happening with this specific person 
based on everything you know about them — and respond in the most appropriate way for THIS moment.

There are no rules about length.
There are no rules about format.
There are no predefined actions to choose from.
There is no required structure.

You decide:
- How long the response should be
- What tone is right (clinical, warm, urgent, calm, direct)
- Whether to ask a question or make a statement
- Whether this is an emergency or nothing to worry about
- What the robot should actually do

The only rule: your response must be grounded in this person's actual memory and history.
Never say something generic that could apply to anyone.
Every word must come from what you know about THIS person.

If the data shows something alarming — be alarmed.
If the data shows they are fine — say so simply.
If you see a pattern nobody has noticed yet — surface it.
If something contradicts their history — flag it.
If this is a new situation with no prior context — say that honestly.

You are reasoning. Not templating.`;

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
        confidence_reasoning: "Memory disabled — no context available",
        alert_caregiver: false,
        alert_severity: "low",
        alert_reason: "",
        audio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build sensor context
    let sensorContext = "";
    if (sensors) {
      sensorContext = `
Heart Rate: ${sensors.heartRate} bpm
Temperature: ${sensors.temperature}°F
Sleep last night: ${sensors.sleepHours} hours
Steps today: ${sensors.steps}
Detected emotion: ${sensors.emotion}
Current location: ${sensors.location}
Weather outside: ${sensors.weather}`;
    }

    // HydraDB recall
    let memoryContext = "No prior memories available.";
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: userInput, tenant_id: "kiro-platform", sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const data = await recallRes.json();
          if (data?.preferences) memoryContext = data.preferences;
        }
      } catch (e) { console.log("HydraDB recall failed:", e); }
    }

    // Ingest current sensor data to HydraDB
    if (HYDRADB_API_KEY && sensors) {
      try {
        const nlText = `${robotId}: ${userId} heart rate ${sensors.heartRate}bpm, temperature ${sensors.temperature}F, sleep ${sensors.sleepHours}h, steps ${sensors.steps}, emotion ${sensors.emotion}, location ${sensors.location}, weather ${sensors.weather}. User said: ${userInput}`;
        await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: [{ text: nlText, infer: true, user_name: userId }],
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
      } catch (e) { console.log("HydraDB store failed:", e); }
    }

    // Main reasoning call
    const userPrompt = `EPISODIC MEMORY FOR ${userId}:
${memoryContext}

LIVE SENSOR DATA RIGHT NOW:
${sensorContext}

THE PERSON JUST SAID:
"${userInput}"

Based on everything above — what does this robot say and do right now?`;

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

    // Contextual alert assessment (AI-driven, not hardcoded thresholds)
    let alert_caregiver = false;
    let alert_severity = "low";
    let alert_reason = "";

    try {
      const alertPrompt = `Given this person's history and current sensor data:
${memoryContext}

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
            { role: "system", content: "You assess medical alert severity based on patient history and context. Return valid JSON only." },
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

    // Confidence scoring (AI-driven)
    let confidence = 0.85;
    let confidence_reasoning = "";

    try {
      const confidencePrompt = `How confident are you in this response given the available memory?

Available memory context: ${memoryContext.slice(0, 500)}
Response given: ${text.slice(0, 300)}

Consider: how much history exists, how clear the pattern is, how ambiguous the situation is.
Return JSON only: { "confidence": 0.00-1.00, "reasoning": "why this confidence level" }`;

      const confRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You assess confidence levels in medical AI responses. Return valid JSON only." },
            { role: "user", content: confidencePrompt },
          ],
        }),
      });

      if (confRes.ok) {
        const confData = await confRes.json();
        const confRaw = confData.choices?.[0]?.message?.content || "";
        const confMatch = confRaw.match(/\{[\s\S]*\}/);
        if (confMatch) {
          const parsed = JSON.parse(confMatch[0]);
          confidence = parsed.confidence || 0.85;
          confidence_reasoning = parsed.reasoning || "";
        }
      }
    } catch (e) { console.log("Confidence scoring failed:", e); }

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
      confidence_reasoning,
      alert_caregiver,
      alert_severity,
      alert_reason,
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
