import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildKIROPrompt,
  ensureDemoMemoriesSeeded,
  lovableChat,
  routeGateways,
  storeConversationMemory,
  storeKiroResponseMemory,
  synthesizeAudio,
} from "../_shared/kiroMemory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await ensureDemoMemoriesSeeded();

    const { userId, message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gatewayResults = await routeGateways(userId, message);
    const { systemPrompt, userPrompt } = await buildKIROPrompt(userId, message, null, gatewayResults);
    const text = await lovableChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    await storeConversationMemory(userId, message);
    await storeKiroResponseMemory(userId, text, message, {
      health: gatewayResults.healthMemories.activated,
      companion: gatewayResults.companionMemories.activated,
      intent: gatewayResults.intent.primary_intent,
    });
    const audio = await synthesizeAudio(text);

    return new Response(
      JSON.stringify({
        text,
        audio,
        response_text: text,
        audio_base64: audio,
        gateways_used: {
          health: gatewayResults.healthMemories.activated,
          companion: gatewayResults.companionMemories.activated,
          intent: gatewayResults.intent.primary_intent,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
