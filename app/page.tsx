"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import CanvasStage from "@/components/3d/CanvasStage";
import { ModeToggle } from "@/components/ui/ModeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { HERO_COPY, type Language } from "@/data/translations";
import { AiChamberView } from "@/components/ai/AiChamberView";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { TokenBookingModal } from "@/components/modals/TokenBookingModal";
import { BedAvailabilityModal } from "@/components/modals/BedAvailabilityModal";
import { DoctorAvailabilityModal } from "@/components/modals/DoctorAvailabilityModal";
import { BookAppointmentModal } from "@/components/modals/BookAppointmentModal";
import { MedicalPreloader } from "@/components/ui/MedicalPreloader";
import {
  ChevronDown,
  Ticket,
  BedDouble,
  Stethoscope,
  CalendarCheck,
  Siren,
  HeartPulse,
  Droplet,
  ShieldAlert,
  HelpCircle,
  Hospital,
  Zap,
  Stethoscope as StethIcon,
} from "lucide-react";

// Icons for the three hero feature badges, paired positionally with
// HERO_COPY[language].badges so the labels stay translatable.
const HERO_BADGE_ICONS = [Stethoscope, Hospital, Zap];

const SERVICES = [
  {
    id: "token",
    title: "Token Booking",
    marathiTitle: "स्मार्ट ओपीडी टोकन",
    description: "Real-time queue tracking & automated digital OPD pass generation.",
    badge: "INSTANT PASS",
    icon: Ticket,
    accentColor: "#f59e0b",
  },
  {
    id: "beds",
    title: "Check Bed Availability",
    marathiTitle: "थेट बेड उपलब्धता",
    description: "Live monitoring of ICU, Oxygen, and General beds across district hospitals.",
    badge: "LIVE STATUS",
    icon: BedDouble,
    accentColor: "#0284c7",
  },
  {
    id: "doctors",
    title: "Doctor Availability",
    marathiTitle: "डॉक्टर वेळापत्रक",
    description: "Specialist consultation schedules, on-duty rotas & department shifts.",
    badge: "DAILY ROTAS",
    icon: Stethoscope,
    accentColor: "#059669",
  },
  {
    id: "appointment",
    title: "Book Appointment",
    marathiTitle: "तज्ज्ञ अपॉइंटमेंट",
    description: "Schedule consultations with district civil hospital specialists online.",
    badge: "SEAMLESS",
    icon: CalendarCheck,
    accentColor: "#7c3aed",
  },
];

