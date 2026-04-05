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

async function extractMeaning(userId: string, message: string, existingEpisodes: string[], apiKey: string) {
  const prompt = `You are analyzing a message from a companion robot's user.
User: ${userId}
Message: "${message}"
Existing episodes in their memory: ${JSON.stringify(existingEpisodes)}

Extract the following. Be nuanced — not every message is significant. Some are just hello.

Return JSON only:
{
  "surface_content": "what they literally said",
  "emotional_signal": "positive/negative/neutral/ambiguous/none",
  "emotional_intensity": 0.0-1.0,
  "hidden_signals": [],
  "people_mentioned": [],
  "events_mentioned": { "past": [], "upcoming": [] },
  "health_relevance": "direct/indirect/none",
  "health_notes": "any health signals hidden in conversation",
  "episode_match": "episode_id if this belongs to existing episode, or null",
  "new_episode_needed": true/false,
  "new_episode_title": "if new episode needed, what to call it",
  "memory_importance": 0.0-1.0,
  "should_monitor": true/false,
  "monitor_reason": "why to watch this going forward or null"
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You extract meaning from conversational messages. Return valid JSON only." },
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
  return {
    surface_content: message,
    emotional_signal: "neutral",
    emotional_intensity: 0.3,
    hidden_signals: [],
    people_mentioned: [],
    events_mentioned: { past: [], upcoming: [] },
    health_relevance: "none",
    health_notes: "",
    episode_match: null,
    new_episode_needed: false,
    new_episode_title: null,
    memory_importance: 0.3,
    should_monitor: false,
    monitor_reason: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { robotId, userId, message, memoryEnabled } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If memory disabled, return generic
    if (memoryEnabled === false) {
      const genericText = "I hear you. How are you feeling right now?";
      return new Response(JSON.stringify({
        text: genericText,
        confidence: 0.5,
        meaning: null,
        episode_update: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");

    // Step 1: Extract meaning from the message
    const meaning = await extractMeaning(userId, message, [], LOVABLE_API_KEY);

    // Step 2: Recall from HydraDB — both sensor history AND conversation history
    let sensorMemories = "No sensor history available.";
    let conversationMemories = "No conversation history available.";
    
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: message, tenant_id: "kiro-platform", sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const data = await recallRes.json();
          if (data?.preferences) {
            // Split memories into sensor and conversation types
            const allMemories = data.preferences;
            sensorMemories = allMemories;
            conversationMemories = allMemories;
          }
        }
      } catch (e) { console.log("HydraDB recall failed:", e); }
    }

    // Step 3: Run KIRO reasoning with full combined context
    const userPrompt = `SENSOR HISTORY:
${sensorMemories}

CONVERSATION HISTORY:
${conversationMemories}

LIVE SENSORS (if available):
No sensor data this interaction

WHAT THEY JUST SAID:
"${message}"

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
    const text = aiData.choices?.[0]?.message?.content || "I'm here with you.";

    // Step 4: Store conversation + extracted meaning in HydraDB
    const convEventId = `CONV_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const episodeId = meaning.episode_match || (meaning.new_episode_needed ? `EP_CONV_${Date.now()}` : `EP_CONV_general`);
    const episodeTitle = meaning.new_episode_title || "Ongoing Conversation";

    if (HYDRADB_API_KEY) {
      try {
        const convText = `${userId} said: "${message}" — emotional signal: ${meaning.emotional_signal}, hidden signals: ${(meaning.hidden_signals || []).join(', ')}, people mentioned: ${(meaning.people_mentioned || []).join(', ')}, upcoming events: ${(meaning.events_mentioned?.upcoming || []).join(', ')}`;
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
                event_id: convEventId,
                episode_id: episodeId,
                episode_title: episodeTitle,
                raw_message: message,
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
            { role: "user", content: `Memory context length: ${sensorMemories.length} chars. Response: ${text.slice(0, 200)}. How confident?` },
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
      audio,
      confidence,
      meaning,
      episode_update: {
        episode_id: episodeId,
        episode_title: episodeTitle,
        is_new: meaning.new_episode_needed,
      },
      graph_update: {
        node: {
          id: convEventId,
          episode: episodeId,
          title: episodeTitle,
          type: "conversation",
          label: message.slice(0, 40),
          emotional_signal: meaning.emotional_signal,
          health_relevance: meaning.health_relevance,
        },
        edges: meaning.episode_match ? [{ source: convEventId, target: meaning.episode_match, relation: "conversation_reveals" }] : [],
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("converse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
