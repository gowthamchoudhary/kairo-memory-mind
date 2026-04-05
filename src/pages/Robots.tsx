import { useState, useEffect, useCallback } from "react";
import { Bot, AlertTriangle, Send, Eye, FileText, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { initialRobots, randomizeSensors, Robot } from "@/lib/robotData";
import { supabase } from "@/integrations/supabase/client";

function timeSince(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} hours ago`;
}

function getStatusColor(status: Robot["status"]) {
  if (status === "active") return "text-success";
  if (status === "alert") return "text-warning";
  return "text-muted-foreground";
}

function getStatusBg(status: Robot["status"]) {
  if (status === "active") return "bg-success";
  if (status === "alert") return "bg-warning animate-alert-pulse";
  return "bg-muted-foreground";
}

export default function Robots() {
  const [robots, setRobots] = useState<Robot[]>(initialRobots);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [queryModal, setQueryModal] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);

  // Live sensor updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRobots((prev) => prev.map(randomizeSensors));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const alertRobot = robots.find((r) => r.status === "alert");

  const handleSendQuery = useCallback(async () => {
    if (!queryText.trim() || !queryModal) return;
    const robot = robots.find((r) => r.id === queryModal);
    if (!robot) return;

    setIsQuerying(true);
    try {
      const { data, error } = await supabase.functions.invoke("kiro-reason", {
        body: {
          robotId: robot.id,
          userId: robot.userId,
          userInput: queryText,
          sensors: robot.sensors,
          memoryEnabled,
        },
      });

      if (error) throw error;

      setRobots((prev) =>
        prev.map((r) =>
          r.id === robot.id
            ? {
                ...r,
                lastResponse: {
                  text: data.text,
                  confidence: data.confidence || 0.85,
                  action: data.alert_severity === "critical" ? "ALERT" : data.alert_severity === "high" ? "REST" : "MONITOR",
                },
                status: data.alert_caregiver ? "alert" : r.status,
                alertMessage: data.alert_caregiver ? data.alert_reason : r.alertMessage,
                totalQueries: r.totalQueries + 1,
              }
            : r
        )
      );

      if (data.audio) {
        try {
          const audioBytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
          const blob = new Blob([audioBytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await audio.play();
        } catch {}
      }

      setQueryModal(null);
      setQueryText("");
      toast({ title: "Query processed", description: data.text.slice(0, 80) + "..." });
    } catch (e: any) {
      toast({ title: "Query failed", description: e.message, variant: "destructive" });
    } finally {
      setIsQuerying(false);
    }
  }, [queryModal, queryText, robots, memoryEnabled]);

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {alertRobot && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning animate-alert-pulse" />
          <span className="text-sm font-medium text-foreground">
            1 Active Alert — {alertRobot.id} — {alertRobot.alertMessage}
          </span>
        </div>
      )}

      {/* Memory toggle */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">KIRO Memory Engine</h2>
          <p className="text-xs text-muted-foreground">
            {memoryEnabled ? "Full contextual response from memory" : "Generic stateless response"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${memoryEnabled ? "text-success" : "text-muted-foreground"}`}>
            {memoryEnabled ? "ON" : "OFF"}
          </span>
          <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
        </div>
      </div>

      {/* Robot grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {robots.map((robot) => (
          <div
            key={robot.id}
            className={`bg-card rounded-lg border shadow-sm ${
              robot.status === "alert" ? "border-warning/50" : "border-border"
            }`}
          >
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-semibold text-foreground">{robot.id}</span>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${getStatusColor(robot.status)}`}>
                  <span className={`w-2 h-2 rounded-full ${getStatusBg(robot.status)}`} />
                  {robot.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{robot.name}</p>
              {robot.status !== "offline" && (
                <p className="text-xs text-muted-foreground">
                  User: {robot.userName}, {robot.userAge} yrs
                </p>
              )}
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {robot.status === "offline" ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No sensor data available</p>
                  <p className="text-xs mt-1">Robot is not connected</p>
                </div>
              ) : (
                <>
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Last ping: {timeSince(robot.lastPing)}</span>
                    <span>Uptime: {robot.uptime}%</span>
                    <span>Queries: {robot.totalQueries}</span>
                  </div>

                  {/* Sensors */}
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Live Sensors</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <span>❤️ HR: <strong className={robot.sensors.heartRate > 110 ? "text-destructive" : "text-foreground"}>{robot.sensors.heartRate} bpm</strong></span>
                      <span>🌡️ Temp: <strong className={robot.sensors.temperature > 100 ? "text-warning" : "text-foreground"}>{robot.sensors.temperature}°F</strong></span>
                      <span>😴 Sleep: <strong className={robot.sensors.sleepHours < 5 ? "text-warning" : "text-foreground"}>{robot.sensors.sleepHours}h</strong></span>
                      <span>👣 Steps: <strong>{robot.sensors.steps}</strong></span>
                      <span>😐 Emotion: <strong>{robot.sensors.emotion}</strong></span>
                      <span>📍 {robot.sensors.location} &nbsp;{robot.sensors.weather === "Rainy" ? "🌧️" : robot.sensors.weather === "Cloudy" ? "☁️" : "☀️"} {robot.sensors.weather}</span>
                    </div>
                  </div>

                  {/* Response */}
                  {robot.lastResponse && (
                    <div className={`rounded-md p-3 text-xs ${robot.status === "alert" ? "bg-warning/5 border border-warning/20" : "bg-accent"}`}>
                      {robot.status === "alert" && (
                        <p className="text-warning font-semibold mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> CAREGIVER ALERT SENT
                        </p>
                      )}
                      <p className="text-foreground italic">"{robot.lastResponse.text}"</p>
                      <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                        <span>Confidence: {robot.lastResponse.confidence.toFixed(2)}</span>
                        <span>Action: {robot.lastResponse.action}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex gap-2">
              {robot.status === "offline" ? (
                <>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5"><RefreshCw className="w-3 h-3" />Reconnect</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5"><FileText className="w-3 h-3" />View Logs</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5"><Settings2 className="w-3 h-3" />Configure</Button>
                </>
              ) : (
                <>
                  <Button size="sm" className="text-xs gap-1.5" onClick={() => { setQueryModal(robot.id); setQueryText(""); }}>
                    <Send className="w-3 h-3" />Send Query
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                    <a href="/memory"><Eye className="w-3 h-3" />View Memory</a>
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <FileText className="w-3 h-3" />API Log
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Query modal */}
      <Dialog open={!!queryModal} onOpenChange={() => setQueryModal(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Send Query to {queryModal}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Type what the patient said or ask KIRO a question about this user.
            </p>
            <Input
              placeholder="e.g. I feel dizzy and didn't eat today"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendQuery()}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Memory:</span>
              <span className={memoryEnabled ? "text-success font-medium" : "text-muted-foreground"}>
                {memoryEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <Button onClick={handleSendQuery} disabled={isQuerying || !queryText.trim()} className="w-full">
              {isQuerying ? "Processing..." : "Send to KIRO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
