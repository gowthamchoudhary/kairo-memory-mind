import { motion } from "framer-motion";

interface KiroAvatarProps {
  isSpeaking: boolean;
}

const KiroAvatar = ({ isSpeaking }: KiroAvatarProps) => {
  return (
    <div className="relative flex items-center justify-center w-48 h-48 mx-auto">
      {/* Outer glow rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/30"
          style={{
            width: `${100 + i * 30}%`,
            height: `${100 + i * 30}%`,
          }}
          animate={
            isSpeaking
              ? {
                  scale: [1, 1.1 + i * 0.05, 1],
                  opacity: [0.2, 0.6, 0.2],
                }
              : {
                  scale: [1, 1.03, 1],
                  opacity: [0.15, 0.3, 0.15],
                }
          }
          transition={{
            duration: isSpeaking ? 0.6 : 3,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Core circle */}
      <motion.div
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        style={{
          background: "radial-gradient(circle, hsl(185 100% 50% / 0.3), hsl(185 100% 50% / 0.05))",
          boxShadow: "0 0 40px hsl(185 100% 50% / 0.3), 0 0 80px hsl(185 100% 50% / 0.1)",
        }}
        animate={
          isSpeaking
            ? { scale: [1, 1.08, 0.95, 1.05, 1] }
            : { scale: [1, 1.02, 1] }
        }
        transition={{
          duration: isSpeaking ? 0.8 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Inner waveform bars */}
        <div className="flex items-center gap-1">
          {[...Array(7)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary"
              animate={
                isSpeaking
                  ? {
                      height: [8, 20 + Math.random() * 24, 8],
                    }
                  : {
                      height: [6, 10, 6],
                    }
              }
              transition={{
                duration: isSpeaking ? 0.3 + Math.random() * 0.3 : 2,
                repeat: Infinity,
                delay: i * 0.08,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default KiroAvatar;
