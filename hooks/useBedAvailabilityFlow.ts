"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DistrictInfo,
  type HospitalInfo,
  getHospitalsForDistrict,
} from "@/data/tokenBookingOptions";
import { type WardAvailability, getWardAvailability } from "@/data/serviceOptions";

/**
 * Wizard state for the live bed availability lookup.
 *
 * `district -> hospital -> completed`, with the live-scan animation exposed as
 * `isScanning` rather than as a fourth step.
 *
 * Why the scan lives here and not in the modal
 * --------------------------------------------
 * `BedAvailabilityModal` used to run the scan off its own
 * `useState<"district" | "hospital" | "scanning" | "dashboard">`. That gave the
 * screen a second, private state machine, so when the voice agent advanced this
 * flow the modal carried on showing whatever step it had reached by tap — the
 * desync the agent was blamed for. One machine owns the progression; the modal
 * renders it.
 *
 * Keeping the scan as a boolean rather than a step means the agent's
 * step-to-phase map stays a clean three-entry table, and the scan is expressed
 * where it belongs: as a transient overlay on the hospital step.
 */

/** How long the simulated HIMS telemetry fetch runs. */
const SCAN_DURATION_MS = 2_400;

export type BedAvailabilityStep = "district" | "hospital" | "completed";

export interface BedAvailabilityFlow {
  step: BedAvailabilityStep;
  district: DistrictInfo | null;
  hospital: HospitalInfo | null;
  hospitalOptions: HospitalInfo[];
  /** Live ward figures for the selected hospital; empty until one is chosen. */
  wardSummary: WardAvailability[];
  /** Which ward card the dashboard has expanded. */
  selectedWardId: string;
  /** True while the telemetry fetch animation is running. */
  isScanning: boolean;

  selectDistrict: (district: DistrictInfo) => void;
  selectHospital: (hospital: HospitalInfo) => void;
  selectWard: (wardId: string) => void;
  /** Back to the hospital list, keeping the district. */
  backToHospitals: () => void;
  reset: () => void;
}

export function useBedAvailabilityFlow(): BedAvailabilityFlow {
  const [step, setStep] = useState<BedAvailabilityStep>("district");
  const [district, setDistrict] = useState<DistrictInfo | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [selectedWardId, setSelectedWardId] = useState("icu");
  const [isScanning, setIsScanning] = useState(false);

  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanTimer = useCallback(() => {
    if (scanTimerRef.current !== null) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const hospitalOptions = useMemo(
    () => getHospitalsForDistrict(district?.id ?? null),
    [district],
  );

  const wardSummary = useMemo(
    () => getWardAvailability(hospital?.id ?? null),
    [hospital],
  );

  const selectDistrict = useCallback(
    (next: DistrictInfo) => {
      // Changing district abandons any scan already in flight.
      clearScanTimer();
      setIsScanning(false);
      setDistrict((previous) => (previous?.id === next.id ? previous : next));
      // Drop a hospital that does not belong to the new district. Deriving this
      // from `districtId` keeps it idempotent — re-selecting the same district
      // never clears a valid choice.
      setHospital((previous) =>
        previous && previous.districtId === next.id ? previous : null,
      );
      setStep("hospital");
    },
    [clearScanTimer],
  );

  const selectHospital = useCallback(
    (next: HospitalInfo) => {
      clearScanTimer();
      setHospital(next);
      setSelectedWardId("icu");
      setIsScanning(true);
      // Stay on the hospital step while scanning: `step` flipping to "completed"
      // is the single signal that the figures are ready to be read out, so it
      // must not happen until they are actually on screen.
      setStep("hospital");

      scanTimerRef.current = setTimeout(() => {
        scanTimerRef.current = null;
        setIsScanning(false);
        setStep("completed");
      }, SCAN_DURATION_MS);
    },
    [clearScanTimer],
  );

  const selectWard = useCallback((wardId: string) => {
    setSelectedWardId(wardId);
  }, []);

  const backToHospitals = useCallback(() => {
    clearScanTimer();
    setIsScanning(false);
    setHospital(null);
    setStep(district ? "hospital" : "district");
  }, [clearScanTimer, district]);

  const reset = useCallback(() => {
    clearScanTimer();
    setIsScanning(false);
    setDistrict(null);
    setHospital(null);
    setSelectedWardId("icu");
    setStep("district");
  }, [clearScanTimer]);

  // Never leave a pending scan behind to fire against an unmounted tree.
  useEffect(() => clearScanTimer, [clearScanTimer]);

  return {
    step,
    district,
    hospital,
    hospitalOptions,
    wardSummary,
    selectedWardId,
    isScanning,
    selectDistrict,
    selectHospital,
    selectWard,
    backToHospitals,
    reset,
  };
}
