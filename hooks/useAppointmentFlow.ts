"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DistrictInfo,
  type HospitalInfo,
  getHospitalsForDistrict,
} from "@/data/tokenBookingOptions";
import {
  type AppointmentDateInfo,
  type AppointmentSlotInfo,
  type DoctorInfo,
  APPOINTMENT_DATES,
  findAppointmentDateById,
  getBookableDoctors,
} from "@/data/serviceOptions";

/**
 * Wizard state for the specialist appointment booking.
 *
 * `district -> hospital -> doctor -> slot -> patient_info -> completed`.
 *
 * Two things are deliberately *not* steps. The date pills live inside the `slot`
 * step, because picking a day without a time books nothing; and the reservation
 * animation is `isConfirming` inside `patient_info`, the same trick the bed and
 * doctor flows use for their scans. Both keep the step list identical to the one
 * the voice agent reconciles against, which is what makes a tap and a spoken
 * answer interchangeable at every point.
 *
 * The doctor list comes from `getBookableDoctors()`, so the specialist deputed to
 * another hospital today is never offered a slot nobody can honour. Before this
 * flow existed the appointment picker carried its own four-doctor array whose ids
 * disagreed with the duty roster's — doc-3 was Shinde here and Patil there — so a
 * booking could name a different doctor than the one the user had just been told
 * about. There is now one roster.
 */

/** How long the simulated slot reservation runs. */
const CONFIRM_DURATION_MS = 2_200;

export type AppointmentStep =
  | "district"
  | "hospital"
  | "doctor"
  | "slot"
  | "patient_info"
  | "completed";

export interface AppointmentFlow {
  step: AppointmentStep;
  district: DistrictInfo | null;
  hospital: HospitalInfo | null;
  hospitalOptions: HospitalInfo[];
  /** Specialists who can actually be booked today. */
  doctorOptions: DoctorInfo[];
  doctor: DoctorInfo | null;
  date: AppointmentDateInfo;
  slot: AppointmentSlotInfo | null;

  patientName: string;
  patientAge: string;
  /** Digits only, at most ten. */
  patientPhone: string;
  abhaId: string;

  /** True while the slot is being reserved. */
  isConfirming: boolean;
  /** Booking reference, issued when confirmation starts. */
  appointmentId: string;
  /** Whether the form holds enough to book. */
  canConfirm: boolean;

  selectDistrict: (district: DistrictInfo) => void;
  selectHospital: (hospital: HospitalInfo) => void;
  selectDoctor: (doctor: DoctorInfo) => void;
  selectDate: (dateId: string) => void;
  selectSlot: (slot: AppointmentSlotInfo) => void;
  setPatientName: (name: string) => void;
  setPatientAge: (age: string) => void;
  setPatientPhone: (phone: string) => void;
  setAbhaId: (id: string) => void;
  confirmBooking: () => void;
  /** Back to the hospital list, keeping the district. */
  backToHospitals: () => void;
  /** Back to the district list. */
  backToDistricts: () => void;
  reset: () => void;
}

