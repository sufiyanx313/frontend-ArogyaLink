"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, RotateCcw, AlertTriangle } from "lucide-react";

// Modals
import { TokenBookingModal } from "@/components/modals/TokenBookingModal";
import { BedAvailabilityModal } from "@/components/modals/BedAvailabilityModal";
import { DoctorAvailabilityModal } from "@/components/modals/DoctorAvailabilityModal";
import { BookAppointmentModal } from "@/components/modals/BookAppointmentModal";

import { useHydrated } from "@/hooks/useHydrated";

// Flows
import { useTokenBookingFlow } from "@/hooks/useTokenBookingFlow";
import { useBedAvailabilityFlow } from "@/hooks/useBedAvailabilityFlow";
import { useDoctorAvailabilityFlow } from "@/hooks/useDoctorAvailabilityFlow";
import { useAppointmentFlow } from "@/hooks/useAppointmentFlow";

// Voice Hooks
import { useVoiceTokenBooking } from "@/hooks/useVoiceTokenBooking";
import { useVoiceBedAvailability } from "@/hooks/useVoiceBedAvailability";
import { useVoiceDoctorAvailability } from "@/hooks/useVoiceDoctorAvailability";
import { useVoiceAppointment } from "@/hooks/useVoiceAppointment";

import type { VoiceAgentHandle } from "@/lib/voice/agent";
import type { VoiceIntent } from "@/lib/voice/matching";

export type PortalServiceId = "token" | "beds" | "doctors" | "appointment";

interface AiChamberProps {
  onExit?: () => void;
  onServiceIntent?: (service: PortalServiceId) => void;
}

const PRESET_PROMPTS = [
  "I want to get an OPD token",
  "Check live bed & ICU status",
  "Show available doctor slots",
  "Book a hospital appointment",
];

const INTENT_TO_SERVICE: Partial<Record<VoiceIntent, PortalServiceId>> = {
  token_booking: "token",
  bed_availability: "beds",
  doctor_availability: "doctors",
  appointment: "appointment",
};

/**
 * Gap between standing the outgoing agent down and the incoming one opening the
 * microphone. `stop()` aborts recognition synchronously but the browser releases
 * the capture device a beat later, and starting inside that window makes Chrome
 * throw `InvalidStateError`.
 */
const HANDOFF_DELAY_MS = 300;

/**
 * Fed to the master agent when a slave hands control back.
 *
 * The master deliberately starts silently — tapping the mic goes straight to
 * listening with no spoken greeting — so `start()` would leave a user who just
 * said "token" facing silence. Delivering the request as an utterance instead
 * routes through the shipped `awaiting_intent` branch, which speaks the booking
 * confirmation and then asks for a district. No edit to a tested hook.
 */
const TOKEN_HANDOFF_UTTERANCE = "opd token";

type MicVisual = "idle" | "listening" | "speaking" | "thinking" | "blocked";

const MIC_THEME: Record<
  MicVisual,
  { button: string; ring: string; halo: string; bar: string; label: string }
> = {
  idle: {
    button: "from-sky-600 to-cyan-500 shadow-sky-600/30",
    ring: "from-sky-400 to-cyan-300",
    halo: "bg-sky-300",
    bar: "bg-sky-700",
    label: "TAP TO TALK • माइक चालू करें",
  },
  listening: {
    button: "from-emerald-600 to-teal-500 shadow-emerald-600/30",
    ring: "from-emerald-400 to-teal-300",
    halo: "bg-emerald-300",
    bar: "bg-emerald-700",
    label: "LISTENING • अब बोलिए",
  },
  speaking: {
    button: "from-amber-500 to-orange-400 shadow-amber-500/30",
    ring: "from-amber-400 to-orange-300",
    halo: "bg-amber-300",
    bar: "bg-amber-600",
    label: "AAROGYA AI IS SPEAKING • सुनिए",
  },
  thinking: {
    button: "from-slate-600 to-slate-500 shadow-slate-600/30",
    ring: "from-slate-400 to-slate-300",
    halo: "bg-slate-300",
    bar: "bg-slate-600",
    label: "PROCESSING • एक पल...",
  },
  blocked: {
    button: "from-rose-600 to-rose-500 shadow-rose-600/30",
    ring: "from-rose-400 to-rose-300",
    halo: "bg-rose-300",
    bar: "bg-rose-600",
    label: "MIC BLOCKED • TAP A SUGGESTION BELOW",
  },
};

