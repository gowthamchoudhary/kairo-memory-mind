import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildKIROPrompt,
  ensureDemoMemoriesSeeded,
  lovableChat,
  normalizeSensors,
  routeGateways,
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

    const { robotId, userId, userInput, sensors, memoryEnabled } = await req.json();
    if (!robotId || !userId) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", message: "robot_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = userInput || "";
    const normalizedSensors = normalizeSensors(sensors);
    const gatewayResults =
      memoryEnabled !== false
        ? await routeGateways(userId, message)
        : {
            intent: {
              primary_intent: "companion" as const,
              health_relevant: false,
              companion_relevant: true,
              reasoning: "Memory disabled, defaulting to companion mode.",
            },
            healthMemories: { gateway: "health" as const, memories: [], activated: false },
            companionMemories: { gateway: "companion" as const, memories: [], activated: false },
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
          [{
            role: "user",
            content: `Given this person's health memory and current sensors (HR: ${normalizedSensors.heart_rate}, Temp: ${normalizedSensors.temperature}), does this require immediate caregiver notification? Consider their personal baseline from memory. Return JSON only: { "alert_caregiver": true/false, "severity": "low/medium/high/critical", "reason": "..." }`,
          }],
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

    await storeKiroResponseMemory(userId, responseText, message, {
      health: gatewayResults.healthMemories.activated,
      companion: gatewayResults.companionMemories.activated,
      intent: gatewayResults.intent.primary_intent,
    });
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
