import { Bot, Brain, MessageSquare, AlertTriangle, ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stats = [
  { label: "Active Robots", value: "3", change: "↑ 1 this week", icon: Bot, color: "text-primary" },
  { label: "Memory Entries", value: "1,247", change: "↑ 23 today", icon: Brain, color: "text-success" },
  { label: "Queries Today", value: "89", change: "↑ 12%", icon: MessageSquare, color: "text-primary" },
  { label: "Alerts", value: "1", change: "⚠ 1 critical", icon: AlertTriangle, color: "text-warning" },
];

const queryData = [
  { day: "Mon", queries: 42 },
  { day: "Tue", queries: 58 },
  { day: "Wed", queries: 89 },
  { day: "Thu", queries: 63 },
  { day: "Fri", queries: 47 },
  { day: "Sat", queries: 31 },
  { day: "Sun", queries: 22 },
];

const quickActions = [
  { icon: "🤖", label: "Send Query", action: "Send →", path: "/robots" },
  { icon: "🧠", label: "View Memory", action: "View →", path: "/memory" },
  { icon: "📡", label: "Test API", action: "Test →", path: "/api-docs" },
  { icon: "⚠️", label: "View Alerts", action: "1 Alert", path: "/robots" },
  { icon: "📘", label: "API Docs", action: "Open →", path: "/api-docs" },
];

const fleet = [
  { id: "KIRO-ELDER-001", type: "ElderCare Unit", status: "active", queries: 847 },
  { id: "KIRO-MED-002", type: "Hospital Unit", status: "active", queries: 392 },
  { id: "KIRO-HOME-003", type: "Home Companion", status: "active", queries: 156 },
  { id: "KIRO-TEST-004", type: "Test Unit", status: "offline", queries: 0 },
];

export default function Overview() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-lg border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.change}</div>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Query Activity</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={queryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="queries" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick actions */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.path}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-sm text-foreground">{a.label}</span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-1">
                  {a.action} <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet table */}
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Robot Fleet</h2>
          <span className="text-xs text-muted-foreground">3 active / 4 total</span>
        </div>
        <div className="divide-y divide-border">
          {fleet.map((r) => (
            <Link
              key={r.id}
              to="/robots"
              className="flex items-center px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <Bot className="w-4 h-4 text-muted-foreground mr-3" />
              <span className="font-mono text-sm text-foreground w-40">{r.id}</span>
              <span className="text-sm text-muted-foreground flex-1">{r.type}</span>
              <span className={`flex items-center gap-1.5 text-xs mr-6 ${r.status === "active" ? "text-success" : "text-muted-foreground"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${r.status === "active" ? "bg-success" : "bg-muted-foreground"}`} />
                {r.status === "active" ? "Active" : "Offline"}
              </span>
              <span className="text-xs text-muted-foreground w-24 text-right">{r.queries} queries</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
