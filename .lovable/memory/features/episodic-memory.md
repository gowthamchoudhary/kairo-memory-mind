---
name: Episodic Memory Architecture
description: Events grouped into episodes with causal links, AI-driven alerts and confidence scoring
type: feature
---
- Every HydraDB memory has metadata: event_id, episode_id, episode_title, event_type, caused_by, links_to_episodes, sensor_data, user_state, is_isolated, confidence, timestamp
- kiro-ingest uses AI (gemini-2.5-flash-lite) to classify events into episodes
- kiro-reason uses 3 AI calls: main reasoning (gemini-3-flash-preview), alert assessment (flash-lite), confidence scoring (flash-lite)
- Alerts are contextual (AI considers baseline), not hardcoded thresholds
- Memory page visualizes episodes as force-directed graph using react-force-graph-2d
- Seed data includes 3 users (rahul, priya, arjun) with pre-built episode structures
- HydraDB tenant: "kiro-platform"
