const endpoints = [
  {
    method: "POST",
    path: "/v1/ingest",
    title: "Ingest sensor data from a robot",
    description:
      "Stores sensor reading as an episodic memory event in HydraDB. Automatically classifies which episode this belongs to, detects causal links to past events, and updates the memory graph.",
    request: `{
  "robot_id": "KIRO-ELDER-001",
  "user_id": "rahul-sharma",
  "sensors": {
    "heart_rate": 98,
    "temperature": 99.1,
    "sleep_hours": 4.2,
    "steps_today": 230,
    "voice_emotion": "distressed",
    "facial_expression": "fatigued",
    "location": "bedroom",
    "weather": "rainy"
  },
  "user_input": "I don't feel well"
}`,
    response: `{
  "status": "ingested",
  "event_id": "EVT_a1b2c3",
  "episode_id": "EP_fatigue_spiral_03",
  "episode_title": "Tuesday Fatigue Spiral",
  "is_new_episode": false,
  "is_isolated": false,
  "linked_to": ["EP_deadline_stress_01", "EP_rain_exposure_02"],
  "relation": "caused_by",
  "alert_triggered": false
}`,
  },
  {
    method: "POST",
    path: "/v1/converse",
    title: "Send a conversation message — no sensors required",
    description:
      "For natural conversation between robot and user. KIRO extracts meaning, emotional signals, hidden context, and responds as a companion — not a health monitor. Health data is only referenced if genuinely relevant.",
    request: `{
  "robot_id": "KIRO-ELDER-001",
  "user_id": "rahul-sharma",
  "message": "My daughter called today. She's coming to visit next week."
}`,
    response: `{
  "response_text": "That's great news. Last time she visited you seemed much more yourself. When is she arriving?",
  "audio_base64": "...",
  "episode_update": {
    "episode_id": "EP_family_connections_01",
    "new_node": "CONV_daughter_visit_upcoming",
    "linked_to_health": true,
    "health_link_reason": "daughter visits correlate with improved sleep and mood"
  },
  "memory_importance": 0.82
}`,
  },
  {
    method: "POST",
    path: "/v1/reason",
    title: "Get KIRO's full contextual reasoning about a user",
    description:
      "Combines sensor history + conversation history + episodic graph to generate a response. Used when the robot needs to respond to something that requires full context — physical symptoms, complex situations, pattern surfacing.",
    request: `{
  "robot_id": "KIRO-ELDER-001",
  "user_id": "rahul-sharma",
  "user_input": "I feel dizzy",
  "sensors": {
    "heart_rate": 108,
    "temperature": 100.2,
    "sleep_hours": 3.8,
    "steps_today": 120,
    "voice_emotion": "distressed",
    "location": "bedroom",
    "weather": "rainy"
  },
  "memory_enabled": true
}`,
    response: `{
  "response_text": "Your full response here — freeform, no template",
  "audio_base64": "...",
  "confidence": 0.91,
  "alert_caregiver": false,
  "alert_severity": null,
  "episode_id": "EP_fatigue_spiral_03",
  "reasoning_trace": "low sleep + rain + elevated HR matches episode pattern from last month"
}`,
    note:
      "response_text is freeform. KIRO decides length, tone, and content based on full context. No predefined actions or templates.",
  },
  {
    method: "POST",
    path: "/v1/alert",
    title: "Trigger a caregiver alert",
    description:
      "Called automatically by KIRO when reasoning detects critical situation. Can also be called directly by robot hardware.",
    request: `{
  "robot_id": "KIRO-MED-002",
  "user_id": "priya-nair",
  "reason": "Heart rate 124bpm sustained for 8 minutes post-activity",
  "severity": "high",
  "sensor_snapshot": {
    "heart_rate": 124,
    "temperature": 101.3
  }
}`,
    response: `{
  "alerted": true,
  "alert_id": "ALT_x9y8z7",
  "timestamp": "2026-04-05T09:31:00Z",
  "severity": "high",
  "stored_in_memory": true
}`,
  },
  {
    method: "GET",
    path: "/v1/graph/:userId",
    title: "Get the full episodic memory graph for a user",
    description:
      "Returns nodes and links for Obsidian-style visualization. Includes all episodes, events, conversation nodes, patterns, and their relationships.",
    response: `{
  "user_id": "rahul-sharma",
  "nodes": [
    {
      "id": "EP_001",
      "label": "Tuesday Fatigue Spiral",
      "type": "episode",
      "color": "#2563EB",
      "size": 12,
      "summary": "Recurring fatigue pattern triggered by deadline stress"
    },
    {
      "id": "CONV_001",
      "label": "Daughter calling",
      "type": "conversation",
      "color": "#8B5CF6",
      "size": 7,
      "raw_message": "My daughter called today"
    },
    {
      "id": "EP_ISOLATED_001",
      "label": "Knee pain after walk",
      "type": "isolated",
      "color": "#D97706",
      "size": 6,
      "note": "No connections yet — monitoring"
    }
  ],
  "links": [
    {
      "source": "EVT_001",
      "target": "EP_001",
      "relation": "caused_by",
      "color": "#EF4444"
    },
    {
      "source": "CONV_001",
      "target": "EP_001",
      "relation": "positive_impact",
      "color": "#8B5CF6"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/v1/patterns/:userId",
    title: "Get detected patterns for a user",
    response: `{
  "user_id": "rahul-sharma",
  "patterns": [
    {
      "pattern_id": "PAT_001",
      "description": "Low sleep under 5hrs + rain exposure leads to fatigue next morning",
      "confidence": 0.89,
      "occurrences": 4,
      "first_seen": "2026-03-20T00:00:00Z",
      "last_seen": "2026-04-04T00:00:00Z",
      "linked_episodes": ["EP_001", "EP_002", "EP_005"]
    },
    {
      "pattern_id": "PAT_002",
      "description": "Daughter visits correlate with improved sleep and normalized HR within 48 hours",
      "confidence": 0.76,
      "occurrences": 2,
      "first_seen": "2026-03-01T00:00:00Z",
      "last_seen": "2026-03-28T00:00:00Z",
      "linked_episodes": ["EP_003", "EP_007"]
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/health",
    title: "Service health check",
    response: `{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 84729,
  "services": {
    "memory": "connected",
    "ai_reasoning": "connected",
    "tts": "connected",
    "alert_system": "active"
  },
  "robots_connected": 3,
  "total_memories_stored": 1247,
  "total_episodes": 24
}`,
  },
];

const errors = [
  `{
  "error": "INVALID_USER_ID",
  "message": "No user found with this ID",
  "status": 404
}`,
  `{
  "error": "MISSING_ROBOT_ID",
  "message": "robot_id is required for all requests",
  "status": 400
}`,
  `{
  "error": "MEMORY_UNAVAILABLE",
  "message": "HydraDB connection failed — falling back to stateless mode",
  "status": 503
}`,
];

function MethodBadge({ method }: { method: string }) {
  const className =
    method === "POST"
      ? "bg-[#EFF6FF] text-[#2563EB]"
      : "bg-[#ECFDF3] text-[#16A34A]";

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{method}</span>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[20px] bg-[#0F172A] p-5 text-xs leading-6 text-slate-100">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocs() {
  return (
    <div className="space-y-8">
      <section className="dashboard-card p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2563EB]">KIRO API Reference</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-900">
            The memory and reasoning layer for companion robots.
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Any robot with internet access can become stateful in 10 minutes.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[20px] bg-[#F8FAFC] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base URL</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">https://api.kiro.dev/v1</p>
          </div>
          <div className="rounded-[20px] bg-[#F8FAFC] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Authentication</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">Authorization: Bearer YOUR_API_KEY</p>
            <p className="mt-3 text-sm text-slate-500">Contact team@kiro.dev to get your API key.</p>
          </div>
        </div>
      </section>

      {endpoints.map((endpoint) => (
        <section key={endpoint.path} className="dashboard-card overflow-hidden">
          <div className="border-b border-[#EEF2F7] px-8 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <MethodBadge method={endpoint.method} />
              <code className="text-sm font-semibold text-slate-900">{endpoint.path}</code>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">{endpoint.title}</h2>
            {endpoint.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{endpoint.description}</p>}
            {endpoint.note && (
              <div className="mt-4 rounded-2xl bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">{endpoint.note}</div>
            )}
          </div>

          <div className="space-y-6 px-8 py-6">
            {endpoint.request && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Request</p>
                <CodeBlock>{endpoint.request}</CodeBlock>
              </div>
            )}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Response</p>
              <CodeBlock>{endpoint.response}</CodeBlock>
            </div>
          </div>
        </section>
      ))}

      <section className="dashboard-card p-8">
        <h2 className="text-xl font-semibold text-slate-900">Error Responses</h2>
        <div className="mt-6 grid gap-4">
          {errors.map((errorBlock) => (
            <CodeBlock key={errorBlock}>{errorBlock}</CodeBlock>
          ))}
        </div>
      </section>
    </div>
  );
}
