import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IntentResult = {
  primary_intent: "health" | "companion" | "both";
  health_relevant: boolean;
  companion_relevant: boolean;
  reasoning: string;
};

type GatewayMemory = {
  gateway: "health" | "companion";
  memories: Array<{ chunk_content?: string; [key: string]: unknown }>;
  activated: boolean;
};

type GatewayResults = {
  intent: IntentResult;
  healthMemories: GatewayMemory;
  companionMemories: GatewayMemory;
};

type IncomingSensors =
  | {
      heartRate?: number;
      temperature?: number;
      sleepHours?: number;
      steps?: number;
      emotion?: string;
      location?: string;
      weather?: string;
    }
  | null
  | undefined;

type NormalizedSensors = {
  heart_rate: number | null;
  temperature: number | null;
  sleep_hours: number | null;
  steps_today: number | null;
  voice_emotion: string | null;
  location: string | null;
  weather: string | null;
};

async function lovableChat(
  messages: Array<{ role: "system" | "user"; content: string }>,
  responseFormat?: { type: "json_object" },
) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: responseFormat ? "google/gemini-2.5-flash-lite" : "google/gemini-3-flash-preview",
      messages,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Lovable request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function classifyIntent(message: string): Promise<IntentResult> {
  const content = await lovableChat(
    [
      {
        role: "user",
        content: `
Classify this message for a companion robot's memory retrieval system.
Message: "${message}"

Return JSON only, no explanation:
{
  "primary_intent": "health" | "companion" | "both",
  "health_relevant": true or false,
  "companion_relevant": true or false,
  "reasoning": "one sentence why"
}

Classification rules - follow these exactly:
- Physical symptoms, pain, dizziness, tiredness, vitals, medication -> health_relevant: true
- Emotions, relationships, people, life events, plans, memories, small talk, greetings -> companion_relevant: true
- Ambiguous feelings like "I feel terrible" or "I'm not okay" -> both
- "I want to propose", "my daughter called", "good morning", "I'm bored" -> companion only, health_relevant: false
- "I feel dizzy", "my chest hurts", "I can't breathe" -> health primarily, companion secondary
- "I can't sleep again" -> both, because sleep is health but the "again" signals emotional pattern
        `.trim(),
      },
    ],
    { type: "json_object" },
  );

  return JSON.parse(content) as IntentResult;
}

async function healthGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const response = await fetch("https://api.hydradb.com/recall/recall_preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("HYDRADB_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `health sensor vitals physical ${query}`,
        tenant_id: "kiro-platform",
        sub_tenant_id: userId,
        max_results: 8,
      }),
    });
    const data = await response.json();
    return {
      gateway: "health",
      memories: data.chunks || [],
      activated: true,
    };
  } catch {
    return { gateway: "health", memories: [], activated: false };
  }
}

async function companionGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const response = await fetch("https://api.hydradb.com/recall/recall_preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("HYDRADB_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `conversation emotion relationship life event ${query}`,
        tenant_id: "kiro-platform",
        sub_tenant_id: userId,
        max_results: 8,
      }),
    });
    const data = await response.json();
    return {
      gateway: "companion",
      memories: data.chunks || [],
      activated: true,
    };
  } catch {
    return { gateway: "companion", memories: [], activated: false };
  }
}

async function routeGateways(userId: string, message: string): Promise<GatewayResults> {
  const intent = await classifyIntent(message);

  let healthMemories: GatewayMemory = { gateway: "health", memories: [], activated: false };
  let companionMemories: GatewayMemory = { gateway: "companion", memories: [], activated: false };

  if (intent.health_relevant && intent.companion_relevant) {
    [healthMemories, companionMemories] = await Promise.all([
      healthGateway(userId, message),
      companionGateway(userId, message),
    ]);
  } else if (intent.health_relevant) {
    healthMemories = await healthGateway(userId, message);
  } else {
    companionMemories = await companionGateway(userId, message);
  }

  return { intent, healthMemories, companionMemories };
}

function normalizeSensors(sensors: IncomingSensors): NormalizedSensors | null {
  if (!sensors) return null;
  return {
    heart_rate: sensors.heartRate ?? null,
    temperature: sensors.temperature ?? null,
    sleep_hours: sensors.sleepHours ?? null,
    steps_today: sensors.steps ?? null,
    voice_emotion: sensors.emotion ?? null,
    location: sensors.location ?? null,
    weather: sensors.weather ?? null,
  };
}

