"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Volume2 } from "lucide-react";
import type { VoiceServiceState } from "@/lib/voice/agent";

/**
 * The status strip every service modal shows while a voice agent is driving it.
 *
 * Factored out of `TokenBookingModal` so the four wizards read identically —
 * and so the reassurance that touch still works ("बोलिए, या कोई विकल्प टैप
 * कीजिए") is worded the same way everywhere.
 *
 * This is presentational only. It never gates the wizard's buttons: every option
 * stays tappable while the agent talks, which is the whole point of running the
 * two input modes against one flow.
 *
 * Note on Tailwind: accent classes are stored as complete literal strings rather
 * than assembled from fragments, because v4 extracts class names statically and
 * an interpolated `border-${accent}-200` is never emitted.
 */

export type VoiceStripAccent = "amber" | "sky" | "violet" | "emerald";

const ACCENT: Record<
  VoiceStripAccent,
  { wrapper: string; speaking: string }
> = {
  amber: {
    wrapper: "border-amber-200/80 bg-gradient-to-r from-amber-50 via-amber-50/60 to-white",
    speaking: "bg-amber-500/15 border-amber-500/30 text-amber-700",
  },
  sky: {
    wrapper: "border-sky-200/80 bg-gradient-to-r from-sky-50 via-sky-50/60 to-white",
    speaking: "bg-sky-500/15 border-sky-500/30 text-sky-700",
  },
  violet: {
    wrapper: "border-violet-200/80 bg-gradient-to-r from-violet-50 via-violet-50/60 to-white",
    speaking: "bg-violet-500/15 border-violet-500/30 text-violet-700",
  },
  emerald: {
    wrapper: "border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-white",
    speaking: "bg-emerald-500/15 border-emerald-500/30 text-emerald-700",
  },
};

interface VoiceStatusStripProps {
  voice?: VoiceServiceState;
  accent?: VoiceStripAccent;
}

export function VoiceStatusStrip({ voice, accent = "sky" }: VoiceStatusStripProps) {
  // Interim text wins: it is what the user is saying right now.
  const liveTranscript = voice?.interimTranscript || voice?.transcript || "";
  const theme = ACCENT[accent];

  return (
    <AnimatePresence>
      {voice?.isActive && (
        <motion.div
          key="voice-strip"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`overflow-hidden border-b ${theme.wrapper}`}
        >
          <div className="px-7 py-2.5 flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {voice.isSpeaking ? (
                <span
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${theme.speaking}`}
                >
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest">
                    Speaking
                  </span>
                </span>
              ) : voice.isListening ? (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700">
                  <Mic className="w-3 h-3 animate-pulse" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest">
                    Listening
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-500/10 border border-slate-300 text-slate-600">
                  <Mic className="w-3 h-3" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest">
                    Voice
                  </span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-800 leading-snug truncate">
                {voice.caption || "Aarogya AI voice assistant is connected."}
              </p>
              <p className="text-[10px] font-mono text-slate-500 leading-snug truncate">
                {liveTranscript
                  ? `आप: ${liveTranscript}`
                  : "बोलिए, या कोई भी विकल्प टैप कीजिए — दोनों चलेंगे."}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
