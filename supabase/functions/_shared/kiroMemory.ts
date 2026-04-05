import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

export type IntentResult = {
  primary_intent: "health" | "companion" | "both";
  health_relevant: boolean;
  companion_relevant: boolean;
  reasoning: string;
};

export type GatewayMemory = {
  gateway: "health" | "companion";
  memories: Array<{ chunk_content?: string; document_metadata?: Record<string, unknown>; [key: string]: unknown }>;
  activated: boolean;
};

export type GatewayResults = {
  intent: IntentResult;
  healthMemories: GatewayMemory;
  companionMemories: GatewayMemory;
};

export type ConversationMeaning = {
  emotional_signal: string;
  people_mentioned: string[];
  life_events: string[];
  event_category: string;
  health_relevance: string;
  summary: string;
};

export type NormalizedSensors = {
  heart_rate: number | null;
  temperature: number | null;
  sleep_hours: number | null;
  steps_today: number | null;
  voice_emotion: string | null;
  facial_expression?: string | null;
  location: string | null;
  weather: string | null;
};

let seedPromise: Promise<void> | null = null;

export async function lovableChat(
  messages: Array<{ role: "system" | "user"; content: string }>,
  responseFormat?: { type: "json_object" },
) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

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

async function addHydraMemory(userId: string, text: string, metadata: Record<string, unknown>) {
  const hydraKey = Deno.env.get("HYDRADB_API_KEY");
  if (!hydraKey) return;

  await fetch("https://api.hydradb.com/memories/add_memory", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hydraKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      memories: [{
        text,
        infer: false,
        user_name: userId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      }],
      tenant_id: "kiro-platform",
      sub_tenant_id: userId,
    }),
  });
}

async function recallHydra(userId: string, query: string, maxResults = 8) {
  const hydraKey = Deno.env.get("HYDRADB_API_KEY");
  if (!hydraKey) return { chunks: [] };

  const response = await fetch("https://api.hydradb.com/recall/recall_preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hydraKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      tenant_id: "kiro-platform",
      sub_tenant_id: userId,
      max_results: maxResults,
    }),
  });

  if (!response.ok) throw new Error(`Hydra recall failed: ${response.status}`);
  return await response.json();
}

export async function classifyIntent(message: string): Promise<IntentResult> {
  const content = await lovableChat(
    [{
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
    }],
    { type: "json_object" },
  );

  return JSON.parse(content) as IntentResult;
}

export async function extractConversationMeaning(userId: string, message: string): Promise<ConversationMeaning> {
  try {
    const content = await lovableChat(
      [{
        role: "user",
        content: `
Extract structured meaning from this message.
User: ${userId}
Message: "${message}"

Return JSON only:
{
  "emotional_signal": "positive/negative/neutral/ambiguous",
  "people_mentioned": ["list of people"],
  "life_events": ["birthday", "proposal", "visit", "call", "memory", "plan"],
  "event_category": "relationship/family/social/personal/work/hobby/none",
  "health_relevance": "none/indirect/direct",
  "summary": "one line plain english summary of what was said"
}
        `.trim(),
      }],
      { type: "json_object" },
    );

    const parsed = JSON.parse(content) as ConversationMeaning;
    return {
      emotional_signal: parsed.emotional_signal || "neutral",
      people_mentioned: parsed.people_mentioned || [],
      life_events: parsed.life_events || [],
      event_category: parsed.event_category || "none",
      health_relevance: parsed.health_relevance || "none",
      summary: parsed.summary || message,
    };
  } catch {
    return {
      emotional_signal: "neutral",
      people_mentioned: [],
      life_events: [],
      event_category: "none",
      health_relevance: "none",
      summary: message,
    };
  }
}

export async function storeConversationMemory(userId: string, message: string) {
  const meaning = await extractConversationMeaning(userId, message);
  const text = `[COMPANION] ${userId}: ${meaning.summary}. People: ${meaning.people_mentioned.join(", ")}. Category: ${meaning.event_category}. Emotion: ${meaning.emotional_signal}. Life events: ${meaning.life_events.join(", ")}`;

  await addHydraMemory(userId, text, {
    memory_type: "conversation",
    event_category: meaning.event_category,
    emotional_signal: meaning.emotional_signal,
    people_mentioned: meaning.people_mentioned,
    life_events: meaning.life_events,
    health_relevance: meaning.health_relevance,
    raw_message: message,
  });

  return meaning;
}

