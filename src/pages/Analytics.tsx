import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const queriesPerRobot = [
  { day: "Mon", elder: 18, med: 12, home: 8 },
  { day: "Tue", elder: 22, med: 15, home: 10 },
  { day: "Wed", elder: 28, med: 18, home: 14 },
  { day: "Thu", elder: 20, med: 14, home: 9 },
  { day: "Fri", elder: 15, med: 10, home: 7 },
  { day: "Sat", elder: 12, med: 8, home: 5 },
  { day: "Sun", elder: 10, med: 6, home: 4 },
];

const confidenceData = [
  { range: "0.5-0.6", count: 3 },
  { range: "0.6-0.7", count: 8 },
  { range: "0.7-0.8", count: 22 },
  { range: "0.8-0.9", count: 45 },
  { range: "0.9-1.0", count: 62 },
];

const alertFrequency = [
  { day: "Mon", alerts: 0 },
  { day: "Tue", alerts: 1 },
  { day: "Wed", alerts: 2 },
  { day: "Thu", alerts: 1 },
  { day: "Fri", alerts: 0 },
  { day: "Sat", alerts: 1 },
  { day: "Sun", alerts: 0 },
];

const actionBreakdown = [
  { name: "MONITOR", value: 45, color: "#2563EB" },
  { name: "REST", value: 28, color: "#16A34A" },
  { name: "HYDRATE", value: 15, color: "#F59E0B" },
  { name: "ALERT", value: 12, color: "#DC2626" },
];

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
};

function CardShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="dashboard-card p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function Analytics() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <CardShell title="Queries per Robot (Daily)" subtitle="Daily grouped traffic across eldercare, hospital, and home units">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={queriesPerRobot} barGap={10}>
              <CartesianGrid vertical={false} stroke="#EEF2F7" />
              <XAxis axisLine={false} dataKey="day" tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="elder" name="Elder" fill="#2563EB" radius={[10, 10, 0, 0]} maxBarSize={18} />
              <Bar dataKey="med" name="Hospital" fill="#F59E0B" radius={[10, 10, 0, 0]} maxBarSize={18} />
              <Bar dataKey="home" name="Home" fill="#16A34A" radius={[10, 10, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardShell>

      <CardShell title="Confidence Score Distribution" subtitle="Model confidence density over the current weekly reasoning window">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={confidenceData}>
              <defs>
                <linearGradient id="confidenceFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEF2F7" />
              <XAxis axisLine={false} dataKey="range" tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                dataKey="count"
                fill="url(#confidenceFill)"
                stroke="#2563EB"
                strokeWidth={3}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardShell>

      <CardShell title="Alert Frequency" subtitle="Critical incidents detected across the fleet during the last seven days">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={alertFrequency}>
              <CartesianGrid vertical={false} stroke="#EEF2F7" />
              <XAxis axisLine={false} dataKey="day" tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <YAxis axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                dataKey="alerts"
                stroke="#DC2626"
                strokeWidth={3}
                type="monotone"
                dot={{ r: 5, fill: "#FFFFFF", stroke: "#DC2626", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#DC2626" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardShell>

      <CardShell title="Response Actions" subtitle="Distribution of the recommended action types across recent interactions">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie
                  data={actionBreakdown}
                  cx="50%"
                  cy="50%"
                  dataKey="value"
                  innerRadius={68}
                  outerRadius={102}
                  paddingAngle={4}
                  stroke="none"
                >
                  {actionBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {actionBreakdown.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-[#EEF2F7] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-semibold text-slate-900">{entry.name}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{entry.value}% of response actions</p>
              </div>
            ))}
          </div>
        </div>
      </CardShell>
    </div>
  );
}
