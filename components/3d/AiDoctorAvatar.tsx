"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Stethoscope, BedDouble, Calendar, Mic, Volume2 } from "lucide-react";
import Image from "next/image";

interface AiDoctorProps {
  onSelectOption: (option: string) => void;
}

export function AiDoctorAvatar({ onSelectOption }: AiDoctorProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const speakGreeting = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  React.useEffect(() => {
    // Auto greet when entering AI Mode
    speakGreeting(
      "Namaste! Main aapki AI Medical Officer hoon. Aaj main aapki kya madad kar sakti hoon?"
    );
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-between p-6 md:p-16 pointer-events-none">

      {/* LEFT: 3D DOCTOR AVATAR DISPLAY */}
      <motion.div
        initial={{ opacity: 0, x: -80, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -80, scale: 0.9 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-md h-[650px] flex items-end justify-center pointer-events-auto"
      >
        {/* Hologram Circular Pedestal Base */}
        <div className="absolute bottom-4 w-72 h-16 rounded-full bg-cyan-500/20 blur-xl border border-cyan-400/40 animate-pulse" />

        {/* Doctor 3D Visual with Floating Breath Effect */}
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative w-full h-[580px] z-10 drop-shadow-[0_20px_40px_rgba(2,132,199,0.35)]"
        >
          <img
            src="/doctor-avatar.jpg"
            alt="AI Doctor Avatar"
            className="max-h-[500px] w-auto object-contain select-none pointer-events-none rounded-3xl shadow-2xl"
          />
        </motion.div>
      </motion.div>

      {/* RIGHT: INTERACTIVE SPEECH HUD & QUICK SELECTION */}
      <motion.div
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 80 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="w-full max-w-xl space-y-5 pointer-events-auto"
      >
        {/* Floating Doctor Dialogue Bubble */}
        <div className="backdrop-blur-2xl bg-slate-950/85 border border-cyan-500/40 p-6 rounded-3xl shadow-2xl shadow-cyan-950/50 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                Dr. Arohi • AI Chief Medical Assistant
              </span>
            </div>
            <button
              onClick={() =>
                speakGreeting(
                  "Namaste! Main aapki AI Medical Officer hoon. Aaj main aapki kya madad kar sakti hoon?"
                )
              }
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingAudio ? "text-cyan-400 animate-bounce" : ""}`} />
            </button>
          </div>

          <p className="text-base md:text-lg font-medium text-slate-100 leading-relaxed">
            &quot;Namaste! Main aapki AI Medical Officer hoon. Aaj main aapki kya madad kar sakti hoon?&quot;
          </p>
          <p className="text-xs text-slate-400 mt-2 font-sans">
            Neeche diye gaye option chunein ya microphone button daba kar bolen:
          </p>
        </div>

        {/* 4 Quick Options Prompt Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            onClick={() => onSelectOption("token")}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/70 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200 group-hover:text-white">Ghar Baithe Token Lo</div>
              <div className="text-[11px] text-slate-400">Live OPD line mein lagein (M4)</div>
            </div>
          </button>

          <button
            onClick={() => onSelectOption("doctor")}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200 group-hover:text-white">Doctor Availability</div>
              <div className="text-[11px] text-slate-400">Slots aur schedule dekho (M3)</div>
            </div>
          </button>

          <button
            onClick={() => onSelectOption("beds")}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/70 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200 group-hover:text-white">Bed & ICU Status</div>
              <div className="text-[11px] text-slate-400">Emergency ward occupancy (M2)</div>
            </div>
          </button>

          <button
            onClick={() => onSelectOption("appointment")}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/70 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/10 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200 group-hover:text-white">Book Appointment</div>
              <div className="text-[11px] text-slate-400">Instant consultation slot (M2)</div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}