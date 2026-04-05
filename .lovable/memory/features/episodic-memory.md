---
name: Episodic Memory Architecture
description: Events grouped into episodes with causal links, AI-driven alerts and confidence scoring, dual pipeline (sensor + conversation)
type: feature
---
- Every HydraDB memory has metadata: event_id, episode_id, episode_title, event_type, caused_by, links_to_episodes, sensor_data, user_state, is_isolated, confidence, timestamp
- Two memory types: "sensor_event" and "conversation" — both stored in HydraDB with memory_type field
- kiro-ingest uses AI (gemini-2.5-flash-lite) to classify events into episodes AND extract meaning from user_input
- kiro-converse handles pure conversation (no sensors) with meaning extraction pipeline
- kiro-reason uses 3 AI calls: main reasoning (gemini-3-flash-preview), alert assessment (flash-lite), confidence scoring (flash-lite)
- kiro-reason now has dual-source prompt: sensor history + conversation history
- Alerts are contextual (AI considers baseline), not hardcoded thresholds
- Memory page visualizes episodes as force-directed graph using react-force-graph-2d
- Graph has filter toggles: All, Health, Conversations, Patterns
- Conversation nodes are purple (#8B5CF6), sensor nodes use state-based colors
- conversation_reveals link type connects conversation nodes to health episodes (purple dashed)
- Seed data includes 3 users with conversation nodes (daughter called, feeling lonely, scared about recovery, etc.)
- Robot query modal has "Just talking" vs "Reporting symptoms" toggle
- HydraDB tenant: "kiro-platform"
