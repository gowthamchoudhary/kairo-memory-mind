import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Brain,
  ChevronRight,
  FileText,
  MessageSquare,
  Radar,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const stats = [
  { label: "Active Robots", value: "3", change: "↑1 this week", icon: Bot, accent: "text-[#2563EB]" },
  { label: "Memory Entries", value: "1,247", change: "↑23 today", icon: Brain, accent: "text-[#16A34A]" },
  { label: "Queries Today", value: "89", change: "↑12%", icon: MessageSquare, accent: "text-[#2563EB]" },
  { label: "Alerts", value: "1", change: "△1 critical", icon: AlertTriangle, accent: "text-[#D97706]" },
];

const queryData = [
  { day: "Mon", value: 42, highlight: false },
  { day: "Tue", value: 58, highlight: false },
  { day: "Wed", value: 89, highlight: true },
  { day: "Thu", value: 63, highlight: false },
  { day: "Fri", value: 47, highlight: false },
  { day: "Sat", value: 31, highlight: false },
  { day: "Sun", value: 22, highlight: false },
];

const quickActions = [
  { icon: MessageSquare, label: "Send Query", action: "Send Query", path: "/robots" },
  { icon: Brain, label: "View Memory", action: "View Memory", path: "/memory" },
  { icon: Radar, label: "Test API", action: "Test API", path: "/api-docs" },
  { icon: ShieldAlert, label: "View Alerts", action: "View Alerts", path: "/robots" },
  { icon: FileText, label: "API Docs", action: "API Docs", path: "/api-docs" },
];

const fleet = [
  { id: "KIRO-ELDER-001", type: "ElderCare Companion Unit", status: "Active", queries: 847, progress: 88, dot: "bg-[#16A34A]" },
  { id: "KIRO-MED-002", type: "Hospital Companion Unit", status: "Alert", queries: 392, progress: 64, dot: "bg-[#D97706]" },
  { id: "KIRO-HOME-003", type: "Home Companion Unit", status: "Active", queries: 156, progress: 42, dot: "bg-[#16A34A]" },
  { id: "KIRO-TEST-004", type: "Test Unit", status: "Offline", queries: 0, progress: 6, dot: "bg-slate-300" },
];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
};

export default function Overview() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="dashboard-card dashboard-hover-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-5 text-5xl font-bold tracking-[-0.04em] text-slate-900">{stat.value}</p>
                    <p className="mt-4 flex items-center gap-1 text-sm font-medium text-slate-500">
                      <ArrowUpRight className={`h-4 w-4 ${stat.accent}`} strokeWidth={1.9} />
                      {stat.change}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F8FAFC] text-slate-500">
                    <stat.icon className={`h-[18px] w-[18px] ${stat.accent}`} strokeWidth={1.9} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-card p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Query Activity</h2>
                <p className="mt-1 text-sm text-slate-500">Weekly engagement across the KIRO fleet</p>
              </div>
              <button type="button" className="dashboard-secondary-button">
                View report
              </button>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queryData} barGap={18}>
                  <CartesianGrid vertical={false} stroke="#EEF2F7" />
                  <XAxis
                    axisLine={false}
                    dataKey="day"
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(37,99,235,0.06)", radius: 14 }}
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value} queries`, "Activity"]}
                    labelStyle={{ color: "#0F172A", fontWeight: 600 }}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={42}>
                    {queryData.map((entry) => (
                      <Cell key={entry.day} fill={entry.highlight ? "#2563EB" : "#BAE6FD"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <aside className="dashboard-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-500">Start the next KIRO workflow</p>
            </div>
            <div className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">5 ready</div>
          </div>

          <div className="mt-6 space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                className="flex items-center justify-between rounded-2xl border border-[#EEF2F7] px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F8FAFC] text-slate-500">
                    <action.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{action.label}</span>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-slate-600">
                  {action.action}
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Robot Fleet</h2>
            <p className="mt-1 text-sm text-slate-500">Live status and query activity across deployed units</p>
          </div>
          <Link to="/robots" className="dashboard-secondary-button">
            View all
          </Link>
        </div>

        <div className="space-y-3">
          {fleet.map((robot) => (
            <Link
              key={robot.id}
              to="/robots"
              className="grid gap-4 rounded-[20px] border border-[#EEF2F7] px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#DBEAFE] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] md:grid-cols-[220px_1fr_140px_120px]"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{robot.id}</p>
                <p className="mt-1 text-sm text-slate-500">{robot.type}</p>
              </div>

              <div className="flex flex-col justify-center">
                <div className="h-2 rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-2 rounded-full bg-[linear-gradient(90deg,#2563EB_0%,#60A5FA_100%)]"
                    style={{ width: `${robot.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Fleet engagement</p>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className={`h-2.5 w-2.5 rounded-full ${robot.dot}`} />
                {robot.status}
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{robot.queries}</p>
                <p className="mt-1 text-xs text-slate-500">query count</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
