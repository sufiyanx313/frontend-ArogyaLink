"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEPARTMENTS,
  DISTRICTS,
  SYMPTOMS,
} from "@/data/tokenBookingOptions";
import {
  type VoiceIntent,
  detectIntent,
  matchOption,
  matchOrdinal,
  matchYesNo,
  parseMobileNumber,
} from "@/lib/voice/matching";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type {
  TokenBookingFlow,
  TokenBookingStep,
} from "@/hooks/useTokenBookingFlow";

/**
 * Voice-guided OPD token booking agent.
 *
 * Conversation model
 * ------------------
 * Each turn is: stop the mic -> speak a prompt -> reopen the mic -> match the
 * transcript -> mutate `flow` -> move to the next phase. The mic is closed
 * while speaking because otherwise recognition transcribes the assistant's own
 * voice back into the next answer.
 *
 * Two mechanisms keep this robust:
 *
 * - **Turn generations.** Every prompt takes a monotonically increasing ticket.
 *   Any async continuation whose ticket is stale is dropped, so a barge-in or a
 *   manual click can never be overwritten by an in-flight turn.
 * - **Step reconciliation.** `flow.step` is watched, so when the user clicks an
 *   option manually the agent notices the wizard moved without it and re-prompts
 *   for whatever step is now current. Voice and touch stay interchangeable at
 *   every point in the flow.
 */

export type VoicePhase =
  | "idle"
  | "greeting"
  | "awaiting_intent"
  | "ask_district"
  | "ask_hospital"
  | "ask_department"
  | "ask_symptom"
  | "ask_phone"
  | "confirm_phone"
  | "verifying"
  | "completed"
  | "denied";

/** Prompt text in both scripts — see `resolvePromptText`. */
interface VoicePrompt {
  /** Devanagari, used when a Hindi TTS voice is installed. */
  hi: string;
  /** Romanised Hinglish, used as the caption and as the en-IN fallback. */
  en: string;
}

/** How long to wait for the user to say something before re-prompting. */
const SILENCE_TIMEOUT_MS = 10_000;
/** Speaker tail guard so the mic does not catch the end of the prompt. */
const MIC_REOPEN_DELAY_MS = 280;

const PROMPTS = {
  greeting: {
    hi: "नमस्ते! मैं आपकी आरोग्य सहायक हूँ। मैं क्या मदद कर सकती हूँ? आप कह सकते हैं — मुझे टोकन बुक करना है।",
    en: "Namaste! Main aapki Aarogya sahayak hoon. Main kya help kar sakti hoon? Aap keh sakte hain — mujhe token book karna hai.",
  },
  intentUnknown: {
    hi: "माफ़ कीजिए, मैं समझ नहीं पाई। टोकन के लिए कहिए — मुझे ओपीडी टोकन चाहिए।",
    en: "Maaf kijiye, main samajh nahi payi. Token ke liye kahiye — mujhe OPD token chahiye.",
  },
  bookingConfirmed: {
    hi: "ठीक है! मैं आपका ओपीडी टोकन बुक करती हूँ।",
    en: "Theek hai! Main aapka OPD token book karti hoon.",
  },
  district: {
    hi: "आपका ज़िला कौन सा है? जैसे पुणे, मुंबई, नागपूर...",
    en: "Aapka district konsa hai? Jaise Pune, Mumbai, Nagpur...",
  },
  department: {
    hi: "कौन सा ओपीडी विभाग चुनना है? जैसे जनरल मेडिसिन, ऑर्थोपेडिक्स, पीडियाट्रिक्स...",
    en: "Konsa OPD department select karna hai? Jaise General Medicine, Orthopedics, Pediatrics...",
  },
  symptom: {
    hi: "आपको क्या तकलीफ़ या लक्षण हैं? जैसे बुखार, सिरदर्द, अंगदुखी...",
    en: "Aapko kya takleef ya symptoms hain? Jaise Fever, Headache, Body ache...",
  },
  phone: {
    hi: "अपना दस अंकों का मोबाइल नंबर बोलिए, या स्क्रीन पर टाइप कीजिए।",
    en: "Apna 10 digit mobile number boliye, ya screen par type kijiye.",
  },
  phoneInvalid: {
    hi: "मुझे पूरा दस अंकों का नंबर नहीं मिला। कृपया दोबारा बोलिए।",
    en: "Mujhe poora 10 digit number nahi mila. Kripya dobara boliye.",
  },
  verifying: {
    hi: "ओटीपी अपने आप वेरिफ़ाई हो रहा है। एक पल रुकिए...",
    en: "OTP automatically verify ho raha hai. Ek pal rukiye...",
  },
  retry: {
    hi: "कृपया दोबारा बोलिए...",
    en: "Kripya dobara boliye...",
  },
  manualHint: {
    hi: "कोई बात नहीं, आप स्क्रीन पर सीधे टैप करके भी चुन सकते हैं।",
    en: "Koi baat nahi, aap screen par seedha tap karke bhi chun sakte hain.",
  },
  cancelled: {
    hi: "ठीक है, टोकन बुकिंग बंद कर रही हूँ।",
    en: "Theek hai, token booking band kar rahi hoon.",
  },
} satisfies Record<string, VoicePrompt>;