async function buildKIROPrompt(userId: string, message: string, sensors: NormalizedSensors | null, gatewayResults: GatewayResults) {
  const { intent, healthMemories, companionMemories } = gatewayResults;

  let healthContext = "";
  let companionContext = "";

  if (healthMemories.activated && healthMemories.memories.length > 0) {
    healthContext = `
HEALTH & SENSOR MEMORY:
${healthMemories.memories.map((memory) => memory.chunk_content || "").filter(Boolean).join("\n")}
    `;
  }

  if (companionMemories.activated && companionMemories.memories.length > 0) {
    companionContext = `
CONVERSATION & LIFE MEMORY:
${companionMemories.memories.map((memory) => memory.chunk_content || "").filter(Boolean).join("\n")}
    `;
  }

  const systemPrompt = `
You are KIRO - a companion that happens to have memory.

You are not a health monitor.
You are not a doctor.
You are not an analyst.

You are the most present, attentive companion this person has.
You remember their life - not to analyze them, but to actually know them.

${intent.health_relevant && !intent.companion_relevant ? `
This message is health related. Use the health memory to reason carefully about what is physically happening. Be warm but be honest about what the data shows.
` : ""}

${intent.companion_relevant && !intent.health_relevant ? `
This message is about life, not health. Do not mention sensors, vitals, cortisol, sleep data, or any health metrics unless the person explicitly asks. Just be present. Be curious. Be warm. Respond like a companion who knows them well.
` : ""}

${intent.primary_intent === "both" ? `
This message touches both health and life. Weave them together naturally - only bring up health data if it genuinely adds to understanding the full picture of what this person is going through.
` : ""}

There is no required length.
There is no required format.
There are no predefined actions.
You decide everything based on what this moment actually calls for.
  `.trim();

  const userPrompt = `
${healthContext}
${companionContext}
${sensors ? `LIVE SENSORS RIGHT NOW:
HR: ${sensors.heart_rate}bpm | Temp: ${sensors.temperature}°F | Sleep: ${sensors.sleep_hours}hrs | Steps: ${sensors.steps_today} | Emotion: ${sensors.voice_emotion}` : ""}

${userId} says: "${message}"

What does KIRO say?
  `.trim();

  return { systemPrompt, userPrompt };
}

async function synthesizeAudio(text: string) {
  const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
  if (!elevenLabsKey) return null;

  try {
    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!ttsResponse.ok) return null;
    return encode(await ttsResponse.arrayBuffer());
  } catch (err) {
    console.error("TTS failed:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { robotId, userId, userInput, sensors, memoryEnabled } = await req.json();
    if (!robotId || !userId) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", message: "robot_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = userInput || "";
    const normalizedSensors = normalizeSensors(sensors);

    const gatewayResults: GatewayResults =
      memoryEnabled !== false
        ? await routeGateways(userId, message)
        : {
            intent: {
              primary_intent: "companion",
              health_relevant: false,
              companion_relevant: true,
              reasoning: "Memory disabled, defaulting to companion mode.",
            },
            healthMemories: { gateway: "health", memories: [], activated: false },
            companionMemories: { gateway: "companion", memories: [], activated: false },
          };

    const { systemPrompt, userPrompt } = await buildKIROPrompt(userId, message, normalizedSensors, gatewayResults);
    const responseText = await lovableChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let alertCaregiver = false;
    let alertSeverity: string | null = null;
    let alertReason = "";

    if (gatewayResults.healthMemories.activated && normalizedSensors) {
      try {
        const alertRaw = await lovableChat(
          [
            {
              role: "user",
              content: `Given this person's health memory and current sensors (HR: ${normalizedSensors.heart_rate}, Temp: ${normalizedSensors.temperature}), does this require immediate caregiver notification? Consider their personal baseline from memory. Return JSON only: { "alert_caregiver": true/false, "severity": "low/medium/high/critical", "reason": "..." }`,
            },
          ],
          { type: "json_object" },
        );
        const alertResult = JSON.parse(alertRaw);
        alertCaregiver = Boolean(alertResult.alert_caregiver);
        alertSeverity = alertResult.severity || null;
        alertReason = alertResult.reason || "";
      } catch (err) {
        console.error("Alert check failed:", err);
      }
    }

    const audioBase64 = await synthesizeAudio(responseText);

    return new Response(
      JSON.stringify({
        response_text: responseText,
        audio_base64: audioBase64,
        alert_caregiver: alertCaregiver,
        alert_severity: alertSeverity,
        alert_reason: alertReason,
        gateways_used: {
          health: gatewayResults.healthMemories.activated,
          companion: gatewayResults.companionMemories.activated,
          intent: gatewayResults.intent.primary_intent,
        },
        text: responseText,
        audio: audioBase64,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("reason error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
