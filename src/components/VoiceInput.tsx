import { useState, useRef } from "react";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const VoiceInput = ({ onSend, disabled }: VoiceInputProps) => {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      onSend(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        {/* Voice button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`rounded-full shrink-0 border-primary/30 ${isListening ? "bg-primary/20" : ""}`}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          disabled={disabled}
        >
          <AnimatePresence>
            {isListening ? (
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                <Mic className="w-5 h-5 text-primary" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5 text-muted-foreground" />
            )}
          </AnimatePresence>
        </Button>

        {/* Text input */}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Talk to KIRO..."
          className="flex-1 bg-muted/50 border-primary/20 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
          disabled={disabled}
        />

        <Button
          type="submit"
          size="icon"
          className="rounded-full shrink-0 bg-primary/20 hover:bg-primary/30 border border-primary/30"
          disabled={!text.trim() || disabled}
        >
          <Send className="w-4 h-4 text-primary" />
        </Button>
      </form>

      {isListening && (
        <p className="text-xs text-primary text-center mt-2 animate-pulse">
          Listening... release to send
        </p>
      )}
    </div>
  );
};

export default VoiceInput;
