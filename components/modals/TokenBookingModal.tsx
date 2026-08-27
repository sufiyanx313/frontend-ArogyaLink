"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  X,
  MapPin,
  Building2,
  Stethoscope,
  Activity,
  CheckCircle2,
  Sparkles,
  QrCode,
  Clock,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Building,
  UserCheck,
  Phone,
  KeyRound,
  ScanLine,
  Radio,
  Mic,
  Volume2,
} from "lucide-react";
import {
  DEPARTMENTS,
  DISTRICTS,
  SYMPTOMS,
} from "@/data/tokenBookingOptions";
import {
  type TokenBookingFlow,
  useTokenBookingFlow,
} from "@/hooks/useTokenBookingFlow";

/**
 * Read-only view of the voice agent, rendered as a status strip inside the
 * modal. Supplying it does not change how the wizard behaves — every option
 * stays clickable while the agent is talking, which is the whole point of the
 * manual-override requirement.
 */
export interface TokenBookingVoiceState {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  /** What the assistant is currently saying. */
  caption: string;
  /** Last complete thing the user said. */
  transcript: string;
  /** What the user is saying right now. */
  interimTranscript: string;
}

interface TokenBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Inject wizard state to run the modal in controlled mode — this is how the
   * voice agent drives it. Omit it and the modal owns its own state, which is
   * exactly the original click-driven behaviour.
   */
  flow?: TokenBookingFlow;
  voice?: TokenBookingVoiceState;
}