export async function storeHealthMemory(userId: string, sensors: NormalizedSensors, extraMetadata: Record<string, unknown> = {}) {
  const text = `[HEALTH] ${userId}: heart rate ${sensors.heart_rate}bpm, sleep ${sensors.sleep_hours}hrs, temperature ${sensors.temperature}F, emotion ${sensors.voice_emotion}, location ${sensors.location}, weather ${sensors.weather}`;

  await addHydraMemory(userId, text, {
    memory_type: "sensor_event",
    sensor_data: sensors,
    ...extraMetadata,
  });
}

export async function healthGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const data = await recallHydra(userId, `[HEALTH] heart rate sleep temperature vitals sensor ${query}`);
    const filtered = (data.chunks || []).filter((chunk: any) =>
      String(chunk.chunk_content || "").includes("[HEALTH]") ||
      chunk.document_metadata?.memory_type === "sensor_event",
    );

    return {
      gateway: "health",
      memories: filtered,
      activated: true,
    };
  } catch {
    return { gateway: "health", memories: [], activated: false };
  }
}

export async function companionGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const data = await recallHydra(userId, `[COMPANION] relationship family emotion life event person ${query}`);
    const filtered = (data.chunks || []).filter((chunk: any) =>
      !String(chunk.chunk_content || "").includes("[HEALTH]") &&
      chunk.document_metadata?.memory_type !== "sensor_event"
    );

    return {
      gateway: "companion",
      memories: filtered,
      activated: true,
    };
  } catch {
    return { gateway: "companion", memories: [], activated: false };
  }
}

