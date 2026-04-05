import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildKIROPrompt,
  ensureDemoMemoriesSeeded,
  lovableChat,
  routeGateways,
  storeConversationMemory,
  storeConversationPair,
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

    const { robotId, userId, message } = await req.json();

    if (!robotId || !userId || !message) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", message: "robot_id, user_id, message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gatewayResults = await routeGateways(userId, message);
    const { systemPrompt, userPrompt } = await buildKIROPrompt(userId, message, null, gatewayResults);
    const responseText = await lovableChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const { meaning } = await storeConversationMemory(userId, message);
    await storeConversationPair(userId, message, responseText, meaning);
    const audioBase64 = await synthesizeAudio(responseText);

    return new Response(
      JSON.stringify({
        response_text: responseText,
        audio_base64: audioBase64,
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
    console.error("converse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
