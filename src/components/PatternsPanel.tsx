import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export interface Pattern {
  id: string;
  description: string;
  confidence: number;
}

interface PatternsPanelProps {
  patterns: Pattern[];
}

const PatternsPanel = ({ patterns }: PatternsPanelProps) => {
  return (
    <div className="h-full flex flex-col">
      <h3 className="font-display text-sm font-semibold text-secondary uppercase tracking-widest mb-4 px-1">
        Patterns Detected
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {patterns.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glow-border-amber rounded-md p-3 bg-card/50"
          >
            <div className="flex items-start gap-2">
              <Zap className="w-3.5 h-3.5 text-secondary mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed text-foreground">{p.description}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full"
                  style={{ width: `${p.confidence}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{p.confidence}%</span>
            </div>
          </motion.div>
        ))}
        {patterns.length === 0 && (
          <p className="text-xs text-muted-foreground">Analyzing patterns...</p>
        )}
      </div>
    </div>
  );
};

export default PatternsPanel;
