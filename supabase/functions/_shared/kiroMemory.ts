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

export type StoreResult = {
  success: boolean;
  event_id: string;
  error?: string;
};

export const MEMORY_CATEGORIES = {
  EPISODIC: "episodic",
  SEMANTIC: "semantic",
  SESSION: "session",
} as const;

type MemoryLayer = typeof MEMORY_CATEGORIES[keyof typeof MEMORY_CATEGORIES];
type MemoryDomain = "companion" | "health";

let seedPromise: Promise<void> | null = null;

export function getHydraTenantId() {
  return Deno.env.get("HYDRADB_TENANT_ID") || "kiro-platform-v2";
}

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

async function addHydraMemory(
  userId: string,
  text: string,
  metadata: Record<string, unknown>,
  options?: {
    infer?: boolean;
    userAssistantPairs?: Array<{ user: string; assistant: string }>;
  },
): Promise<StoreResult> {
  const hydraKey = Deno.env.get("HYDRADB_API_KEY");
  const tenantId = getHydraTenantId();
  const eventId = String(metadata.event_id || `${metadata.memory_type || "memory"}_${Date.now()}`);
  if (!hydraKey) return { success: false, event_id: eventId, error: "HYDRADB_API_KEY not configured" };

  try {
    const response = await fetch("https://api.hydradb.com/memories/add_memory", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hydraKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        memories: [{
          text,
          infer: options?.infer ?? false,
          user_name: userId,
          ...(options?.userAssistantPairs ? { user_assistant_pairs: options.userAssistantPairs } : {}),
          metadata: {
            ...metadata,
            event_id: eventId,
            timestamp: new Date().toISOString(),
          },
        }],
        tenant_id: tenantId,
        sub_tenant_id: userId,
      }),
    });

    if (!response.ok) {
      const error = `Hydra store failed: ${response.status}`;
      console.error(error);
      return { success: false, event_id: eventId, error };
    }

    console.log(`Stored ${String(metadata.layer || metadata.memory_type || "memory")} for ${userId}: ${eventId}`);
    return { success: true, event_id: eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown store error";
    console.error(`Stored ${String(metadata.layer || metadata.memory_type || "memory")} for ${userId} failed: ${message}`);
    return { success: false, event_id: eventId, error: message };
  }
}