export async function routeGateways(userId: string, message: string): Promise<GatewayResults> {
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

export async function buildKIROPrompt(userId: string, message: string, sensors: NormalizedSensors | null, gatewayResults: GatewayResults) {
  const { intent, healthMemories, companionMemories } = gatewayResults;

  let healthContext = "";
  let companionContext = "";

  if (healthMemories.activated && healthMemories.memories.length > 0) {
    healthContext = `HEALTH & SENSOR MEMORY:\n${healthMemories.memories.map((memory) => memory.chunk_content || "").join("\n")}`;
  }

  if (companionMemories.activated && companionMemories.memories.length > 0) {
    companionContext = `CONVERSATION & LIFE MEMORY:\n${companionMemories.memories.map((memory) => memory.chunk_content || "").join("\n")}`;
  }

  const systemPrompt = `
You are KIRO - a companion that happens to have memory.

You are not a health monitor.
You are not a doctor.
You are not an analyst.

You are the most present, attentive companion this person has.
You remember their life - not to analyze them, but to actually know them.

${intent.health_relevant && !intent.companion_relevant ? "This message is health related. Use the health memory to reason carefully about what is physically happening. Be warm but be honest about what the data shows." : ""}
${intent.companion_relevant && !intent.health_relevant ? "This message is about life, not health. Do not mention sensors, vitals, cortisol, sleep data, or any health metrics unless the person explicitly asks. Just be present. Be curious. Be warm. Respond like a companion who knows them well." : ""}
${intent.primary_intent === "both" ? "This message touches both health and life. Weave them together naturally - only bring up health data if it genuinely adds to understanding the full picture of what this person is going through." : ""}

There is no required length.
There is no required format.
There are no predefined actions.
You decide everything based on what this moment actually calls for.
  `.trim();

  const userPrompt = `
${healthContext}
${companionContext}
${sensors ? `LIVE SENSORS RIGHT NOW:\nHR: ${sensors.heart_rate}bpm | Temp: ${sensors.temperature}°F | Sleep: ${sensors.sleep_hours}hrs | Steps: ${sensors.steps_today} | Emotion: ${sensors.voice_emotion}` : ""}

${userId} says: "${message}"

What does KIRO say?
  `.trim();

  return { systemPrompt, userPrompt };
}

export async function synthesizeAudio(text: string) {
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

export function normalizeSensors(input: any): NormalizedSensors | null {
  if (!input) return null;
  return {
    heart_rate: input.heart_rate ?? input.heartRate ?? null,
    temperature: input.temperature ?? null,
    sleep_hours: input.sleep_hours ?? input.sleepHours ?? null,
    steps_today: input.steps_today ?? input.steps ?? null,
    voice_emotion: input.voice_emotion ?? input.emotion ?? null,
    facial_expression: input.facial_expression ?? null,
    location: input.location ?? null,
    weather: input.weather ?? null,
  };
}

async function hasSeededCompanionMemory(userId: string) {
  try {
    const data = await recallHydra(userId, "[COMPANION] daughter Priya visiting next week", 3);
    return (data.chunks || []).some((chunk: any) => String(chunk.chunk_content || "").includes("[COMPANION]"));
  } catch {
    return false;
  }
}

export async function reseedDemoMemories() {
  const healthMemories: Record<string, string[]> = {
    "rahul-sharma-v2": [
      "[HEALTH] rahul-sharma: heart rate 102bpm, sleep 4 hours, temperature 99.1F, emotion distressed, location bedroom, weather rainy",
      "[HEALTH] rahul-sharma: heart rate 88bpm, sleep 3.5 hours, skipped breakfast, steps 150, emotion anxious",
      "[HEALTH] rahul-sharma: heart rate 72bpm, sleep 8 hours, steps 4200, temperature 98.4F, emotion calm - good day",
      "[HEALTH] rahul-sharma: heart rate 95bpm, rain exposure 40 mins, fatigue reported, steps 890",
      "[HEALTH] rahul-sharma: heart rate 105bpm, skipped lunch, caffeine 3 cups, deadline stress reported",
    ],
    "priya-nair-v2": [
      "[HEALTH] priya-nair: heart rate 118bpm, temperature 100.8F, sleep 3 hours, post-surgery day 3, pain reported",
      "[HEALTH] priya-nair: heart rate 124bpm, temperature 101.3F, emotion anxious, said feeling dizzy",
      "[HEALTH] priya-nair: heart rate 108bpm, skipped dinner, steps 45, location hospital room",
    ],
    "arjun-mehta-v2": [
      "[HEALTH] arjun-mehta: heart rate 74bpm, sleep 7.5 hours, steps 3200, emotion calm, feeling good",
      "[HEALTH] arjun-mehta: heart rate 85bpm post-exercise, sleep 8 hours, steps 5100, mood energetic",
    ],
  };

  const companionMemories: Record<string, string[]> = {
    "rahul-sharma-v2": [
      "[COMPANION] rahul-sharma: daughter Priya called today. Category: family. Emotion: positive. Life events: phone call. People: daughter Priya",
      "[COMPANION] rahul-sharma: mentioned missing cricket. Used to play every Sunday with friends. Category: hobby. Emotion: nostalgic. People: old friends",
      "[COMPANION] rahul-sharma: worried about son's job situation in Bangalore. Category: family. Emotion: anxious. People: son",
      "[COMPANION] rahul-sharma: daughter Priya visiting next week. Very excited. Category: family. Emotion: positive. Life events: upcoming visit",
    ],
    "priya-nair-v2": [
      "[COMPANION] priya-nair: husband visits every evening, makes her feel better. Category: family. Emotion: positive. People: husband",
      "[COMPANION] priya-nair: worried about missing granddaughter's school play. Category: family. Emotion: sad. People: granddaughter",
    ],
    "arjun-mehta-v2": [
      "[COMPANION] arjun-mehta: planning anniversary trip with wife to Goa next month. Category: relationship. Emotion: excited. People: wife. Life events: anniversary trip",
      "[COMPANION] arjun-mehta: started reading again after years. Currently reading Shantaram. Category: hobby. Emotion: positive",
    ],
  };

  for (const [userId, memories] of Object.entries(healthMemories)) {
    for (const text of memories) {
      await addHydraMemory(userId, text, { memory_type: "sensor_event" });
    }
  }

  for (const [userId, memories] of Object.entries(companionMemories)) {
    for (const text of memories) {
      await addHydraMemory(userId, text, { memory_type: "conversation" });
    }
  }

  console.log("Demo memories seeded cleanly");
}

export async function ensureDemoMemoriesSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const alreadySeeded = await hasSeededCompanionMemory("rahul-sharma-v2");
      if (!alreadySeeded) {
        await reseedDemoMemories();
      }
    })();
  }

  await seedPromise;
}
