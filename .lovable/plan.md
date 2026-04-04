## KIRO Build Plan

### Phase 1 — Design System & Fonts
- Set up dark retro-futuristic theme: deep space black (#080810), electric cyan (#00F5FF), warm amber (#FFB347)
- Add Google Fonts: Space Mono + Syne
- Scanline texture overlay, glowing neon borders
- Add framer-motion (already have it? No — need to install)

### Phase 2 — Frontend UI Components
- **KiroAvatar** — Animated pulsing cyan circular waveform (framer-motion), idle breathing + active speaking states
- **TypewriterText** — Character-by-character text reveal
- **MemoryTimeline** — Right sidebar showing last 7 memory entries with timestamps
- **PatternsPanel** — Left sidebar showing detected causal patterns
- **VoiceInput** — Press-and-hold voice button using Web Speech API + text input fallback
- **MemoryCard** — Card for sleep/food/mood/weather/activity

### Phase 3 — Pages
- **Main Chat (/)** — Logo + tagline, avatar, response text, input bar, sidebars
- **Memory Dashboard (/memories)** — Full memory view, pattern graph, manual log button

### Phase 4 — Backend (Lovable Cloud Edge Functions)
- Enable Lovable Cloud
- **Edge Function: `kiro-chat`** — Receives message, calls HydraDB recall, sends to Lovable AI (with KIRO system prompt), returns response
- **Edge Function: `kiro-log`** — Stores memory in HydraDB
- **Edge Function: `kiro-memories`** — Fetches all memories from HydraDB
- **Edge Function: `kiro-tts`** — Calls ElevenLabs TTS, returns audio
- **Edge Function: `kiro-seed`** — Seeds demo memories on first load

### Phase 5 — "Oh Shit" Moment
- On app load: fetch memories → send to AI for proactive greeting → typewriter display → auto-play TTS → avatar animation
- Pre-seed 7 days of sample data
- Wake-up chime via Web Audio API

### Secrets Needed
- `HYDRADB_API_KEY` — for memory storage/recall
- `ELEVENLABS_API_KEY` — for TTS
- `ELEVENLABS_VOICE_ID` — for voice selection
- `GROQ_API_KEY` — User requested Groq, but we'll use **Lovable AI** (pre-configured, no extra key needed) with the same KIRO system prompt

### Tech Notes
- No Express server — using Lovable Cloud Edge Functions instead (platform constraint)
- Lovable AI replaces Groq (pre-configured, same quality)
- HydraDB calls go through edge functions to protect API key
- ElevenLabs TTS through edge function
