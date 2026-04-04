import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell
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
  { name: "MONITOR", value: 45, color: "hsl(217, 91%, 60%)" },
  { name: "REST", value: 28, color: "hsl(142, 72%, 29%)" },
  { name: "HYDRATE", value: 15, color: "hsl(32, 95%, 44%)" },
  { name: "ALERT", value: 12, color: "hsl(0, 72%, 51%)" },
];

const chartStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function Analytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Queries per robot */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Queries per Robot (Daily)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={queriesPerRobot}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={chartStyle} />
            <Legend />
            <Bar dataKey="elder" name="Elder" fill="hsl(217, 91%, 60%)" radius={[2,2,0,0]} />
            <Bar dataKey="med" name="Hospital" fill="hsl(32, 95%, 44%)" radius={[2,2,0,0]} />
            <Bar dataKey="home" name="Home" fill="hsl(142, 72%, 29%)" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Confidence distribution */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Confidence Score Distribution</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={confidenceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="range" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={chartStyle} />
            <Area type="monotone" dataKey="count" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%)" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Alert frequency */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Alert Frequency</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={alertFrequency}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={chartStyle} />
            <Line type="monotone" dataKey="alerts" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ fill: "hsl(0, 72%, 51%)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Action breakdown */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Response Actions</h2>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={actionBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {actionBreakdown.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
