import { useState } from "react";
import { Heart, Moon, Activity, Brain, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const users = [
  { id: "rahul", name: "Rahul Sharma" },
  { id: "priya", name: "Priya Nair" },
  { id: "arjun", name: "Arjun Mehta" },
];

const memoryFeed: Record<string, Array<{ icon: string; label: string; time: string; text: string; confidence: number }>> = {
  rahul: [
    { icon: "❤️", label: "Heart Rate", time: "2 hours ago", text: "98 bpm — distressed emotion detected", confidence: 0.95 },
    { icon: "😴", label: "Sleep Pattern", time: "Yesterday", text: "4.2 hours — below healthy threshold", confidence: 0.99 },
    { icon: "🌧️", label: "Weather Exposure", time: "2 days ago", text: "Caught in rain, walked 40 mins", confidence: 0.88 },
    { icon: "🍽️", label: "Nutrition", time: "2 days ago", text: "Skipped breakfast, heavy dinner only", confidence: 0.92 },
  ],
  priya: [
    { icon: "❤️", label: "Heart Rate", time: "1 hour ago", text: "124 bpm — critical, nurse notified", confidence: 0.96 },
    { icon: "😴", label: "Sleep Pattern", time: "Today", text: "3.1 hours — post-surgery recovery", confidence: 0.98 },
    { icon: "🌡️", label: "Temperature", time: "3 hours ago", text: "101.3°F — elevated", confidence: 0.94 },
  ],
  arjun: [
    { icon: "❤️", label: "Heart Rate", time: "30 min ago", text: "74 bpm — normal range", confidence: 0.90 },
    { icon: "😴", label: "Sleep Pattern", time: "Today", text: "7.5 hours — healthy", confidence: 0.97 },
    { icon: "🏃", label: "Activity", time: "Today", text: "3,240 steps, 30 min exercise", confidence: 0.93 },
  ],
};

const patterns: Record<string, Array<{ label: string; desc: string; count: number; confidence: number }>> = {
  rahul: [
    { label: "HIGH CONFIDENCE", desc: "Low sleep + rain exposure → fatigue next morning", count: 4, confidence: 0.89 },
    { label: "MEDIUM CONFIDENCE", desc: "Skipped meals + stress → elevated heart rate", count: 2, confidence: 0.74 },
  ],
  priya: [
    { label: "HIGH CONFIDENCE", desc: "Heart rate above 115bpm → pain escalation", count: 3, confidence: 0.92 },
    { label: "MEDIUM CONFIDENCE", desc: "Poor sleep + low food → dizziness", count: 2, confidence: 0.78 },
  ],
  arjun: [
    { label: "HIGH CONFIDENCE", desc: "Consistent sleep >7h → stable heart rate", count: 5, confidence: 0.94 },
    { label: "MEDIUM CONFIDENCE", desc: "Regular exercise → positive mood + lower HR", count: 3, confidence: 0.82 },
  ],
};

const timelineData = [
  { day: "Mon", hr: 102, sleep: 4.0, steps: 150 },
  { day: "Tue", hr: 88, sleep: 3.5, steps: 890 },
  { day: "Wed", hr: 95, sleep: 5.0, steps: 1200 },
  { day: "Thu", hr: 98, sleep: 4.2, steps: 230 },
  { day: "Fri", hr: 72, sleep: 8.0, steps: 4200 },
  { day: "Sat", hr: 78, sleep: 7.0, steps: 3100 },
  { day: "Sun", hr: 98, sleep: 4.2, steps: 230 },
];

export default function Memory() {
  const [selectedUser, setSelectedUser] = useState("rahul");
  const [query, setQuery] = useState("");
  const [kiroResponse, setKiroResponse] = useState("");
  const [isAsking, setIsAsking] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setIsAsking(true);
    setKiroResponse("");
    try {
      const { data, error } = await supabase.functions.invoke("kiro-chat", {
        body: { userId: selectedUser, message: query },
      });
      if (error) throw error;
      setKiroResponse(data.text);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsAsking(false);
    }
  };

  const feed = memoryFeed[selectedUser] || [];
  const pats = patterns[selectedUser] || [];

  return (
    <div className="space-y-6">
      {/* User tabs */}
      <div className="flex gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => { setSelectedUser(u.id); setKiroResponse(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedUser === u.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — memory feed */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Raw Memory Feed</h2>
          {feed.map((m, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  {m.icon} {m.label}
                </span>
                <span className="text-xs text-muted-foreground">{m.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.text}</p>
              <p className="text-xs text-muted-foreground mt-1">Confidence: {m.confidence.toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Right — patterns */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Patterns Detected</h2>
          {pats.map((p, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 shadow-sm">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-2 ${
                p.label.includes("HIGH") ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
              }`}>
                ⚡ PATTERN — {p.label}
              </span>
              <p className="text-sm text-foreground">"{p.desc}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Observed: {p.count} times | Confidence: {p.confidence.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Health timeline */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Health Timeline (7 days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend />
            <Line type="monotone" dataKey="hr" stroke="hsl(var(--primary))" name="Heart Rate" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sleep" stroke="hsl(var(--success))" name="Sleep (h)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="steps" stroke="hsl(var(--warning))" name="Steps (÷10)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Query box */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">Ask KIRO about this user</h2>
        <div className="flex gap-2">
          <Input
            placeholder="What patterns indicate health decline?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          />
          <Button onClick={handleAsk} disabled={isAsking} className="gap-1.5">
            <Send className="w-4 h-4" />Ask KIRO
          </Button>
        </div>
        {kiroResponse && (
          <div className="mt-3 p-3 bg-accent rounded-lg text-sm text-foreground">
            <span className="text-xs text-muted-foreground block mb-1">KIRO:</span>
            {kiroResponse}
          </div>
        )}
      </div>
    </div>
  );
}
