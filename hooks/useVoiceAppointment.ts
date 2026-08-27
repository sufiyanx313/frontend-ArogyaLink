"use client";

import { useCallback } from "react";
import {
  DISTRICTS,
  getHospitalsForDistrict,
  type HospitalInfo,
} from "@/data/tokenBookingOptions";
import {
  APPOINTMENT_DATES,
  APPOINTMENT_SLOTS,
  SPECIALIST_DEPARTMENTS,
  matchSlotPeriod,
  type AppointmentSlotInfo,
  type DoctorInfo,
} from "@/data/serviceOptions";
import {
  type VoiceIntent,
  extractPersonName,
  matchOption,
  matchOrdinal,
  matchYesNo,
  parseMobileNumber,
  tokenize,
} from "@/lib/voice/matching";
import { spellDigits, spokenList } from "@/lib/voice/promptText";
import type { VoiceAgentHandle, VoicePrompt } from "@/lib/voice/agent";
import {
  type PhaseSignal,
  type ResolveOutcome,
  useVoiceFlowEngine,
} from "@/hooks/useVoiceFlowEngine";
import type { AppointmentFlow, AppointmentStep } from "@/hooks/useAppointmentFlow";

/**
 * Voice agent for specialist appointment booking — the longest of the four
 * scripts, and the only one that collects free-form data.
 *
 * Script only; every conversation mechanic comes from `useVoiceFlowEngine`.
 *
 * Three phases share the `patient_info` step (`ask_name`, `ask_mobile`,
 * `confirm`) plus the reservation animation (`booking`). They are listed in
 * `TOLERATED` so the reconciliation effect does not read normal progress through
 * the form as drift and restart it.
 */

type AppointmentPhase =
  | "ask_district"
  | "ask_hospital"
  | "ask_doctor"
  | "ask_slot"
  | "ask_name"
  | "ask_mobile"
  | "confirm"
  | "booking"
  | "booked";

/** Everything except the reservation animation and the final slip read-out. */
const LISTENING_PHASES: readonly AppointmentPhase[] = [
  "ask_district",
  "ask_hospital",
  "ask_doctor",
  "ask_slot",
  "ask_name",
  "ask_mobile",
  "confirm",
];

const STEP_TO_PHASE: Record<AppointmentStep, AppointmentPhase> = {
  district: "ask_district",
  hospital: "ask_hospital",
  doctor: "ask_doctor",
  slot: "ask_slot",
  patient_info: "ask_name",
  completed: "booked",
};

const TOLERATED: Partial<Record<AppointmentPhase, readonly AppointmentPhase[]>> = {
  // Collecting the name, the number, the confirmation and reserving the slot are
  // all the same wizard step.
  ask_name: ["ask_mobile", "confirm", "booking"],
};

const RETRY_PROMPT: VoicePrompt = {
  hi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलिए।",
  en: "Sorry, I did not catch that. Please say it again.",
};

const MANUAL_HINT_PROMPT: VoicePrompt = {
  hi: "कोई बात नहीं। आप स्क्रीन पर दिख रहे विकल्प पर सीधे टैप भी कर सकते हैं।",
  en: "No problem. You can also tap the option directly on the screen.",
};

const CANCELLED_PROMPT: VoicePrompt = {
  hi: "ठीक है, अपॉइंटमेंट बुकिंग रद्द कर रहा हूँ।",
  en: "Alright, cancelling the appointment booking.",
};

const BOOKING_PROMPT: VoicePrompt = {
  hi: "एक क्षण, आपकी अपॉइंटमेंट रिज़र्व की जा रही है।",
  en: "One moment, reserving your appointment slot.",
};

const NAME_INVALID_PROMPT: VoicePrompt = {
  hi: "मुझे नाम स्पष्ट नहीं हुआ। कृपया केवल रुग्ण का नाम बोलिए।",
  en: "I did not get the name. Please say just the patient's name.",
};

