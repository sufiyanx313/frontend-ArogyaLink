"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  CreditCard,
} from "lucide-react";

import { type AppointmentFlow, useAppointmentFlow } from "@/hooks/useAppointmentFlow";
import { DISTRICTS } from "@/data/tokenBookingOptions";
import { APPOINTMENT_DATES, APPOINTMENT_SLOTS } from "@/data/serviceOptions";
import type { VoiceServiceState } from "@/lib/voice/agent";
import { VoiceStatusStrip } from "@/components/modals/VoiceStatusStrip";

/**
 * Specialist appointment wizard.
 *
 * Controlled by the AI chamber when a `flow` is injected, standalone otherwise —
 * the same split as the other three service modals, so voice and touch always
 * drive one state machine rather than two that drift apart.
 *
 * The doctor list is now `flow.doctorOptions`, which comes from the shared roster
 * in `data/serviceOptions`. The local `DOCTOR_SPECIALISTS` array this file used to
 * carry disagreed with the duty roster on ids — doc-3 was Shinde here and Patil
 * on the availability screen — so the slip could name a different specialist than
 * the one the user had just been told was on duty.
 */

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Injected by the AI chamber so voice and touch share one state machine. */
  flow?: AppointmentFlow;
  /** Read-only agent status, for the strip under the header. */
  voice?: VoiceServiceState;
}

