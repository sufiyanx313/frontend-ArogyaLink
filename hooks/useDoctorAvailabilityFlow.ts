"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DistrictInfo,
  type HospitalInfo,
  getHospitalsForDistrict,
} from "@/data/tokenBookingOptions";
import { DOCTORS, type DoctorInfo } from "@/data/serviceOptions";

/**
 * Wizard state for the specialist duty roster.
 *
 * `district -> hospital -> completed`, with the beacon-scan animation exposed as
 * `isFetching` rather than as a fourth step — the same shape as
 * `useBedAvailabilityFlow`, so both voice agents can share one engine and one
 * step-to-phase convention.
 *
 * The department filter, the search box and the focused card all live here too.
 * They are presentation state in the sense that they never gate progress, but the
 * voice agent needs to drive them ("dikhao sirf pediatrics", "Dr Kulkarni kahan
 * hain") and anything the agent drives has to be somewhere both it and the screen
 * can see.
 */

/** How long the simulated attendance-beacon scan runs. */
const FETCH_DURATION_MS = 2_400;

export type DoctorAvailabilityStep = "district" | "hospital" | "completed";

export interface DoctorAvailabilityFlow {
  step: DoctorAvailabilityStep;
  district: DistrictInfo | null;
  hospital: HospitalInfo | null;
  hospitalOptions: HospitalInfo[];
  /** True while the roster is being fetched. */
  isFetching: boolean;
  /** `"ALL"` or a `SPECIALIST_DEPARTMENTS` id. */
  departmentFilter: string;
  searchQuery: string;
  /** Roster after the filter and search are applied. */
  doctorRoster: DoctorInfo[];
  /** Card the agent has just talked about, highlighted on screen. */
  focusedDoctorId: string | null;

  selectDistrict: (district: DistrictInfo) => void;
  selectHospital: (hospital: HospitalInfo) => void;
  setDepartmentFilter: (departmentId: string) => void;
  setSearchQuery: (query: string) => void;
  focusDoctor: (doctorId: string | null) => void;
  backToHospitals: () => void;
  reset: () => void;
}

export function useDoctorAvailabilityFlow(): DoctorAvailabilityFlow {
  const [step, setStep] = useState<DoctorAvailabilityStep>("district");
  const [district, setDistrict] = useState<DistrictInfo | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [departmentFilter, setDepartmentFilterState] = useState("ALL");
  const [searchQuery, setSearchQueryState] = useState("");
  const [focusedDoctorId, setFocusedDoctorId] = useState<string | null>(null);

  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFetchTimer = useCallback(() => {
    if (fetchTimerRef.current !== null) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }
  }, []);

  const hospitalOptions = useMemo(
    () => getHospitalsForDistrict(district?.id ?? null),
    [district],
  );

  const doctorRoster = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return DOCTORS.filter((doctor) => {
      const matchesDepartment =
        departmentFilter === "ALL" || doctor.departmentId === departmentFilter;
      if (!matchesDepartment) return false;
      if (query.length === 0) return true;

      return (
        doctor.name.toLowerCase().includes(query) ||
        doctor.deptName.toLowerCase().includes(query) ||
        // Devanagari is matched unfolded: `toLowerCase` is a no-op for it, and the
        // user may well type or dictate the Marathi spelling of the name.
        doctor.marathiName.includes(searchQuery.trim())
      );
    });
  }, [departmentFilter, searchQuery]);

  const selectDistrict = useCallback(
    (next: DistrictInfo) => {
      clearFetchTimer();
      setIsFetching(false);
      setDistrict((previous) => (previous?.id === next.id ? previous : next));
      setHospital((previous) =>
        previous && previous.districtId === next.id ? previous : null,
      );
      setStep("hospital");
    },
    [clearFetchTimer],
  );

  const selectHospital = useCallback(
    (next: HospitalInfo) => {
      clearFetchTimer();
      setHospital(next);
      setFocusedDoctorId(null);
      setIsFetching(true);
      // Hold on the hospital step until the roster is actually on screen: the move
      // to "completed" is what tells the agent it may read the roster out.
      setStep("hospital");

      fetchTimerRef.current = setTimeout(() => {
        fetchTimerRef.current = null;
        setIsFetching(false);
        setStep("completed");
      }, FETCH_DURATION_MS);
    },
    [clearFetchTimer],
  );

  const setDepartmentFilter = useCallback((departmentId: string) => {
    setDepartmentFilterState(departmentId);
    // A filter change makes the previous highlight meaningless — that card may no
    // longer be rendered.
    setFocusedDoctorId(null);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
  }, []);

  const focusDoctor = useCallback((doctorId: string | null) => {
    setFocusedDoctorId(doctorId);
  }, []);

  const backToHospitals = useCallback(() => {
    clearFetchTimer();
    setIsFetching(false);
    setHospital(null);
    setFocusedDoctorId(null);
    setDepartmentFilterState("ALL");
    setSearchQueryState("");
    setStep(district ? "hospital" : "district");
  }, [clearFetchTimer, district]);

  const reset = useCallback(() => {
    clearFetchTimer();
    setIsFetching(false);
    setDistrict(null);
    setHospital(null);
    setFocusedDoctorId(null);
    setDepartmentFilterState("ALL");
    setSearchQueryState("");
    setStep("district");
  }, [clearFetchTimer]);

  useEffect(() => clearFetchTimer, [clearFetchTimer]);

  return {
    step,
    district,
    hospital,
    hospitalOptions,
    isFetching,
    departmentFilter,
    searchQuery,
    doctorRoster,
    focusedDoctorId,
    selectDistrict,
    selectHospital,
    setDepartmentFilter,
    setSearchQuery,
    focusDoctor,
    backToHospitals,
    reset,
  };
}
