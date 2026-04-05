import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function testHydra() {
  const key = Deno.env.get("HYDRADB_API_KEY");
  if (!key) return "failed";
  try {
    const response = await fetch("https://api.hydradb.com/tenants/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tenant_id: "kiro-test-001" }),
    });
    return response.status === 200 || response.status === 201 || response.status === 409 ? "connected" : "failed";
  } catch {
    return "failed";
  }
}

async function testLovable() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "failed";
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "say hello" }],
      }),
    });
    return response.ok ? "connected" : "failed";
  } catch {
    return "failed";
  }
}

async function testElevenLabs() {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID");
  if (!key) return { elevenlabs: "failed", voice: "invalid" };
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
    });
    if (!response.ok) return { elevenlabs: "failed", voice: "invalid" };
    const data = await response.json();
    const validVoice = Boolean(voiceId && Array.isArray(data.voices) && data.voices.some((voice: any) => voice.voice_id === voiceId));
    return { elevenlabs: "connected", voice: validVoice ? "valid" : "invalid" };
  } catch {
    return { elevenlabs: "failed", voice: "invalid" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const [hydradb, lovable, elevenLabsResult] = await Promise.all([
      testHydra(),
      testLovable(),
      testElevenLabs(),
    ]);

    return new Response(JSON.stringify({
      hydradb,
      lovable,
      elevenlabs: elevenLabsResult.elevenlabs,
      elevenlabs_voice_id: elevenLabsResult.voice,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
