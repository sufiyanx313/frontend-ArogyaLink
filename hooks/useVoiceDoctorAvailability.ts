"use client";

import { useCallback } from "react";
import {
  DISTRICTS,
  getHospitalsForDistrict,
  type HospitalInfo,
} from "@/data/tokenBookingOptions";
import {
  DOCTORS,
  SPECIALIST_DEPARTMENTS,
  type DoctorInfo,
} from "@/data/serviceOptions";
import { type VoiceIntent, matchOption, matchOrdinal } from "@/lib/voice/matching";
import { spokenList } from "@/lib/voice/promptText";
import type { VoiceAgentHandle, VoicePrompt } from "@/lib/voice/agent";
import {
  type PhaseSignal,
  type ResolveOutcome,
  useVoiceFlowEngine,
} from "@/hooks/useVoiceFlowEngine";
import type {
  DoctorAvailabilityFlow,
  DoctorAvailabilityStep,
} from "@/hooks/useDoctorAvailabilityFlow";

/**
 * Voice agent for the specialist duty roster.
 *
 * Script only — every conversation mechanic comes from `useVoiceFlowEngine`.
 *
 * Once the roster is on screen the agent stays in a small loop rather than
 * finishing: a caller who has just been told four names almost always follows up
 * with "and Dr Kulkarni?" or "show me only pediatrics". Both are handled from the
 * `roster` phase, and both move the filter or the highlight on the actual screen
 * so the answer is visible as well as audible.
 */

type DoctorPhase =
  | "ask_district"
  | "ask_hospital"
  | "fetching"
  | "roster"
  | "doctor_detail";

const LISTENING_PHASES: readonly DoctorPhase[] = [
  "ask_district",
  "ask_hospital",
  "roster",
  "doctor_detail",
];

const STEP_TO_PHASE: Record<DoctorAvailabilityStep, DoctorPhase> = {
  district: "ask_district",
  hospital: "ask_hospital",
  completed: "roster",
};

/** `fetching` sits inside the hospital step; `doctor_detail` inside the roster. */
const TOLERATED: Partial<Record<DoctorPhase, readonly DoctorPhase[]>> = {
  ask_hospital: ["fetching"],
  roster: ["doctor_detail"],
};

const ANOTHER_HOSPITAL_ALIASES = [
  "another hospital",
  "other hospital",
  "different hospital",
  "change hospital",
  "dusra hospital",
  "doosra hospital",
  "दूसरा अस्पताल",
  "दुसरे रुग्णालय",
  "अस्पताल बदलो",
];

/** "Show me everyone" — clears the department filter. */
const ALL_DEPARTMENTS_ALIASES = [
  "all",
  "everyone",
  "all doctors",
  "all specialists",
  "sab",
  "sabhi",
  "sare",
  "sarv",
  "सब",
  "सभी",
  "सर्व",
  "सगळे",
];

const RETRY_PROMPT: VoicePrompt = {
  hi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलिए।",
  en: "Sorry, I did not catch that. Please say it again.",
};

const MANUAL_HINT_PROMPT: VoicePrompt = {
  hi: "कोई बात नहीं। आप स्क्रीन पर दिख रहे विकल्प पर सीधे टैप भी कर सकते हैं।",
  en: "No problem. You can also tap the option directly on the screen.",
};

const CANCELLED_PROMPT: VoicePrompt = {
  hi: "ठीक है, डॉक्टर उपस्थिति सेवा बंद कर रहा हूँ।",
  en: "Alright, closing the doctor availability service.",
};

const FETCHING_PROMPT: VoicePrompt = {
  hi: "एक क्षण, डॉक्टरों की लाइव उपस्थिति देखी जा रही है।",
  en: "One moment, checking the live specialist attendance beacon.",
};

function hospitalPrompt(hospitals: readonly HospitalInfo[]): VoicePrompt {
  if (hospitals.length === 0) {
    return {
      hi: "इस ज़िले में कोई सरकारी अस्पताल सूची में नहीं मिला। कृपया दूसरा ज़िला बोलिए।",
      en: "I could not find a listed government hospital in that district. Please say another district.",
    };
  }

  const names = hospitals.map((hospital) => hospital.spoken);
  return {
    hi: `किस अस्पताल के डॉक्टर देखने हैं? ${spokenList(names, "या")}।`,
    en: `Which hospital's doctors would you like? ${spokenList(names)}.`,
  };
}

