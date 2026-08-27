"use client";

import { useCallback } from "react";
import {
  DISTRICTS,
  getHospitalsForDistrict,
  type HospitalInfo,
} from "@/data/tokenBookingOptions";
import { WARD_CATEGORIES, getWardAvailability } from "@/data/serviceOptions";
import {
  type VoiceIntent,
  matchOption,
  matchOrdinal,
} from "@/lib/voice/matching";
import { spokenList } from "@/lib/voice/promptText";
import type { VoiceAgentHandle, VoicePrompt } from "@/lib/voice/agent";
import {
  type PhaseSignal,
  type ResolveOutcome,
  useVoiceFlowEngine,
} from "@/hooks/useVoiceFlowEngine";
import type {
  BedAvailabilityFlow,
  BedAvailabilityStep,
} from "@/hooks/useBedAvailabilityFlow";

/**
 * Voice agent for the live bed availability lookup.
 *
 * All conversation mechanics — turn generations, the silence timer, mic
 * handover, the retry ladder, and step reconciliation — come from
 * `useVoiceFlowEngine`. This file is only the script: what to say in each phase,
 * and how to read one answer.
 *
 * The earlier hand-written version of this hook had no step-to-phase map and no
 * reconciliation effect, so tapping a district on screen left the agent still
 * asking for one. That map is now `STEP_TO_PHASE` below, and the engine enforces
 * it on every change to `flow.step`.
 */

type BedPhase = "ask_district" | "ask_hospital" | "scanning" | "summary" | "ward_detail";

const LISTENING_PHASES: readonly BedPhase[] = [
  "ask_district",
  "ask_hospital",
  "summary",
  "ward_detail",
];

/** The phase that belongs to each wizard step. Drives reconciliation. */
const STEP_TO_PHASE: Record<BedAvailabilityStep, BedPhase> = {
  district: "ask_district",
  hospital: "ask_hospital",
  completed: "summary",
};

/**
 * Sub-phases that are not a mismatch.
 *
 * `scanning` happens while the wizard is still on the hospital step, and
 * `ward_detail` is a drill-down inside the completed step. Without these the
 * engine would read the reconciliation as drift and re-ask the previous question
 * mid-sentence.
 */
const TOLERATED: Partial<Record<BedPhase, readonly BedPhase[]>> = {
  ask_hospital: ["scanning"],
  summary: ["ward_detail"],
};

/** "Show me another hospital" — sends the caller back one step. */
const ANOTHER_HOSPITAL_ALIASES = [
  "another hospital",
  "other hospital",
  "different hospital",
  "change hospital",
  "dusra hospital",
  "doosra hospital",
  "dusre hospital",
  "दूसरा अस्पताल",
  "दुसरे रुग्णालय",
  "दुसरं रुग्णालय",
  "अस्पताल बदलो",
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
  hi: "ठीक है, बेड जानकारी बंद कर रहा हूँ।",
  en: "Alright, closing the bed availability service.",
};

const SCANNING_PROMPT: VoicePrompt = {
  hi: "एक क्षण रुकिए, अस्पताल से लाइव बेड जानकारी ली जा रही है।",
  en: "One moment, fetching live bed telemetry from the hospital.",
};

/** Prompt for the hospital step, built from a district's own list. */
function hospitalPrompt(hospitals: readonly HospitalInfo[]): VoicePrompt {
  if (hospitals.length === 0) {
    return {
      hi: "इस ज़िले में कोई सरकारी अस्पताल सूची में नहीं मिला। कृपया दूसरा ज़िला बोलिए।",
      en: "I could not find a listed government hospital in that district. Please say another district.",
    };
  }

  const names = hospitals.map((hospital) => hospital.spoken);
  return {
    hi: `कौन सा अस्पताल? ${spokenList(names, "या")}।`,
    en: `Which hospital? ${spokenList(names)}.`,
  };
}

export interface UseVoiceBedAvailabilityOptions {
  flow: BedAvailabilityFlow;
  /**
   * Speak the opening question on `start()`. True by default: this agent is
   * handed control mid-conversation, so the caller needs to hear what to answer.
   */
  announceOnStart?: boolean;
  onIntent?: (intent: VoiceIntent) => void;
  onCancel?: () => void;
}

