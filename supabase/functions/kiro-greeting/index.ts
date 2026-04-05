import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getHydraTenantId } from "../_shared/kiroMemory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIRO_SYSTEM_PROMPT = `You are KIRO, a companion robot with deep memory of this user's life.

When the user opens the app, you speak FIRST — before they say anything.

Analyze their memory history and generate an opening statement that:
- References 2-3 specific things from their recent history (sleep, food, mood, weather, stress)
- Connects patterns they probably haven't noticed themselves
- Feels like someone who has been quietly watching and caring
- Is warm but slightly uncanny — like the robot knows too much
- Is 3 sentences MAX

NEVER say generic things like "How can I help you today?"
NEVER ask "How are you feeling?"
NEVER introduce yourself with "Hi I'm KIRO"

Instead say things like:
"You've had three short nights in a row. Combined with skipping lunch twice this week — your body is probably running on empty right now."`;

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

    const { userId } = await req.json();
    const tenantId = getHydraTenantId();

    // Try to fetch from HydraDB if key exists
    let memoryContext = SEED_CONTEXT;
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (HYDRADB_API_KEY) {
      try {
        const recallRes = await fetch("https://api.hydradb.com/recall/recall_preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({ query: "user wellbeing overview", tenant_id: tenantId, sub_tenant_id: userId }),
        });
        if (recallRes.ok) {
          const recallData = await recallRes.json();
          if (recallData?.preferences) memoryContext = recallData.preferences;
        }
      } catch (e) {
        console.log("HydraDB recall failed, using seed data:", e);
      }
    }

    // Call Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: KIRO_SYSTEM_PROMPT },
          { role: "user", content: `USER HISTORY FROM MEMORY:\n${memoryContext}\n\nGenerate the proactive opening greeting.` },
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
    const text = aiData.choices?.[0]?.message?.content || "I see your patterns. Let's talk.";

    // TTS via ElevenLabs if configured
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
          const buf = await ttsRes.arrayBuffer();
          audio = encode(buf);
        }
      } catch (e) {
        console.log("TTS failed:", e);
      }
    }

    return new Response(JSON.stringify({ text, audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("greeting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
