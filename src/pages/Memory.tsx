import { useCallback, useEffect, useRef, useState } from "react";
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

type NodeType = "health_report" | "pattern" | "critical_alert";

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
      { id: "EVT_rahul_001", label: "HR 102", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.95 },
      { id: "EVT_rahul_002", label: "Skipped breakfast", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.92 },
      { id: "EVT_rahul_003", label: "Sleep 3.5h", episode: "EP_rahul_002", episodeTitle: "Sleep Deficit Pattern", type: "health_report", state: "deteriorating", confidence: 0.99 },
      { id: "EVT_rahul_004", label: "Rain 40min", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.88 },
      { id: "EVT_rahul_005", label: "Sleep 8h", episode: "EP_rahul_003", episodeTitle: "Recovery Day", type: "health_report", state: "improving", confidence: 0.94 },
      { id: "EVT_rahul_P1", label: "Pattern", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "pattern", state: "stable", confidence: 0.89 },
      { id: "EVT_rahul_P2", label: "Meals + HR", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "pattern", state: "stable", confidence: 0.74 },
    ],
    links: [
      { source: "EVT_rahul_001", target: "EVT_rahul_002", relation: "follows" },
      { source: "EVT_rahul_001", target: "EVT_rahul_003", relation: "recurring" },
      { source: "EVT_rahul_001", target: "EVT_rahul_P1", relation: "caused_by" },
      { source: "EVT_rahul_004", target: "EVT_rahul_P1", relation: "caused_by" },
      { source: "EVT_rahul_002", target: "EVT_rahul_P2", relation: "caused_by" },
      { source: "EVT_rahul_005", target: "EVT_rahul_001", relation: "contradicts" },
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
    { label: "Heart rate", time: "2 hours ago", text: "98 bpm — distressed emotion detected", confidence: 0.95, eventId: "EVT_rahul_001" },
    { label: "Sleep pattern", time: "Yesterday", text: "4.2 hours — below healthy threshold", confidence: 0.99, eventId: "EVT_rahul_003" },
    { label: "Weather exposure", time: "2 days ago", text: "Caught in rain, walked 40 mins", confidence: 0.88, eventId: "EVT_rahul_004" },
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
    { label: "HIGH CONFIDENCE", desc: "Low sleep + rain exposure -> fatigue next morning", count: 4, confidence: 0.89 },
    { label: "MEDIUM CONFIDENCE", desc: "Skipped meals + stress -> elevated heart rate", count: 2, confidence: 0.74 },
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
  if (node.state === "deteriorating") return "#F59E0B";
  if (node.state === "improving") return "#16A34A";
  return "#2563EB";
}

function getNodeSize(node: GraphNode): number {
  if (node.type === "critical_alert") return 9;
  if (node.type === "pattern") return 8;
  return 7;
}

function shouldShowNode(node: GraphNode, filter: GraphFilter): boolean {
  if (filter === "all") return true;
  if (filter === "health") return node.type !== "pattern";
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
  const filteredNodes = graphData.nodes.filter((node) => shouldShowNode(node, graphFilter));
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredLinks = graphData.links.filter((link) => filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target));
  const episodes = [...new Set(graphData.nodes.map((node) => node.episodeTitle))];

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
              setHoveredNode(null);
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
              {graphData.nodes.length} events across {episodes.length} episodes • Drag to explore
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="dashboard-secondary-button px-3" onClick={() => graphRef.current?.zoomToFit(300)}>
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
            ref={graphRef}
            backgroundColor="#FBFCFE"
            cooldownTicks={80}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.28}
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
            onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
            width={dimensions.width}
          />

          {hoveredNode && (
            <div className="absolute right-4 top-4 max-w-[240px] rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
              <p className="text-sm font-semibold text-slate-900">{hoveredNode.label}</p>
              <p className="mt-1 text-sm text-slate-500">{hoveredNode.episodeTitle}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getNodeColor(hoveredNode) }} />
                {(hoveredNode.confidence * 100).toFixed(0)}% confidence
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 rounded-full bg-white/90 px-4 py-2 text-xs text-slate-500 shadow-sm backdrop-blur">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> Stable</span>
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
            <p className="mt-1 text-sm text-slate-500">Event-level records captured from KIRO monitoring</p>
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
            <p className="mt-1 text-sm text-slate-500">High-signal inferences surfaced by the memory engine</p>
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