/** Which phase corresponds to each wizard step, for reconciliation. */
const STEP_TO_PHASE: Record<TokenBookingStep, VoicePhase> = {
  district: "ask_district",
  hospital: "ask_hospital",
  department: "ask_department",
  symptoms: "ask_symptom",
  otp: "ask_phone",
  generating: "verifying",
  token: "completed",
};

/** Phases where the microphone should be open after the prompt. */
const LISTENING_PHASES: ReadonlySet<VoicePhase> = new Set<VoicePhase>([
  "greeting",
  "awaiting_intent",
  "ask_district",
  "ask_hospital",
  "ask_department",
  "ask_symptom",
  "ask_phone",
  "confirm_phone",
]);

/** Renders "9876543210" as "9 8 7 6..." so TTS reads it digit by digit. */
function spellDigits(value: string): string {
  return value.split("").join(" ");
}

/** Joins option names into a natural spoken list: "A, B ya C". */
function spokenList(names: string[], conjunction: string): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}

export interface UseVoiceTokenBookingOptions {
  /** The wizard state this agent drives. */
  flow: TokenBookingFlow;
  /** Called when the token-booking intent is detected, to open the modal. */
  onBookingStart?: () => void;
  /** Called for intents belonging to the other portal services. */
  onIntent?: (intent: VoiceIntent) => void;
  /** Called when the user asks to cancel or exit. */
  onCancel?: () => void;
  /** Recognition + synthesis language. */
  lang?: string;
}

export interface UseVoiceTokenBookingResult {
  phase: VoicePhase;
  isActive: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  /** Exactly what the assistant is saying, in the script being spoken. */
  caption: string;
  /** The same line romanised, for readers who prefer Latin script. */
  captionRoman: string;
  /** Last finalised user utterance. */
  transcript: string;
  /** Live partial utterance while the user is still talking. */
  interimTranscript: string;
  micError: SpeechRecognitionErrorCode | null;
  /** Begins the conversation. Must be called from a user gesture. */
  start: () => void;
  /** Ends the conversation and releases the microphone. */
  stop: () => void;
  /** Feeds text through the same pipeline as speech (used by preset chips). */
  submitText: (text: string) => void;
}

