import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SeedEvent {
  text: string;
  metadata: {
    event_id: string;
    episode_id: string;
    episode_title: string;
    event_type: string;
    caused_by: string[];
    relation_to_episode: string;
    links_to_episodes: string[];
    sensor_data?: Record<string, any>;
    user_state: string;
    is_isolated: boolean;
    confidence: number;
    timestamp: string;
  };
}

const seedData: Record<string, SeedEvent[]> = {
  rahul: [
    {
      text: "Rahul heart rate 102bpm, sleep 4 hours, emotion distressed, weather rainy, location bedroom, said: I don't feel well",
      metadata: {
        event_id: "EVT_rahul_001", episode_id: "EP_rahul_001", episode_title: "Tuesday Fatigue Spiral",
        event_type: "health_report", caused_by: [], relation_to_episode: "trigger",
        links_to_episodes: [], sensor_data: { heart_rate: 102, sleep_hours: 4, temperature: 99.1, steps: 150, emotion: "distressed", location: "bedroom", weather: "rainy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.95, timestamp: "2026-04-01T07:00:00Z",
      },
    },
    {
      text: "Rahul skipped breakfast, heart rate 88bpm, steps 150, location bedroom, mood low",
      metadata: {
        event_id: "EVT_rahul_002", episode_id: "EP_rahul_001", episode_title: "Tuesday Fatigue Spiral",
        event_type: "health_report", caused_by: ["EVT_rahul_001"], relation_to_episode: "follows",
        links_to_episodes: [], sensor_data: { heart_rate: 88, sleep_hours: 4, temperature: 98.6, steps: 150, emotion: "low", location: "bedroom", weather: "cloudy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.92, timestamp: "2026-04-01T12:00:00Z",
      },
    },
    {
      text: "Rahul sleep 3.5 hours, temperature 99.2F, emotion anxious, said: cannot sleep well",
      metadata: {
        event_id: "EVT_rahul_003", episode_id: "EP_rahul_002", episode_title: "Sleep Deficit Pattern",
        event_type: "health_report", caused_by: ["EVT_rahul_001"], relation_to_episode: "recurring",
        links_to_episodes: ["EP_rahul_001"], sensor_data: { heart_rate: 95, sleep_hours: 3.5, temperature: 99.2, steps: 120, emotion: "anxious", location: "bedroom", weather: "cloudy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.99, timestamp: "2026-04-02T06:30:00Z",
      },
    },
    {
      text: "Rahul exposed to rain 40 mins, steps 890, heart rate 95bpm, fatigue reported",
      metadata: {
        event_id: "EVT_rahul_004", episode_id: "EP_rahul_001", episode_title: "Tuesday Fatigue Spiral",
        event_type: "health_report", caused_by: [], relation_to_episode: "caused_by",
        links_to_episodes: ["EP_rahul_002"], sensor_data: { heart_rate: 95, sleep_hours: 5, temperature: 98.8, steps: 890, emotion: "tired", location: "outdoors", weather: "rainy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.88, timestamp: "2026-04-01T17:00:00Z",
      },
    },
    {
      text: "Rahul sleep 8 hours, heart rate 72bpm, steps 4200, mood happy, said: feeling great today",
      metadata: {
        event_id: "EVT_rahul_005", episode_id: "EP_rahul_003", episode_title: "Recovery Day",
        event_type: "health_report", caused_by: [], relation_to_episode: "contradicts",
        links_to_episodes: ["EP_rahul_001", "EP_rahul_002"], sensor_data: { heart_rate: 72, sleep_hours: 8, temperature: 98.4, steps: 4200, emotion: "happy", location: "living room", weather: "sunny" },
        user_state: "improving", is_isolated: false, confidence: 0.94, timestamp: "2026-04-04T08:00:00Z",
      },
    },
    {
      text: "Pattern: Rahul low sleep under 5 hours combined with rain leads to fatigue next morning",
      metadata: {
        event_id: "EVT_rahul_P1", episode_id: "EP_rahul_001", episode_title: "Tuesday Fatigue Spiral",
        event_type: "pattern", caused_by: ["EVT_rahul_001", "EVT_rahul_004"], relation_to_episode: "summary",
        links_to_episodes: ["EP_rahul_002"], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.89, timestamp: "2026-04-03T00:00:00Z",
      },
    },
    {
      text: "Pattern: Rahul skipped meals combined with high heart rate indicates stress response",
      metadata: {
        event_id: "EVT_rahul_P2", episode_id: "EP_rahul_001", episode_title: "Tuesday Fatigue Spiral",
        event_type: "pattern", caused_by: ["EVT_rahul_002"], relation_to_episode: "summary",
        links_to_episodes: [], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.74, timestamp: "2026-04-03T00:00:00Z",
      },
    },
  ],
  priya: [
    {
      text: "Priya post-surgery day 3, heart rate 118bpm, temperature 100.8F, sleep 3 hours, pain reported",
      metadata: {
        event_id: "EVT_priya_001", episode_id: "EP_priya_001", episode_title: "Post-Surgery Recovery Crisis",
        event_type: "critical_alert", caused_by: [], relation_to_episode: "trigger",
        links_to_episodes: [], sensor_data: { heart_rate: 118, sleep_hours: 3, temperature: 100.8, steps: 45, emotion: "anxious", location: "hospital room", weather: "cloudy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.96, timestamp: "2026-04-03T08:00:00Z",
      },
    },
    {
      text: "Priya skipped dinner, heart rate 110bpm, steps 45, location hospital room, anxious",
      metadata: {
        event_id: "EVT_priya_002", episode_id: "EP_priya_001", episode_title: "Post-Surgery Recovery Crisis",
        event_type: "health_report", caused_by: ["EVT_priya_001"], relation_to_episode: "follows",
        links_to_episodes: [], sensor_data: { heart_rate: 110, sleep_hours: 3, temperature: 100.2, steps: 45, emotion: "anxious", location: "hospital room", weather: "cloudy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.94, timestamp: "2026-04-03T19:00:00Z",
      },
    },
    {
      text: "Priya sleep 2.5 hours, temperature 101F, emotion anxious, said: feeling dizzy",
      metadata: {
        event_id: "EVT_priya_003", episode_id: "EP_priya_002", episode_title: "Dizziness Episode",
        event_type: "health_report", caused_by: ["EVT_priya_001", "EVT_priya_002"], relation_to_episode: "escalation",
        links_to_episodes: ["EP_priya_001"], sensor_data: { heart_rate: 124, sleep_hours: 2.5, temperature: 101, steps: 20, emotion: "anxious", location: "hospital room", weather: "cloudy" },
        user_state: "deteriorating", is_isolated: false, confidence: 0.98, timestamp: "2026-04-04T06:00:00Z",
      },
    },
    {
      text: "Pattern: Priya heart rate above 115bpm consistently indicates pain escalation",
      metadata: {
        event_id: "EVT_priya_P1", episode_id: "EP_priya_001", episode_title: "Post-Surgery Recovery Crisis",
        event_type: "pattern", caused_by: ["EVT_priya_001", "EVT_priya_002"], relation_to_episode: "summary",
        links_to_episodes: ["EP_priya_002"], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.92, timestamp: "2026-04-04T12:00:00Z",
      },
    },
    {
      text: "Pattern: Priya poor sleep combined with low food intake leads to dizziness",
      metadata: {
        event_id: "EVT_priya_P2", episode_id: "EP_priya_002", episode_title: "Dizziness Episode",
        event_type: "pattern", caused_by: ["EVT_priya_002", "EVT_priya_003"], relation_to_episode: "summary",
        links_to_episodes: ["EP_priya_001"], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.78, timestamp: "2026-04-04T12:00:00Z",
      },
    },
  ],
  arjun: [
    {
      text: "Arjun sleep 7.5 hours, heart rate 74bpm, steps 3200, mood calm, said: feeling good",
      metadata: {
        event_id: "EVT_arjun_001", episode_id: "EP_arjun_001", episode_title: "Stable Wellness Baseline",
        event_type: "health_report", caused_by: [], relation_to_episode: "initial",
        links_to_episodes: [], sensor_data: { heart_rate: 74, sleep_hours: 7.5, temperature: 98.4, steps: 3200, emotion: "calm", location: "living room", weather: "sunny" },
        user_state: "stable", is_isolated: false, confidence: 0.90, timestamp: "2026-04-02T08:00:00Z",
      },
    },
    {
      text: "Arjun had healthy meals, heart rate 72bpm, steps 4100, location living room, happy",
      metadata: {
        event_id: "EVT_arjun_002", episode_id: "EP_arjun_001", episode_title: "Stable Wellness Baseline",
        event_type: "health_report", caused_by: ["EVT_arjun_001"], relation_to_episode: "follows",
        links_to_episodes: [], sensor_data: { heart_rate: 72, sleep_hours: 7, temperature: 98.2, steps: 4100, emotion: "happy", location: "living room", weather: "sunny" },
        user_state: "stable", is_isolated: false, confidence: 0.93, timestamp: "2026-04-03T12:00:00Z",
      },
    },
    {
      text: "Arjun exercise 30 mins, heart rate 85bpm post-exercise, mood energetic",
      metadata: {
        event_id: "EVT_arjun_003", episode_id: "EP_arjun_002", episode_title: "Exercise Recovery",
        event_type: "health_report", caused_by: [], relation_to_episode: "initial",
        links_to_episodes: ["EP_arjun_001"], sensor_data: { heart_rate: 85, sleep_hours: 7.5, temperature: 98.6, steps: 5200, emotion: "energetic", location: "outdoors", weather: "sunny" },
        user_state: "improving", is_isolated: false, confidence: 0.91, timestamp: "2026-04-04T10:00:00Z",
      },
    },
    {
      text: "Pattern: Arjun consistent sleep above 7 hours maintains stable heart rate",
      metadata: {
        event_id: "EVT_arjun_P1", episode_id: "EP_arjun_001", episode_title: "Stable Wellness Baseline",
        event_type: "pattern", caused_by: ["EVT_arjun_001", "EVT_arjun_002"], relation_to_episode: "summary",
        links_to_episodes: [], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.94, timestamp: "2026-04-04T12:00:00Z",
      },
    },
    {
      text: "Pattern: Arjun regular exercise correlates with positive mood and lower resting HR",
      metadata: {
        event_id: "EVT_arjun_P2", episode_id: "EP_arjun_002", episode_title: "Exercise Recovery",
        event_type: "pattern", caused_by: ["EVT_arjun_003"], relation_to_episode: "summary",
        links_to_episodes: ["EP_arjun_001"], sensor_data: {}, user_state: "stable", is_isolated: false, confidence: 0.82, timestamp: "2026-04-04T12:00:00Z",
      },
    },
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

    for (const [userId, events] of Object.entries(seedData)) {
      try {
        const memories = events.map(e => ({
          text: e.text,
          infer: true,
          user_name: userId,
          metadata: e.metadata,
        }));

        const res = await fetch("https://api.hydradb.com/memories/add_memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
          body: JSON.stringify({
            memories,
            tenant_id: "kiro-platform",
            sub_tenant_id: userId,
          }),
        });
        const data = await res.json();
        results[userId] = { status: res.ok ? "seeded" : "failed", code: res.status, events: events.length, data };
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
