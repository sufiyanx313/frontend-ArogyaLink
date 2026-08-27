"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DepartmentInfo,
  type DistrictInfo,
  type HospitalInfo,
  type SymptomInfo,
  getHospitalsForDistrict,
} from "@/data/tokenBookingOptions";

/**
 * Owns the whole OPD token wizard state.
 *
 * This state used to live inside `TokenBookingModal`. It was lifted into a hook
 * so the voice agent can drive exactly the same values the modal renders — the
 * standard controlled/uncontrolled component split. `TokenBookingModal` still
 * creates its own instance when no flow is injected, so the existing
 * click-driven path from the service cards is unchanged.
 */

export type TokenBookingStep =
  | "district"
  | "hospital"
  | "department"
  | "symptoms"
  | "otp"
  | "generating"
  | "token";

/** How long the "Allocating Live OPD Slot..." animation runs. */
const GENERATING_DURATION_MS = 2_000;

/** Demo OTP used by the voice agent's auto-verification step. */
export const DEMO_OTP = ["4", "2", "1", "9"] as const;

export interface TokenBookingFlow {
  step: TokenBookingStep;
  district: DistrictInfo | null;
  hospital: HospitalInfo | null;
  department: DepartmentInfo | null;
  symptom: SymptomInfo | null;
  phone: string;
  otp: string[];
  userTokenNum: number;
  currentServingToken: number;
  tokenCodePrefix: string;
  activeCardTab: 0 | 1 | 2;
  /** Hospitals for the currently selected district. */
  hospitalOptions: HospitalInfo[];
  /** True once ten digits have been entered, by voice or by keypad. */
  isPhoneComplete: boolean;

  setStep: (step: TokenBookingStep) => void;
  selectDistrict: (district: DistrictInfo) => void;
  selectHospital: (hospital: HospitalInfo) => void;
  selectDepartment: (department: DepartmentInfo) => void;
  selectSymptom: (symptom: SymptomInfo) => void;
  setPhone: (phone: string) => void;
  setOtpDigit: (value: string, index: number) => void;
  autoFillOtp: () => void;
  generateToken: () => void;
  setActiveCardTab: (tab: 0 | 1 | 2) => void;
  reset: () => void;
}

export function useTokenBookingFlow(): TokenBookingFlow {
  const [step, setStep] = useState<TokenBookingStep>("district");
  const [district, setDistrict] = useState<DistrictInfo | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [department, setDepartment] = useState<DepartmentInfo | null>(null);
  const [symptom, setSymptom] = useState<SymptomInfo | null>(null);
  const [phone, setPhoneState] = useState("");
  const [otp, setOtp] = useState<string[]>(["", "", "", ""]);

  const [userTokenNum, setUserTokenNum] = useState(28);
  const [currentServingToken, setCurrentServingToken] = useState(24);
  const [tokenCodePrefix, setTokenCodePrefix] = useState("MH-ORT");
  const [activeCardTab, setActiveCardTab] = useState<0 | 1 | 2>(0);

  const generatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hospitalOptions = useMemo(
    () => getHospitalsForDistrict(district?.id ?? null),
    [district],
  );

  const selectDistrict = useCallback((next: DistrictInfo) => {
    setDistrict((previous) => {
      // Switching district invalidates a hospital chosen under the old one.
      if (previous && previous.id !== next.id) setHospital(null);
      return next;
    });
    setStep("hospital");
  }, []);

  const selectHospital = useCallback((next: HospitalInfo) => {
    setHospital(next);
    setStep("department");
  }, []);

  const selectDepartment = useCallback((next: DepartmentInfo) => {
    setDepartment(next);
    setStep("symptoms");
  }, []);

  const selectSymptom = useCallback((next: SymptomInfo) => {
    setSymptom(next);
    setStep("otp");
  }, []);

  const setPhone = useCallback((next: string) => {
    setPhoneState(next.replace(/\D/g, "").slice(0, 10));
  }, []);

  const setOtpDigit = useCallback((value: string, index: number) => {
    if (value.length > 1 || index < 0 || index > 3) return;
    setOtp((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  const autoFillOtp = useCallback(() => setOtp([...DEMO_OTP]), []);

  const generateToken = useCallback(() => {
    setStep("generating");

    const assigned = Math.floor(25 + Math.random() * 15);
    setUserTokenNum(assigned);
    // Start the queue three patients behind the user.
    setCurrentServingToken(assigned - 3);
    setTokenCodePrefix(`MH-${department?.id ?? "GEN"}`);

    if (generatingTimerRef.current !== null) {
      clearTimeout(generatingTimerRef.current);
    }
    generatingTimerRef.current = setTimeout(() => {
      generatingTimerRef.current = null;
      setStep("token");
    }, GENERATING_DURATION_MS);
  }, [department]);

  const reset = useCallback(() => {
    if (generatingTimerRef.current !== null) {
      clearTimeout(generatingTimerRef.current);
      generatingTimerRef.current = null;
    }
    setDistrict(null);
    setHospital(null);
    setDepartment(null);
    setSymptom(null);
    setPhoneState("");
    setOtp(["", "", "", ""]);
    setActiveCardTab(0);
    setStep("district");
  }, []);

  // Simulated live OPD progress, one patient every 4.5s while the pass is open.
  useEffect(() => {
    if (step !== "token") return;
    const interval = setInterval(() => {
      setCurrentServingToken((previous) => previous + 1);
    }, 4_500);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    return () => {
      if (generatingTimerRef.current !== null) {
        clearTimeout(generatingTimerRef.current);
        generatingTimerRef.current = null;
      }
    };
  }, []);

  return {
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
    // Matches the modal's own "Verify" button rule exactly, so the voice agent
    // and the keypad agree on when a number is ready. Voice input is validated
    // more strictly upstream by `parseMobileNumber`.
    isPhoneComplete: phone.length === 10,
    setStep,
    selectDistrict,
    selectHospital,
    selectDepartment,
    selectSymptom,
    setPhone,
    setOtpDigit,
    autoFillOtp,
    generateToken,
    setActiveCardTab,
    reset,
  };
}
