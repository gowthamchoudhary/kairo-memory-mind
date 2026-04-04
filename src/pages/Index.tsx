import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import KiroAvatar from "@/components/KiroAvatar";
import TypewriterText from "@/components/TypewriterText";
import MemoryTimeline from "@/components/MemoryTimeline";
import PatternsPanel from "@/components/PatternsPanel";
import VoiceInput from "@/components/VoiceInput";
import { seedMemories, seedPatterns, seedMemoryContext } from "@/lib/seedData";
import { playWakeUpChime, playBase64Audio } from "@/lib/audio";
import { sendChat, getGreeting } from "@/lib/api";
import { motion } from "framer-motion";
import { Brain, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [kiroText, setKiroText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemories] = useState(seedMemories);
  const [patterns] = useState(seedPatterns);
  const [hasGreeted, setHasGreeted] = useState(false);
  const greetedRef = useRef(false);

  // "Oh Shit" moment — proactive greeting on load
  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;

    const doGreeting = async () => {
      setIsLoading(true);
      try {
        // Play wake-up chime
        await playWakeUpChime();
        setIsSpeaking(true);

        // Try backend greeting, fall back to local
        try {
          const result = await getGreeting();
          setKiroText(result.text);
          if (result.audio) {
            await playBase64Audio(result.audio).catch(() => {});
          }
        } catch {
          // Fallback greeting using seed data context
          setKiroText(
            "You've had three short nights in a row. Combined with skipping lunch and getting caught in the rain — your body is running on empty. I'd watch for a crash today."
          );
        }

        setHasGreeted(true);
      } catch (err) {
        console.error("Greeting error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay for dramatic effect
    const timer = setTimeout(doGreeting, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleTypewriterComplete = useCallback(() => {
    setIsSpeaking(false);
  }, []);

  const handleSend = async (message: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setIsSpeaking(true);
    setKiroText("");

    // Add user message as memory
    const newMemory = {
      id: `u-${Date.now()}`,
      text: message,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      type: "activity",
    };
    setMemories((prev) => [newMemory, ...prev].slice(0, 10));

    try {
      const result = await sendChat(message);
      setKiroText(result.text);
      if (result.audio) {
        await playBase64Audio(result.audio).catch(() => {});
      }
    } catch {
      // Fallback response
      setKiroText(
        "I'm having trouble connecting to my memory banks right now. But based on what I know — you should probably rest. Your patterns suggest you're overextending."
      );
      toast({
        title: "Connection issue",
        description: "Using local reasoning mode",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Main layout */}
      <div className="relative z-10 flex min-h-screen">
        {/* Left sidebar — Patterns */}
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-r border-border/30 p-4">
          <PatternsPanel patterns={patterns} />
        </aside>

        {/* Center content */}
        <main className="flex-1 flex flex-col items-center justify-between py-6 px-4 min-h-screen">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-1">
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="font-display text-2xl font-bold tracking-tight text-primary">
                KIRO
              </h1>
            </div>
            <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase">
              Memory-Driven Robot Intelligence
            </p>
            <Link to="/memories">
              <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground hover:text-primary gap-1.5 text-xs">
                <LayoutGrid className="w-3.5 h-3.5" />
                Memory Dashboard
              </Button>
            </Link>
          </motion.header>

          {/* Avatar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <KiroAvatar isSpeaking={isSpeaking} />
          </motion.div>

          {/* Response area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center px-4 min-h-[100px] flex items-center"
          >
            {isLoading && !kiroText ? (
              <p className="text-muted-foreground text-sm animate-pulse">
                KIRO is thinking...
              </p>
            ) : kiroText ? (
              <TypewriterText
                text={kiroText}
                speed={25}
                onComplete={handleTypewriterComplete}
              />
            ) : null}
          </motion.div>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full"
          >
            <VoiceInput onSend={handleSend} disabled={isLoading} />
          </motion.div>
        </main>

        {/* Right sidebar — Memory Timeline */}
        <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-l border-border/30 p-4">
          <MemoryTimeline memories={memories} />
        </aside>
      </div>
    </div>
  );
};

export default Index;
