import { motion } from "framer-motion";
import { Clock } from "lucide-react";

export interface MemoryEntry {
  id: string;
  text: string;
  timestamp: string;
  type?: string;
}

interface MemoryTimelineProps {
  memories: MemoryEntry[];
}

const typeColors: Record<string, string> = {
  sleep: "text-primary",
  food: "text-secondary",
  mood: "text-purple-400",
  weather: "text-blue-400",
  activity: "text-green-400",
  pattern: "text-secondary",
};

const MemoryTimeline = ({ memories }: MemoryTimelineProps) => {
  return (
    <div className="h-full flex flex-col">
      <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-widest mb-4 px-1">
        Memory Timeline
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {memories.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glow-border rounded-md p-3 bg-card/50"
          >
            <p className={`text-xs leading-relaxed ${typeColors[m.type || ""] || "text-foreground"}`}>
              {m.text}
            </p>
            <div className="flex items-center gap-1 mt-2 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-[10px]">{m.timestamp}</span>
            </div>
          </motion.div>
        ))}
        {memories.length === 0 && (
          <p className="text-xs text-muted-foreground">No memories yet...</p>
        )}
      </div>
    </div>
  );
};

export default MemoryTimeline;
