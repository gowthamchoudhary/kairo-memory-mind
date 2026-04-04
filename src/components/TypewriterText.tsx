import { useState, useEffect } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

const TypewriterText = ({ text, speed = 30, onComplete }: TypewriterTextProps) => {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <p className="text-lg md:text-xl leading-relaxed text-foreground font-mono max-w-2xl mx-auto">
      {displayed}
      {!done && <span className="typewriter-cursor" />}
    </p>
  );
};

export default TypewriterText;
