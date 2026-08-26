"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, RotateCcw } from "lucide-react";

interface AiChamberProps {
  onExit?: () => void;
  onSelectOption?: (option: string) => void;
}

const PRESET_PROMPTS = [
  "I want to get an OPD token",
  "Check live bed & ICU status",
  "Show available doctor slots",
  "Book a hospital appointment",
];

export function AiChamberView({ onExit, onSelectOption }: AiChamberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isListening, setIsListening] = useState(true);
  const [activeQuery, setActiveQuery] = useState("");

  // Perfect open-eyed smiling frame before the final blink (9.25s)
  const PAUSE_TIMESTAMP = 9.25;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= PAUSE_TIMESTAMP && !video.paused) {
      video.pause();
    }
  };

  const replayGreeting = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  const handleChipClick = (promptText: string) => {
    setActiveQuery(promptText);
    if (onSelectOption) onSelectOption(promptText);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-20 bg-[#adadad] text-slate-900 flex flex-col justify-end pt-24 pb-8 px-6 select-none overflow-hidden"
    >
      {/* Center AI Doctor Video Stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center -my-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center justify-center w-full max-w-[480px] md:max-w-[540px]"
        >
          <div
            className="relative w-full flex items-center justify-center overflow-hidden"
            style={{
              maskImage:
                "radial-gradient(ellipse 70% 75% at 50% 50%, black 40%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.3) 78%, transparent 94%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 75% at 50% 50%, black 40%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.3) 78%, transparent 94%)",
            }}
          >
            <video
              ref={videoRef}
              src="/doctor-ai.mp4"
              playsInline
              autoPlay
              muted={false}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-auto object-contain select-none pointer-events-none"
            />

            {/* Seamless Soft Edge Vignette */}
            <div className="absolute inset-0 pointer-events-none [box-shadow:inset_0_0_40px_20px_#adadad]" />
          </div>
        </motion.div>
      </div>

      {/* Bottom Floating Interactive Suite */}
      <div className="relative z-30 flex flex-col items-center gap-4 max-w-2xl mx-auto w-full">
        {/* Pre-Typed Prompt Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full px-2">
          {PRESET_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(prompt)}
              className="px-4 py-2 rounded-full bg-white/80 hover:bg-white border border-white/80 hover:border-sky-500 text-slate-800 hover:text-sky-800 text-xs font-semibold backdrop-blur-md shadow-sm hover:shadow transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Dynamic Voice Active Query Badge */}
        <AnimatePresence>
          {activeQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs font-mono font-bold text-sky-900 bg-white/95 border border-sky-400 px-4 py-1.5 rounded-full shadow-sm"
            >
              &quot;{activeQuery}&quot;
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Console */}
        <div className="flex items-center gap-6">
          <button
            onClick={replayGreeting}
            title="Replay Doctor Voice"
            className="p-3 rounded-full bg-white/80 border border-white/80 hover:bg-white text-slate-700 hover:text-sky-700 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Glowing Mic */}
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <motion.span
                  animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-400 to-cyan-300 blur-md pointer-events-none"
                />
                <motion.span
                  animate={{ scale: [1, 1.7, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="absolute inset-0 rounded-full bg-sky-300 blur-lg pointer-events-none"
                />
              </>
            )}

            <button
              onClick={() => setIsListening(!isListening)}
              className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-sky-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Mic className={`w-6 h-6 ${isListening ? "animate-pulse" : ""}`} />
            </button>
          </div>

          {/* Audio Waveform */}
          <div className="flex items-center gap-1 h-6">
            {[40, 75, 100, 60, 85].map((height, i) => (
              <motion.span
                key={i}
                animate={
                  isListening
                    ? { height: [`${height * 0.3}%`, `${height}%`, `${height * 0.3}%`] }
                    : { height: "20%" }
                }
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.12,
                }}
                className="w-1 bg-sky-700 rounded-full"
                style={{ height: "40%" }}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] font-mono font-semibold text-slate-700 tracking-wider">
          {isListening ? "LISTENING • SPEAK NOW OR TAP A QUERY" : "MIC PAUSED • TAP TO ACTIVATE"}
        </p>
      </div>
    </motion.div>
  );
}