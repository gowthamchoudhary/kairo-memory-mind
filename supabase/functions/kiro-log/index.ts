import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getHydraTenantId } from "../_shared/kiroMemory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, type, value, timestamp } = await req.json();
    if (!type || !value) {
      return new Response(JSON.stringify({ error: "type and value required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    const tenantId = getHydraTenantId();
    if (HYDRADB_API_KEY) {
      const res = await fetch("https://api.hydradb.com/memories/add_memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
        body: JSON.stringify({
          memories: [{ text: `User logged: ${type} = ${value} at ${timestamp}`, infer: true, user_name: userId }],
          tenant_id: tenantId,
          sub_tenant_id: userId || "gowtham",
        }),
      });
      if (!res.ok) console.error("HydraDB store error:", await res.text());
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
