import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ZoomIn, Maximize2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ForceGraph2D from "react-force-graph-2d";

const users = [
  { id: "rahul", name: "Rahul Sharma" },
  { id: "priya", name: "Priya Nair" },
  { id: "arjun", name: "Arjun Mehta" },
];

type NodeType = "health_report" | "pattern" | "critical_alert" | "interaction" | "conversation";

interface GraphNode {
  id: string;
  label: string;
  episode: string;
  episodeTitle: string;
  type: NodeType;
  state: "stable" | "deteriorating" | "improving";
  confidence: number;
  emotionalSignal?: string;
  healthRelevance?: string;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

type GraphFilter = "all" | "health" | "conversations" | "patterns" | "isolated";

const graphDataByUser: Record<string, { nodes: GraphNode[]; links: GraphLink[] }> = {
  rahul: {
    nodes: [
      { id: "EVT_rahul_001", label: "HR 102, Sleep 4h\nDistressed", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.95 },
      { id: "EVT_rahul_002", label: "Skipped breakfast\nMood low", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.92 },
      { id: "EVT_rahul_003", label: "Sleep 3.5h\nAnxious", episode: "EP_rahul_002", episodeTitle: "Sleep Deficit Pattern", type: "health_report", state: "deteriorating", confidence: 0.99 },
      { id: "EVT_rahul_004", label: "Rain 40min\nFatigue", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "health_report", state: "deteriorating", confidence: 0.88 },
      { id: "EVT_rahul_005", label: "Sleep 8h ✓\nFeeling great", episode: "EP_rahul_003", episodeTitle: "Recovery Day", type: "health_report", state: "improving", confidence: 0.94 },
      { id: "EVT_rahul_P1", label: "⚡ Pattern\nSleep + Rain → Fatigue", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "pattern", state: "stable", confidence: 0.89 },
      { id: "EVT_rahul_P2", label: "⚡ Pattern\nMeals + HR → Stress", episode: "EP_rahul_001", episodeTitle: "Tuesday Fatigue Spiral", type: "pattern", state: "stable", confidence: 0.74 },
      // Conversation nodes
      { id: "CONV_rahul_001", label: "My daughter called\ntoday", episode: "EP_rahul_004", episodeTitle: "Family Connection", type: "conversation", state: "improving", confidence: 0.85, emotionalSignal: "positive", healthRelevance: "indirect" },
      { id: "CONV_rahul_002", label: "Feeling lonely\nthese days", episode: "EP_rahul_005", episodeTitle: "Isolation Concern", type: "conversation", state: "deteriorating", confidence: 0.90, emotionalSignal: "negative", healthRelevance: "indirect" },
      { id: "CONV_rahul_003", label: "Temple visit\ntomorrow", episode: "EP_rahul_004", episodeTitle: "Family Connection", type: "conversation", state: "stable", confidence: 0.78, emotionalSignal: "positive", healthRelevance: "none" },
    ],
    links: [
      { source: "EVT_rahul_001", target: "EVT_rahul_002", relation: "follows" },
      { source: "EVT_rahul_001", target: "EVT_rahul_003", relation: "recurring" },
      { source: "EVT_rahul_001", target: "EVT_rahul_P1", relation: "caused_by" },
      { source: "EVT_rahul_004", target: "EVT_rahul_P1", relation: "caused_by" },
      { source: "EVT_rahul_002", target: "EVT_rahul_P2", relation: "caused_by" },
      { source: "EVT_rahul_005", target: "EVT_rahul_001", relation: "contradicts" },
      { source: "EVT_rahul_003", target: "EVT_rahul_004", relation: "links_to" },
      // Conversation links
      { source: "CONV_rahul_001", target: "EP_rahul_003", relation: "conversation_reveals" },
      { source: "CONV_rahul_002", target: "EVT_rahul_001", relation: "conversation_reveals" },
      { source: "CONV_rahul_003", target: "CONV_rahul_001", relation: "follows" },
      { source: "CONV_rahul_002", target: "EVT_rahul_003", relation: "conversation_reveals" },
    ],
  },
  priya: {
    nodes: [
      { id: "EVT_priya_001", label: "Post-surgery\nHR 118, Temp 100.8", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "critical_alert", state: "deteriorating", confidence: 0.96 },
      { id: "EVT_priya_002", label: "Skipped dinner\nAnxious", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "health_report", state: "deteriorating", confidence: 0.94 },
      { id: "EVT_priya_003", label: "Sleep 2.5h\nDizzy, HR 124", episode: "EP_priya_002", episodeTitle: "Dizziness Episode", type: "critical_alert", state: "deteriorating", confidence: 0.98 },
      { id: "EVT_priya_P1", label: "⚡ Pattern\nHR > 115 → Pain", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "pattern", state: "stable", confidence: 0.92 },
      { id: "EVT_priya_P2", label: "⚡ Pattern\nSleep + Food → Dizzy", episode: "EP_priya_002", episodeTitle: "Dizziness Episode", type: "pattern", state: "stable", confidence: 0.78 },
      // Conversation nodes
      { id: "CONV_priya_001", label: "Scared about\nrecovery", episode: "EP_priya_001", episodeTitle: "Post-Surgery Recovery Crisis", type: "conversation", state: "deteriorating", confidence: 0.93, emotionalSignal: "negative", healthRelevance: "direct" },
      { id: "CONV_priya_002", label: "Husband visiting\ntomorrow", episode: "EP_priya_003", episodeTitle: "Family Support", type: "conversation", state: "improving", confidence: 0.80, emotionalSignal: "positive", healthRelevance: "indirect" },
    ],
    links: [
      { source: "EVT_priya_001", target: "EVT_priya_002", relation: "follows" },
      { source: "EVT_priya_001", target: "EVT_priya_003", relation: "escalation" },
      { source: "EVT_priya_002", target: "EVT_priya_003", relation: "caused_by" },
      { source: "EVT_priya_001", target: "EVT_priya_P1", relation: "caused_by" },
      { source: "EVT_priya_002", target: "EVT_priya_P1", relation: "caused_by" },
      { source: "EVT_priya_002", target: "EVT_priya_P2", relation: "caused_by" },
      { source: "EVT_priya_003", target: "EVT_priya_P2", relation: "caused_by" },
      { source: "CONV_priya_001", target: "EVT_priya_001", relation: "conversation_reveals" },
      { source: "CONV_priya_002", target: "EVT_priya_003", relation: "conversation_reveals" },
    ],
  },
  arjun: {
    nodes: [
      { id: "EVT_arjun_001", label: "Sleep 7.5h\nCalm, HR 74", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "health_report", state: "stable", confidence: 0.90 },
      { id: "EVT_arjun_002", label: "Healthy meals\nHappy, HR 72", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "health_report", state: "stable", confidence: 0.93 },
      { id: "EVT_arjun_003", label: "Exercise 30min\nEnergetic", episode: "EP_arjun_002", episodeTitle: "Exercise Recovery", type: "health_report", state: "improving", confidence: 0.91 },
      { id: "EVT_arjun_P1", label: "⚡ Pattern\nSleep > 7h → Stable HR", episode: "EP_arjun_001", episodeTitle: "Stable Wellness Baseline", type: "pattern", state: "stable", confidence: 0.94 },
      { id: "EVT_arjun_P2", label: "⚡ Pattern\nExercise → Mood ↑", episode: "EP_arjun_002", episodeTitle: "Exercise Recovery", type: "pattern", state: "stable", confidence: 0.82 },
      // Conversation nodes
      { id: "CONV_arjun_001", label: "Work deadline\nnext week", episode: "EP_arjun_003", episodeTitle: "Work Stress Watch", type: "conversation", state: "stable", confidence: 0.75, emotionalSignal: "neutral", healthRelevance: "indirect" },
      { id: "CONV_arjun_002", label: "Planning weekend\nhike", episode: "EP_arjun_002", episodeTitle: "Exercise Recovery", type: "conversation", state: "improving", confidence: 0.82, emotionalSignal: "positive", healthRelevance: "indirect" },
    ],
    links: [
      { source: "EVT_arjun_001", target: "EVT_arjun_002", relation: "follows" },
      { source: "EVT_arjun_001", target: "EVT_arjun_P1", relation: "caused_by" },
      { source: "EVT_arjun_002", target: "EVT_arjun_P1", relation: "caused_by" },
      { source: "EVT_arjun_003", target: "EVT_arjun_P2", relation: "caused_by" },
      { source: "EVT_arjun_003", target: "EVT_arjun_001", relation: "links_to" },
      { source: "CONV_arjun_001", target: "EVT_arjun_001", relation: "conversation_reveals" },
      { source: "CONV_arjun_002", target: "EVT_arjun_003", relation: "follows" },
    ],
  },
};

const memoryFeed: Record<string, Array<{ icon: string; label: string; time: string; text: string; confidence: number; eventId: string; type: "sensor" | "conversation" }>> = {
  rahul: [
    { icon: "❤️", label: "Heart Rate", time: "2 hours ago", text: "98 bpm — distressed emotion detected", confidence: 0.95, eventId: "EVT_rahul_001", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "3 hours ago", text: '"My daughter called today" — positive, family connection', confidence: 0.85, eventId: "CONV_rahul_001", type: "conversation" },
    { icon: "😴", label: "Sleep Pattern", time: "Yesterday", text: "4.2 hours — below healthy threshold", confidence: 0.99, eventId: "EVT_rahul_003", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "Yesterday", text: '"Feeling lonely these days" — negative, isolation signal', confidence: 0.90, eventId: "CONV_rahul_002", type: "conversation" },
    { icon: "🌧️", label: "Weather Exposure", time: "2 days ago", text: "Caught in rain, walked 40 mins", confidence: 0.88, eventId: "EVT_rahul_004", type: "sensor" },
    { icon: "🍽️", label: "Nutrition", time: "2 days ago", text: "Skipped breakfast, heavy dinner only", confidence: 0.92, eventId: "EVT_rahul_002", type: "sensor" },
  ],
  priya: [
    { icon: "❤️", label: "Heart Rate", time: "1 hour ago", text: "124 bpm — critical, nurse notified", confidence: 0.96, eventId: "EVT_priya_001", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "2 hours ago", text: '"Scared about recovery" — anxiety, direct health', confidence: 0.93, eventId: "CONV_priya_001", type: "conversation" },
    { icon: "😴", label: "Sleep Pattern", time: "Today", text: "3.1 hours — post-surgery recovery", confidence: 0.98, eventId: "EVT_priya_003", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "Today", text: '"Husband visiting tomorrow" — positive, family support', confidence: 0.80, eventId: "CONV_priya_002", type: "conversation" },
    { icon: "🌡️", label: "Temperature", time: "3 hours ago", text: "101.3°F — elevated", confidence: 0.94, eventId: "EVT_priya_002", type: "sensor" },
  ],
  arjun: [
    { icon: "❤️", label: "Heart Rate", time: "30 min ago", text: "74 bpm — normal range", confidence: 0.90, eventId: "EVT_arjun_001", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "1 hour ago", text: '"Planning weekend hike" — positive, active lifestyle', confidence: 0.82, eventId: "CONV_arjun_002", type: "conversation" },
    { icon: "😴", label: "Sleep Pattern", time: "Today", text: "7.5 hours — healthy", confidence: 0.97, eventId: "EVT_arjun_002", type: "sensor" },
    { icon: "💬", label: "Conversation", time: "Yesterday", text: '"Work deadline next week" — neutral, monitoring', confidence: 0.75, eventId: "CONV_arjun_001", type: "conversation" },
    { icon: "🏃", label: "Activity", time: "Today", text: "3,240 steps, 30 min exercise", confidence: 0.93, eventId: "EVT_arjun_003", type: "sensor" },
  ],
};

const patterns: Record<string, Array<{ label: string; desc: string; count: number; confidence: number }>> = {
  rahul: [
    { label: "HIGH CONFIDENCE", desc: "Low sleep + rain exposure → fatigue next morning", count: 4, confidence: 0.89 },
    { label: "MEDIUM CONFIDENCE", desc: "Skipped meals + stress → elevated heart rate", count: 2, confidence: 0.74 },
    { label: "NEW — CONVERSATION", desc: "Loneliness mentions correlate with sleep decline", count: 2, confidence: 0.67 },
  ],
  priya: [
    { label: "HIGH CONFIDENCE", desc: "Heart rate above 115bpm → pain escalation", count: 3, confidence: 0.92 },
    { label: "MEDIUM CONFIDENCE", desc: "Poor sleep + low food → dizziness", count: 2, confidence: 0.78 },
    { label: "NEW — CONVERSATION", desc: "Recovery anxiety spikes before family visits", count: 1, confidence: 0.55 },
  ],
  arjun: [
    { label: "HIGH CONFIDENCE", desc: "Consistent sleep >7h → stable heart rate", count: 5, confidence: 0.94 },
    { label: "MEDIUM CONFIDENCE", desc: "Regular exercise → positive mood + lower HR", count: 3, confidence: 0.82 },
    { label: "NEW — CONVERSATION", desc: "Work stress mentions don't affect vitals yet", count: 1, confidence: 0.60 },
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

function getNodeColor(node: GraphNode): string {
  if (node.type === "conversation") return "#8B5CF6";
  if (node.type === "pattern") return "#16A34A";
  if (node.type === "critical_alert") return "#DC2626";
  if (node.state === "deteriorating") return "#D97706";
  if (node.state === "improving") return "#16A34A";
  return "#2563EB";
}

function getNodeSize(node: GraphNode): number {
  if (node.type === "pattern") return 8;
  if (node.type === "critical_alert") return 10;
  if (node.type === "conversation") return 7;
  return 6;
}

function getLinkColor(link: GraphLink): string {
  if (link.relation === "conversation_reveals") return "#8B5CF6";
  if (link.relation === "escalation") return "#DC2626";
  return "#CBD5E1";
}

function shouldShowNode(node: GraphNode, filter: GraphFilter): boolean {
  if (filter === "all") return true;
  if (filter === "health") return node.type === "health_report" || node.type === "critical_alert" || (node.type === "conversation" && node.healthRelevance !== "none");
  if (filter === "conversations") return node.type === "conversation";
  if (filter === "patterns") return node.type === "pattern";
  if (filter === "isolated") return false; // no isolated nodes in seed data
  return true;
}

function getNodeOpacity(node: GraphNode, filter: GraphFilter): number {
  if (filter === "all") return 1;
  if (filter === "health") {
    if (node.type === "health_report" || node.type === "critical_alert") return 1;
    if (node.type === "conversation" && node.healthRelevance !== "none") return 0.7;
    if (node.type === "pattern") return 0.8;
    return 0.2;
  }
  if (filter === "conversations") {
    if (node.type === "conversation") return 1;
    return 0.2;
  }
  if (filter === "patterns") {
    if (node.type === "pattern") return 1;
    return 0.2;
  }
  return 1;
}

export default function Memory() {
  const [selectedUser, setSelectedUser] = useState("rahul");
  const [query, setQuery] = useState("");
  const [kiroResponse, setKiroResponse] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphExpanded, setGraphExpanded] = useState(false);
  const [graphFilter, setGraphFilter] = useState<GraphFilter>("all");
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: graphExpanded ? 500 : 350 });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [graphExpanded]);

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

  const graphData = graphDataByUser[selectedUser] || { nodes: [], links: [] };
  const feed = memoryFeed[selectedUser] || [];
  const pats = patterns[selectedUser] || [];

  // Filter graph data
  const filteredNodes = graphData.nodes.filter(n => shouldShowNode(n, graphFilter));
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = graphData.links.filter(l => {
    const srcId = typeof l.source === "object" ? (l.source as any).id : l.source;
    const tgtId = typeof l.target === "object" ? (l.target as any).id : l.target;
    return filteredNodeIds.has(srcId) && filteredNodeIds.has(tgtId);
  });
  const filteredGraphData = { nodes: filteredNodes, links: filteredLinks };

  const episodes = [...new Set(graphData.nodes.map(n => n.episodeTitle))];
  const conversationCount = graphData.nodes.filter(n => n.type === "conversation").length;
  const sensorCount = graphData.nodes.filter(n => n.type !== "conversation" && n.type !== "pattern").length;

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const gNode = node as GraphNode & { x: number; y: number };
    const size = getNodeSize(gNode);
    const color = getNodeColor(gNode);
    const opacity = getNodeOpacity(gNode, graphFilter);

    ctx.globalAlpha = opacity;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(gNode.x, gNode.y, size, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    // Glow for critical
    if (gNode.type === "critical_alert") {
      ctx.beginPath();
      ctx.arc(gNode.x, gNode.y, size + 3, 0, 2 * Math.PI, false);
      ctx.strokeStyle = "rgba(220, 38, 38, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Conversation node ring
    if (gNode.type === "conversation") {
      ctx.beginPath();
      ctx.arc(gNode.x, gNode.y, size + 2, 0, 2 * Math.PI, false);
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Label
    if (globalScale > 0.8) {
      const label = gNode.label.split("\n")[0];
      ctx.font = `${Math.max(10 / globalScale, 3)}px Inter, sans-serif`;
      ctx.fillStyle = "#0F172A";
      ctx.textAlign = "center";
      ctx.fillText(label, gNode.x, gNode.y + size + 10 / globalScale);

      // Show emotional signal for conversation nodes
      if (gNode.type === "conversation" && gNode.emotionalSignal && globalScale > 1.2) {
        ctx.font = `${Math.max(8 / globalScale, 2.5)}px Inter, sans-serif`;
        ctx.fillStyle = "#8B5CF6";
        ctx.fillText(gNode.emotionalSignal, gNode.x, gNode.y + size + 18 / globalScale);
      }
    }

    ctx.globalAlpha = 1;
  }, [graphFilter]);

  const filters: { key: GraphFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "health", label: "Health" },
    { key: "conversations", label: "Conversations" },
    { key: "patterns", label: "Patterns" },
  ];

  return (
    <div className="space-y-6">
      {/* User tabs */}
      <div className="flex gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => { setSelectedUser(u.id); setKiroResponse(""); setHoveredNode(null); }}
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

      {/* Episodic Memory Graph */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Episodic Memory Graph</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sensorCount} sensor events • {conversationCount} conversations • {episodes.length} episodes
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => graphRef.current?.zoomToFit(400)}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setGraphExpanded(!graphExpanded)}>
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Graph filter toggles */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Show:</span>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setGraphFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                graphFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div ref={containerRef} className="relative bg-[#FAFBFD]" style={{ height: graphExpanded ? 500 : 350 }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredGraphData}
            width={dimensions.width}
            height={graphExpanded ? 500 : 350}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={(link: any) => getLinkColor(link)}
            linkWidth={(link: any) => link.relation === "conversation_reveals" ? 2 : 1.5}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.9}
            linkDirectionalArrowColor={(link: any) => getLinkColor(link)}
            linkLineDash={(link: any) => link.relation === "conversation_reveals" ? [4, 2] : []}
            onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)}
            cooldownTicks={50}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.3}
            backgroundColor="#FAFBFD"
          />

          {/* Node tooltip */}
          {hoveredNode && (
            <div className="absolute top-3 right-3 bg-card border border-border rounded-lg p-3 shadow-lg max-w-[240px] z-10">
              <p className="text-xs font-semibold text-foreground">{hoveredNode.label.replace("\n", " — ")}</p>
              <p className="text-xs text-muted-foreground mt-1">Episode: {hoveredNode.episodeTitle}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor(hoveredNode) }} />
                <span className="text-xs text-muted-foreground capitalize">{hoveredNode.type.replace("_", " ")}</span>
                <span className="text-xs text-muted-foreground">• {(hoveredNode.confidence * 100).toFixed(0)}%</span>
              </div>
              {hoveredNode.type === "conversation" && (
                <div className="mt-1.5 text-xs">
                  <span className="text-muted-foreground">Emotion: </span>
                  <span style={{ color: "#8B5CF6" }}>{hoveredNode.emotionalSignal}</span>
                  {hoveredNode.healthRelevance !== "none" && (
                    <span className="text-muted-foreground ml-2">Health: {hoveredNode.healthRelevance}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Stable</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" /> Deteriorating</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Improving</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: "#8B5CF6" }} /> Conversation</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Pattern</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" /> Critical</span>
          </div>
        </div>
      </div>

      {/* Two columns: feed + patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Memory Feed — Sensor + Conversation</h2>
          {feed.map((m, i) => (
            <div key={i} className={`bg-card rounded-lg border p-3 shadow-sm ${m.type === "conversation" ? "border-[#8B5CF6]/30" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  {m.icon} {m.label}
                </span>
                <div className="flex items-center gap-2">
                  {m.type === "conversation" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8B5CF6" }}>CONV</span>
                  )}
                  <span className="text-xs text-muted-foreground">{m.time}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{m.text}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">Confidence: {m.confidence.toFixed(2)}</p>
                <span className="text-xs font-mono text-muted-foreground/60">{m.eventId}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Patterns Detected</h2>
          {pats.map((p, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4 shadow-sm">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-2 ${
                p.label.includes("HIGH") ? "bg-primary/10 text-primary"
                : p.label.includes("CONVERSATION") ? "text-[#8B5CF6]" 
                : "bg-warning/10 text-warning"
              }`} style={p.label.includes("CONVERSATION") ? { backgroundColor: "rgba(139,92,246,0.1)" } : undefined}>
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
