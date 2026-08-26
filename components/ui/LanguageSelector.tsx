"use client";

import React from "react";
import { motion } from "framer-motion";
import { Languages } from "lucide-react";
import { LANGUAGES, type Language } from "@/data/translations";

interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const activeIndex = Math.max(
    0,
    LANGUAGES.findIndex((language) => language.code === value)
  );

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-4 h-4 text-white/50 hidden sm:block" />

      <div
        role="radiogroup"
        aria-label="Select language"
        className="relative flex items-center h-11 w-[13.5rem] rounded-full p-1 bg-slate-900/60 border border-white/15 shadow-inner shadow-black/30 backdrop-blur-md select-none"
      >
        {/* Sliding thumb. Width is one third of the track's inner area, so a
            translate of 100% moves it exactly one segment. */}
        <motion.span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 shadow-md shadow-teal-500/30 pointer-events-none"
          style={{ width: "calc((100% - 0.5rem) / 3)" }}
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />

        {LANGUAGES.map((language) => {
          const isActive = language.code === value;

          return (
            <button
              key={language.code}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={language.name}
              onClick={() => onChange(language.code)}
              className={`relative z-10 flex-1 h-9 rounded-full text-xs font-bold tracking-wide transition-colors duration-200 cursor-pointer ${
                isActive
                  ? "text-slate-900"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {language.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
