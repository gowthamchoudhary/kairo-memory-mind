import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Maximize2, Send, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ForceGraph2D from "react-force-graph-2d";

const users = [
  { id: "rahul", backendId: "rahul-sharma-v2", name: "Rahul Sharma" },
  { id: "priya", backendId: "priya-nair-v2", name: "Priya Nair" },
  { id: "arjun", backendId: "arjun-mehta-v2", name: "Arjun Mehta" },
];

type NodeType = "health_report" | "pattern" | "critical_alert" | "companion_event";

interface GraphNode {
  id: string;
  label: string;
  episode: string;
  episodeTitle: string;
  type: NodeType;
  state: "stable" | "deteriorating" | "improving";
  confidence: number;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

type GraphFilter = "all" | "health" | "patterns";

const graphDataByUser: Record<string, { nodes: GraphNode[]; links: GraphLink[] }> = {
  rahul: {
    nodes: [
      { id: "SEM_rahul_001", label: "Teacher", episode: "SEM_rahul_identity", episodeTitle: "Who Rahul Is", type: "companion_event", state: "stable", confidence: 0.96 },
      { id: "SEM_rahul_002", label: "Cricket", episode: "SEM_rahul_identity", episodeTitle: "Who Rahul Is", type: "companion_event", state: "stable", confidence: 0.94 },
      { id: "SEM_rahul_003", label: "Priya bond", episode: "SEM_rahul_family", episodeTitle: "Family Connections", type: "companion_event", state: "improving", confidence: 0.97 },
      { id: "SEM_rahul_004", label: "Aryan worry", episode: "SEM_rahul_family", episodeTitle: "Family Connections", type: "companion_event", state: "deteriorating", confidence: 0.88 },
      { id: "SEM_rahul_005", label: "Suresh chess", episode: "SEM_rahul_social", episodeTitle: "Weekly Social Rituals", type: "companion_event", state: "stable", confidence: 0.9 },
      { id: "EVT_rahul_010", label: "Diwali visit", episode: "EP_rahul_010", episodeTitle: "Priya's Diwali Visit", type: "companion_event", state: "improving", confidence: 0.93 },
      { id: "EVT_rahul_011", label: "Aryan called", episode: "EP_rahul_011", episodeTitle: "Family Relief Call", type: "companion_event", state: "stable", confidence: 0.87 },
      { id: "EVT_rahul_012", label: "Wedding", episode: "EP_rahul_012", episodeTitle: "Former Student Wedding", type: "companion_event", state: "stable", confidence: 0.85 },
      { id: "EVT_rahul_013", label: "Suresh won", episode: "EP_rahul_013", episodeTitle: "Chess Rivalry", type: "companion_event", state: "stable", confidence: 0.82 },
      { id: "EVT_rahul_014", label: "India won", episode: "EP_rahul_014", episodeTitle: "Cricket Celebration", type: "companion_event", state: "improving", confidence: 0.89 },
      { id: "EVT_rahul_015", label: "Priya maybe April", episode: "EP_rahul_015", episodeTitle: "Upcoming Priya Visit", type: "companion_event", state: "improving", confidence: 0.9 },
      { id: "EVT_rahul_016", label: "Rainy no walks", episode: "EP_rahul_016", episodeTitle: "Missed Evening Walks", type: "companion_event", state: "deteriorating", confidence: 0.86 },
      { id: "EVT_rahul_017", label: "Visit confirmed", episode: "EP_rahul_017", episodeTitle: "Priya Visit Confirmed", type: "companion_event", state: "improving", confidence: 0.95 },
      { id: "HEA_rahul_001", label: "HR 102", episode: "EP_rahul_health_01", episodeTitle: "Rain + Low Sleep Episode", type: "health_report", state: "deteriorating", confidence: 0.95 },
      { id: "HEA_rahul_002", label: "3 coffees", episode: "EP_rahul_health_02", episodeTitle: "Stress Intake Pattern", type: "health_report", state: "deteriorating", confidence: 0.84 },
      { id: "HEA_rahul_003", label: "HR 76", episode: "EP_rahul_health_03", episodeTitle: "Recovery After Priya Call", type: "health_report", state: "improving", confidence: 0.92 },
      { id: "HEA_rahul_004", label: "Rain fatigue", episode: "EP_rahul_health_04", episodeTitle: "Rain Exposure Repeat", type: "health_report", state: "deteriorating", confidence: 0.88 },
      { id: "PAT_rahul_001", label: "Rain + sleep", episode: "PAT_rahul_001", episodeTitle: "Fatigue Pattern", type: "pattern", state: "stable", confidence: 0.89 },
      { id: "PAT_rahul_002", label: "Meals + stress", episode: "PAT_rahul_002", episodeTitle: "Stress Pattern", type: "pattern", state: "stable", confidence: 0.84 },
      { id: "PAT_rahul_003", label: "Priya lifts mood", episode: "PAT_rahul_003", episodeTitle: "Priya Recovery Pattern", type: "pattern", state: "improving", confidence: 0.91 },
    ],
    links: [
      { source: "SEM_rahul_003", target: "EVT_rahul_010", relation: "grounded_in" },
      { source: "SEM_rahul_003", target: "EVT_rahul_015", relation: "anticipates" },
      { source: "EVT_rahul_015", target: "EVT_rahul_017", relation: "confirmed_as" },
      { source: "EVT_rahul_017", target: "PAT_rahul_003", relation: "supports" },
      { source: "HEA_rahul_003", target: "PAT_rahul_003", relation: "caused_by" },
      { source: "SEM_rahul_002", target: "EVT_rahul_014", relation: "inspires" },
      { source: "SEM_rahul_005", target: "EVT_rahul_013", relation: "linked_to" },
      { source: "EVT_rahul_016", target: "PAT_rahul_001", relation: "supports" },
      { source: "HEA_rahul_001", target: "PAT_rahul_001", relation: "supports" },
      { source: "HEA_rahul_004", target: "PAT_rahul_001", relation: "recurs_as" },
      { source: "HEA_rahul_002", target: "PAT_rahul_002", relation: "supports" },
      { source: "SEM_rahul_004", target: "HEA_rahul_002", relation: "contributes_to" },
      { source: "SEM_rahul_003", target: "HEA_rahul_003", relation: "improves" },
      { source: "EVT_rahul_011", target: "SEM_rahul_004", relation: "relates_to" },
      { source: "EVT_rahul_012", target: "SEM_rahul_001", relation: "reinforces" },
    ],
  },
  priya: {
    nodes: [
      { id: "EVT_priya_001", label: "HR 118", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "critical_alert", state: "deteriorating", confidence: 0.96 },
      { id: "EVT_priya_002", label: "Skipped dinner", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "health_report", state: "deteriorating", confidence: 0.94 },
      { id: "EVT_priya_003", label: "HR 124", episode: "EP_priya_002", episodeTitle: "Dizziness Episode", type: "critical_alert", state: "deteriorating", confidence: 0.98 },
      { id: "EVT_priya_P1", label: "HR > 115", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "pattern", state: "stable", confidence: 0.92 },
      { id: "EVT_priya_P2", label: "Sleep + Food", episode: "EP_priya_002", episodeTitle: "Dizziness Episode", type: "pattern", state: "stable", confidence: 0.78 },
    ],
    links: [
      { source: "EVT_priya_001", target: "EVT_priya_002", relation: "follows" },
      { source: "EVT_priya_001", target: "EVT_priya_003", relation: "escalation" },
      { source: "EVT_priya_002", target: "EVT_priya_P2", relation: "caused_by" },
      { source: "EVT_priya_003", target: "EVT_priya_P2", relation: "caused_by" },
    ],
  },
  arjun: {
    nodes: [
      { id: "EVT_arjun_001", label: "Sleep 7.5h", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "health_report", state: "stable", confidence: 0.90 },
      { id: "EVT_arjun_002", label: "Healthy meals", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "health_report", state: "stable", confidence: 0.93 },
      { id: "EVT_arjun_003", label: "Exercise 30min", episode: "EP_arjun_002", episodeTitle: "Exercise Recovery", type: "health_report", state: "improving", confidence: 0.91 },
      { id: "EVT_arjun_P1", label: "Sleep > 7h", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "pattern", state: "stable", confidence: 0.94 },
      { id: "EVT_arjun_P2", label: "Exercise -> Mood", episode: "EP_arjun_002", episodeTitle: "Exercise Recovery", type: "pattern", state: "stable", confidence: 0.82 },
    ],
    links: [
      { source: "EVT_arjun_001", target: "EVT_arjun_002", relation: "follows" },
      { source: "EVT_arjun_001", target: "EVT_arjun_P1", relation: "caused_by" },
      { source: "EVT_arjun_003", target: "EVT_arjun_P2", relation: "caused_by" },
    ],
  },
};

const memoryFeed: Record<string, Array<{ label: string; time: string; text: string; confidence: number; eventId: string }>> = {
  rahul: [
    { label: "Priya visit", time: "This week", text: "Priya confirmed her visit next week. Rahul asked Meena to cook her favorite dishes.", confidence: 0.95, eventId: "EVT_rahul_017" },
    { label: "Heart rate", time: "4 days ago", text: "102 bpm after 4 hours of sleep and rain exposure.", confidence: 0.95, eventId: "HEA_rahul_001" },
    { label: "Recovery day", time: "3 days ago", text: "After Priya called, Rahul slept 8 hours and heart rate normalized to 76 bpm.", confidence: 0.92, eventId: "HEA_rahul_003" },
  ],
  priya: [
    { label: "Heart rate", time: "1 hour ago", text: "124 bpm — critical, nurse notified", confidence: 0.96, eventId: "EVT_priya_001" },
    { label: "Sleep pattern", time: "Today", text: "3.1 hours — post-surgery recovery", confidence: 0.98, eventId: "EVT_priya_003" },
    { label: "Temperature", time: "3 hours ago", text: "101.3°F — elevated", confidence: 0.94, eventId: "EVT_priya_002" },
  ],
  arjun: [
    { label: "Heart rate", time: "30 min ago", text: "74 bpm — normal range", confidence: 0.90, eventId: "EVT_arjun_001" },
    { label: "Sleep pattern", time: "Today", text: "7.5 hours — healthy", confidence: 0.97, eventId: "EVT_arjun_002" },
    { label: "Activity", time: "Today", text: "3,240 steps, 30 min exercise", confidence: 0.93, eventId: "EVT_arjun_003" },
  ],
};

const patterns: Record<string, Array<{ label: string; desc: string; count: number; confidence: number }>> = {
  rahul: [
    { label: "HIGH CONFIDENCE", desc: "Fatigue appears when sleep drops below 5 hours and rain exposure happens the same day.", count: 4, confidence: 0.89 },
    { label: "HIGH CONFIDENCE", desc: "Priya calling or visiting measurably improves Rahul's mood and next-day recovery.", count: 3, confidence: 0.91 },
    { label: "MEDIUM CONFIDENCE", desc: "Stress and skipped meals tend to push heart rate above Rahul's normal baseline.", count: 2, confidence: 0.84 },
  ],
  priya: [
    { label: "HIGH CONFIDENCE", desc: "Heart rate above 115 bpm -> pain escalation", count: 3, confidence: 0.92 },
    { label: "MEDIUM CONFIDENCE", desc: "Poor sleep + low food -> dizziness", count: 2, confidence: 0.78 },
  ],
  arjun: [
    { label: "HIGH CONFIDENCE", desc: "Consistent sleep > 7h -> stable heart rate", count: 5, confidence: 0.94 },
    { label: "MEDIUM CONFIDENCE", desc: "Regular exercise -> positive mood + lower HR", count: 3, confidence: 0.82 },
  ],
};

function getNodeColor(node: GraphNode): string {
  if (node.type === "critical_alert") return "#DC2626";
  if (node.type === "pattern") return "#8B5CF6";
  if (node.type === "companion_event") return "#2563EB";
  if (node.state === "deteriorating") return "#F59E0B";
  if (node.state === "improving") return "#16A34A";
  return "#2563EB";
}

function getNodeSize(node: GraphNode): number {
  if (node.type === "critical_alert") return 9;
  if (node.type === "pattern") return 8;
  if (node.type === "companion_event") return 7.5;
  return 7;
}

function shouldShowNode(node: GraphNode, filter: GraphFilter): boolean {
  if (filter === "all") return true;
  if (filter === "health") return node.type === "health_report" || node.type === "critical_alert";
  return node.type === "pattern";
}

export default function Memory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUser, setSelectedUser] = useState("rahul");
  const [query, setQuery] = useState("");
  const [kiroResponse, setKiroResponse] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [graphFilter, setGraphFilter] = useState<GraphFilter>("all");
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 420 });
  const [graphVersion, setGraphVersion] = useState(0);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: graphExpanded ? 520 : 420 });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [graphExpanded]);

  useEffect(() => {
    if (searchParams.get("action") === "ask") {
      queryInputRef.current?.focus();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setIsAsking(true);
    setKiroResponse("");
    try {
      const { data, error } = await supabase.functions.invoke("kiro-chat", {
        body: { userId: users.find((user) => user.id === selectedUser)?.backendId || selectedUser, message: query },
      });
      if (error) throw error;
      setKiroResponse(data.text);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsAsking(false);
    }
  };

  const graphData = graphDataByUser[selectedUser] || { nodes: [], links: [] };
  const feed = memoryFeed[selectedUser] || [];
  const pats = patterns[selectedUser] || [];
  const filteredNodes = useMemo(
    () => graphData.nodes.filter((node) => shouldShowNode(node, graphFilter)),
    [graphData.nodes, graphFilter],
  );
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredLinks = useMemo(
    () => graphData.links.filter((link) => filteredNodeIds.has(String(link.source)) && filteredNodeIds.has(String(link.target))),
    [graphData.links, filteredNodeIds],
  );
  const episodes = [...new Set(filteredNodes.map((node) => node.episodeTitle))];

  useEffect(() => {
    setGraphVersion((value) => value + 1);
    setHoveredNode(null);
  }, [selectedUser, graphFilter]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode & { x: number; y: number };
    const size = getNodeSize(graphNode);
    const color = getNodeColor(graphNode);

    ctx.beginPath();
    ctx.arc(graphNode.x, graphNode.y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(graphNode.x, graphNode.y, size + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `${color}20`;
    ctx.lineWidth = 3;
    ctx.stroke();

    if (globalScale > 0.8) {
      ctx.font = `${Math.max(10 / globalScale, 5)}px Inter, sans-serif`;
      ctx.fillStyle = "#0F172A";
      ctx.textAlign = "center";
      ctx.fillText(graphNode.label, graphNode.x, graphNode.y + size + 12 / globalScale);
    }
  }, []);

  const filters: { key: GraphFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "health", label: "Health" },
    { key: "patterns", label: "Patterns" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => {
              setSelectedUser(user.id);
              setKiroResponse("");
            }}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              selectedUser === user.id
                ? "bg-[#2563EB] text-white shadow-[0_12px_20px_-12px_rgba(37,99,235,0.55)]"
                : "border border-[#E5E7EB] bg-white text-slate-500 hover:text-slate-900"
            }`}
          >
            {user.name}
          </button>
        ))}
      </div>

      <section className="dashboard-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#EEF2F7] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Episodic Memory Graph</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredNodes.length} visible memories across {episodes.length} clusters • Layout locks after loading
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="dashboard-secondary-button px-3" onClick={() => graphRef.current?.zoomToFit(300, 48)}>
              <ZoomIn className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <button type="button" className="dashboard-secondary-button px-3" onClick={() => setGraphExpanded(!graphExpanded)}>
              <Maximize2 className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF2F7] px-6 py-4">
          <div className="mr-2 flex items-center gap-2 text-sm text-slate-500">
            <Filter className="h-4 w-4" strokeWidth={1.9} />
            Show
          </div>
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setGraphFilter(filter.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                graphFilter === filter.key ? "bg-[#2563EB] text-white" : "bg-[#F3F4F6] text-slate-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div ref={containerRef} className="relative bg-[#FBFCFE]" style={{ height: graphExpanded ? 520 : 420 }}>
          <ForceGraph2D
            key={graphVersion}
            ref={graphRef}
            backgroundColor="#FBFCFE"
            cooldownTicks={120}
            d3AlphaDecay={0.08}
            d3VelocityDecay={0.45}
            enableNodeDrag={false}
            graphData={{ nodes: filteredNodes, links: filteredLinks }}
            height={dimensions.height}
            linkColor={() => "#CBD5E1"}
            linkDirectionalArrowColor={() => "#CBD5E1"}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.9}
            linkWidth={1.5}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            onEngineStop={() => {
              graphRef.current?.zoomToFit?.(400, 48);
              graphRef.current?.pauseAnimation?.();
            }}
            onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
            width={dimensions.width}
          />

          {hoveredNode && (
            <div className="absolute right-4 top-4 max-w-[260px] rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <p className="text-sm font-semibold text-slate-900">{hoveredNode.label}</p>
              <p className="mt-1 text-sm text-slate-500">{hoveredNode.episodeTitle}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeColor(hoveredNode) }} />
                {(hoveredNode.confidence * 100).toFixed(0)}% confidence
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-full bg-white/90 px-4 py-2 text-xs text-slate-500 shadow-sm backdrop-blur">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> Companion</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Deteriorating</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" /> Improving</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" /> Pattern</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" /> Critical</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="dashboard-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Raw Memory Feed</h2>
            <p className="mt-1 text-sm text-slate-500">Recent high-signal memories driving the active graph</p>
          </div>

          <div className="space-y-3">
            {feed.map((item) => (
              <div key={item.eventId} className="rounded-[20px] border border-[#EEF2F7] bg-[#FBFCFE] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <span className="text-xs text-slate-400">{item.time}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Confidence {item.confidence.toFixed(2)}</span>
                  <span>{item.eventId}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Patterns Detected</h2>
            <p className="mt-1 text-sm text-slate-500">Long-range observations surfaced from Rahul's six-month memory lane</p>
          </div>

          <div className="space-y-4">
            {pats.map((pattern) => (
              <div key={pattern.desc} className="rounded-[20px] bg-[#F8FAFC] p-5">
                <div className="inline-flex rounded-full bg-[#EFF6FF] px-3 py-1 text-[11px] font-semibold text-[#2563EB]">
                  {pattern.label}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700">{pattern.desc}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <span className="dashboard-pill">Observed {pattern.count} times</span>
                  <span className="dashboard-pill">Confidence {pattern.confidence.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="dashboard-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Ask KIRO about this user</h2>
          <p className="mt-1 text-sm text-slate-500">Query the memory graph directly for care and pattern insights</p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <Input
            ref={queryInputRef}
            placeholder="What patterns indicate health decline?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            className="h-12 rounded-full border-[#E5E7EB] bg-[#FBFCFE] px-5 shadow-none focus-visible:ring-[#2563EB]"
          />
          <Button
            onClick={handleAsk}
            disabled={isAsking}
            className="h-12 rounded-full bg-[#111827] px-6 text-sm font-medium text-white hover:bg-[#111827]/95"
          >
            <Send className="mr-2 h-4 w-4" strokeWidth={1.9} />
            {isAsking ? "Thinking..." : "Ask KIRO"}
          </Button>
        </div>

        {kiroResponse && (
          <div className="mt-5 rounded-[20px] bg-[#F8FAFC] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">KIRO response</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{kiroResponse}</p>
          </div>
        )}
      </section>
    </div>
  );
}