const FAQS = [
  {
    q: "How does the Digital Token work?",
    a: "Generate a token online and show the QR code at the OPD counter to instantly fetch your triage details.",
  },
  {
    q: "Are the hospital beds real-time?",
    a: "Yes, bed availability is synced every 2 minutes using IoT sensors from the Hospital Management System.",
  },
  {
    q: "Can I book a specialist in advance?",
    a: "Absolutely. You can schedule appointments up to 3 days in advance for any district civil hospital.",
  },
];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAiMode, setIsAiMode] = useState(false);
  const [language, setLanguage] = useState<Language>("en");

  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

  const copy = HERO_COPY[language];
  const isLatin = language === "en";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
  });

  const glassOpacity = useTransform(scrollYProgress, [0, 0.4, 1], [0, 1, 1]);
  const heroHintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const handleCardClick = (id: string) => {
    if (id === "token") setIsTokenModalOpen(true);
    else if (id === "beds") setIsBedModalOpen(true);
    else if (id === "doctors") setIsDoctorModalOpen(true);
    else if (id === "appointment") setIsAppointmentModalOpen(true);
  };

  return (
    <main
      ref={scrollContainerRef}
      className={`relative w-full h-[100dvh] font-sans select-none overflow-x-hidden snap-y snap-mandatory scroll-smooth bg-[#f8fafc] ${
        isLoading ? "overflow-y-hidden" : "overflow-y-auto"
      }`}
    >
      {/* 1. 3D Medical Preloader */}
      <AnimatePresence>
        {isLoading && (
          <MedicalPreloader onComplete={() => setIsLoading(false)} />
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      {/* Self-contained dark glass bar: it sits above both the dark hero and the
          light frosted sections below, so it carries its own contrast. */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 md:px-8 py-4 pointer-events-auto">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-950/55 border border-white/15 backdrop-blur-xl px-3 md:px-4 py-2.5 shadow-lg shadow-black/25">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center font-bold text-amber-300 shadow-sm">
            MH
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
              {copy.govLine}
            </p>
            <h1 className="text-sm font-extrabold tracking-wide text-white">
              {copy.deptLine}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <LanguageSelector value={language} onChange={setLanguage} />

          <ModeToggle
            isAiMode={isAiMode}
            onToggle={() => setIsAiMode((prev) => !prev)}
          />
        </div>
      </header>

      {/* Background 3D Stage */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <CanvasStage isAiMode={isAiMode} />
      </div>

      {/* Global Frosted Glass Layer */}
      {/* Raised from white/30 to white/75: the hero backdrop is now darkened by
          the slate gradient, so the old value left the light-text-on-white
          sections below sitting on mid-grey. */}
      {!isAiMode && (
        <motion.div
          style={{ opacity: glassOpacity }}
          className="fixed inset-0 z-10 pointer-events-none bg-white/75 backdrop-blur-3xl backdrop-saturate-150 backdrop-contrast-105"
        />
      )}

      {/* UI WRAPPER */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 25 : 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20"
      >
        {/* --- SECTION 1: HERO --- */}
        {/* The 3D wordmark lives in the fixed WebGL canvas behind this section.
            With the camera at z=6 / fov 45 the visible height is ~4.97 world
            units, so the wordmark plus its ECG line occupy 39.5%-57.1% of the
            viewport at worst case (including the Float bob and tilt). The zone
            heights below leave that band empty so the DOM copy frames the 3D
            text instead of colliding with it. */}
        {!isAiMode && (
          <section className="relative h-[100dvh] w-full snap-start snap-always pointer-events-none">
            <motion.div
              style={{ opacity: heroHintOpacity }}
              className="flex flex-col items-center h-full w-full px-6"
            >
              {/* Above the wordmark: live network status */}
              <div className="h-[36dvh] flex items-end pb-3">
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-2.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md px-5 py-2 shadow-lg shadow-black/25"
                >
                  <span className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className="absolute inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400/60 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)]" />
                  </span>
                  <span
                    className={`text-[11px] md:text-xs font-bold text-white/90 ${
                      isLatin ? "uppercase tracking-widest" : "tracking-wide"
                    }`}
                  >
                    {copy.statusPill}
                  </span>
                </motion.div>
              </div>

              {/* Reserved band for the 3D wordmark + ECG pulse line */}
              <div className="h-[23dvh]" aria-hidden />

              {/* Below the wordmark: official subtitle + real feature badges */}
              <div className="flex flex-col items-center gap-5 md:gap-6 w-full max-w-4xl">
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center text-sm md:text-base font-medium leading-relaxed text-white/80 max-w-3xl"
                >
                  {copy.subtitle}
                </motion.p>

                <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3">
                  {copy.badges.map((badge, i) => {
                    const Icon = HERO_BADGE_ICONS[i];

                    return (
                      <motion.div
                        key={badge}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.6,
                          delay: 0.8 + i * 0.1,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md px-4 py-2.5 shadow-lg shadow-black/25"
                      >
                        <Icon className="w-4 h-4 shrink-0 text-teal-300" />
                        <span className="text-xs md:text-[13px] font-semibold text-white/90 whitespace-nowrap">
                          {badge}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Scroll affordance */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="mt-auto mb-10 flex flex-col items-center gap-1.5 text-white/80 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-lg shadow-black/25"
              >
                <span
                  className={`text-xs font-bold ${
                    isLatin ? "uppercase tracking-wider" : "tracking-wide"
                  }`}
                >
                  {copy.scrollHint}
                </span>
                <ChevronDown className="w-4 h-4 text-teal-300" />
              </motion.div>
            </motion.div>
          </section>
        )}

        {/* --- SECTION 2: SERVICES CARDS --- */}
        {!isAiMode && (
          <section className="relative min-h-[100dvh] w-full snap-start snap-always flex flex-col justify-center px-6 md:px-12 py-24 pointer-events-auto">
            <div className="w-full max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <span className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-mono font-bold tracking-wider uppercase mb-3 shadow-sm">
                  Digital Citizen Care Portal
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight drop-shadow-sm">
                  Public Healthcare Services
                </h2>
                <p className="text-sm font-medium text-slate-600 mt-2 max-w-xl mx-auto">
                  Access real-time hospital management amenities and token queues across Maharashtra.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {SERVICES.map((service, idx) => (
                  <ServiceCard
                    key={service.title}
                    {...service}
                    index={idx}
                    onClick={() => handleCardClick(service.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* --- SECTION 3: PREMIUM GLASS FOOTER DASHBOARD --- */}
        {!isAiMode && (
          <section className="relative min-h-[100dvh] w-full snap-start snap-always flex flex-col justify-center px-6 md:px-12 py-16 pointer-events-auto">
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
              
              {/* Col 1: Mission Card */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col justify-between h-full p-8 rounded-[2.5rem] bg-gradient-to-br from-white/60 to-white/30 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md relative overflow-hidden group"
              >
                {/* Decorative glow inside card */}
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-400/20 blur-3xl rounded-full transition-all duration-700 group-hover:bg-amber-400/30" />
                
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-lg shadow-amber-500/20 flex items-center justify-center text-white mb-6">
                    <StethIcon className="w-7 h-7" />
                  </div>
                  <h3 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
                    Our Mission
                  </h3>
                  <p className="text-xs font-mono tracking-widest text-amber-600 uppercase font-extrabold mt-1">
                    आरोग्य संपन्न महाराष्ट्र
                  </p>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mt-5">
                    Dedicated to providing accessible, transparent, and technology-driven public healthcare services to every citizen of Maharashtra. Our smart infrastructure ensures zero wait times and critical care readiness.
                  </p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-200/50 text-[11px] font-mono font-semibold text-slate-500 flex justify-between items-end">
                  <p>© 2026 Govt. of Maharashtra.<br/>All rights reserved.</p>
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  </div>
                </div>
              </motion.div>

              {/* Col 2: Emergency Hotlines */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <h3 className="text-xs font-extrabold tracking-widest text-slate-500 uppercase flex items-center gap-2 mb-5 pl-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Emergency Hotlines
                </h3>

                {/* 108 Ambulance */}
                <a href="tel:108" className="group relative flex items-center justify-between p-5 rounded-3xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-md hover:bg-white/80 hover:shadow-[0_12px_40px_rgb(225,29,72,0.15)] hover:border-rose-300/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                      <Siren className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Ambulance Service</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-medium">Medical Emergency & Trauma</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black font-mono text-rose-600 tracking-tighter relative z-10 drop-shadow-sm">108</span>
                </a>

                {/* 104 Health Helpline */}
                <a href="tel:104" className="group relative flex items-center justify-between p-5 rounded-3xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-md hover:bg-white/80 hover:shadow-[0_12px_40px_rgb(14,165,233,0.15)] hover:border-sky-300/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                      <HeartPulse className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Health Helpline</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-medium">Information & Grievance</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black font-mono text-sky-600 tracking-tighter relative z-10 drop-shadow-sm">104</span>
                </a>

                {/* 1910 Blood Bank */}
                <a href="tel:1910" className="group relative flex items-center justify-between p-5 rounded-3xl bg-white/40 border border-white/60 shadow-sm backdrop-blur-md hover:bg-white/80 hover:shadow-[0_12px_40px_rgb(245,158,11,0.15)] hover:border-amber-300/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                      <Droplet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Blood Bank Dial</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-medium">State Blood Transfusion</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black font-mono text-amber-500 tracking-tighter relative z-10 drop-shadow-sm">1910</span>
                </a>
              </motion.div>

              {/* Col 3: Quick FAQs */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <h3 className="text-xs font-extrabold tracking-widest text-slate-500 uppercase flex items-center gap-2 mb-5 pl-2">
                  <HelpCircle className="w-4 h-4 text-emerald-500" />
                  Quick FAQs
                </h3>

                <div className="space-y-4">
                  {FAQS.map((faq, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      className="group p-5 rounded-3xl bg-white/40 border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-md hover:bg-white/80 transition-all duration-300 cursor-default relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-400 to-emerald-200 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <h4 className="text-sm font-extrabold text-slate-900 mb-1.5 flex items-start gap-2 leading-tight">
                        <span className="text-emerald-500 mt-0.5">•</span> {faq.q}
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed pl-4">
                        {faq.a}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

            </div>
          </section>
        )}
      </motion.div>

      {/* --- ALL MODALS --- */}
      <AnimatePresence>
        {isTokenModalOpen && <TokenBookingModal isOpen={isTokenModalOpen} onClose={() => setIsTokenModalOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isBedModalOpen && <BedAvailabilityModal isOpen={isBedModalOpen} onClose={() => setIsBedModalOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isDoctorModalOpen && <DoctorAvailabilityModal isOpen={isDoctorModalOpen} onClose={() => setIsDoctorModalOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {isAppointmentModalOpen && <BookAppointmentModal isOpen={isAppointmentModalOpen} onClose={() => setIsAppointmentModalOpen(false)} />}
      </AnimatePresence>

      {/* AI Chamber View */}
      <AnimatePresence mode="wait">
        {isAiMode && (
          <motion.div
            key="ai-chamber-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="fixed inset-0 z-30 pointer-events-auto"
          >
            <AiChamberView />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}