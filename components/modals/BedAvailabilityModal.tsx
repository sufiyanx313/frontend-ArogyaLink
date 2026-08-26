"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Building2,
  BedDouble,
  Activity,
  HeartPulse,
  Wind,
  ShieldAlert,
  Radio,
  RotateCcw,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface BedAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DISTRICTS = [
  "Pune (पुणे)",
  "Mumbai Suburban (मुंबई उपनगर)",
  "Nagpur (नागपूर)",
  "Nashik (नाशिक)",
  "Chhatrapati Sambhajinagar (छ. संभाजीनगर)",
  "Thane (ठाणे)",
];

const HOSPITALS: Record<string, string[]> = {
  "Pune (पुणे)": [
    "Sassoon General Hospital & BJMC",
    "Aundh District Civil Hospital",
    "YCM Hospital & Medical College",
  ],
  "Mumbai Suburban (मुंबई उपनगर)": [
    "KEM Hospital & Seth GS Medical College",
    "Lokmanya Tilak Municipal General Hospital (Sion)",
    "Cooper Hospital & HBT Medical College",
  ],
  "Nagpur (नागपूर)": [
    "Government Medical College & Hospital (GMCH)",
    "Indira Gandhi GMC (Mayo Hospital)",
  ],
  "Nashik (नाशिक)": [
    "Nashik District Civil Hospital",
    "General Hospital Malegaon",
  ],
  "Chhatrapati Sambhajinagar (छ. संभाजीनगर)": [
    "Government Medical College & Hospital (Ghati)",
    "District Civil Hospital Chh. Sambhajinagar",
  ],
  "Thane (ठाणे)": [
    "Thane District Civil Hospital",
    "Chhatrapati Shivaji Maharaj Hospital Kalwa",
  ],
};

// Ward Bed Matrix Categories
const WARD_CATEGORIES = [
  {
    id: "icu",
    name: "ICU / Ventilator",
    marathi: "तीव्र दक्षता विभाग",
    total: 48,
    available: 7,
    occupied: 41,
    icon: HeartPulse,
    accent: "#ef4444",
    bgAccent: "rgba(239,68,68,0.1)",
    borderAccent: "rgba(239,68,68,0.3)",
  },
  {
    id: "oxygen",
    name: "Oxygen Supported",
    marathi: "प्राणवायू बेड",
    total: 120,
    available: 24,
    occupied: 96,
    icon: Wind,
    accent: "#0284c7",
    bgAccent: "rgba(2,132,199,0.1)",
    borderAccent: "rgba(2,132,199,0.3)",
  },
  {
    id: "general",
    name: "General Ward",
    marathi: "सामान्य वॉर्ड",
    total: 250,
    available: 68,
    occupied: 182,
    icon: BedDouble,
    accent: "#059669",
    bgAccent: "rgba(5,150,105,0.1)",
    borderAccent: "rgba(5,150,105,0.3)",
  },
  {
    id: "emergency",
    name: "Emergency Trauma",
    marathi: "आपत्कालीन विभाग",
    total: 30,
    available: 4,
    occupied: 26,
    icon: ShieldAlert,
    accent: "#f59e0b",
    bgAccent: "rgba(245,158,11,0.1)",
    borderAccent: "rgba(245,158,11,0.3)",
  },
];

