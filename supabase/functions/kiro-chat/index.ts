import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIRO_CHAT_PROMPT = `You are KIRO, a companion robot with long-term memory. You reason causally about a user's wellbeing using their life history. Never give generic advice. Always connect your response to their actual recent history. Be warm, concise, and specific. If you see patterns (bad sleep + rain + skipped meals = feeling sick), say so explicitly. Speak in 2-3 sentences max.`;

const SEED_CONTEXT = `
User slept only 4 hours on Monday night.
User skipped breakfast on Tuesday, had heavy dinner.
User was caught in rain on Tuesday evening, walked 20 mins.
User mood logged as low on Wednesday morning.
User stressed about project deadline this week.
User slept 5 hours Wednesday night, had coffee 3 times.
User mentioned feeling tired but pushed through work.
Pattern observed: user energy crashes after consecutive short sleep nights.
Pattern observed: user skips meals when under deadline pressure.
Pattern observed: rain exposure combined with low sleep leads to next-day fatigue.
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { userId, message } = await req.json();
    if (!message) return new Response(JSON.stringify({ error: "No message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Try HydraDB recall
    let memoryContext = SEED_CONTEXT;
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: message, tenant_id: "kiro-app", sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const data = await recallRes.json();
          if (data?.preferences) memoryContext = data.preferences;
        }
      } catch (e) { console.log("HydraDB recall failed:", e); }
    }

    // Store the user message in HydraDB
    if (HYDRADB_API_KEY) {
      try {
        await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: [{ text: `User said: ${message}`, infer: true, user_name: userId }],
            tenant_id: "kiro-app",
            sub_tenant_id: userId,
          }),
        });
      } catch (e) { console.log("HydraDB store failed:", e); }
    }

    // Call Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: KIRO_CHAT_PROMPT },
          { role: "user", content: `USER HISTORY FROM MEMORY:\n${memoryContext}\n\nCURRENT MESSAGE: ${message}` },
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
    const text = aiData.choices?.[0]?.message?.content || "Something's off — let me check your history again.";

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

    return new Response(JSON.stringify({ text, audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
