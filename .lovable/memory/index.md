# Project Memory

## Core
KIRO — bright B2B SaaS dashboard. BG #F8F9FC, primary #2563EB, text #0F172A.
Inter font everywhere. Clean cards with 8px radius, subtle shadows. No dark mode.
Lovable Cloud backend with edge functions (kiro-reason, kiro-ingest, kiro-seed, kiro-chat).
Uses Lovable AI (not Groq). HydraDB for memory (optional, graceful fallback). ElevenLabs TTS (optional).
5 screens: Overview, Robots, Memory, Analytics, API Docs.
Episodic memory architecture: events → episodes → graph. AI-driven alerts & confidence (not hardcoded).
Memory page uses react-force-graph-2d for Obsidian-style graph visualization.

## Memories
- [Design tokens](mem://design/tokens) — Bright theme: #F8F9FC bg, #2563EB primary, Inter font
- [Episodic architecture](mem://features/episodic-memory) — Events with episode_id, causal links, AI classification