export function BedAvailabilityModal({ isOpen, onClose }: BedAvailabilityModalProps) {
  const [step, setStep] = useState<"district" | "hospital" | "scanning" | "dashboard">("district");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("icu");

  const startLiveScanning = (hosp: string) => {
    setSelectedHospital(hosp);
    setStep("scanning");

    // Live MH-Cloud Bed Sync Animation
    setTimeout(() => {
      setStep("dashboard");
    }, 2400);
  };

  const resetFlow = () => {
    setSelectedDistrict("");
    setSelectedHospital("");
    setStep("district");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Dim Frosted Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl"
      />

      {/* Main Glass Modal Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl bg-slate-50 border border-white/90 shadow-2xl overflow-hidden text-slate-900 max-h-[90vh] flex flex-col"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-slate-200/80 bg-white/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 font-bold">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-sky-600 uppercase">
                Maharashtra Live Bed Network
              </p>
              <h3 className="text-base font-extrabold text-slate-900">
                थेट रुग्णालय बेड उपलब्धता कक्ष
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

        {/* Modal Body */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* STEP 1: District Selection */}
            {step === "district" && (
              <motion.div
                key="step-district"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Step 1: Select District / जिल्हा निवडा
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISTRICTS.map((dist) => (
                    <button
                      key={dist}
                      onClick={() => {
                        setSelectedDistrict(dist);
                        setStep("hospital");
                      }}
                      className="p-4 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <span>{dist}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Hospital Selection */}
            {step === "hospital" && (
              <motion.div
                key="step-hospital"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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
                    {selectedDistrict}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {(HOSPITALS[selectedDistrict] || []).map((hosp) => (
                    <button
                      key={hosp}
                      onClick={() => startLiveScanning(hosp)}
                      className="p-4 rounded-2xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{hosp}</p>
                        <p className="text-[11px] text-sky-700 font-medium flex items-center gap-1 mt-0.5">
                          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                          Live IoT Bed Sensors Online
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: SCANNING ANIMATION (No Tilt) */}
            {step === "scanning" && (
              <motion.div
                key="step-scanning"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                {/* Clean 3D Geometric Concentric Radar */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full border-2 border-sky-400/40 bg-sky-500/5"
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-dashed border-sky-500"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 shadow-xl shadow-sky-500/30 flex items-center justify-center text-white"
                  >
                    <Activity className="w-8 h-8 animate-pulse" />
                  </motion.div>
                </div>

                <h4 className="text-base md:text-lg font-extrabold text-slate-900">
                  Fetching Live Bed Telemetry...
                </h4>
                <p className="text-xs font-mono text-slate-500 mt-1 max-w-sm">
                  Connecting to {selectedHospital} Hospital Information Management System (HIMS)
                </p>

                {/* Micro Live Status Trackers */}
                <div className="flex items-center gap-4 mt-6 text-[10px] font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    ICU Cloud Active
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                    Oxygen Line Synced
                  </span>
                </div>
              </motion.div>
            )}

            {/* STEP 4: LIVE COMMAND CENTER DASHBOARD */}
            {step === "dashboard" && (
              <motion.div
                key="step-dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-6"
              >
                {/* Hospital Header Meta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-600">
                      {selectedDistrict} • Real-time Triage
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      {selectedHospital}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE SYNCED (2m ago)
                    </span>
                  </div>
                </div>

                {/* 4 Ward Bed Matrix Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {WARD_CATEGORIES.map((ward) => {
                    const Icon = ward.icon;
                    const isSelected = selectedCategory === ward.id;
                    const percentVacant = Math.round((ward.available / ward.total) * 100);

                    return (
                      <button
                        key={ward.id}
                        onClick={() => setSelectedCategory(ward.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? "bg-white border-slate-900 ring-2 ring-slate-900/10 shadow-md"
                            : "bg-white/70 border-slate-200/80 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: ward.bgAccent, color: ward.accent }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span
                            className="text-xs font-mono font-black px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: ward.bgAccent, color: ward.accent }}
                          >
                            {ward.available} Left
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-900 truncate">{ward.name}</p>
                        <p className="text-[9px] text-slate-500 font-mono mb-2">{ward.marathi}</p>

                        {/* Mini Occupancy Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${100 - percentVacant}%`,
                              backgroundColor: ward.accent,
                            }}
                          />
                        </div>
                        <p className="text-[8px] font-mono text-slate-400 mt-1">
                          {ward.occupied}/{ward.total} Beds Occupied
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* INTERACTIVE WARD FLOOR BED-GRID */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                        Ward Floor Plan Live Grid
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-2 h-2 rounded-xs bg-emerald-500" /> Vacant (Ready)
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className="w-2 h-2 rounded-xs bg-slate-700" /> Occupied
                      </span>
                    </div>
                  </div>

                  {/* Bed Grid Visualization (16 Beds Sample) */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 py-1">
                    {Array.from({ length: 16 }).map((_, i) => {
                      const isVacant = i === 2 || i === 5 || i === 11 || i === 14;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                            isVacant
                              ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                              : "border-slate-800 bg-slate-950/60 text-slate-600"
                          }`}
                        >
                          <BedDouble className={`w-3.5 h-3.5 mb-1 ${isVacant ? "text-emerald-400" : "text-slate-600"}`} />
                          <span className="text-[9px] font-mono font-bold">B-{i + 101}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Emergency Action Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    onClick={resetFlow}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Select Another Hospital</span>
                  </button>

                  <a
                    href="tel:108"
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Emergency Ambulance (108)</span>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}