export function BookAppointmentModal({
  isOpen,
  onClose,
  flow: injectedFlow,
  voice,
}: BookAppointmentModalProps) {
  // Always called, so hook order stays stable between controlled and
  // uncontrolled use; the result is ignored when a flow is supplied.
  const internalFlow = useAppointmentFlow();
  const flow = injectedFlow ?? internalFlow;

  if (!isOpen) return null;

  const showDistricts = flow.step === "district";
  const showHospitals = flow.step === "hospital";
  const showDoctors = flow.step === "doctor";
  const showSlots = flow.step === "slot";
  const showPatientForm = flow.step === "patient_info" && !flow.isConfirming;
  const showSlip = flow.step === "completed" && !flow.isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Frosted Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl"
      />

      {/* Main Glass Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-3xl rounded-3xl bg-slate-50 border border-white/90 shadow-2xl overflow-hidden text-slate-900 max-h-[92vh] flex flex-col"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-slate-200/80 bg-white/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-purple-600 uppercase">
                Specialist OPD Online Appointment
              </p>
              <h3 className="text-base font-extrabold text-slate-900">
                तज्ज्ञ डॉक्टर थेट अपॉइंटमेंट प्रणाली
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
          <VoiceStatusStrip voice={voice} accent="violet" />
        </div>

        {/* Modal Body */}
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
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Step 1: Select District / जिल्हा निवडा
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DISTRICTS.map((district) => (
                    <button
                      key={district.id}
                      onClick={() => flow.selectDistrict(district)}
                      className="p-4 rounded-2xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
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
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 2: Select Hospital / रुग्णालय निवडा
                    </span>
                  </div>
                  <button
                    onClick={flow.backToDistricts}
                    className="text-[11px] font-mono text-purple-600 font-bold hover:underline cursor-pointer"
                  >
                    Change ({flow.district?.label})
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {flow.hospitalOptions.map((hospital) => (
                    <button
                      key={hospital.id}
                      onClick={() => flow.selectHospital(hospital)}
                      className="p-4 rounded-2xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-400 text-left font-semibold text-slate-800 transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{hospital.name}</p>
                        <p className="text-[11px] text-purple-700 font-medium">
                          Digital OPD Appointment Facility Enabled
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Doctor Specialist Selection */}
            {showDoctors && (
              <motion.div
                key="step-doctor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Stethoscope className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 3: Select Specialist Doctor / तज्ज्ञ डॉक्टर निवडा
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-bold truncate max-w-[200px]">
                    {flow.hospital?.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {flow.doctorOptions.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => flow.selectDoctor(doc)}
                      className="p-4 rounded-2xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-400 text-left transition-all hover:scale-[1.01] active:scale-95 shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-mono font-bold text-purple-600 uppercase">
                          {doc.deptName}
                        </span>
                        <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {doc.room} • {doc.experience}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 4: Slot & Date Selection */}
            {showSlots && (
              <motion.div
                key="step-slot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Step 4: Select Consultation Slot / वेळ निवडा
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-purple-600 font-bold">
                    {flow.doctor?.name}
                  </span>
                </div>

                {/* Date Pills */}
                <div className="flex items-center gap-2">
                  {APPOINTMENT_DATES.map((date) => (
                    <button
                      key={date.id}
                      onClick={() => flow.selectDate(date.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        flow.date.id === date.id
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200"
                      }`}
                    >
                      {date.label}
                    </button>
                  ))}
                </div>

                {/* Available Time Slots Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {APPOINTMENT_SLOTS.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => flow.selectSlot(slot)}
                      className="p-3 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-500 text-center font-mono text-xs font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer flex flex-col items-center justify-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>{slot.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 5: Patient Info Form */}
            {showPatientForm && (
              <motion.div
                key="step-patient"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 max-w-lg mx-auto w-full"
              >
                <div className="text-center mb-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600">
                    Appointment with {flow.doctor?.name}
                  </span>
                  <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                    Patient Consultation Form
                  </h4>
                  <p className="text-xs text-slate-500">
                    Slot: {flow.date.label} at {flow.slot?.label} ({flow.doctor?.room})
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Patient Full Name / रुग्णाचे पूर्ण नाव"
                      value={flow.patientName}
                      onChange={(event) => flow.setPatientName(event.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-xs font-semibold outline-none text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Age / वय (Optional)"
                      value={flow.patientAge}
                      onChange={(event) => flow.setPatientAge(event.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-xs font-semibold outline-none text-slate-800"
                    />
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Mobile Number"
                        value={flow.patientPhone}
                        onChange={(event) => flow.setPatientPhone(event.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-xs font-semibold outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ABHA ID / Ayushman Card (Optional / ऐच्छिक)"
                      value={flow.abhaId}
                      onChange={(event) => flow.setAbhaId(event.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-xs font-mono font-semibold outline-none text-slate-800"
                    />
                  </div>
                </div>

                <button
                  disabled={!flow.canConfirm}
                  onClick={flow.confirmBooking}
                  className="w-full mt-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Specialist Consultation</span>
                </button>
              </motion.div>
            )}

            {/* STEP 6: Confirming Animation */}
            {flow.isConfirming && (
              <motion.div
                key="step-confirming"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="relative w-28 h-28 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-purple-500"
                  />
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-purple-400 shadow-xl shadow-purple-500/30 flex items-center justify-center text-white">
                    <Sparkles className="w-8 h-8 animate-pulse" />
                  </div>
                </div>

                <h4 className="text-base md:text-lg font-extrabold text-slate-900">
                  Reserving Doctor Consultation Slot...
                </h4>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  Synchronizing with Maharashtra Public Health Appointment Grid
                </p>
              </motion.div>
            )}

            {/* STEP 7: DIGITAL APPOINTMENT SLIP */}
            {showSlip && (
              <motion.div
                key="step-slip"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto w-full"
              >
                {/* Printable Appointment Pass */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xl text-slate-900 relative overflow-hidden">
                  {/* Sheen & Stamp */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold">
                        MH
                      </div>
                      <div>
                        <p className="text-[9px] font-mono tracking-wider font-bold text-purple-600 uppercase">
                          Govt. of Maharashtra
                        </p>
                        <p className="text-xs font-extrabold text-slate-900">
                          Specialist Consultation Pass
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[9px] font-mono font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      CONFIRMED
                    </span>
                  </div>

                  {/* Appointment Code */}
                  <div className="my-4 p-3 bg-purple-50/60 rounded-2xl border border-purple-100 text-center font-mono">
                    <p className="text-[9px] text-purple-700 uppercase font-bold tracking-widest">
                      Booking Reference ID
                    </p>
                    <h3 className="text-2xl font-black text-purple-900 mt-0.5">
                      {flow.appointmentId}
                    </h3>
                  </div>

                  {/* Pass Meta */}
                  <div className="space-y-2.5 text-xs text-slate-700">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Patient:</span>
                      <span className="font-bold">
                        {flow.patientName}
                        {flow.patientAge ? ` (${flow.patientAge} Yrs)` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Specialist:</span>
                      <span className="font-bold">{flow.doctor?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Department:</span>
                      <span className="font-bold">{flow.doctor?.deptName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">Hospital:</span>
                      <span className="font-bold truncate max-w-[200px]">
                        {flow.hospital?.name}
                      </span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">Schedule &amp; Room:</span>
                      <span className="font-bold font-mono text-purple-700">
                        {flow.date.label}, {flow.slot?.label} • {flow.doctor?.room}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-slate-500 mt-3 text-center">
                  * SMS with appointment pass has been dispatched to +91 {flow.patientPhone}
                </p>

                {/* Bottom Actions */}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={flow.reset}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Book Another</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                  >
                    Done &amp; Close
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
