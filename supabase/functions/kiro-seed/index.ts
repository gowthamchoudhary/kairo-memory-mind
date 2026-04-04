import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const seedData: Record<string, string[]> = {
  rahul: [
    "Rahul slept 4 hours, heart rate 102bpm, emotion distressed, weather rainy, said feeling tired",
    "Rahul skipped breakfast, heart rate 88bpm, steps 150, location bedroom, mood low",
    "Rahul sleep 3.5 hours, temperature 99.2F, emotion anxious, said cannot sleep well",
    "Rahul exposed to rain 40 mins, steps 890, heart rate 95bpm, fatigue reported",
    "Rahul sleep 8 hours, heart rate 72bpm, steps 4200, mood happy, said feeling great",
    "Pattern: Rahul low sleep under 5 hours combined with rain leads to fatigue next morning",
    "Pattern: Rahul skipped meals combined with high heart rate indicates stress response",
  ],
  priya: [
    "Priya post-surgery day 3, heart rate 118bpm, temperature 100.8F, sleep 3 hours, pain reported",
    "Priya skipped dinner, heart rate 110bpm, steps 45, location hospital room, anxious",
    "Priya sleep 2.5 hours, temperature 101F, emotion anxious, said feeling dizzy",
    "Pattern: Priya heart rate above 115bpm consistently indicates pain escalation",
    "Pattern: Priya poor sleep combined with low food intake leads to dizziness",
  ],
  arjun: [
    "Arjun sleep 7.5 hours, heart rate 74bpm, steps 3200, mood calm, said feeling good",
    "Arjun had healthy meals, heart rate 72bpm, steps 4100, location living room, happy",
    "Arjun exercise 30 mins, heart rate 85bpm post-exercise, mood energetic",
    "Pattern: Arjun consistent sleep above 7 hours maintains stable heart rate",
    "Pattern: Arjun regular exercise correlates with positive mood and lower resting HR",
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    if (!HYDRADB_API_KEY) {
      return new Response(JSON.stringify({ status: "skipped", message: "No HydraDB key configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};

    for (const [userId, memories] of Object.entries(seedData)) {
      try {
        const res = await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories: memories.map((text) => ({ text, infer: true, user_name: userId })),
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
        results[userId] = { status: res.ok ? "seeded" : "failed", code: res.status };
      } catch (e) {
        results[userId] = { status: "error", message: String(e) };
      }
    }

    return new Response(JSON.stringify({ status: "seed_complete", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
