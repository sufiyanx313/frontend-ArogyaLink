"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Building2,
  Stethoscope,
  Clock,
  Search,
  RotateCcw,
  ArrowRight,
  Radio,
  MapPinOff,
  Activity,
  Footprints,
  Syringe,
} from "lucide-react";

import {
  type DoctorAvailabilityFlow,
  useDoctorAvailabilityFlow,
} from "@/hooks/useDoctorAvailabilityFlow";
import { DISTRICTS } from "@/data/tokenBookingOptions";
import { SPECIALIST_DEPARTMENTS } from "@/data/serviceOptions";
import type { VoiceServiceState } from "@/lib/voice/agent";
import { VoiceStatusStrip } from "@/components/modals/VoiceStatusStrip";

/**
 * Specialist duty-roster wizard.
 *
 * Same controlled/standalone split as `BedAvailabilityModal`: when the AI chamber
 * injects a `flow`, this screen and the voice agent drive one state machine, so a
 * department named out loud moves the pills here and a card tapped here is picked
 * up by the agent's reconciliation effect. Without it the modal runs its own flow
 * and behaves as a plain touch wizard.
 *
 * The districts and hospitals now come from `data/tokenBookingOptions` rather than
 * from local label-keyed literals. The old `HOSPITALS` map was keyed by display
 * strings such as `"Pune (पुणे)"`, which meant one typo anywhere produced a
 * silently empty hospital list — and gave the voice agent nothing matchable.
 */

interface DoctorAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Injected by the AI chamber so voice and touch share one state machine. */
  flow?: DoctorAvailabilityFlow;
  /** Read-only agent status, for the strip under the header. */
  voice?: VoiceServiceState;
}

/** The filter pills: an "everything" pill, then the specialties. */
const DEPARTMENT_PILLS = [
  { id: "ALL", label: "All Specialists / सर्व विभाग" },
  ...SPECIALIST_DEPARTMENTS.map((department) => ({
    id: department.id,
    label: department.name,
  })),
];

