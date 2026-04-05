import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory episode store (per user)
const episodeStore = new Map<string, Array<{ episode_id: string; episode_title: string; events: string[] }>>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HYDRADB_API_KEY = Deno.env.get("HYDRADB_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!HYDRADB_API_KEY) {
      return new Response(JSON.stringify({ status: "skipped", message: "No HydraDB key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { robotId, userId, sensors, userInput } = await req.json();
    if (!robotId || !userId || !sensors) {
      return new Response(JSON.stringify({ error: "Missing fields: robotId, userId, sensors required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventId = `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();

    // Get existing episodes for this user
    const userEpisodes = episodeStore.get(userId) || [];

    // Classify episode using AI
    let episodeId = `EP_${Date.now()}`;
    let episodeTitle = "New Episode";
    let isNewEpisode = true;
    let isIsolated = userEpisodes.length === 0;
    let relationType = "initial";
    let causedByEvents: string[] = [];
    let linksToEpisodes: string[] = [];

    if (LOVABLE_API_KEY) {
      try {
        const episodePrompt = `Given this new sensor event for user ${userId}:
Heart Rate: ${sensors.heartRate}bpm, Temperature: ${sensors.temperature}°F, Sleep: ${sensors.sleepHours}h, Steps: ${sensors.steps}, Emotion: ${sensors.emotion}, Location: ${sensors.location}, Weather: ${sensors.weather}
${userInput ? `User said: "${userInput}"` : ""}

Existing episodes: ${JSON.stringify(userEpisodes.map(e => ({ id: e.episode_id, title: e.episode_title, event_count: e.events.length })))}

Determine:
1. Does this belong to an existing episode?
2. If yes: which episode_id and what is the relation? (caused_by/follows/part_of/contradicts/recurring)
3. If no: create a new episode with a descriptive title
4. What events caused this? List event_ids from existing episodes
5. Is this a new isolated node with no relations?

Return JSON only: { "episode_id": "string", "episode_title": "string", "is_new_episode": true/false, "is_isolated": true/false, "relation_type": "string", "caused_by_events": [], "links_to_episodes": [] }`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You classify health events into episodic memory episodes. Return valid JSON only." },
              { role: "user", content: episodePrompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            episodeId = parsed.episode_id || episodeId;
            episodeTitle = parsed.episode_title || episodeTitle;
            isNewEpisode = parsed.is_new_episode !== false;
            isIsolated = parsed.is_isolated || false;
            relationType = parsed.relation_type || "initial";
            causedByEvents = parsed.caused_by_events || [];
            linksToEpisodes = parsed.links_to_episodes || [];
          }
        }
      } catch (e) {
        console.log("Episode classification failed, using defaults:", e);
      }
    }

    // Build the natural language text with full metadata
    const nlText = `${robotId}: ${userId} heart rate ${sensors.heartRate}bpm, temperature ${sensors.temperature}F, sleep ${sensors.sleepHours}h, steps ${sensors.steps}, emotion ${sensors.emotion}, location ${sensors.location}, weather ${sensors.weather}${userInput ? `, said: ${userInput}` : ""}`;

    // Determine user state from sensors
    let userState = "stable";
    if (sensors.heartRate > 110 || sensors.temperature > 100.5 || sensors.sleepHours < 4) {
      userState = "deteriorating";
    } else if (sensors.heartRate < 80 && sensors.sleepHours >= 7 && (sensors.emotion === "calm" || sensors.emotion === "happy")) {
      userState = "improving";
    }

    // Build event type
    let eventType = "health_report";
    if (userInput) eventType = "interaction";
    if (sensors.heartRate > 120 || sensors.temperature > 101.5) eventType = "critical_alert";

    // Store in HydraDB with episodic metadata
    const memoryPayload = {
      memories: [{
        text: nlText,
        infer: true,
        user_name: userId,
        metadata: {
          event_id: eventId,
          episode_id: episodeId,
          episode_title: episodeTitle,
          event_type: eventType,
          caused_by: causedByEvents,
          relation_to_episode: relationType,
          links_to_episodes: linksToEpisodes,
          sensor_data: {
            heart_rate: sensors.heartRate,
            sleep_hours: sensors.sleepHours,
            temperature: sensors.temperature,
            steps: sensors.steps,
            emotion: sensors.emotion,
            location: sensors.location,
            weather: sensors.weather,
          },
          user_state: userState,
          is_isolated: isIsolated,
          confidence: 0.85,
          timestamp,
        },
      }],
      tenant_id: "kiro-platform",
      sub_tenant_id: userId,
    };

    const res = await fetch("https://api.hydradb.com/memories/add_memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${HYDRADB_API_KEY}` },
      body: JSON.stringify(memoryPayload),
    });

    const data = await res.json();

    // Update in-memory episode store
    if (isNewEpisode) {
      userEpisodes.push({ episode_id: episodeId, episode_title: episodeTitle, events: [eventId] });
    } else {
      const ep = userEpisodes.find(e => e.episode_id === episodeId);
      if (ep) ep.events.push(eventId);
    }
    episodeStore.set(userId, userEpisodes);

    return new Response(JSON.stringify({
      status: "ingested",
      event_id: eventId,
      episode_id: episodeId,
      episode_title: episodeTitle,
      is_new_episode: isNewEpisode,
      is_isolated: isIsolated,
      user_state: userState,
      graph_update: {
        node: { id: eventId, episode: episodeId, title: episodeTitle, type: eventType, state: userState },
        edges: causedByEvents.map(src => ({ source: src, target: eventId, relation: relationType })),
      },
      data,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
