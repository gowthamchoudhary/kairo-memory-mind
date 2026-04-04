const endpoints = [
  {
    method: "POST",
    path: "/v1/ingest",
    desc: "Ingest sensor data from a robot. Converts to natural language and stores in memory.",
    body: `{
  "robotId": "KIRO-ELDER-001",
  "userId": "rahul",
  "sensors": {
    "heartRate": 98,
    "temperature": 99.1,
    "sleepHours": 4.2,
    "steps": 230,
    "emotion": "Distressed",
    "location": "Bedroom",
    "weather": "Rainy"
  }
}`,
    response: `{
  "status": "ingested",
  "memory_id": "mem_a1b2c3d4"
}`,
  },
  {
    method: "POST",
    path: "/v1/reason",
    desc: "Send a query about a user. KIRO recalls memories, reasons causally, and returns a response with optional TTS.",
    body: `{
  "robotId": "KIRO-ELDER-001",
  "userId": "rahul",
  "userInput": "Patient says he feels dizzy",
  "sensors": { ... },
  "memoryEnabled": true
}`,
    response: `{
  "text": "Based on 3 nights of poor sleep...",
  "confidence": 0.91,
  "action": "REST",
  "alert_caregiver": false,
  "audio": "base64-encoded-mp3..."
}`,
  },
  {
    method: "GET",
    path: "/v1/patterns/:userId",
    desc: "Retrieve detected patterns for a specific user from the memory engine.",
    body: null,
    response: `{
  "patterns": [
    {
      "description": "Low sleep + rain → fatigue",
      "confidence": 0.89,
      "occurrences": 4
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/health",
    desc: "Health check endpoint. Returns service status.",
    body: null,
    response: `{
  "status": "ok",
  "version": "1.0.0",
  "memory": "connected",
  "ai": "connected"
}`,
  },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-success/10 text-success",
    POST: "bg-primary/10 text-primary",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${colors[method] || "bg-muted text-muted-foreground"}`}>
      {method}
    </span>
  );
}

export default function ApiDocs() {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">KIRO API Reference</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The KIRO API lets you interact with the robot fleet, ingest sensor data, and query the memory-driven reasoning engine.
        </p>
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm space-y-3">
          <div>
            <span className="text-xs text-muted-foreground">Base URL</span>
            <div className="code-block mt-1">https://api.kiro.dev/v1</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Authentication</span>
            <div className="code-block mt-1">Authorization: Bearer YOUR_API_KEY</div>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      {endpoints.map((ep, i) => (
        <div key={i} className="bg-card rounded-lg border border-border shadow-sm">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 mb-2">
              <MethodBadge method={ep.method} />
              <code className="text-sm font-mono font-semibold text-foreground">{ep.path}</code>
            </div>
            <p className="text-sm text-muted-foreground">{ep.desc}</p>
          </div>
          <div className="p-4 space-y-4">
            {ep.body && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request Body</span>
                <pre className="code-block mt-2 text-xs">{ep.body}</pre>
              </div>
            )}
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
              <pre className="code-block mt-2 text-xs">{ep.response}</pre>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">cURL Example</span>
              <pre className="code-block mt-2 text-xs whitespace-pre-wrap">{`curl -X ${ep.method} https://api.kiro.dev${ep.path} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"${ep.body ? ` \\
  -d '${ep.body.replace(/\n/g, "").replace(/\s+/g, " ")}'` : ""}`}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