const MOBILE_INVALID_PROMPT: VoicePrompt = {
  hi: "कृपया दस अंकों का मोबाइल नंबर, एक-एक अंक बोलिए।",
  en: "Please say the ten digit mobile number, one digit at a time.",
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
    hi: `किस अस्पताल में अपॉइंटमेंट चाहिए? ${spokenList(names, "या")}।`,
    en: `Which hospital would you like the appointment at? ${spokenList(names)}.`,
  };
}

function doctorPrompt(doctors: readonly DoctorInfo[]): VoicePrompt {
  if (doctors.length === 0) {
    return {
      hi: "आज कोई तज्ज्ञ अपॉइंटमेंट के लिए उपलब्ध नहीं है। कृपया दूसरा अस्पताल बोलिए।",
      en: "No specialist is available for an appointment today. Please say another hospital.",
    };
  }

  const hi = doctors.map((doctor) => `${doctor.marathiName} — ${doctor.deptName}`);
  const en = doctors.map((doctor) => `Doctor ${doctor.spoken} for ${doctor.deptName}`);

  return {
    hi: `किस तज्ज्ञ डॉक्टर से भेटायचं आहे? ${spokenList(hi, "किंवा")}। डॉक्टर का नाम, या विभाग बोलिए।`,
    en: `Which specialist would you like to see? ${spokenList(en)}. Say a doctor's name, or a department.`,
  };
}

/** Times for the day currently selected — dates and slots share one phase. */
function slotPrompt(flow: AppointmentFlow, dateLabelOverride?: VoicePrompt): VoicePrompt {
  const day = dateLabelOverride ?? {
    hi: flow.date.label,
    en: flow.date.spoken,
  };
  const labels = APPOINTMENT_SLOTS.map((slot) => slot.label);

  return {
    hi:
      `${day.hi} के लिए उपलब्ध वेळ: ${spokenList(labels, "किंवा")}। ` +
      `कोणती वेळ हवी? दुसरा दिवस हवा असेल तर 'उद्या' किंवा 'परवा' बोला.`,
    en:
      `Available times for ${day.en}: ${spokenList(labels)}. ` +
      `Which time works? For another day, say tomorrow or the day after.`,
  };
}

function namePrompt(doctor: DoctorInfo | null): VoicePrompt {
  const withDoctor = doctor ? ` ${doctor.marathiName} सोबत` : "";
  return {
    hi: `ठीक आहे.${withDoctor} अपॉइंटमेंट नोंदवत आहे. रुग्णाचे पूर्ण नाव सांगा.`,
    en: `Alright. Please say the patient's full name.`,
  };
}

function mobilePrompt(name: string): VoicePrompt {
  const greeting = name.trim().length > 0 ? `धन्यवाद, ${name}. ` : "";
  return {
    hi: `${greeting}आता दहा अंकी मोबाइल नंबर सांगा, एक-एक अंक.`,
    en: `Thank you. Now please say the ten digit mobile number, one digit at a time.`,
  };
}

/**
 * Read-back before booking.
 *
 * `phoneOverride` exists because the resolver has just written the number to the
 * flow and this render's copy is still the previous one; the same reason the
 * engine supports prompt overrides at all.
 */
function confirmPrompt(flow: AppointmentFlow, phoneOverride?: string): VoicePrompt {
  const phone = phoneOverride ?? flow.patientPhone;
  const spokenPhone = spellDigits(phone);
  const doctorHi = flow.doctor?.marathiName ?? "तज्ज्ञ डॉक्टर";
  const doctorEn = flow.doctor?.spoken ?? "the specialist";
  const time = flow.slot?.label ?? "";

  return {
    hi:
      `कृपया तपासा: ${flow.patientName}, मोबाइल ${spokenPhone}, ` +
      `${doctorHi} सोबत ${flow.date.label} रोजी ${time}. ` +
      `बुक करू का? होय किंवा नाही सांगा.`,
    en:
      `Please check: ${flow.patientName}, mobile ${spokenPhone}, ` +
      `with Doctor ${doctorEn} on ${flow.date.spoken} at ${time}. ` +
      `Shall I book it? Say yes or no.`,
  };
}

