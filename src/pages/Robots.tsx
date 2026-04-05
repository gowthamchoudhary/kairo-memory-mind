import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  DatabaseZap,
  Eye,
  FileText,
  Footprints,
  HeartPulse,
  MapPin,
  MessageSquareText,
  MoonStar,
  RefreshCw,
  Send,
  Smile,
  Thermometer,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { initialRobots, randomizeSensors, Robot } from "@/lib/robotData";
import { supabase } from "@/integrations/supabase/client";

function timeSince(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} hr ago`;
}

function statusStyles(status: Robot["status"]) {
  if (status === "active") return { text: "text-[#16A34A]", dot: "bg-[#16A34A]" };
  if (status === "alert") return { text: "text-[#D97706]", dot: "bg-[#D97706]" };
  return { text: "text-slate-400", dot: "bg-slate-300" };
}

const sensorMeta = [
  { key: "heartRate", label: "Heart rate", icon: HeartPulse },
  { key: "temperature", label: "Temperature", icon: Thermometer },
  { key: "sleepHours", label: "Sleep", icon: MoonStar },
  { key: "steps", label: "Steps", icon: Footprints },
  { key: "emotion", label: "Emotion", icon: Smile },
] as const;

export default function Robots() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [robots, setRobots] = useState<Robot[]>(initialRobots);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [queryModal, setQueryModal] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryMode, setQueryMode] = useState<"talking" | "symptoms">("talking");
  const [isQuerying, setIsQuerying] = useState(false);
  const [memoryStoredNotice, setMemoryStoredNotice] = useState<{ robotId: string; user: string; kiro: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importRobotId, setImportRobotId] = useState(initialRobots.find((robot) => robot.status !== "offline")?.id ?? "");
  const [importPayload, setImportPayload] = useState(
    JSON.stringify(
      {
        heart_rate: 98,
        temperature: 99.1,
        sleep_hours: 4.2,
        steps_today: 230,
        voice_emotion: "distressed",
        location: "bedroom",
        weather: "rainy",
      },
      null,
      2,
    ),
  );
  const [importNote, setImportNote] = useState("I don't feel well");

  useEffect(() => {
    const interval = setInterval(() => {
      setRobots((prev) => prev.map(randomizeSensors));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;

    const defaultRobot = robots.find((robot) => robot.status !== "offline");
    if (action === "query" && defaultRobot) {
      setQueryModal(defaultRobot.id);
      setQueryText("");
      setQueryMode("talking");
    }

    if (action === "import") {
      if (defaultRobot) {
        setImportRobotId(defaultRobot.id);
      }
      setImportModalOpen(true);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    setSearchParams(nextParams, { replace: true });
  }, [robots, searchParams, setSearchParams]);

  const alertRobot = robots.find((robot) => robot.status === "alert");
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const importRobot = useMemo(
    () => robots.find((robot) => robot.id === importRobotId && robot.status !== "offline") ?? null,
    [importRobotId, robots],
  );
  const filteredRobots = useMemo(() => {
    if (!searchQuery) return robots;
    return robots.filter((robot) =>
      [
        robot.id,
        robot.name,
        robot.type,
        robot.userId,
        robot.userName,
        robot.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery),
    );
  }, [robots, searchQuery]);

  const handleSendQuery = useCallback(async () => {
    if (!queryText.trim() || !queryModal) return;
    const robot = robots.find((item) => item.id === queryModal);
    if (!robot) return;

    setIsQuerying(true);
    try {
      let data: any;

      if (queryMode === "talking") {
        const res = await supabase.functions.invoke("kiro-converse", {
          body: {
            robotId: robot.id,
            userId: robot.userId,
            message: queryText,
            memoryEnabled,
          },
        });
        if (res.error) throw res.error;
        data = res.data;
      } else {
        const res = await supabase.functions.invoke("kiro-reason", {
          body: {
            robotId: robot.id,
            userId: robot.userId,
            userInput: queryText,
            sensors: robot.sensors,
            memoryEnabled,
          },
        });
        if (res.error) throw res.error;
        data = res.data;
      }

      setRobots((prev) =>
        prev.map((item) =>
          item.id === robot.id
            ? {
                ...item,
                lastResponse: {
                  text: data.response_text || data.text,
                  confidence: data.confidence || 0.85,
                  action:
                    data.alert_severity === "critical"
                      ? "ALERT"
                      : data.alert_severity === "high"
                        ? "REST"
                        : "MONITOR",
                  gatewaysUsed: data.gateways_used,
                },
                status: data.alert_caregiver ? "alert" : item.status,
                alertMessage: data.alert_caregiver ? data.alert_reason : item.alertMessage,
                totalQueries: item.totalQueries + 1,
              }
            : item,
        ),
      );

      setMemoryStoredNotice({
        robotId: robot.id,
        user: queryText,
        kiro: data.response_text || data.text,
      });
      window.setTimeout(() => {
        setMemoryStoredNotice((current) => (current?.robotId === robot.id ? null : current));
      }, 3000);

      const audioPayload = data.audio_base64 || data.audio;
      if (audioPayload) {
        try {
          const audioBytes = Uint8Array.from(atob(audioPayload), (char) => char.charCodeAt(0));
          const blob = new Blob([audioBytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await audio.play();
        } catch {
          // Audio playback is best-effort.
        }
      }

      setQueryModal(null);
      setQueryText("");
      toast({ title: "Query processed", description: `${(data.response_text || data.text).slice(0, 80)}...` });
    } catch (e: any) {
      toast({ title: "Query failed", description: e.message, variant: "destructive" });
    } finally {
      setIsQuerying(false);
    }
  }, [memoryEnabled, queryModal, queryMode, queryText, robots]);

  const handleImport = useCallback(async () => {
    if (!importRobot) return;

    let parsedSensors: Record<string, unknown>;
    try {
      parsedSensors = JSON.parse(importPayload);
    } catch {
      toast({ title: "Invalid JSON", description: "Paste valid sensor JSON before importing.", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const res = await supabase.functions.invoke("kiro-ingest", {
        body: {
          robotId: importRobot.id,
          userId: importRobot.userId,
          sensors: parsedSensors,
          userInput: importNote.trim() || undefined,
        },
      });
      if (res.error) throw res.error;

      setRobots((prev) =>
        prev.map((robot) =>
          robot.id === importRobot.id
            ? {
                ...robot,
                sensors: {
                  heartRate: Number(parsedSensors.heart_rate ?? parsedSensors.heartRate ?? robot.sensors.heartRate),
                  temperature: Number(parsedSensors.temperature ?? robot.sensors.temperature),
                  sleepHours: Number(parsedSensors.sleep_hours ?? parsedSensors.sleepHours ?? robot.sensors.sleepHours),
                  steps: Number(parsedSensors.steps_today ?? parsedSensors.steps ?? robot.sensors.steps),
                  emotion: String(parsedSensors.voice_emotion ?? parsedSensors.emotion ?? robot.sensors.emotion),
                  location: String(parsedSensors.location ?? robot.sensors.location),
                  weather: String(parsedSensors.weather ?? robot.sensors.weather),
                },
                lastPing: Date.now(),
              }
            : robot,
        ),
      );

      setImportModalOpen(false);
      toast({
        title: "Robot data imported",
        description: `${importRobot.id} stored event ${res.data?.event_id || "successfully"} in memory.`,
      });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }, [importNote, importPayload, importRobot]);

  const modalRobot = robots.find((robot) => robot.id === queryModal);

  return (
    <div className="space-y-6">
      {alertRobot && (
        <section className="flex items-center gap-3 rounded-2xl border border-[#F3E8D5] bg-[#FCF5EA] px-5 py-4 text-sm text-slate-700 shadow-[0_4px_14px_rgba(148,163,184,0.08)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#D97706]">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <p className="font-medium">
            1 Active Alert — {alertRobot.id} — {alertRobot.alertMessage}
          </p>
        </section>
      )}

      <section className="dashboard-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">KIRO Memory Engine</h2>
            <p className="mt-1 text-sm text-slate-500">
              {memoryEnabled ? "Context-aware reasoning is enabled across live robot interactions" : "Stateless mode is active"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-semibold ${memoryEnabled ? "text-[#16A34A]" : "text-slate-400"}`}>
              {memoryEnabled ? "ON" : "OFF"}
            </span>
            <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {filteredRobots.map((robot) => {
          const styles = statusStyles(robot.status);

          return (
            <article
              key={robot.id}
              className={`dashboard-card dashboard-hover-card overflow-hidden ${
                robot.status === "alert" ? "border-[#FDE7C7]" : ""
              }`}
            >
              <div className="border-b border-[#EEF2F7] px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F8FAFC] text-slate-500">
                        {robot.status === "offline" ? (
                          <WifiOff className="h-[18px] w-[18px]" strokeWidth={1.9} />
                        ) : (
                          <Bot className="h-[18px] w-[18px]" strokeWidth={1.9} />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{robot.id}</h3>
                        <p className="mt-1 text-sm text-slate-500">{robot.name}</p>
                      </div>
                    </div>
                    {robot.status !== "offline" && (
                      <p className="mt-4 text-sm text-slate-600">
                        {robot.userName}, {robot.userAge}
                      </p>
                    )}
                  </div>

                  <div className={`inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold ${styles.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot} ${robot.status === "alert" ? "animate-alert-pulse" : ""}`} />
                    {robot.status.toUpperCase()}
                  </div>
                </div>

                {robot.status !== "offline" && (
                  <div className="mt-5 grid gap-4 text-sm text-slate-500 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Last ping</p>
                      <p className="mt-2 font-medium text-slate-700">{timeSince(robot.lastPing)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Uptime</p>
                      <p className="mt-2 font-medium text-slate-700">{robot.uptime}%</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Queries</p>
                      <p className="mt-2 font-medium text-slate-700">{robot.totalQueries}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-5 px-6 py-6">
                {robot.status === "offline" ? (
                  <div className="rounded-[20px] border border-dashed border-[#E5E7EB] bg-[#FBFCFE] px-6 py-10 text-center">
                    <p className="text-sm font-medium text-slate-700">No live sensor data available</p>
                    <p className="mt-2 text-sm text-slate-500">This robot is currently offline and waiting for reconnection.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live sensors</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} />
                          {robot.sensors.location}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        {sensorMeta.map((item) => {
                          const Icon = item.icon;
                          let value = "";

                          if (item.key === "heartRate") value = `${robot.sensors.heartRate} bpm`;
                          if (item.key === "temperature") value = `${robot.sensors.temperature}°F`;
                          if (item.key === "sleepHours") value = `${robot.sensors.sleepHours}h`;
                          if (item.key === "steps") value = `${robot.sensors.steps}`;
                          if (item.key === "emotion") value = robot.sensors.emotion;

                          return (
                            <div key={item.key} className="rounded-[20px] bg-[#F8FAFC] px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {robot.lastResponse && (
                      <div className="rounded-[20px] bg-[#F8FAFC] p-4">
                        {robot.status === "alert" && (
                          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold text-[#B45309]">
                            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.9} />
                            CAREGIVER ALERT SENT
                          </div>
                        )}
                        <p className="text-sm italic leading-6 text-slate-700">"{robot.lastResponse.text}"</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="dashboard-pill">Confidence {robot.lastResponse.confidence.toFixed(2)}</span>
                          <span className="dashboard-pill">Action {robot.lastResponse.action}</span>
                          <span className="dashboard-pill">{robot.sensors.weather}</span>
                        </div>
                        {robot.lastResponse.gatewaysUsed && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              KIRO responded using
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {robot.lastResponse.gatewaysUsed.companion && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#F3E8FF] px-3 py-1 text-xs font-medium text-[#7C3AED]">
                                  <span aria-hidden="true">Memory</span>
                                  Companion Memory
                                </span>
                              )}
                              {robot.lastResponse.gatewaysUsed.health && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#2563EB]">
                                  <span aria-hidden="true">Health</span>
                                  Health Memory
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {memoryStoredNotice?.robotId === robot.id && (
                          <div className="mt-4 rounded-[18px] border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-sm text-[#166534]">
                            <p className="font-semibold">✓ Memory stored</p>
                            <p className="mt-2 truncate">User: "{memoryStoredNotice.user}"</p>
                            <p className="mt-1 truncate">KIRO: "{memoryStoredNotice.kiro}"</p>
                            <p className="mt-1 text-xs text-[#15803D]">Saved to HydraDB as conversation pair</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap gap-3">
                  {robot.status === "offline" ? (
                    <>
                      <button type="button" className="dashboard-secondary-button">
                        <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
                        Reconnect
                      </button>
                      <button type="button" className="dashboard-secondary-button">
                        <FileText className="h-4 w-4" strokeWidth={1.9} />
                        View Logs
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="dashboard-primary-button"
                        onClick={() => {
                          setQueryModal(robot.id);
                          setQueryText("");
                          setQueryMode("talking");
                        }}
                      >
                        <Send className="h-4 w-4" strokeWidth={1.9} />
                        Send Query
                      </button>
                      <Link to="/memory" className="dashboard-secondary-button">
                        <Eye className="h-4 w-4" strokeWidth={1.9} />
                        View Memory
                      </Link>
                      <button
                        type="button"
                        className="dashboard-secondary-button"
                        onClick={() => {
                          setImportRobotId(robot.id);
                          setImportModalOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" strokeWidth={1.9} />
                        Import Data
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {filteredRobots.length === 0 && (
        <section className="dashboard-card px-6 py-12 text-center">
          <p className="text-base font-semibold text-slate-900">No robots matched your search</p>
          <p className="mt-2 text-sm text-slate-500">
            Try searching by robot ID, user name, unit type, or status.
          </p>
        </section>
      )}

      <Dialog open={!!queryModal} onOpenChange={() => setQueryModal(null)}>
        <DialogContent className="max-w-xl rounded-[24px] border border-[#EEF2F7] bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
          <DialogHeader className="border-b border-[#EEF2F7] px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-base font-semibold text-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                <MessageSquareText className="h-5 w-5" strokeWidth={1.9} />
              </div>
              Talk to KIRO — {queryModal}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-[20px] bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-slate-900">{modalRobot ? modalRobot.userName : "User input"}</p>
              <p className="mt-1 text-sm text-slate-500">Choose whether this is general conversation or symptom reporting.</p>
            </div>

            <Textarea
              placeholder={
                queryMode === "talking"
                  ? "My daughter called today, it was nice to hear from her"
                  : "I feel dizzy and I did not eat well today"
              }
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={5}
              className="min-h-[140px] rounded-[20px] border-[#E5E7EB] bg-[#FBFCFE] px-4 py-3 text-sm shadow-none focus-visible:ring-[#2563EB]"
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setQueryMode("talking")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  queryMode === "talking" ? "bg-[#2563EB] text-white" : "bg-[#F3F4F6] text-slate-600"
                }`}
              >
                Just talking
              </button>
              <button
                type="button"
                onClick={() => setQueryMode("symptoms")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  queryMode === "symptoms" ? "bg-[#2563EB] text-white" : "bg-[#F3F4F6] text-slate-600"
                }`}
              >
                Reporting symptoms
              </button>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Pipeline: {queryMode === "talking" ? "Conversation -> Memory -> Respond" : "Sensors + Conversation -> Reason -> Respond"}
              </span>
              <span className={memoryEnabled ? "font-semibold text-[#16A34A]" : ""}>
                Memory {memoryEnabled ? "ON" : "OFF"}
              </span>
            </div>

            <Button
              onClick={handleSendQuery}
              disabled={isQuerying || !queryText.trim()}
              className="h-12 rounded-full bg-[#111827] text-sm font-medium text-white hover:bg-[#111827]/95"
            >
              {isQuerying ? "Processing..." : "Send to KIRO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-2xl rounded-[24px] border border-[#EEF2F7] bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
          <DialogHeader className="border-b border-[#EEF2F7] px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-base font-semibold text-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                <DatabaseZap className="h-5 w-5" strokeWidth={1.9} />
              </div>
              Import Robot Data
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Robot</label>
                <Select value={importRobotId} onValueChange={setImportRobotId}>
                  <SelectTrigger className="h-12 rounded-[18px] border-[#E5E7EB] bg-[#FBFCFE] px-4 text-sm shadow-none focus:ring-[#2563EB]">
                    <SelectValue placeholder="Choose a robot" />
                  </SelectTrigger>
                  <SelectContent>
                    {robots
                      .filter((robot) => robot.status !== "offline")
                      .map((robot) => (
                        <SelectItem key={robot.id} value={robot.id}>
                          {robot.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Context note</label>
                <Input
                  value={importNote}
                  onChange={(event) => setImportNote(event.target.value)}
                  className="h-12 rounded-[18px] border-[#E5E7EB] bg-[#FBFCFE] px-4 shadow-none focus-visible:ring-[#2563EB]"
                  placeholder="Optional user note for this sensor event"
                />
              </div>
            </div>

            <div className="rounded-[20px] bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-slate-900">{importRobot?.userName || "Robot import"}</p>
              <p className="mt-1 text-sm text-slate-500">
                Paste live sensor JSON to send a real ingest event through the backend memory pipeline.
              </p>
            </div>

            <Textarea
              value={importPayload}
              onChange={(event) => setImportPayload(event.target.value)}
              rows={12}
              className="min-h-[280px] rounded-[20px] border-[#E5E7EB] bg-[#FBFCFE] px-4 py-3 font-mono text-sm shadow-none focus-visible:ring-[#2563EB]"
            />

            <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
              <span>Endpoint: kiro-ingest</span>
              <span>{importRobot ? `${importRobot.id} -> ${importRobot.userId}` : "Select a robot"}</span>
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting || !importRobot}
              className="h-12 rounded-full bg-[#111827] text-sm font-medium text-white hover:bg-[#111827]/95"
            >
              {isImporting ? "Importing..." : "Import into KIRO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
