import { MemoryEntry } from "@/components/MemoryTimeline";
import { Pattern } from "@/components/PatternsPanel";

const now = Date.now();
const day = 86400000;

export const seedMemories: MemoryEntry[] = [
  { id: "1", text: "Slept only 4 hours", timestamp: new Date(now - 6 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "sleep" },
  { id: "2", text: "Skipped breakfast, had heavy dinner", timestamp: new Date(now - 5 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "food" },
  { id: "3", text: "Caught in rain, walked 2km", timestamp: new Date(now - 4 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "weather" },
  { id: "4", text: "Mood: low — stressed about deadline", timestamp: new Date(now - 3 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "mood" },
  { id: "5", text: "Slept 8 hours, felt better", timestamp: new Date(now - 2 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "sleep" },
  { id: "6", text: "Skipped lunch, 3 coffees", timestamp: new Date(now - 1 * day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "food" },
  { id: "7", text: "Slept 5 hours, rained again", timestamp: new Date(now).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), type: "sleep" },
];

export const seedPatterns: Pattern[] = [
  { id: "p1", description: "Low sleep → fatigue next day (3 occurrences this week)", confidence: 92 },
  { id: "p2", description: "Skipped meals → increased coffee intake", confidence: 85 },
  { id: "p3", description: "Rain + <5h sleep → feeling off next morning", confidence: 78 },
  { id: "p4", description: "Deadline stress → sleep drops + meal skips", confidence: 88 },
];

export const seedMemoryContext = `
User slept only 4 hours on Monday night.
User skipped breakfast on Tuesday, had heavy dinner.
User was caught in rain on Tuesday evening, walked 20 mins.
User mood logged as low on Wednesday morning.
User stressed about project deadline this week.
User slept 5 hours Wednesday night, had coffee 3 times.
User mentioned feeling tired but pushed through work.
Pattern observed: user energy crashes after consecutive short sleep nights.
Pattern observed: user skips meals when under deadline pressure.
Pattern observed: rain exposure combined with low sleep leads to next-day fatigue.
`.trim();
