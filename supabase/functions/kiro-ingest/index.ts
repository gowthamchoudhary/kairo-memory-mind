import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (!HYDRADB_API_KEY) {
      return new Response(JSON.stringify({ status: "skipped", message: "No HydraDB key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { robotId, userId, sensors } = await req.json();
    if (!robotId || !userId || !sensors) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nlText = `${robotId}: ${userId} heart rate ${sensors.heartRate}bpm, temperature ${sensors.temperature}F, sleep ${sensors.sleepHours}h, steps ${sensors.steps}, emotion ${sensors.emotion}, location ${sensors.location}, weather ${sensors.weather}`;

    const res = await fetch("https://api.hydradb.com/memories/add_memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
      body: JSON.stringify({
        memories: [{ text: nlText, infer: true, user_name: userId }],
        tenant_id: "kiro-platform",
        sub_tenant_id: userId,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ status: "ingested", data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
