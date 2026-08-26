"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Activity } from "lucide-react";

interface ModeToggleProps {
  isAiMode: boolean;
  onToggle: () => void;
}

export function ModeToggle({ isAiMode, onToggle }: ModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center h-11 w-48 rounded-full p-1 transition-colors duration-300 shadow-inner border border-white/20 backdrop-blur-md cursor-pointer select-none ${
        isAiMode
          ? "bg-slate-900/90 shadow-cyan-950/50"
          : "bg-slate-200/90 shadow-slate-400/30"
      }`}
    >
      {/* Background Labels */}
      <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold tracking-wider pointer-events-none">
        <span
          className={`flex items-center gap-1 transition-opacity duration-300 ${
            !isAiMode ? "opacity-0" : "opacity-70 text-slate-400"
          }`}
        >
          <Activity size={13} /> NORMAL
        </span>
        <span
          className={`flex items-center gap-1 transition-opacity duration-300 ${
            isAiMode ? "opacity-0" : "opacity-70 text-amber-700"
          }`}
        >
          <Sparkles size={13} /> AI MODE
        </span>
      </div>

      {/* Sliding Pill Thumb */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`h-9 px-3 rounded-full flex items-center justify-center gap-1.5 font-semibold text-xs shadow-md z-10 ${
          isAiMode
            ? "ml-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/40"
            : "mr-auto bg-white text-slate-800 shadow-slate-300"
        }`}
      >
        {isAiMode ? (
          <>
            <Sparkles size={14} className="animate-pulse" />
            <span>AI MODE</span>
          </>
        ) : (
          <>
            <Activity size={14} className="text-emerald-600" />
            <span>NORMAL</span>
          </>
        )}
      </motion.div>
    </button>
  );
}