function bookedPrompt(flow: AppointmentFlow): VoicePrompt {
  const reference = flow.appointmentId.length > 0 ? flow.appointmentId : "";
  const doctorHi = flow.doctor?.marathiName ?? "तज्ज्ञ डॉक्टर";
  const doctorEn = flow.doctor?.spoken ?? "the specialist";
  const room = flow.doctor?.room ?? "";

  return {
    hi:
      `अपॉइंटमेंट निश्चित झाली. संदर्भ क्रमांक ${reference}. ` +
      `${doctorHi}, ${room}, ${flow.date.label} रोजी ${flow.slot?.label ?? ""}. ` +
      `कृपया दहा मिनिटे आधी पोहोचा. एसएमएस पाठवला आहे.`,
    en:
      `Your appointment is confirmed. Reference ${reference}. ` +
      `Doctor ${doctorEn}, ${room}, on ${flow.date.spoken} at ${flow.slot?.label ?? ""}. ` +
      `Please arrive ten minutes early. An S M S has been sent.`,
  };
}

export interface UseVoiceAppointmentOptions {
  flow: AppointmentFlow;
  announceOnStart?: boolean;
  onIntent?: (intent: VoiceIntent) => void;
  onCancel?: () => void;
}

export function useVoiceAppointment({
  flow,
  announceOnStart = true,
  onIntent,
  onCancel,
}: UseVoiceAppointmentOptions): VoiceAgentHandle {
  const buildPrompt = useCallback(
    (phase: AppointmentPhase, current: AppointmentFlow): VoicePrompt | null => {
      switch (phase) {
        case "ask_district": {
          const names = DISTRICTS.map((district) => district.spoken);
          return {
            hi: `अपॉइंटमेंटसाठी कोणता जिल्हा? ${spokenList(names, "किंवा")}।`,
            en: `Which district is the appointment in? ${spokenList(names)}.`,
          };
        }

        case "ask_hospital":
          return hospitalPrompt(current.hospitalOptions);

        case "ask_doctor":
          return doctorPrompt(current.doctorOptions);

        case "ask_slot":
          return slotPrompt(current);

        case "ask_name":
          return namePrompt(current.doctor);

        case "ask_mobile":
          return mobilePrompt(current.patientName);

        case "confirm":
          return confirmPrompt(current);

        case "booking":
          return BOOKING_PROMPT;

        case "booked":
          return bookedPrompt(current);
      }
    },
    [],
  );

  const resolve = useCallback(
    (
      phase: AppointmentPhase,
      spoken: string,
      current: AppointmentFlow,
    ): ResolveOutcome<AppointmentPhase> => {
      switch (phase) {
        case "ask_district": {
          const match = matchOption(spoken, DISTRICTS, (district) => district.aliases);
          const district = match?.option ?? pickByOrdinal(spoken, DISTRICTS);
          if (!district) return { type: "unmatched" };

          current.selectDistrict(district);
          return {
            type: "advance",
            phase: "ask_hospital",
            // From the district just matched: this render's flow still holds the
            // previous district's hospital list.
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
          // The bookable roster does not depend on the hospital, so reading it
          // from this render is safe.
          return {
            type: "advance",
            phase: "ask_doctor",
            prompt: doctorPrompt(current.doctorOptions),
          };
        }

        case "ask_doctor": {
          const options = current.doctorOptions;
          if (options.length === 0) return { type: "unmatched" };

          const byName = matchOption(spoken, options, (doctor) => doctor.aliases);
          let doctor = byName?.option ?? null;

          // "I need pediatrics" — resolve the specialty to its specialist.
          if (!doctor) {
            const department = matchOption(
              spoken,
              SPECIALIST_DEPARTMENTS,
              (candidate) => candidate.aliases,
            );
            if (department) {
              doctor =
                options.find(
                  (candidate) => candidate.departmentId === department.option.id,
                ) ?? null;

              // The specialty exists but nobody is bookable for it today.
              if (!doctor) {
                return {
                  type: "invalid",
                  prompt: {
                    hi: `${department.option.marathi} साठी आज कोणी उपलब्ध नाही. दुसरा विभाग सांगा.`,
                    en: `No one is available for ${department.option.spoken} today. Please say another department.`,
                  },
                };
              }
            }
          }

          doctor = doctor ?? pickByOrdinal(spoken, options);
          if (!doctor) return { type: "unmatched" };

          current.selectDoctor(doctor);
          return { type: "advance", phase: "ask_slot", prompt: slotPrompt(current) };
        }

        case "ask_slot": {
          // Dates are checked first on purpose. "तीन दिवस" contains the token
          // "तीन", which is also an alias of the 3 PM slot, so matching slots
          // first would book a time when the caller was choosing a day.
          const dateMatch = matchOption(
            spoken,
            APPOINTMENT_DATES,
            (date) => date.aliases,
          );
          if (dateMatch) {
            current.selectDate(dateMatch.option.id);
            return {
              type: "advance",
              phase: "ask_slot",
              prompt: slotPrompt(current, {
                hi: dateMatch.option.label,
                en: dateMatch.option.spoken,
              }),
            };
          }

          const slotMatch = matchOption(
            spoken,
            APPOINTMENT_SLOTS,
            (slot) => slot.aliases,
          );
          const slot: AppointmentSlotInfo | null =
            slotMatch?.option ??
            // "any morning slot" — no time named, so take the first of that half-day.
            matchSlotPeriod(tokenize(spoken)) ??
            pickByOrdinal(spoken, APPOINTMENT_SLOTS);

          if (!slot) return { type: "unmatched" };

          current.selectSlot(slot);
          return {
            type: "advance",
            phase: "ask_name",
            prompt: namePrompt(current.doctor),
          };
        }

        case "ask_name": {
          const name = extractPersonName(spoken);
          if (!name) return { type: "invalid", prompt: NAME_INVALID_PROMPT };

          current.setPatientName(name);
          return { type: "advance", phase: "ask_mobile", prompt: mobilePrompt(name) };
        }

        case "ask_mobile": {
          const digits = parseMobileNumber(spoken);
          if (!digits) return { type: "invalid", prompt: MOBILE_INVALID_PROMPT };

          current.setPatientPhone(digits);
          return {
            type: "advance",
            phase: "confirm",
            prompt: confirmPrompt(current, digits),
          };
        }

        case "confirm": {
          const answer = matchYesNo(spoken);
          if (answer === null) return { type: "unmatched" };

          if (!answer) {
            // Start the details over rather than guessing which part was wrong.
            return {
              type: "advance",
              phase: "ask_name",
              prompt: {
                hi: "ठीक आहे, पुन्हा घेतो. रुग्णाचे नाव सांगा.",
                en: "Alright, let us redo it. Please say the patient's name.",
              },
            };
          }

          current.confirmBooking();
          // The `isConfirming` signal moves the agent to `booking`, and the step
          // reaching "completed" moves it on to `booked`.
          return { type: "stay" };
        }

        case "booking":
        case "booked":
          return { type: "stay" };
      }
    },
    [],
  );

  const signals: readonly PhaseSignal<AppointmentPhase>[] = [
    // Covers the confirm button being tapped instead of spoken.
    {
      active: flow.isConfirming,
      from: ["ask_name", "ask_mobile", "confirm"],
      to: "booking",
    },
    // Covers the number being typed on the keypad: ten digits is unambiguous
    // completion, which a partially typed name is not.
    { active: flow.patientPhone.length === 10, from: ["ask_mobile"], to: "confirm" },
  ];

  return useVoiceFlowEngine<AppointmentFlow, AppointmentStep, AppointmentPhase>({
    service: "appointment",
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