/** Where a doctor is right now, phrased for speech. */
function statusPhrase(doctor: DoctorInfo): VoicePrompt {
  switch (doctor.status) {
    case "ON_DUTY_OPD":
      return {
        hi: `ओपीडी में मौजूद हैं, ${doctor.room} में`,
        en: `present in the O P D, at ${doctor.room}`,
      };
    case "WARD_ROUND":
      return { hi: "अभी वॉर्ड राउंड पर हैं", en: "currently on a ward round" };
    case "IN_OT":
      return {
        hi: "आपत्कालीन ऑपरेशन थिएटर में हैं",
        en: "in the emergency operation theatre",
      };
    case "OTHER_HOSPITAL":
      return {
        hi: "आज दूसरे अस्पताल में तैनात हैं",
        en: "deputed to another hospital today",
      };
  }
}

function doctorDetailPrompt(doctor: DoctorInfo): VoicePrompt {
  const status = statusPhrase(doctor);
  return {
    hi:
      `${doctor.marathiName}, ${doctor.deptName}। ` +
      `${status.hi}। अनुमानित प्रतीक्षा: ${doctor.estimatedWait}। ` +
      `किसी और डॉक्टर या विभाग का नाम बोल सकते हैं।`,
    en:
      `Doctor ${doctor.spoken}, ${doctor.deptName}. ` +
      `${status.en}. Estimated wait: ${doctor.estimatedWait}. ` +
      `You can name another doctor or a department.`,
  };
}

/**
 * Summary of whichever slice of the roster is on screen.
 *
 * Built from an explicit doctor list rather than from the flow, so it can be
 * computed for a filter that has only just been applied and has not been
 * committed to a render yet.
 */
function rosterPrompt(doctors: readonly DoctorInfo[], hospitalName: string): VoicePrompt {
  if (doctors.length === 0) {
    return {
      hi: "इस विभाग में अभी कोई विशेषज्ञ सूची में नहीं है। दूसरा विभाग बोलिए, या 'सब' कहिए।",
      en: "No specialist is listed for that department. Say another department, or say all.",
    };
  }

  const onDuty = doctors.filter((doctor) => doctor.status === "ON_DUTY_OPD");
  const names = doctors.map((doctor) => doctor.spoken);

  const availability: VoicePrompt =
    onDuty.length === 0
      ? {
          hi: "इस समय कोई भी ओपीडी कक्ष में नहीं है",
          en: "none of them is in an O P D chamber right now",
        }
      : {
          hi: `${onDuty.length} डॉक्टर अभी ओपीडी में मौजूद हैं`,
          en: `${onDuty.length} of them are in the O P D right now`,
        };

  return {
    hi:
      `${hospitalName} में ${doctors.length} विशेषज्ञ हैं: ${spokenList(names, "और")}। ` +
      `${availability.hi}। किसी डॉक्टर का नाम बोलिए, या कोई विभाग।`,
    en:
      `${hospitalName} has ${doctors.length} specialists: ${spokenList(names, "and")}. ` +
      `${availability.en}. Name a doctor, or a department.`,
  };
}

/** Applies the same filter the flow applies, for prompts built ahead of a render. */
function filterRoster(departmentId: string): DoctorInfo[] {
  return departmentId === "ALL"
    ? DOCTORS.slice()
    : DOCTORS.filter((doctor) => doctor.departmentId === departmentId);
}

export interface UseVoiceDoctorAvailabilityOptions {
  flow: DoctorAvailabilityFlow;
  announceOnStart?: boolean;
  onIntent?: (intent: VoiceIntent) => void;
  onCancel?: () => void;
}