export function DoctorAvailabilityModal({
  isOpen,
  onClose,
  flow: injectedFlow,
  voice,
}: DoctorAvailabilityModalProps) {
  // Always called, so hook order stays stable between controlled and uncontrolled
  // use; the result is ignored when a flow is supplied.
  const internalFlow = useDoctorAvailabilityFlow();
  const flow = injectedFlow ?? internalFlow;

  if (!isOpen) return null;

  const showDistricts = flow.step === "district";
  const showHospitals = flow.step === "hospital" && !flow.isFetching;
  const showRoster = flow.step === "completed" && !flow.isFetching;

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

      {/* Main Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl bg-slate-50 border border-white/90 shadow-2xl overflow-hidden text-slate-900 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-slate-200/80 bg-white/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-emerald-600 uppercase">
                Specialist Biometric &amp; Ward Tracking
              </p>
              <h3 className="text-base font-extrabold text-slate-900">
                डॉक्टर वेळापत्रक, वॉर्ड राउंड व उपस्थिती
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

        <div className="shrink-0">
          <VoiceStatusStrip voice={voice} accent="emerald" />
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* STEP 1: District */}
            {showDistricts && (
              <motion.div
                key="step-district"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Step 1: Select District / जिल्हा निवडा
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISTRICTS.map((district) => (
                    <button
                      key={district.id}
                      onClick={() => flow.selectDistrict(district)}
                      className="p-4 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <span>{district.label}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Hospital */}
            {showHospitals && (
              <motion.div
                key="step-hospital"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 2: Select Hospital / रुग्णालय निवडा
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    {flow.district?.label}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {flow.hospitalOptions.map((hospital) => (
                    <button
                      key={hospital.id}
                      onClick={() => flow.selectHospital(hospital)}
                      className="p-4 rounded-2xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{hospital.name}</p>
                        <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                          Live Doctor Attendance Beacon Online
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: 3D AESTHETIC FETCHING ANIMATION (No Tilt) */}
            {flow.isFetching && (
              <motion.div
                key="step-fetching"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                {/* Geometric Heartbeat Beacon Mesh */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-400/40 bg-emerald-500/5"
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-dashed border-emerald-500"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-xl shadow-emerald-500/30 flex items-center justify-center text-white"
                  >
                    <Activity className="w-8 h-8 animate-pulse" />
                  </motion.div>
                </div>

                <h4 className="text-base md:text-lg font-extrabold text-slate-900">
                  Scanning Specialist Shift Beacon...
                </h4>
                <p className="text-xs font-mono text-slate-500 mt-1 max-w-sm">
                  Connecting to {flow.hospital?.name} Departmental Attendance &amp; Round
                  Registry
                </p>

                <div className="flex items-center gap-4 mt-6 text-[10px] font-mono text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Biometric Active
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                    Ward GPS Synced
                  </span>
                </div>
              </motion.div>
            )}

            {/* STEP 4: LIVE DOCTORS & WARD TRACKER */}
            {showRoster && (
              <motion.div
                key="step-roster"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="space-y-5"
              >
                {/* Hospital Header & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600">
                      {flow.district?.label} • Live Duty Tracker
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      {flow.hospital?.name}
                    </h4>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search doctor or dept..."
                      value={flow.searchQuery}
                      onChange={(event) => flow.setSearchQuery(event.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Department Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {DEPARTMENT_PILLS.map((department) => (
                    <button
                      key={department.id}
                      onClick={() => flow.setDepartmentFilter(department.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        flow.departmentFilter === department.id
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                      }`}
                    >
                      {department.label}
                    </button>
                  ))}
                </div>

                {/* DOCTORS LIVE ROSTER CARDS */}
                <div className="space-y-3.5">
                  {flow.doctorRoster.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-mono">
                      No specialists found matching your search.
                    </div>
                  ) : (
                    flow.doctorRoster.map((doc) => {
                      const isOnOpd = doc.status === "ON_DUTY_OPD";
                      const isWardRound = doc.status === "WARD_ROUND";
                      const isInOt = doc.status === "IN_OT";
                      const isOtherHospital = doc.status === "OTHER_HOSPITAL";
                      // The card the agent just spoke about, so the answer is
                      // visible as well as audible.
                      const isFocused = flow.focusedDoctorId === doc.id;

                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => flow.focusDoctor(isFocused ? null : doc.id)}
                          className={`w-full text-left p-4 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                            isFocused
                              ? "border-emerald-500 ring-2 ring-emerald-500/15"
                              : "border-slate-200/90"
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            {/* Doctor Profile */}
                            <div className="flex items-start gap-3.5">
                              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 font-bold text-base shrink-0">
                                👨‍⚕️
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-sm font-extrabold text-slate-900">
                                    {doc.name}
                                  </h5>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    ({doc.marathiName})
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-600 mt-0.5">
                                  {doc.deptName} •{" "}
                                  <span className="text-[11px] text-emerald-700 font-mono font-bold">
                                    {doc.qualifications}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Live Dynamic Status Badge */}
                            <div>
                              {isOnOpd && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-[10px] font-mono font-bold text-emerald-700">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  IN OPD CHAMBER
                                </span>
                              )}

                              {isWardRound && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-300 text-[10px] font-mono font-bold text-sky-700">
                                  <Footprints className="w-3 h-3 text-sky-600 animate-bounce" />
                                  ON WARD ROUNDS
                                </span>
                              )}

                              {isInOt && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-300 text-[10px] font-mono font-bold text-rose-700">
                                  <Syringe className="w-3 h-3 text-rose-600 animate-pulse" />
                                  IN EMERGENCY OT
                                </span>
                              )}

                              {isOtherHospital && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-[10px] font-mono font-bold text-amber-700">
                                  <MapPinOff className="w-3 h-3 text-amber-600" />
                                  DEPUTED AT OTHER HOSPITAL
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Real-time Location & Status Bar */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10px] font-mono">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <div>
                                <p className="text-slate-400 text-[8px] uppercase">
                                  Exact Location
                                </p>
                                <p className="font-bold truncate">{doc.currentLocation}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Activity className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <div>
                                <p className="text-slate-400 text-[8px] uppercase">
                                  Current Activity
                                </p>
                                <p className="font-bold truncate">{doc.servingState}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <div>
                                <p className="text-slate-400 text-[8px] uppercase">
                                  Est. Next Turn
                                </p>
                                <p className="font-bold truncate">{doc.estimatedWait}</p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Bottom Reset */}
                <div className="pt-2">
                  <button
                    onClick={flow.backToHospitals}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Select Another Hospital</span>
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