export function useAppointmentFlow(): AppointmentFlow {
  const [step, setStep] = useState<AppointmentStep>("district");
  const [district, setDistrict] = useState<DistrictInfo | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [dateId, setDateId] = useState(APPOINTMENT_DATES[0].id);
  const [slot, setSlot] = useState<AppointmentSlotInfo | null>(null);

  const [patientName, setPatientNameState] = useState("");
  const [patientAge, setPatientAgeState] = useState("");
  const [patientPhone, setPatientPhoneState] = useState("");
  const [abhaId, setAbhaIdState] = useState("");

  const [isConfirming, setIsConfirming] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");

  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimerRef.current !== null) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  const hospitalOptions = useMemo(
    () => getHospitalsForDistrict(district?.id ?? null),
    [district],
  );

  const doctorOptions = useMemo(() => getBookableDoctors(), []);

  const date = useMemo(
    () => findAppointmentDateById(dateId) ?? APPOINTMENT_DATES[0],
    [dateId],
  );

  // Age is intentionally not required: the voice script collects a name and a
  // mobile number, and a form the agent cannot complete would strand any caller
  // who booked by speech.
  const canConfirm = patientName.trim().length > 0 && patientPhone.length === 10;

  const selectDistrict = useCallback(
    (next: DistrictInfo) => {
      clearConfirmTimer();
      setIsConfirming(false);
      setDistrict((previous) => (previous?.id === next.id ? previous : next));
      // Only drop the hospital when it does not belong to the new district, so
      // re-confirming the same district does not undo later progress.
      setHospital((previous) =>
        previous && previous.districtId === next.id ? previous : null,
      );
      setStep("hospital");
    },
    [clearConfirmTimer],
  );

  const selectHospital = useCallback(
    (next: HospitalInfo) => {
      clearConfirmTimer();
      setIsConfirming(false);
      setHospital(next);
      setStep("doctor");
    },
    [clearConfirmTimer],
  );

  const selectDoctor = useCallback((next: DoctorInfo) => {
    setDoctor(next);
    // A different specialist means a different chamber; the old time is stale.
    setSlot(null);
    setStep("slot");
  }, []);

  const selectDate = useCallback((nextDateId: string) => {
    setDateId(nextDateId);
  }, []);

  const selectSlot = useCallback((next: AppointmentSlotInfo) => {
    setSlot(next);
    setStep("patient_info");
  }, []);

  const setPatientName = useCallback((name: string) => {
    setPatientNameState(name);
  }, []);

  const setPatientAge = useCallback((age: string) => {
    setPatientAgeState(age.replace(/\D/g, "").slice(0, 3));
  }, []);

  const setPatientPhone = useCallback((phone: string) => {
    setPatientPhoneState(phone.replace(/\D/g, "").slice(0, 10));
  }, []);

  const setAbhaId = useCallback((id: string) => {
    setAbhaIdState(id);
  }, []);

  const confirmBooking = useCallback(() => {
    clearConfirmTimer();
    // Generated in an event handler, never during render, so the reference on
    // screen matches the one the agent reads out.
    setAppointmentId(`MH-APT-${Math.floor(1000 + Math.random() * 9000)}`);
    setIsConfirming(true);
    // Hold on patient_info until the slip exists: the move to "completed" is the
    // single signal that the booking is real and may be read out.
    setStep("patient_info");

    confirmTimerRef.current = setTimeout(() => {
      confirmTimerRef.current = null;
      setIsConfirming(false);
      setStep("completed");
    }, CONFIRM_DURATION_MS);
  }, [clearConfirmTimer]);

  const backToHospitals = useCallback(() => {
    clearConfirmTimer();
    setIsConfirming(false);
    setHospital(null);
    setDoctor(null);
    setSlot(null);
    setStep(district ? "hospital" : "district");
  }, [clearConfirmTimer, district]);

  const backToDistricts = useCallback(() => {
    clearConfirmTimer();
    setIsConfirming(false);
    setDistrict(null);
    setHospital(null);
    setDoctor(null);
    setSlot(null);
    setStep("district");
  }, [clearConfirmTimer]);

  const reset = useCallback(() => {
    clearConfirmTimer();
    setIsConfirming(false);
    setDistrict(null);
    setHospital(null);
    setDoctor(null);
    setDateId(APPOINTMENT_DATES[0].id);
    setSlot(null);
    setPatientNameState("");
    setPatientAgeState("");
    setPatientPhoneState("");
    setAbhaIdState("");
    setAppointmentId("");
    setStep("district");
  }, [clearConfirmTimer]);

  // Unmount safety: a pending reservation must not fire into a dead tree.
  useEffect(() => clearConfirmTimer, [clearConfirmTimer]);

  return {
    step,
    district,
    hospital,
    hospitalOptions,
    doctorOptions,
    doctor,
    date,
    slot,
    patientName,
    patientAge,
    patientPhone,
    abhaId,
    isConfirming,
    appointmentId,
    canConfirm,
    selectDistrict,
    selectHospital,
    selectDoctor,
    selectDate,
    selectSlot,
    setPatientName,
    setPatientAge,
    setPatientPhone,
    setAbhaId,
    confirmBooking,
    backToHospitals,
    backToDistricts,
    reset,
  };
}
