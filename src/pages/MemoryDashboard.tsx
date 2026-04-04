import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Moon, Utensils, Cloud, Brain, Activity, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedMemories, seedPatterns } from "@/lib/seedData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const typeIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-5 h-5" />,
  food: <Utensils className="w-5 h-5" />,
  weather: <Cloud className="w-5 h-5" />,
  mood: <Brain className="w-5 h-5" />,
  activity: <Activity className="w-5 h-5" />,
};

const typeLabels: Record<string, string> = {
  sleep: "Sleep",
  food: "Food & Nutrition",
  weather: "Weather",
  mood: "Mood & Stress",
  activity: "Activity",
};

const MemoryDashboard = () => {
  const [memories] = useState(seedMemories);
  const [patterns] = useState(seedPatterns);
  const [logType, setLogType] = useState("sleep");
  const [logValue, setLogValue] = useState("");

  const grouped = memories.reduce((acc, m) => {
    const t = m.type || "activity";
    if (!acc[t]) acc[t] = [];
    acc[t].push(m);
    return acc;
  }, {} as Record<string, typeof memories>);

  const handleLog = () => {
    if (!logValue.trim()) return;
    // In real app, would call logMemory API
    setLogValue("");
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div className="scanline-overlay" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-display text-xl font-bold text-primary">Memory Dashboard</h1>
              <p className="text-xs text-muted-foreground">Everything KIRO knows about you</p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary">
                <Plus className="w-4 h-4" />
                Log something
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-primary/20">
              <DialogHeader>
                <DialogTitle className="font-display text-primary">Log Context</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Select value={logType} onValueChange={setLogType}>
                  <SelectTrigger className="border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={logValue}
                  onChange={(e) => setLogValue(e.target.value)}
                  placeholder="e.g. Slept 6 hours, felt okay"
                  className="border-primary/20"
                />
                <Button onClick={handleLog} className="w-full bg-primary text-primary-foreground">
                  Save to Memory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Memory Cards by Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Object.entries(grouped).map(([type, items], i) => (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glow-border rounded-lg p-4 bg-card/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-primary">{typeIcons[type]}</span>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  {typeLabels[type] || type}
                </h3>
              </div>
              <div className="space-y-2">
                {items.map((m) => (
                  <div key={m.id} className="text-xs text-muted-foreground flex justify-between">
                    <span className="text-foreground/80">{m.text}</span>
                    <span className="shrink-0 ml-2">{m.timestamp}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pattern Graph Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="font-display text-lg font-bold text-secondary mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Pattern Graph
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.map((p, i) => (
              <div key={p.id} className="glow-border-amber rounded-lg p-4 bg-card/50">
                <p className="text-sm text-foreground mb-3">{p.description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-secondary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${p.confidence}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{p.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MemoryDashboard;