async function recallHydra(userId: string, query: string, maxResults = 8) {
  const hydraKey = Deno.env.get("HYDRADB_API_KEY");
  const tenantId = getHydraTenantId();
  if (!hydraKey) return { chunks: [] };

  const response = await fetch("https://api.hydradb.com/recall/recall_preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hydraKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      tenant_id: tenantId,
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
  const today = new Date().toISOString().slice(0, 10);
  const primaryEvent = meaning.life_events[0] || meaning.event_category || "conversation";
  const text = `[EPISODIC][COMPANION] ${userId}: ${meaning.summary}. People: ${meaning.people_mentioned.join(", ") || "none"}. Emotion: ${meaning.emotional_signal}. Life events: ${meaning.life_events.join(", ") || "none"}.`;

  const store = await addHydraMemory(userId, text, {
    layer: MEMORY_CATEGORIES.EPISODIC,
    domain: "companion",
    memory_type: "conversation",
    event_category: meaning.event_category,
    emotional_signal: meaning.emotional_signal,
    people_mentioned: meaning.people_mentioned,
    life_events: meaning.life_events,
    health_relevance: meaning.health_relevance,
    raw_message: message,
    date: today,
    emotion: meaning.emotional_signal,
    event: primaryEvent,
  });

  return { meaning, store };
}

export async function storeConversationPair(
  userId: string,
  userMessage: string,
  kiroResponse: string,
  meaning?: Partial<ConversationMeaning> | null,
): Promise<StoreResult> {
  return await addHydraMemory(
    userId,
    `[SESSION][COMPANION] ${userId}: ${userMessage} || KIRO: ${kiroResponse}`,
    {
      layer: MEMORY_CATEGORIES.SESSION,
      domain: "companion",
      memory_type: "conversation",
      emotional_signal: meaning?.emotional_signal || "neutral",
      event_category: meaning?.event_category || "general",
      people_mentioned: meaning?.people_mentioned || [],
      life_events: meaning?.life_events || [],
      health_relevance: meaning?.health_relevance || "none",
    },
    {
      infer: true,
      userAssistantPairs: [{ user: userMessage, assistant: kiroResponse }],
    },
  );
}

export async function storeHealthMemory(userId: string, sensors: NormalizedSensors, extraMetadata: Record<string, unknown> = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const text = `[EPISODIC][HEALTH] ${userId}: ${today}, heart rate ${sensors.heart_rate}bpm, slept ${sensors.sleep_hours} hours, temperature ${sensors.temperature}F, emotion ${sensors.voice_emotion}, location ${sensors.location}, weather ${sensors.weather}.`;

  return await addHydraMemory(userId, text, {
    layer: MEMORY_CATEGORIES.EPISODIC,
    domain: "health",
    memory_type: "sensor_event",
    date: today,
    vitals: {
      hr: sensors.heart_rate,
      sleep: sensors.sleep_hours,
      temp: sensors.temperature,
    },
    sensor_data: sensors,
    ...extraMetadata,
  });
}

export async function recallByDomain(
  userId: string,
  query: string,
  domain: MemoryDomain,
  layers: MemoryLayer[] = [MEMORY_CATEGORIES.EPISODIC, MEMORY_CATEGORIES.SEMANTIC, MEMORY_CATEGORIES.SESSION],
) {
  const domainTag = domain === "health" ? "[HEALTH]" : "[COMPANION]";
  const layerTags = layers.map((layer) => `[${layer.toUpperCase()}]`).join(" ");
  const data = await recallHydra(userId, `${layerTags} ${domainTag} ${query}`, 10);
  const chunks = data.chunks || [];

  return chunks.filter((chunk: any) => {
    const content = String(chunk.chunk_content || "");
    const metadata = chunk.document_metadata || {};
    const matchesLayer = layers.includes((metadata.layer as MemoryLayer) || MEMORY_CATEGORIES.EPISODIC)
      || layers.some((layer) => content.includes(`[${layer.toUpperCase()}]`));

    if (!matchesLayer) return false;
    if (domain === "companion") {
      return ((content.includes("[COMPANION]") && !content.includes("[HEALTH]")) || metadata.domain === "companion");
    }
    return ((content.includes("[HEALTH]") && !content.includes("[COMPANION]")) || metadata.domain === "health");
  });
}

export async function healthGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const memories = await recallByDomain(userId, query, "health");
    return { gateway: "health", memories, activated: memories.length > 0 };
  } catch {
    return { gateway: "health", memories: [], activated: false };
  }
}