export function AiChamberView({ onExit, onServiceIntent }: AiChamberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHydrated = useHydrated();

  // 🔥 1. ACTIVE SERVICE ROUTER
  const [activeService, setActiveService] = useState<PortalServiceId | null>(null);

  const PAUSE_TIMESTAMP = 9.25;

  // 🔥 2. INITIALIZE FLOWS
  const tokenFlow = useTokenBookingFlow();
  const bedFlow = useBedAvailabilityFlow();
  const doctorFlow = useDoctorAvailabilityFlow();
  const appointmentFlow = useAppointmentFlow();

  /**
   * Agent registry.
   *
   * The master's `onIntent` has to reach the slave agents, but they are declared
   * after it — `bedVoice.start()` written straight into that callback is a
   * use-before-declaration and a hard TDZ crash the first time an intent fires.
   * Every agent is therefore published into this ref from a dependency-less
   * effect below and reached by id, so declaration order stops mattering.
   */
  const agentsRef = useRef<Partial<Record<PortalServiceId, VoiceAgentHandle>>>({});
  /** Mirrors `activeService` for synchronous reads inside handlers and timers. */
  const activeServiceRef = useRef<PortalServiceId | null>(null);
  const onServiceIntentRef = useRef(onServiceIntent);
  const onExitRef = useRef(onExit);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHandoffTimer = useCallback(() => {
    if (handoffTimerRef.current !== null) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
  }, []);

  // Pulled out of the flow objects so the callback below depends on four stable
  // functions rather than four objects that change identity every render.
  const { reset: resetTokenFlow } = tokenFlow;
  const { reset: resetBedFlow } = bedFlow;
  const { reset: resetDoctorFlow } = doctorFlow;
  const { reset: resetAppointmentFlow } = appointmentFlow;

  const resetFlow = useCallback(
    (service: PortalServiceId | null) => {
      switch (service) {
        case "token":
          resetTokenFlow();
          return;
        case "beds":
          resetBedFlow();
          return;
        case "doctors":
          resetDoctorFlow();
          return;
        case "appointment":
          resetAppointmentFlow();
          return;
        default:
          return;
      }
    },
    [resetAppointmentFlow, resetBedFlow, resetDoctorFlow, resetTokenFlow],
  );

  /** Master → slave, slave → slave, and slave → master all run through here. */
  const handoffTo = useCallback(
    (service: PortalServiceId) => {
      clearHandoffTimer();

      // Stand the outgoing agent down before anything else. Two agents must
      // never hold the microphone at once, and `stop()` also bumps that agent's
      // turn counter so an in-flight prompt cannot reopen the mic behind us.
      const outgoing = activeServiceRef.current ?? "token";
      if (outgoing !== service) agentsRef.current[outgoing]?.stop();

      setActiveService(service);
      onServiceIntentRef.current?.(service);

      handoffTimerRef.current = setTimeout(() => {
        handoffTimerRef.current = null;
        const agent = agentsRef.current[service];
        if (!agent) return;

        if (service === "token") {
          agent.submitText(TOKEN_HANDOFF_UTTERANCE);
          return;
        }
        // Slaves announce their opening question: the user has just asked for
        // the service and needs to be told what to say next.
        agent.start();
      }, HANDOFF_DELAY_MS);
    },
    [clearHandoffTimer],
  );

  const handleIntent = useCallback(
    (intent: VoiceIntent) => {
      const service = INTENT_TO_SERVICE[intent];
      if (!service) return;
      handoffTo(service);
    },
    [handoffTo],
  );

  /** Shared teardown for every agent's cancel path. */
  const handleAgentCancel = useCallback(
    (service: PortalServiceId) => {
      clearHandoffTimer();
      setActiveService(null);
      resetFlow(service);
      onExitRef.current?.();
    },
    [clearHandoffTimer, resetFlow],
  );

  // 🔥 3. TOKEN VOICE (MASTER)
  const tokenVoice = useVoiceTokenBooking({
    flow: tokenFlow,
    onBookingStart: () => setActiveService("token"),
    onIntent: handleIntent,
    onCancel: () => handleAgentCancel("token"),
  });

  // 🔥 4. SLAVE VOICES
  const bedVoice = useVoiceBedAvailability({
    flow: bedFlow,
    onIntent: handleIntent,
    onCancel: () => handleAgentCancel("beds"),
  });

  const doctorVoice = useVoiceDoctorAvailability({
    flow: doctorFlow,
    onIntent: handleIntent,
    onCancel: () => handleAgentCancel("doctors"),
  });

  const appointmentVoice = useVoiceAppointment({
    flow: appointmentFlow,
    onIntent: handleIntent,
    onCancel: () => handleAgentCancel("appointment"),
  });

  /**
   * Publishes this render's agents and props to their refs.
   *
   * Assigned from an effect, never during render, and only ever read from event
   * handlers and timers — all of which run after the commit.
   */
  useEffect(() => {
    agentsRef.current = {
      token: tokenVoice,
      beds: bedVoice,
      doctors: doctorVoice,
      appointment: appointmentVoice,
    };
    activeServiceRef.current = activeService;
    onServiceIntentRef.current = onServiceIntent;
    onExitRef.current = onExit;
  });

  // 🔥 5. DYNAMIC ACTIVE VOICE SELECTION
  // `token` falls through to the master, which is also who holds the mic before
  // any service has been chosen.
  const activeVoice: VoiceAgentHandle =
    activeService === "beds"
      ? bedVoice
      : activeService === "doctors"
        ? doctorVoice
        : activeService === "appointment"
          ? appointmentVoice
          : tokenVoice;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  // A queued handoff must not fire into an unmounted tree.
  useEffect(() => clearHandoffTimer, [clearHandoffTimer]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= PAUSE_TIMESTAMP && !video.paused) {
      video.pause();
    }
  };

  const handleReplay = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
    if (activeVoice.isActive) activeVoice.submitText("repeat");
  };

  const handleChipClick = (promptText: string) => {
    activeVoice.submitText(promptText);
  };

  const handleMicTap = () => {
    if (activeVoice.isActive) {
      activeVoice.stop();
      return;
    }
    activeVoice.start();
  };

  const handleModalClose = () => {
    clearHandoffTimer();
    const closing = activeService;
    setActiveService(null);
    activeVoice.stop();
    resetFlow(closing);
  };

  const micVisual: MicVisual = useMemo(() => {
    if (activeVoice.phase === "denied") return "blocked";
    if (!activeVoice.isActive) return "idle";
    if (activeVoice.isSpeaking) return "speaking";
    if (activeVoice.isListening) return "listening";
    return "thinking";
  }, [activeVoice.isActive, activeVoice.isListening, activeVoice.isSpeaking, activeVoice.phase]);

  const theme = MIC_THEME[micVisual];
  const isAnimated = activeVoice.isActive && micVisual !== "blocked";
  const liveTranscript = activeVoice.interimTranscript || activeVoice.transcript;

  const voiceState = useMemo(
    () => ({
      isActive: activeVoice.isActive,
      isSpeaking: activeVoice.isSpeaking,
      isListening: activeVoice.isListening,
      caption: activeVoice.caption,
      transcript: activeVoice.transcript,
      interimTranscript: activeVoice.interimTranscript,
    }),
    [
      activeVoice.caption,
      activeVoice.interimTranscript,
      activeVoice.isActive,
      activeVoice.isListening,
      activeVoice.isSpeaking,
      activeVoice.transcript,
    ]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-20 bg-[#adadad] text-slate-900 flex flex-col justify-end pt-28 pb-8 px-6 select-none overflow-hidden"
    >
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
            <div className="absolute inset-0 pointer-events-none [box-shadow:inset_0_0_40px_20px_#adadad]" />
          </div>

          <AnimatePresence>
            {activeVoice.isSpeaking && (
              <motion.div
                key="avatar-halo"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full pointer-events-none bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(245,158,11,0.28),transparent_70%)]"
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="relative z-30 flex flex-col items-center gap-4 max-w-2xl mx-auto w-full">
        {!activeVoice.isSupported && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 border border-amber-300 text-[11px] font-semibold text-amber-800 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Voice input isn&apos;t available in this browser.</span>
          </div>
        )}

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

        <AnimatePresence>
          {liveTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`text-xs font-mono font-bold px-4 py-1.5 rounded-full shadow-sm border max-w-full truncate ${
                activeVoice.interimTranscript
                  ? "text-emerald-900 bg-white/95 border-emerald-400"
                  : "text-sky-900 bg-white/95 border-sky-400"
              }`}
            >
              &quot;{liveTranscript}&quot;
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-6">
          <button
            onClick={handleReplay}
            className="p-3 rounded-full bg-white/80 border border-white/80 hover:bg-white text-slate-700 hover:text-sky-700 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="relative flex items-center justify-center">
            {isAnimated && (
              <>
                <motion.span
                  animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute inset-0 rounded-full bg-gradient-to-tr ${theme.ring} blur-md pointer-events-none`}
                />
                <motion.span
                  animate={{ scale: [1, 1.7, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className={`absolute inset-0 rounded-full ${theme.halo} blur-lg pointer-events-none`}
                />
              </>
            )}

            <button
              onClick={handleMicTap}
              className={`relative z-10 w-14 h-14 rounded-full bg-gradient-to-tr ${theme.button} text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer`}
            >
              {micVisual === "blocked" ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className={`w-6 h-6 ${isAnimated ? "animate-pulse" : ""}`} />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 h-6">
            {[40, 75, 100, 60, 85].map((height, i) => (
              <motion.span
                key={i}
                animate={
                  isAnimated
                    ? { height: [`${height * 0.3}%`, `${height}%`, `${height * 0.3}%`] }
                    : { height: "20%" }
                }
                transition={{
                  duration: activeVoice.isSpeaking ? 0.6 : 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.12,
                }}
                className={`w-1 ${theme.bar} rounded-full`}
                style={{ height: "40%" }}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] font-mono font-semibold text-slate-700 tracking-wider text-center">
          {theme.label}
        </p>
      </div>

      {isHydrated &&
        createPortal(
          <AnimatePresence>
            {/* 🔥 Conditionally rendering modals based on Active Service */}
            {activeService === "token" && (
              <TokenBookingModal
                isOpen={true}
                onClose={handleModalClose}
                flow={tokenFlow}
                voice={voiceState}
              />
            )}

            {activeService === "beds" && (
              <BedAvailabilityModal
                isOpen={true}
                onClose={handleModalClose}
                flow={bedFlow}
                voice={voiceState}
              />
            )}

            {activeService === "doctors" && (
              <DoctorAvailabilityModal
                isOpen={true}
                onClose={handleModalClose}
                flow={doctorFlow}
                voice={voiceState}
              />
            )}

            {activeService === "appointment" && (
              <BookAppointmentModal
                isOpen={true}
                onClose={handleModalClose}
                flow={appointmentFlow}
                voice={voiceState}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </motion.div>
  );
}