export function useVoiceTokenBooking({
  flow,
  onBookingStart,
  onIntent,
  onCancel,
  lang = "hi-IN",
}: UseVoiceTokenBookingOptions): UseVoiceTokenBookingResult {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [isActive, setIsActive] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionRoman, setCaptionRoman] = useState("");
  const [transcript, setTranscript] = useState("");

  /** Mirrors `phase` for synchronous reads inside async continuations. */
  const phaseRef = useRef<VoicePhase>("idle");
  /** Invalidates async continuations from superseded turns. */
  const turnRef = useRef(0);
  const retryRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True once the district prompt has been reached at least once. */
  const bookingStartedRef = useRef(false);

  // Latest props and callbacks, so nothing here closes over a stale render.
  // Assigned from an effect (never during render) and only ever read from
  // events, timers and effects — all of which run after the commit.
  const flowRef = useRef(flow);
  const callbacksRef = useRef({ onBookingStart, onIntent, onCancel });

  const { speak, cancel: cancelSpeech, isSpeaking, activeVoice, isSupported: isTtsSupported } =
    useSpeechSynthesis(lang);

  // `handleFinal` and `runPhase` are mutually recursive, so each is reached
  // through a ref. The refs are filled in by the sync effect below, which is
  // declared ahead of every effect that calls through them.
  const handleFinalRef = useRef<(text: string) => void>(() => {});
  const runPhaseRef = useRef<(next: VoicePhase) => void>(() => {});

  const recognition = useSpeechRecognition({
    lang,
    onFinalResult: (text) => handleFinalRef.current(text),
    onTerminalError: () => {
      turnRef.current += 1;
      cancelSpeech();
      phaseRef.current = "denied";
      setPhase("denied");
    },
  });

  const {
    start: startMic,
    stop: stopMic,
    abort: abortMic,
    isListening,
    interimTranscript,
    errorCode: micError,
    isSupported: isRecognitionSupported,
  } = recognition;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  /** Devanagari when a Hindi voice exists, otherwise the romanised line. */
  const resolvePromptText = useCallback(
    (prompt: VoicePrompt): string => {
      const isHindiVoice = activeVoice?.lang.toLowerCase().startsWith("hi") ?? false;
      return isHindiVoice ? prompt.hi : prompt.en;
    },
    [activeVoice],
  );

  /**
   * Speaks a prompt then optionally reopens the mic.
   * Returns `false` when the turn was superseded mid-flight.
   */
  const speakPrompt = useCallback(
    async (prompt: VoicePrompt, shouldListen: boolean): Promise<boolean> => {
      const generation = (turnRef.current += 1);

      clearSilenceTimer();
      stopMic();

      setCaption(resolvePromptText(prompt));
      setCaptionRoman(prompt.en);

      await speak(resolvePromptText(prompt));
      if (turnRef.current !== generation) return false;

      if (!shouldListen) return true;

      await new Promise((resolve) => setTimeout(resolve, MIC_REOPEN_DELAY_MS));
      if (turnRef.current !== generation) return false;

      startMic();
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        if (turnRef.current === generation) handleFinalRef.current("");
      }, SILENCE_TIMEOUT_MS);

      return true;
    },
    [clearSilenceTimer, resolvePromptText, speak, startMic, stopMic],
  );

  /** Builds the prompt for a phase, including any dynamic option list. */
  const promptForPhase = useCallback((target: VoicePhase): VoicePrompt | null => {
    const current = flowRef.current;

    switch (target) {
      case "greeting":
        return PROMPTS.greeting;
      case "awaiting_intent":
        return PROMPTS.intentUnknown;
      case "ask_district":
        return PROMPTS.district;
      case "ask_hospital": {
        const names = current.hospitalOptions.map((hospital) => hospital.spoken);
        return {
          hi: `कौन से अस्पताल में टोकन चाहिए? ${spokenList(names, "या")}`,
          en: `Konse hospital me token chahiye? ${spokenList(names, "ya")}`,
        };
      }
      case "ask_department":
        return PROMPTS.department;
      case "ask_symptom":
        return PROMPTS.symptom;
      case "ask_phone":
        return PROMPTS.phone;
      case "confirm_phone": {
        const spelled = spellDigits(current.phone);
        return {
          hi: `मैंने ${spelled} सुना। क्या यह सही है?`,
          en: `Maine ${spelled} suna. Kya yeh sahi hai?`,
        };
      }
      case "verifying":
        return PROMPTS.verifying;
      case "completed": {
        const code = `${current.tokenCodePrefix}-${current.userTokenNum}`;
        const room = current.department?.room ?? "Room 14";
        return {
          hi: `आपका ओपीडी टोकन सफलतापूर्वक जनरेट हो गया है! आपका टोकन ${code} है। कृपया ${room} में जाइए।`,
          en: `Aapka OPD token successfully generate ho gaya hai! Aapka token ${code} hai. Kripya ${room} me jaiye.`,
        };
      }
      default:
        return null;
    }
  }, []);

  /** Enters a phase: resets retries, speaks its prompt, reopens the mic. */
  const runPhase = useCallback(
    (target: VoicePhase) => {
      phaseRef.current = target;
      setPhase(target);
      retryRef.current = 0;

      if (target === "ask_district") bookingStartedRef.current = true;

      const prompt = promptForPhase(target);
      if (!prompt) {
        turnRef.current += 1;
        clearSilenceTimer();
        stopMic();
        return;
      }

      void speakPrompt(prompt, LISTENING_PHASES.has(target)).then((survived) => {
        // The greeting flows straight into intent capture without re-speaking.
        if (survived && phaseRef.current === "greeting") {
          phaseRef.current = "awaiting_intent";
          setPhase("awaiting_intent");
        }
      });
    },
    [clearSilenceTimer, promptForPhase, speakPrompt, stopMic],
  );

  /**
   * Escalating recovery for unclear input: repeat once, then point at the
   * on-screen options, then just keep listening rather than nagging.
   */
  const handleUnmatched = useCallback(() => {
    retryRef.current += 1;
    const attempt = retryRef.current;
    const prompt =
      attempt === 1
        ? PROMPTS.retry
        : attempt === 2
          ? PROMPTS.manualHint
          : null;

    if (prompt) {
      void speakPrompt(prompt, true);
      return;
    }

    // Silent re-arm: mic stays open, no further spoken nudges.
    const generation = (turnRef.current += 1);
    startMic();
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (turnRef.current === generation) handleFinalRef.current("");
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, speakPrompt, startMic]);

  const finish = useCallback(
    (notify: boolean) => {
      turnRef.current += 1;
      clearSilenceTimer();
      abortMic();
      cancelSpeech();
      phaseRef.current = "idle";
      setPhase("idle");
      setIsActive(false);
      setCaption("");
      setCaptionRoman("");
      bookingStartedRef.current = false;
      if (notify) callbacksRef.current.onCancel?.();
    },
    [abortMic, cancelSpeech, clearSilenceTimer],
  );

  /** Routes one finalised utterance ("" means the silence timer fired). */
  const handleFinal = useCallback(
    (text: string) => {
      clearSilenceTimer();

      const spoken = text.trim();
      if (spoken.length > 0) setTranscript(spoken);

      const current = phaseRef.current;
      if (current === "idle" || current === "denied") return;

      // Silence: treat as an unclear answer.
      if (spoken.length === 0) {
        handleUnmatched();
        return;
      }

      const intent = detectIntent(spoken);

      if (intent === "cancel") {
        void speakPrompt(PROMPTS.cancelled, false).then(() => finish(true));
        return;
      }

      if (intent === "repeat") {
        runPhaseRef.current(current);
        return;
      }

      const flowNow = flowRef.current;

      switch (current) {
        case "greeting":
        case "awaiting_intent": {
          if (intent === "token_booking") {
            callbacksRef.current.onBookingStart?.();
            void speakPrompt(PROMPTS.bookingConfirmed, false).then((survived) => {
              if (survived) runPhaseRef.current("ask_district");
            });
            return;
          }
          if (intent !== "unknown") {
            // Another service was asked for — hand off and stand down.
            callbacksRef.current.onIntent?.(intent);
            finish(false);
            return;
          }
          handleUnmatched();
          return;
        }

        case "ask_district": {
          const match = matchOption(spoken, DISTRICTS, (item) => item.aliases);
          const district =
            match?.option ??
            (() => {
              const index = matchOrdinal(spoken, DISTRICTS.length);
              return index === null ? null : DISTRICTS[index];
            })();

          if (!district) {
            handleUnmatched();
            return;
          }
          flowNow.selectDistrict(district);
          runPhaseRef.current("ask_hospital");
          return;
        }

        case "ask_hospital": {
          const options = flowNow.hospitalOptions;
          const match = matchOption(spoken, options, (item) => item.aliases);
          const hospital =
            match?.option ??
            (() => {
              const index = matchOrdinal(spoken, options.length);
              return index === null ? null : options[index];
            })();

          if (!hospital) {
            handleUnmatched();
            return;
          }
          flowNow.selectHospital(hospital);
          runPhaseRef.current("ask_department");
          return;
        }

        case "ask_department": {
          const match = matchOption(spoken, DEPARTMENTS, (item) => item.aliases);
          const department =
            match?.option ??
            (() => {
              const index = matchOrdinal(spoken, DEPARTMENTS.length);
              return index === null ? null : DEPARTMENTS[index];
            })();

          if (!department) {
            handleUnmatched();
            return;
          }
          flowNow.selectDepartment(department);
          runPhaseRef.current("ask_symptom");
          return;
        }

        case "ask_symptom": {
          const match = matchOption(spoken, SYMPTOMS, (item) => item.aliases);
          const symptom =
            match?.option ??
            (() => {
              const index = matchOrdinal(spoken, SYMPTOMS.length);
              return index === null ? null : SYMPTOMS[index];
            })();

          if (!symptom) {
            handleUnmatched();
            return;
          }
          flowNow.selectSymptom(symptom);
          runPhaseRef.current("ask_phone");
          return;
        }

        case "ask_phone": {
          const mobile = parseMobileNumber(spoken);
          if (!mobile) {
            // Distinct wording from the generic retry: the user did speak,
            // the digits just did not add up to a valid mobile number.
            retryRef.current += 1;
            void speakPrompt(
              retryRef.current >= 2 ? PROMPTS.manualHint : PROMPTS.phoneInvalid,
              true,
            );
            return;
          }
          // Setting the phone triggers the confirmation effect below, which is
          // the same path a manually typed number takes.
          flowNow.setPhone(mobile);
          return;
        }

        case "confirm_phone": {
          const answer = matchYesNo(spoken);
          if (answer === null) {
            handleUnmatched();
            return;
          }
          if (!answer) {
            flowNow.setPhone("");
            runPhaseRef.current("ask_phone");
            return;
          }
          flowNow.autoFillOtp();
          phaseRef.current = "verifying";
          setPhase("verifying");
          void speakPrompt(PROMPTS.verifying, false);
          flowNow.generateToken();
          return;
        }

        default:
          return;
      }
    },
    [clearSilenceTimer, finish, handleUnmatched, speakPrompt],
  );

  /**
   * Publishes the current render's props and callbacks to their refs.
   *
   * Declared before the effects that call `runPhaseRef` / `handleFinalRef` so
   * that on every commit the refs are refreshed first.
   */
  useEffect(() => {
    flowRef.current = flow;
    callbacksRef.current = { onBookingStart, onIntent, onCancel };
    runPhaseRef.current = runPhase;
    handleFinalRef.current = handleFinal;
  });

  /**
   * Moves to confirmation as soon as a full number exists, whether it arrived
   * by voice or was typed into the modal.
   */
  useEffect(() => {
    if (!isActive) return;
    if (phaseRef.current !== "ask_phone") return;
    if (!flow.isPhoneComplete) return;
    runPhaseRef.current("confirm_phone");
  }, [flow.isPhoneComplete, isActive]);

  /**
   * Reconciles manual clicks: if the wizard step no longer matches the phase
   * the agent thinks it is in, adopt the wizard's step and prompt for it.
   */
  useEffect(() => {
    if (!isActive || !bookingStartedRef.current) return;

    const expected = STEP_TO_PHASE[flow.step];
    const current = phaseRef.current;

    if (current === expected || current === "denied") return;
    // Confirmation and OTP entry are both the "otp" step — not a mismatch.
    if (expected === "ask_phone" && current === "confirm_phone") return;

    runPhaseRef.current(expected);
  }, [flow.step, isActive]);

  // 🛑 FIX: Puraana 'runPhaseRef.current("greeting")' hata diya gaya hai.
  // Ab ye bina bole direct 'awaiting_intent' mein chala jayega aur sunne lagega.
  const start = useCallback(() => {
    if (!isRecognitionSupported && !isTtsSupported) return;
    setIsActive(true);
    setTranscript("");
    bookingStartedRef.current = false;
    
    // Yahan hum directly Mic open kar rahe hain bina TTS (Text-to-speech) trigger kiye
    phaseRef.current = "awaiting_intent";
    setPhase("awaiting_intent");
    startMic();
  }, [isRecognitionSupported, isTtsSupported, startMic]);

  const stop = useCallback(() => finish(false), [finish]);

  /** Lets the preset chips drive the same conversation without a microphone. */
  const submitText = useCallback(
    (text: string) => {
      setIsActive(true);
      if (phaseRef.current === "idle" || phaseRef.current === "denied") {
        phaseRef.current = "awaiting_intent";
        setPhase("awaiting_intent");
      }
      handleFinalRef.current(text);
    },
    [],
  );

  useEffect(() => {
    return () => {
      turnRef.current += 1;
      if (silenceTimerRef.current !== null) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, []);

  return {
    phase,
    isActive,
    isSupported: isRecognitionSupported,
    isSpeaking,
    isListening,
    caption,
    captionRoman,
    transcript,
    interimTranscript,
    micError,
    start,
    stop,
    submitText,
  };
}