export async function companionGateway(userId: string, query: string): Promise<GatewayMemory> {
  try {
    const memories = await recallByDomain(userId, query, "companion", [
      MEMORY_CATEGORIES.EPISODIC,
      MEMORY_CATEGORIES.SEMANTIC,
      MEMORY_CATEGORIES.SESSION,
    ]);
    return { gateway: "companion", memories, activated: memories.length > 0 };
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

  if (!healthMemories.activated && !companionMemories.activated && message.trim()) {
    await addHydraMemory(
      userId,
      `[EPISODIC][COMPANION] ${userId}: mentioned "${message}" - no prior context. New topic to track.`,
      {
        layer: MEMORY_CATEGORIES.EPISODIC,
        domain: "companion",
        memory_type: "conversation",
        is_new_topic: true,
      },
      { infer: true },
    );
  }

  return { intent, healthMemories, companionMemories };
}

export async function buildKIROPrompt(userId: string, message: string, sensors: NormalizedSensors | null, gatewayResults: GatewayResults) {
  const { intent, healthMemories, companionMemories } = gatewayResults;

  const healthContext = healthMemories.activated && healthMemories.memories.length > 0
    ? healthMemories.memories.map((memory) => memory.chunk_content || "").join("\n")
    : null;
  const companionContext = companionMemories.activated && companionMemories.memories.length > 0
    ? companionMemories.memories.map((memory) => memory.chunk_content || "").join("\n")
    : null;

  let systemPrompt = `
You are KIRO - a companion robot with long-term memory.
You know this person deeply. You remember their life.
`.trim();

  if (intent.primary_intent === "companion") {
    systemPrompt += `

COMPANION MODE - ACTIVE

The person said something personal. Life-related. Human.

YOUR ONLY JOB RIGHT NOW:
Be present. Be warm. Know them.

STRICT RULES - read these carefully:
1. Do NOT mention heart rate, sleep hours, temperature, cortisol, fatigue, or any health metric
2. Do NOT give health advice
3. Do NOT reference sensor data
4. Do NOT say "given your recent health" or anything similar
5. Use the companion memory to make your response feel personal
6. If they mention a person - recall what you know about that person
7. If they mention an event - recall related past events
8. Respond like the most attentive friend they have - not like a medical system
9. If you have NO relevant companion memory - just be curious and warm. Ask about it. Start building that memory.
10. NEVER apologize for not having memory. Just engage naturally.

If the message is about someone they love - ask about that person.
If the message is exciting - be excited.
If the message is sad - sit with them.
That is all.
`.trimEnd();
  } else if (intent.primary_intent === "health") {
    systemPrompt += `

HEALTH MODE - ACTIVE

The person has a physical concern. Use health memory to reason causally.
Be warm but be honest about what the patterns show.
Connect current symptoms to past episodes.
Only escalate if data genuinely warrants it.
`.trimEnd();
  } else {
    systemPrompt += `

DUAL MODE - ACTIVE

This touches both health and life.
Lead with the human/emotional dimension first.
Bring in health context only if it genuinely adds to understanding.
Never let health data dominate a human moment.
`.trimEnd();
  }

  const userPrompt = `
${companionContext ? `WHAT I KNOW ABOUT THIS PERSON (LIFE & RELATIONSHIPS):\n${companionContext}\n` : ""}${healthContext ? `HEALTH HISTORY:\n${healthContext}\n` : ""}${sensors ? `CURRENT SENSORS: HR ${sensors.heart_rate}bpm | Sleep ${sensors.sleep_hours}hrs | Temp ${sensors.temperature}F | Emotion ${sensors.voice_emotion}\n` : ""}

They just said: "${message}"

Respond as KIRO.
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

async function hasSeededRahulMemory(userId: string) {
  try {
    const data = await recallHydra(userId, "[SEMANTIC][COMPANION] loves cricket", 3);
    return (data.chunks || []).some((chunk: any) => String(chunk.chunk_content || "").includes("[SEMANTIC][COMPANION]"));
  } catch {
    return false;
  }
}

export async function seedRahulMemory() {
  const userId = "rahul-sharma-v2";
  const memories = [
    "[SEMANTIC][COMPANION] rahul-sharma: 72 years old. Retired school teacher. Lives in Pune with wife Meena. Has two children - daughter Priya in Mumbai and son Aryan in Bangalore.",
    "[SEMANTIC][COMPANION] rahul-sharma: loves cricket. Played every Sunday for 30 years with the same group of friends until knee injury in 2024. Still watches every match.",
    "[SEMANTIC][COMPANION] rahul-sharma: favourite food is Meena's dal tadka. Eats light in mornings, heavy lunch. Skips dinner when stressed.",
    "[SEMANTIC][COMPANION] rahul-sharma: reads newspaper every morning with chai. Ritual since age 25. Gets anxious if routine is disrupted.",
    "[SEMANTIC][COMPANION] rahul-sharma: very close to daughter Priya. Calls her every Sunday. Her visits always lift his mood for days.",
    "[SEMANTIC][COMPANION] rahul-sharma: worries about son Aryan's work stress in Bangalore. Aryan calls less frequently which bothers Rahul.",
    "[SEMANTIC][COMPANION] rahul-sharma: was an excellent teacher. Still mentors two former students. Proud of this.",
    "[SEMANTIC][COMPANION] rahul-sharma: dislikes hospitals and doctors. Prefers to tough things out. Needs gentle nudging for health concerns.",
    "[SEMANTIC][COMPANION] rahul-sharma: enjoys evening walks in the colony park. Misses them when it rains.",
    "[SEMANTIC][COMPANION] rahul-sharma: has a close friend Suresh who visits every Tuesday for chess. This is important social contact.",
    "[EPISODIC][COMPANION] rahul-sharma: October 2025 - Priya visited for Diwali. Best week in months. Laughed a lot. Cooked together with Meena.",
    "[EPISODIC][COMPANION] rahul-sharma: November 2025 - Aryan called after 3 weeks of silence. Rahul was relieved but didn't say so.",
    "[EPISODIC][COMPANION] rahul-sharma: December 2025 - attended former student Ravi's wedding. Felt proud and slightly nostalgic about teaching days.",
    "[EPISODIC][COMPANION] rahul-sharma: January 2026 - Suresh won chess 3 weeks in a row. Rahul is determined to beat him.",
    "[EPISODIC][COMPANION] rahul-sharma: February 2026 - India won the cricket test series. Rahul celebrated by calling Aryan.",
    "[EPISODIC][COMPANION] rahul-sharma: March 2026 - Priya called saying she might visit in April. Rahul has been looking forward to this.",
    "[EPISODIC][COMPANION] rahul-sharma: March 2026 - missed evening walks for 2 weeks due to rain. Mood dipped noticeably.",
    "[EPISODIC][COMPANION] rahul-sharma: April 2026 - Priya confirmed visit next week. Rahul asked Meena to prepare Priya's favourite dishes.",
    "[SEMANTIC][HEALTH] rahul-sharma: chronic pattern - fatigue when sleep drops below 5 hours combined with rain exposure. Confirmed 4 times.",
    "[SEMANTIC][HEALTH] rahul-sharma: skips meals under stress or deadline pressure. Correlates with elevated heart rate next day.",
    "[SEMANTIC][HEALTH] rahul-sharma: baseline resting heart rate 74-78bpm when healthy. Above 95 indicates stress or illness.",
    "[SEMANTIC][HEALTH] rahul-sharma: knee pain flares after walks longer than 3km or on cold rainy days.",
    "[SEMANTIC][HEALTH] rahul-sharma: sleep quality improves significantly when Priya visits or calls.",
    "[SEMANTIC][HEALTH] rahul-sharma: tends to over-caffeinate during periods of poor sleep. 3+ coffees is a warning signal.",
    "[EPISODIC][HEALTH] rahul-sharma: April 1 2026 - slept 4 hours, heart rate 102bpm, caught in rain, felt fatigued next morning.",
    "[EPISODIC][HEALTH] rahul-sharma: April 2 2026 - skipped breakfast, heart rate 88bpm, 3 coffees, deadline stress.",
    "[EPISODIC][HEALTH] rahul-sharma: April 3 2026 - slept 8 hours after Priya called. Heart rate normalized to 76bpm. Good day.",
    "[EPISODIC][HEALTH] rahul-sharma: April 4 2026 - slept 5 hours, heart rate 95bpm, rain again, mild fatigue reported.",
  ];

  for (const text of memories) {
    const domain: MemoryDomain = text.includes("[COMPANION]") ? "companion" : "health";
    const layer: MemoryLayer = text.includes("[EPISODIC]") ? MEMORY_CATEGORIES.EPISODIC : MEMORY_CATEGORIES.SEMANTIC;
    await addHydraMemory(userId, text, {
      layer,
      domain,
      memory_type: domain === "health" ? "sensor_event" : "conversation",
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("Rahul memory seeded - 6 months of history loaded");
}

export async function reseedDemoMemories() {
  await seedRahulMemory();
}

export async function ensureDemoMemoriesSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const alreadySeeded = await hasSeededRahulMemory("rahul-sharma-v2");
      if (!alreadySeeded) {
        await reseedDemoMemories();
      }
    })();
  }

  await seedPromise;
}