export function useVoiceDoctorAvailability({
  flow,
  announceOnStart = true,
  onIntent,
  onCancel,
}: UseVoiceDoctorAvailabilityOptions): VoiceAgentHandle {
  const buildPrompt = useCallback(
    (phase: DoctorPhase, current: DoctorAvailabilityFlow): VoicePrompt | null => {
      switch (phase) {
        case "ask_district": {
          const names = DISTRICTS.map((district) => district.spoken);
          return {
            hi: `किस ज़िले के डॉक्टर देखने हैं? ${spokenList(names, "या")}।`,
            en: `Which district's doctors would you like to see? ${spokenList(names)}.`,
          };
        }

        case "ask_hospital":
          return hospitalPrompt(current.hospitalOptions);

        case "fetching":
          return FETCHING_PROMPT;

        case "roster": {
          if (!current.hospital) return null;
          return rosterPrompt(current.doctorRoster, current.hospital.spoken);
        }

        case "doctor_detail": {
          const doctor = current.doctorRoster.find(
            (candidate) => candidate.id === current.focusedDoctorId,
          );
          return doctor ? doctorDetailPrompt(doctor) : null;
        }
      }
    },
    [],
  );

  const resolve = useCallback(
    (
      phase: DoctorPhase,
      spoken: string,
      current: DoctorAvailabilityFlow,
    ): ResolveOutcome<DoctorPhase> => {
      switch (phase) {
        case "ask_district": {
          const match = matchOption(spoken, DISTRICTS, (district) => district.aliases);
          const district = match?.option ?? pickByOrdinal(spoken, DISTRICTS);
          if (!district) return { type: "unmatched" };

          current.selectDistrict(district);
          return {
            type: "advance",
            phase: "ask_hospital",
            // Built from the district just matched: this render's flow still holds
            // the previous district's hospital list.
            prompt: hospitalPrompt(getHospitalsForDistrict(district.id)),
          };
        }

        case "ask_hospital": {
          const options = current.hospitalOptions;
          if (options.length === 0) return { type: "unmatched" };

          const match = matchOption(spoken, options, (hospital) => hospital.aliases);
          const hospital = match?.option ?? pickByOrdinal(spoken, options);
          if (!hospital) return { type: "unmatched" };

          current.selectHospital(hospital);
          return { type: "advance", phase: "fetching", prompt: FETCHING_PROMPT };
        }

        case "fetching":
          return { type: "stay" };

        case "roster":
        case "doctor_detail": {
          if (matchesAny(spoken, ANOTHER_HOSPITAL_ALIASES)) {
            current.backToHospitals();
            return {
              type: "advance",
              phase: "ask_hospital",
              prompt: hospitalPrompt(current.hospitalOptions),
            };
          }

          const hospitalName = current.hospital?.spoken ?? "this hospital";

          // A named doctor is the most specific request, so it is checked first.
          const doctorMatch = matchOption(spoken, DOCTORS, (doctor) => doctor.aliases);
          if (doctorMatch) {
            const doctor = doctorMatch.option;
            // Clear any filter that would hide the card being talked about.
            if (
              current.departmentFilter !== "ALL" &&
              current.departmentFilter !== doctor.departmentId
            ) {
              current.setDepartmentFilter("ALL");
            }
            current.focusDoctor(doctor.id);
            return {
              type: "advance",
              phase: "doctor_detail",
              prompt: doctorDetailPrompt(doctor),
            };
          }

          if (matchesAny(spoken, ALL_DEPARTMENTS_ALIASES)) {
            current.setDepartmentFilter("ALL");
            return {
              type: "advance",
              phase: "roster",
              prompt: rosterPrompt(filterRoster("ALL"), hospitalName),
            };
          }

          const departmentMatch = matchOption(
            spoken,
            SPECIALIST_DEPARTMENTS,
            (department) => department.aliases,
          );
          if (departmentMatch) {
            const departmentId = departmentMatch.option.id;
            current.setDepartmentFilter(departmentId);
            return {
              type: "advance",
              phase: "roster",
              prompt: rosterPrompt(filterRoster(departmentId), hospitalName),
            };
          }

          // "pehla doctor" / "second one", against what is currently listed.
          const ordinalPick = pickByOrdinal(spoken, current.doctorRoster);
          if (ordinalPick) {
            current.focusDoctor(ordinalPick.id);
            return {
              type: "advance",
              phase: "doctor_detail",
              prompt: doctorDetailPrompt(ordinalPick),
            };
          }

          const districtMatch = matchOption(
            spoken,
            DISTRICTS,
            (district) => district.aliases,
          );
          if (districtMatch) {
            current.selectDistrict(districtMatch.option);
            return {
              type: "advance",
              phase: "ask_hospital",
              prompt: hospitalPrompt(getHospitalsForDistrict(districtMatch.option.id)),
            };
          }

          return { type: "unmatched" };
        }
      }
    },
    [],
  );

  const signals: readonly PhaseSignal<DoctorPhase>[] = [
    // Covers a hospital chosen by tap: the scan is already running, so stop
    // waiting for a spoken answer to a question that has been answered.
    { active: flow.isFetching, from: ["ask_district", "ask_hospital"], to: "fetching" },
  ];

  return useVoiceFlowEngine<
    DoctorAvailabilityFlow,
    DoctorAvailabilityStep,
    DoctorPhase
  >({
    service: "doctor_availability",
    flow,
    step: flow.step,
    entryPhase: "ask_district",
    listeningPhases: LISTENING_PHASES,
    stepToPhase: STEP_TO_PHASE,
    tolerated: TOLERATED,
    signals,
    buildPrompt,
    resolve,
    retryPrompt: RETRY_PROMPT,
    manualHintPrompt: MANUAL_HINT_PROMPT,
    cancelledPrompt: CANCELLED_PROMPT,
    announceOnStart,
    onIntent,
    onCancel,
  });
}

/* ------------------------------------------------------------------ */
/* Local helpers                                                      */
/* ------------------------------------------------------------------ */

function pickByOrdinal<T>(spoken: string, options: readonly T[]): T | null {
  const index = matchOrdinal(spoken, options.length);
  return index === null ? null : options[index];
}

function matchesAny(spoken: string, aliases: readonly string[]): boolean {
  return matchOption(spoken, [aliases], (group) => group) !== null;
}