export function useVoiceBedAvailability({
  flow,
  announceOnStart = true,
  onIntent,
  onCancel,
}: UseVoiceBedAvailabilityOptions): VoiceAgentHandle {
  const buildPrompt = useCallback(
    (phase: BedPhase, current: BedAvailabilityFlow): VoicePrompt | null => {
      switch (phase) {
        case "ask_district": {
          const names = DISTRICTS.map((district) => district.spoken);
          return {
            hi: `किस ज़िले की बेड उपलब्धता देखनी है? ${spokenList(names, "या")}।`,
            en: `Which district's bed availability do you need? ${spokenList(names)}.`,
          };
        }

        case "ask_hospital":
          return hospitalPrompt(current.hospitalOptions);

        case "scanning":
          return SCANNING_PROMPT;

        case "summary": {
          const hospital = current.hospital;
          const summary = current.wardSummary;
          if (!hospital || summary.length === 0) return null;

          const byId = (id: string) =>
            summary.find((entry) => entry.ward.id === id)?.available ?? 0;

          return {
            hi:
              `${hospital.spoken} की लाइव स्थिति। आईसीयू में ${byId("icu")} बेड खाली, ` +
              `ऑक्सिजन बेड ${byId("oxygen")}, जनरल वॉर्ड ${byId("general")}, ` +
              `और इमरजेंसी में ${byId("emergency")} बेड खाली हैं। ` +
              `किसी वॉर्ड का पूरा ब्योरा चाहिए तो उसका नाम बोलिए।`,
            en:
              `Live status at ${hospital.spoken}. ${byId("icu")} I C U beds free, ` +
              `${byId("oxygen")} oxygen beds, ${byId("general")} general ward beds, ` +
              `and ${byId("emergency")} emergency beds free. ` +
              `Say a ward name for the full breakdown.`,
          };
        }

        case "ward_detail": {
          const entry = current.wardSummary.find(
            (candidate) => candidate.ward.id === current.selectedWardId,
          );
          if (!entry) return null;
          return wardDetailPrompt(entry.ward.spoken, entry.ward.name, entry.available, entry.total);
        }
      }
    },
    [],
  );

  const resolve = useCallback(
    (
      phase: BedPhase,
      spoken: string,
      current: BedAvailabilityFlow,
    ): ResolveOutcome<BedPhase> => {
      switch (phase) {
        case "ask_district": {
          const match = matchOption(spoken, DISTRICTS, (district) => district.aliases);
          const district =
            match?.option ??
            pickByOrdinal(spoken, DISTRICTS);

          if (!district) return { type: "unmatched" };

          current.selectDistrict(district);
          // The prompt is computed from the district we just matched, not from
          // `current.hospitalOptions`: this render's flow still holds the previous
          // district's list, so reading it here would announce the wrong hospitals.
          return {
            type: "advance",
            phase: "ask_hospital",
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
          // The scan runs for a couple of seconds; the flow flipping to
          // "completed" is what triggers the announcement.
          return { type: "advance", phase: "scanning", prompt: SCANNING_PROMPT };
        }

        case "scanning":
          // Microphone is closed during the scan; nothing should arrive here.
          return { type: "stay" };

        case "summary":
        case "ward_detail": {
          // "Another hospital" first — it is a navigation request, and a ward name
          // may well be sitting in the same sentence.
          if (matchesAny(spoken, ANOTHER_HOSPITAL_ALIASES)) {
            current.backToHospitals();
            return {
              type: "advance",
              phase: "ask_hospital",
              prompt: hospitalPrompt(current.hospitalOptions),
            };
          }

          const wardMatch = matchOption(spoken, WARD_CATEGORIES, (ward) => ward.aliases);
          if (wardMatch) {
            const ward = wardMatch.option;
            current.selectWard(ward.id);

            // Recomputed from the hospital id rather than read off
            // `current.wardSummary`, so the figure spoken is the one the freshly
            // selected card will show.
            const entry = getWardAvailability(current.hospital?.id ?? null).find(
              (candidate) => candidate.ward.id === ward.id,
            );
            if (!entry) return { type: "unmatched" };

            return {
              type: "advance",
              phase: "ward_detail",
              prompt: wardDetailPrompt(ward.spoken, ward.name, entry.available, entry.total),
            };
          }

          // A district name here means "start over somewhere else".
          const districtMatch = matchOption(spoken, DISTRICTS, (district) => district.aliases);
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

  const signals: readonly PhaseSignal<BedPhase>[] = [
    // A tap on the hospital card starts the scan without the agent's involvement;
    // this moves the conversation into the scan so it does not keep waiting for
    // an answer to a question that has already been answered by touch.
    { active: flow.isScanning, from: ["ask_district", "ask_hospital"], to: "scanning" },
  ];

  return useVoiceFlowEngine<BedAvailabilityFlow, BedAvailabilityStep, BedPhase>({
    service: "bed_availability",
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

function wardDetailPrompt(
  spoken: string,
  name: string,
  available: number,
  total: number,
): VoicePrompt {
  const occupied = total - available;
  return {
    hi: `${name} में कुल ${total} बेड हैं। ${available} खाली और ${occupied} भरे हुए हैं।`,
    en: `${spoken}: ${available} of ${total} beds are free, ${occupied} are occupied.`,
  };
}

/** Resolves "pehla wala" / "second one" against a list. */
function pickByOrdinal<T>(spoken: string, options: readonly T[]): T | null {
  const index = matchOrdinal(spoken, options.length);
  return index === null ? null : options[index];
}

/** True when any alias appears in the utterance. */
function matchesAny(spoken: string, aliases: readonly string[]): boolean {
  return matchOption(spoken, [aliases], (group) => group) !== null;
}