export function TokenBookingModal({
  isOpen,
  onClose,
  flow: injectedFlow,
  voice,
}: TokenBookingModalProps) {
  // Always called to satisfy the hooks rules; ignored when a flow is injected.
  // The internal instance sits idle at step "district" and starts no timers,
  // so keeping it around costs nothing.
  const internalFlow = useTokenBookingFlow();
  const flow = injectedFlow ?? internalFlow;

  const {
    step,
    district,
    hospital,
    department,
    symptom,
    phone,
    otp,
    userTokenNum,
    currentServingToken,
    tokenCodePrefix,
    activeCardTab,
    hospitalOptions,
  } = flow;

  // 3D Tilt Card Values
  const tokenCardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-150, 150], [12, -12]);
  const rotateY = useTransform(mouseX, [-150, 150], [-12, 12]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tokenCardRef.current) return;
    const rect = tokenCardRef.current.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const handleOtpChange = (val: string, index: number) => {
    if (val.length > 1) return;
    flow.setOtpDigit(val, index);

    if (val && index < 3) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // 5 Visible Sliding Queue Box Numbers
  const visibleTokens = [
    currentServingToken - 2,
    currentServingToken - 1,
    currentServingToken, // Center (Active - Green)
    currentServingToken + 1,
    currentServingToken + 2,
  ];

  const liveTranscript = voice?.interimTranscript || voice?.transcript || "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl"
      />

      {/* Main Glass Modal Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 25 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-2xl rounded-3xl bg-slate-50 border border-white/90 shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-slate-200/80 bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-amber-600 uppercase">
                Arogya Smart OPD Triage
              </p>
              <h3 className="text-base font-extrabold text-slate-900">
                डिजिटल ओपीडी टोकन प्रणाली
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voice agent status strip — only while the AI is driving the wizard */}
        <AnimatePresence>
          {voice?.isActive && (
            <motion.div
              key="voice-strip"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-amber-200/80 bg-gradient-to-r from-amber-50 via-amber-50/60 to-white"
            >
              <div className="px-7 py-2.5 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {voice.isSpeaking ? (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700">
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
                      : "बोलिए, या नीचे से कोई भी विकल्प टैप कीजिए — दोनों चलेंगे."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Wizard Body */}
        <div className="p-7 min-h-[420px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {/* Step 1: District */}
            {step === "district" && (
              <motion.div
                key="step-district"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Step 1: Select Your District / जिल्हा निवडा
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISTRICTS.map((dist) => (
                    <button
                      key={dist.id}
                      onClick={() => flow.selectDistrict(dist)}
                      className="p-4 rounded-2xl bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <span>{dist.label}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Hospital */}
            {step === "hospital" && (
              <motion.div
                key="step-hospital"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 2: Select Hospital / रुग्णालय निवडा
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    {district?.label}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {hospitalOptions.map((hosp) => (
                    <button
                      key={hosp.id}
                      onClick={() => flow.selectHospital(hosp)}
                      className="p-4 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{hosp.name}</p>
                        <p className="text-[11px] text-sky-700 font-medium">District Public Healthcare Authority</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Department */}
            {step === "department" && (
              <motion.div
                key="step-department"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 3: Select OPD Department / विभाग निवडा
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-bold truncate max-w-[200px]">
                    {hospital?.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => flow.selectDepartment(dept)}
                      className="p-4 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-left transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer"
                    >
                      <p className="text-[10px] font-mono font-bold text-emerald-600 uppercase">{dept.marathi}</p>
                      <p className="text-sm font-bold text-slate-900">{dept.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">{dept.counter} • {dept.room}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Symptoms */}
            {step === "symptoms" && (
              <motion.div
                key="step-symptoms"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Activity className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 4: Primary Symptom / मुख्य लक्षणे
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-600 font-bold">
                    {department?.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SYMPTOMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => flow.selectSymptom(item)}
                      className="p-3.5 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-400 text-left font-semibold text-slate-800 text-xs transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 5: OTP */}
            {step === "otp" && (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                className="space-y-5 max-w-md mx-auto w-full"
              >
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 mx-auto mb-2">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Patient Mobile Verification
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your mobile number to receive live OPD queue tracking SMS
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="10-digit Mobile Number"
                      value={phone}
                      maxLength={10}
                      onChange={(e) => flow.setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs font-mono font-bold outline-none text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {[0, 1, 2, 3].map((index) => (
                      <input
                        key={index}
                        id={`otp-input-${index}`}
                        type="text"
                        maxLength={1}
                        value={otp[index]}
                        onChange={(e) => handleOtpChange(e.target.value, index)}
                        className="w-12 h-12 rounded-xl bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-center font-mono text-base font-black outline-none text-slate-900"
                      />
                    ))}
                  </div>
                </div>

                <button
                  disabled={phone.length < 10}
                  onClick={flow.generateToken}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Identity & Generate Token</span>
                </button>
              </motion.div>
            )}

            {/* Step 6: Generating */}
            {step === "generating" && (
              <motion.div
                key="step-generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500"
                  />
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 shadow-xl shadow-amber-500/30 flex items-center justify-center text-white">
                    <Sparkles className="w-7 h-7 animate-pulse" />
                  </div>
                </div>

                <h4 className="text-lg font-extrabold text-slate-900">
                  Allocating Live OPD Slot...
                </h4>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  Connecting to Digital Queue Corridor
                </p>
              </motion.div>
            )}

            {/* STEP 7: 3-TAB CAROUSEL (PASS, QR & 3D QUEUE STREAM) */}
            {step === "token" && (
              <motion.div
                key="step-token"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center"
              >
                {/* 3D Tilt Wrapper */}
                <div
                  className="perspective-1000 w-full flex justify-center cursor-grab active:cursor-grabbing"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <motion.div
                    ref={tokenCardRef}
                    style={{
                      rotateX,
                      rotateY,
                      transformStyle: "preserve-3d",
                    }}
                    className="relative w-full max-w-[430px] rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-1 shadow-[0_20px_50px_rgba(245,158,11,0.35)] select-none transition-shadow"
                  >
                    <div className="relative w-full min-h-[300px] rounded-[22px] bg-slate-950/90 backdrop-blur-xl p-5 text-white overflow-hidden border border-white/15 flex flex-col justify-between">

                      {/* Ambient Sheen */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

                      {/* Header Stamp */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[9px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                              Govt. of Maharashtra
                            </p>
                            <p className="text-[10px] text-slate-300 font-medium">Public Health Department</p>
                          </div>
                        </div>
                        <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CONFIRMED</span>
                        </div>
                      </div>

                      {/* CAROUSEL SWITCHER */}
                      <AnimatePresence mode="wait">
                        {/* TAB 0: TOKEN PASS */}
                        {activeCardTab === 0 && (
                          <motion.div
                            key="tab-token"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }}
                            className="py-1"
                          >
                            <div className="text-left">
                              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Building className="w-3 h-3 text-amber-400" />
                                <span className="truncate">{hospital?.name || "District Hospital"}</span>
                              </p>
                              <p className="text-xs font-bold text-slate-200 mt-0.5">
                                {department?.name} ({department?.marathi})
                              </p>
                            </div>

                            <div className="my-3 py-2.5 bg-slate-900/80 rounded-2xl border border-slate-800/80 text-center">
                              <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                                Priority Queue Token
                              </p>
                              <h2 className="text-3xl font-black font-mono tracking-tight text-amber-400 drop-shadow-sm my-0.5">
                                {tokenCodePrefix}-{userTokenNum}
                              </h2>
                              <p className="text-[10px] font-mono text-slate-400">
                                Symptom: {symptom?.spoken || "General"}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-center font-mono">
                              <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                                <div className="flex items-center justify-center gap-1 text-amber-400 mb-0.5">
                                  <Clock className="w-3 h-3" />
                                </div>
                                <p className="text-[8px] text-slate-400">Wait</p>
                                <p className="text-[10px] font-bold text-slate-200">
                                  ~{Math.max(0, (userTokenNum - currentServingToken) * 4)} Mins
                                </p>
                              </div>

                              <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                                <div className="flex items-center justify-center gap-1 text-sky-400 mb-0.5">
                                  <UserCheck className="w-3 h-3" />
                                </div>
                                <p className="text-[8px] text-slate-400">Desk</p>
                                <p className="text-[10px] font-bold text-slate-200">{department?.counter || "Desk 02"}</p>
                              </div>

                              <div className="bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-0.5">
                                  <QrCode className="w-3 h-3" />
                                </div>
                                <p className="text-[8px] text-slate-400">Room</p>
                                <p className="text-[10px] font-bold text-slate-200">{department?.room || "Room 14"}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* TAB 1: DOCTOR QR */}
                        {activeCardTab === 1 && (
                          <motion.div
                            key="tab-qr"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }}
                            className="py-1 flex flex-col items-center text-center"
                          >
                            <div className="relative p-2.5 bg-white rounded-2xl shadow-inner mt-1">
                              <svg className="w-24 h-24 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                                <rect x="0" y="0" width="28" height="28" rx="4" />
                                <rect x="4" y="4" width="20" height="20" fill="white" rx="2" />
                                <rect x="8" y="8" width="12" height="12" />
                                <rect x="72" y="0" width="28" height="28" rx="4" />
                                <rect x="76" y="4" width="20" height="20" fill="white" rx="2" />
                                <rect x="80" y="8" width="12" height="12" />
                                <rect x="0" y="72" width="28" height="28" rx="4" />
                                <rect x="4" y="76" width="20" height="20" fill="white" rx="2" />
                                <rect x="8" y="80" width="12" height="12" />
                                <rect x="36" y="8" width="8" height="18" />
                                <rect x="48" y="16" width="16" height="8" />
                                <rect x="36" y="38" width="28" height="24" rx="2" />
                                <rect x="12" y="38" width="16" height="8" />
                                <rect x="72" y="38" width="18" height="16" />
                                <rect x="38" y="72" width="16" height="20" />
                                <rect x="62" y="72" width="28" height="8" />
                                <rect x="76" y="86" width="14" height="14" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <ScanLine className="w-16 h-16 text-amber-500/70 animate-pulse" />
                              </div>
                            </div>

                            <p className="text-[11px] font-mono font-bold text-amber-400 mt-2">
                              DOCTOR OPD TRIAGE SCANNER
                            </p>
                            <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                              Scan at counter to automatically load pre-triage health sheet
                            </p>
                          </motion.div>
                        )}

                        {/* TAB 2: 5-BOX 3D SLIDING QUEUE CORRIDOR */}
                        {activeCardTab === 2 && (
                          <motion.div
                            key="tab-queue"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }}
                            className="py-1 flex flex-col items-center justify-center"
                          >
                            <div className="flex items-center justify-between w-full px-2 mb-2">
                              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                                Live OPD Stream
                              </span>
                              <span className="text-[9px] font-mono text-amber-400 font-bold">
                                Your Token: #{userTokenNum}
                              </span>
                            </div>

                            {/* 5-BOX 3D STREAM CONTAINER */}
                            <div className="relative w-full flex items-center justify-center gap-2 py-3 overflow-hidden">
                              {visibleTokens.map((num, idx) => {
                                const isCenter = idx === 2; // Middle 3rd Box
                                const isUserToken = num === userTokenNum;

                                // Base colors
                                let borderGlow = "border-slate-800 bg-slate-900/60 text-slate-400";
                                let tagBadge = null;

                                if (isCenter) {
                                  // Green Active Doctor Serving Window
                                  borderGlow = "border-emerald-500 bg-emerald-950/70 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-110 z-10";
                                  tagBadge = (
                                    <span className="absolute -top-2.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[7px] font-black text-slate-950 uppercase tracking-wider">
                                      NOW
                                    </span>
                                  );
                                } else if (isUserToken) {
                                  // Orange / Amber Alert when User Token enters the 5-box window
                                  borderGlow = "border-amber-500 bg-amber-950/70 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105 z-10";
                                  tagBadge = (
                                    <span className="absolute -top-2.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-[7px] font-black text-slate-950 uppercase tracking-wider animate-bounce">
                                      YOU
                                    </span>
                                  );
                                }

                                return (
                                  <motion.div
                                    key={num}
                                    layout
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                    className={`relative flex flex-col items-center justify-center w-14 h-16 rounded-xl border-2 backdrop-blur-md transition-all duration-300 ${borderGlow}`}
                                    style={{
                                      boxShadow: isCenter
                                        ? "0 10px 25px -5px rgba(16, 185, 129, 0.4)"
                                        : isUserToken
                                        ? "0 10px 25px -5px rgba(245, 158, 11, 0.4)"
                                        : undefined,
                                    }}
                                  >
                                    {tagBadge}
                                    <span className="text-[8px] font-mono text-slate-500 font-bold">OPD</span>
                                    <span className="text-base sm:text-lg font-black font-mono tracking-tight">
                                      {num}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>

                            <p className="text-[9px] font-mono text-slate-400 mt-2 text-center">
                              {currentServingToken === userTokenNum ? (
                                <span className="text-emerald-400 font-bold animate-pulse">
                                  👉 It&apos;s your turn! Please proceed to {department?.room || "Room 14"}.
                                </span>
                              ) : (
                                <span>
                                  Doctor is currently attending Token <strong>#{currentServingToken}</strong>. Next in queue auto-shifts left.
                                </span>
                              )}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  </motion.div>
                </div>

                {/* 3 INTERACTIVE DOTS */}
                <div className="flex items-center gap-2 mt-3.5">
                  {([0, 1, 2] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => flow.setActiveCardTab(tab)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        activeCardTab === tab
                          ? "w-7 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                          : "w-2 bg-slate-300 hover:bg-slate-400"
                      }`}
                    />
                  ))}
                </div>

                <p className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                  <span>* Click 3 dots to view Token, Doctor QR, or Live 3D Queue stream</span>
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={flow.reset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Book Another</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    Done &amp; Save Pass
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
