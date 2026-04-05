import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ensureDemoMemoriesSeeded,
  lovableChat,
  normalizeSensors,
  storeConversationMemory,
  storeHealthMemory,
} from "../_shared/kiroMemory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const episodeStore = new Map<string, Array<{ episode_id: string; episode_title: string; events: string[] }>>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await ensureDemoMemoriesSeeded();

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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedSensors = normalizeSensors(sensors);
    if (!normalizedSensors) throw new Error("Unable to normalize sensors");

    const eventId = `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    const userEpisodes = episodeStore.get(userId) || [];

    let episodeId = `EP_${Date.now()}`;
    let episodeTitle = "New Episode";
    let isNewEpisode = true;
    let isIsolated = userEpisodes.length === 0;
    let relationType = "initial";
    let causedByEvents: string[] = [];
    let linksToEpisodes: string[] = [];

    if (LOVABLE_API_KEY) {
      try {
        const episodeRaw = await lovableChat(
          [{
            role: "user",
            content: `Given this new sensor event for user ${userId}:
Heart Rate: ${normalizedSensors.heart_rate}bpm, Temperature: ${normalizedSensors.temperature}°F, Sleep: ${normalizedSensors.sleep_hours}h, Steps: ${normalizedSensors.steps_today}, Emotion: ${normalizedSensors.voice_emotion}, Location: ${normalizedSensors.location}, Weather: ${normalizedSensors.weather}
${userInput ? `User said: "${userInput}"` : ""}

Existing episodes: ${JSON.stringify(userEpisodes.map((episode) => ({ id: episode.episode_id, title: episode.episode_title, event_count: episode.events.length })))}

Determine:
1. Does this belong to an existing episode?
2. If yes: which episode_id and what is the relation? (caused_by/follows/part_of/contradicts/recurring)
3. If no: create a new episode with a descriptive title
4. What events caused this? List event_ids from existing episodes
5. Is this a new isolated node with no relations?

Return JSON only: { "episode_id": "string", "episode_title": "string", "is_new_episode": true/false, "is_isolated": true/false, "relation_type": "string", "caused_by_events": [], "links_to_episodes": [] }`,
          }],
          { type: "json_object" },
        );

        const parsed = JSON.parse(episodeRaw);
        episodeId = parsed.episode_id || episodeId;
        episodeTitle = parsed.episode_title || episodeTitle;
        isNewEpisode = parsed.is_new_episode !== false;
        isIsolated = Boolean(parsed.is_isolated);
        relationType = parsed.relation_type || "initial";
        causedByEvents = parsed.caused_by_events || [];
        linksToEpisodes = parsed.links_to_episodes || [];
      } catch (e) {
        console.log("Episode classification failed, using defaults:", e);
      }
    }

    let userState = "stable";
    if ((normalizedSensors.heart_rate || 0) > 110 || (normalizedSensors.temperature || 0) > 100.5 || (normalizedSensors.sleep_hours || 0) < 4) {
      userState = "deteriorating";
    } else if ((normalizedSensors.heart_rate || 999) < 80 && (normalizedSensors.sleep_hours || 0) >= 7 && (normalizedSensors.voice_emotion === "calm" || normalizedSensors.voice_emotion === "happy")) {
      userState = "improving";
    }

    let eventType = "health_report";
    if (userInput) eventType = "interaction";
    if ((normalizedSensors.heart_rate || 0) > 120 || (normalizedSensors.temperature || 0) > 101.5) eventType = "critical_alert";

    if (userInput) {
      await storeConversationMemory(userId, userInput);
    }

    await storeHealthMemory(userId, normalizedSensors, {
      event_id: eventId,
      episode_id: episodeId,
      episode_title: episodeTitle,
      event_type: eventType,
      caused_by: causedByEvents,
      relation_to_episode: relationType,
      links_to_episodes: linksToEpisodes,
      user_state: userState,
      is_isolated: isIsolated,
      confidence: 0.85,
      timestamp,
    });

    if (isNewEpisode) {
      userEpisodes.push({ episode_id: episodeId, episode_title: episodeTitle, events: [eventId] });
    } else {
      const episode = userEpisodes.find((item) => item.episode_id === episodeId);
      if (episode) episode.events.push(eventId);
    }
    episodeStore.set(userId, userEpisodes);

    return new Response(JSON.stringify({
      status: "ingested",
      event_id: eventId,
      episode_id: episodeId,
      episode_title: episodeTitle,
      is_new_episode: isNewEpisode,
      is_isolated: isIsolated,
      linked_to: linksToEpisodes,
      relation: relationType,
      alert_triggered: false,
      user_state: userState,
      graph_update: {
        node: { id: eventId, episode: episodeId, title: episodeTitle, type: eventType, state: userState },
        edges: causedByEvents.map((source) => ({ source, target: eventId, relation: relationType })),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
