"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type VoiceIntent, detectIntent } from "@/lib/voice/matching";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { VoiceAgentHandle, VoicePrompt } from "@/lib/voice/agent";

/**
 * The conversation engine shared by every service voice agent.
 *
 * Why this is factored out
 * ------------------------
 * `useVoiceTokenBooking` proved the conversation model, and the first attempt at
 * a second service copied it by hand. The copy silently dropped three things —
 * the step-reconciliation effect, the turn bump on a terminal mic error, and the
 * `silenceTimerRef` null-out inside the timeout — and the result was an agent
 * whose phase drifted away from the wizard the moment anyone tapped an option.
 * Every one of those is orchestration, not service logic, so it lives here once.
 *
 * A service hook supplies only what is actually service-specific: its phase
 * vocabulary, its prompts, its step-to-phase map, and a `resolve` function that
 * turns one utterance into a flow mutation plus the next phase.
 *
 * Conversation model
 * ------------------
 * Each turn is: stop the mic -> speak a prompt -> reopen the mic -> match the
 * transcript -> mutate the flow -> move to the next phase. The mic is closed
 * while speaking, otherwise recognition transcribes the assistant's own voice
 * back in as the next answer.
 *
 * Three mechanisms keep it robust:
 *
 * - **Turn generations.** Every prompt takes a monotonically increasing ticket.
 *   Any async continuation holding a stale ticket is dropped, so a barge-in, a
 *   manual tap, or a service handoff can never be overwritten by an in-flight
 *   turn.
 * - **Step reconciliation.** `flow.step` is watched. When the user taps an
 *   option the wizard moves without the agent, so the agent adopts whatever step
 *   is now current and prompts for it. Voice and touch stay interchangeable at
 *   every point in the flow.
 * - **Prompt overrides.** A resolver that has just selected a value can hand the
 *   engine the next prompt directly. This matters because `flow` inside an event
 *   handler is still the pre-update render's copy — asking it for
 *   `hospitalOptions` immediately after `selectDistrict()` yields the *previous*
 *   district's list.
 */

/** How long to wait for the user to say something before re-prompting. */
const SILENCE_TIMEOUT_MS = 10_000;
/** Speaker tail guard so the mic does not catch the end of the prompt. */
const MIC_REOPEN_DELAY_MS = 280;

/**
 * A flow-derived transition, for progress the user did not speak: a scan
 * animation finishing, or a phone number reaching ten digits by keypad.
 *
 * Fires when `active` flips true while the agent sits in one of `from`. It is
 * naturally idempotent — entering `to` means `from` no longer matches.
 */
export interface PhaseSignal<TPhase extends string> {
  active: boolean;
  from: readonly TPhase[];
  to: TPhase;
}

/** What a resolver decides to do with one finalised utterance. */
export type ResolveOutcome<TPhase extends string> =
  /** Value accepted and written to the flow; enter `phase` next. */
  | { type: "advance"; phase: TPhase; prompt?: VoicePrompt }
  /** Nothing recognised — run the escalating retry ladder. */
  | { type: "unmatched" }
  /** Heard, but not usable. Speak `prompt`, then escalate on repeats. */
  | { type: "invalid"; prompt: VoicePrompt }
  /** Handled; a `PhaseSignal` or effect will drive the next move. */
  | { type: "stay" }
  /** End the conversation. */
  | { type: "cancel" };

export interface VoiceFlowEngineConfig<TFlow, TStep extends string, TPhase extends string> {
  /**
   * This agent's own intent. Utterances matching it are never treated as a
   * handoff request, so saying "bed" inside the bed flow is not a service switch.
   */
  service: VoiceIntent;
  /** Wizard state this agent drives. */
  flow: TFlow;
  /** `flow.step`, passed separately so the engine can depend on it directly. */
  step: TStep;
  /** Phase the conversation opens on. */
  entryPhase: TPhase;
  /** Phases where the microphone reopens after the prompt. */
  listeningPhases: readonly TPhase[];
  /** Which phase corresponds to each wizard step, for reconciliation. */
  stepToPhase: Readonly<Record<TStep, TPhase>>;
  /**
   * Phases that are an acceptable stand-in for a reconciled phase, keyed by the
   * phase the step map produces. Sub-phases of one wizard step belong here —
   * confirming a mobile number is still the same step as entering it.
   */
  tolerated?: Readonly<Partial<Record<TPhase, readonly TPhase[]>>>;
  /** Flow-derived transitions. */
  signals?: readonly PhaseSignal<TPhase>[];
  /** Prompt for a phase. Receives the freshest committed flow. */
  buildPrompt: (phase: TPhase, flow: TFlow) => VoicePrompt | null;
  /** Turns one utterance into a flow mutation plus the next phase. */
  resolve: (phase: TPhase, spoken: string, flow: TFlow) => ResolveOutcome<TPhase>;
  /** Shared recovery lines. */
  retryPrompt: VoicePrompt;
  manualHintPrompt: VoicePrompt;
  cancelledPrompt: VoicePrompt;
  /**
   * Speak the entry prompt on `start()`. Slave agents want this — the user has
   * just asked for the service and needs to be told what to say next. The master
   * agent sets it false so tapping the mic opens straight into listening.
   */
  announceOnStart?: boolean;
  /** Another service was asked for. The agent stands down first. */
  onIntent?: (intent: VoiceIntent) => void;
  /** The user asked to cancel or exit. */
  onCancel?: () => void;
  /** Recognition + synthesis language. */
  lang?: string;
}

export function useVoiceFlowEngine<TFlow, TStep extends string, TPhase extends string>(
  config: VoiceFlowEngineConfig<TFlow, TStep, TPhase>,
): VoiceAgentHandle {
  const {
    flow,
    step,
    entryPhase,
    signals,
    announceOnStart = true,
    lang = "hi-IN",
  } = config;

  const [phase, setPhase] = useState<TPhase | "idle" | "denied">("idle");
  const [isActive, setIsActive] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionRoman, setCaptionRoman] = useState("");
  const [transcript, setTranscript] = useState("");

  /** Mirrors `phase` for synchronous reads inside async continuations. */
  const phaseRef = useRef<TPhase | "idle" | "denied">("idle");
  /** Invalidates async continuations from superseded turns. */
  const turnRef = useRef(0);
  const retryRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True once `start()` has run, which arms step reconciliation. */
  const hasStartedRef = useRef(false);

  // Latest config, so nothing below closes over a stale render. Assigned from
  // an effect (never during render) and only ever read from events, timers and
  // effects, all of which run after the commit.
  const configRef = useRef(config);

  const { speak, cancel: cancelSpeech, isSpeaking, activeVoice, isSupported: isTtsSupported } =
    useSpeechSynthesis(lang);

  // `handleFinal` and `runPhase` are mutually recursive, so each is reached
  // through a ref. The refs are filled in by the sync effect below, which is
  // declared ahead of every effect that calls through them.
  const handleFinalRef = useRef<(text: string) => void>(() => {});
  const runPhaseRef = useRef<(next: TPhase, prompt?: VoicePrompt) => void>(() => {});

  const recognition = useSpeechRecognition({
    lang,
    onFinalResult: (text) => handleFinalRef.current(text),
    onTerminalError: () => {
      // Bump the turn first: a prompt may still be mid-flight, and it must not
      // reopen a microphone the browser has just refused.
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

  /** Opens the mic and arms the silence timer under a fresh turn ticket. */
  const armListening = useCallback(
    (generation: number) => {
      startMic();
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        // Null this out before dispatching, or the ref keeps pointing at a timer
        // that has already fired and `clearSilenceTimer` becomes a no-op guard.
        silenceTimerRef.current = null;
        if (turnRef.current === generation) handleFinalRef.current("");
      }, SILENCE_TIMEOUT_MS);
    },
    [clearSilenceTimer, startMic],
  );

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

      armListening(generation);
      return true;
    },
    [armListening, clearSilenceTimer, resolvePromptText, speak, stopMic],
  );

  /** Enters a phase: resets retries, speaks its prompt, reopens the mic. */
  const runPhase = useCallback(
    (target: TPhase, promptOverride?: VoicePrompt) => {
      phaseRef.current = target;
      setPhase(target);
      retryRef.current = 0;

      const current = configRef.current;
      const prompt = promptOverride ?? current.buildPrompt(target, current.flow);

      if (!prompt) {
        // Nothing to say: retire any in-flight turn and release the mic.
        turnRef.current += 1;
        clearSilenceTimer();
        stopMic();
        return;
      }

      void speakPrompt(prompt, current.listeningPhases.includes(target));
    },
    [clearSilenceTimer, speakPrompt, stopMic],
  );

  /**
   * Escalating recovery for unclear input: repeat once, then point at the
   * on-screen options, then just keep listening rather than nagging.
   */
  const handleUnmatched = useCallback(
    (override?: VoicePrompt) => {
      retryRef.current += 1;
      const attempt = retryRef.current;
      const current = configRef.current;

      // A caller-supplied line is more specific than the generic retry, so it
      // wins the first attempt; the manual hint still takes over after that.
      const prompt =
        attempt === 1
          ? (override ?? current.retryPrompt)
          : attempt === 2
            ? current.manualHintPrompt
            : null;

      if (prompt) {
        void speakPrompt(prompt, true);
        return;
      }

      // Silent re-arm: mic stays open, no further spoken nudges.
      armListening((turnRef.current += 1));
    },
    [armListening, speakPrompt],
  );

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
      hasStartedRef.current = false;
      if (notify) configRef.current.onCancel?.();
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

      const settings = configRef.current;
      const intent = detectIntent(spoken);

      if (intent === "cancel") {
        void speakPrompt(settings.cancelledPrompt, false).then(() => finish(true));
        return;
      }

      if (intent === "repeat") {
        runPhaseRef.current(current);
        return;
      }

      // Resolve before considering a handoff. A service keyword can easily fall
      // out of a legitimate answer, and losing a matched hospital to a stray
      // "bed" would be far worse than missing a switch the user can repeat.
      const outcome = settings.resolve(current, spoken, settings.flow);

      switch (outcome.type) {
        case "advance":
          runPhaseRef.current(outcome.phase, outcome.prompt);
          return;
        case "invalid":
          handleUnmatched(outcome.prompt);
          return;
        case "stay":
          return;
        case "cancel":
          void speakPrompt(settings.cancelledPrompt, false).then(() => finish(true));
          return;
        case "unmatched": {
          // Nothing in this step fit. Now a service keyword is worth acting on.
          if (intent !== "unknown" && intent !== settings.service) {
            settings.onIntent?.(intent);
            finish(false);
            return;
          }
          handleUnmatched();
          return;
        }
      }
    },
    [clearSilenceTimer, finish, handleUnmatched, speakPrompt],
  );

  /**
   * Publishes this render's config and callbacks to their refs.
   *
   * Declared before the effects that call `runPhaseRef` / `handleFinalRef`, so
   * on every commit the refs are refreshed before anything reads through them.
   */
  useEffect(() => {
    configRef.current = config;
    runPhaseRef.current = runPhase;
    handleFinalRef.current = handleFinal;
  });

  /**
   * Collapses the signal list to one primitive so the effect below has a stable
   * dependency instead of a spread array.
   */
  const signalKey = useMemo(
    () => (signals ?? []).map((signal) => (signal.active ? "1" : "0")).join(""),
    [signals],
  );

  /** Flow-derived transitions: scan finished, ten digits typed, and so on. */
  useEffect(() => {
    if (!isActive) return;
    const pending = configRef.current.signals;
    if (!pending) return;

    const current = phaseRef.current;
    if (current === "idle" || current === "denied") return;

    for (const signal of pending) {
      if (signal.active && signal.from.includes(current)) {
        runPhaseRef.current(signal.to);
        return;
      }
    }
  }, [isActive, signalKey]);

  /**
   * Reconciles manual taps: if the wizard step no longer matches the phase the
   * agent thinks it is in, adopt the wizard's step and prompt for it.
   */
  useEffect(() => {
    if (!isActive || !hasStartedRef.current) return;

    const settings = configRef.current;
    const expected = settings.stepToPhase[step];
    const current = phaseRef.current;

    if (current === expected || current === "denied") return;
    // Sub-phases of the same wizard step are not a mismatch.
    if (settings.tolerated?.[expected]?.includes(current as TPhase)) return;

    runPhaseRef.current(expected);
  }, [isActive, step]);

  const start = useCallback(() => {
    if (!isRecognitionSupported && !isTtsSupported) return;

    setIsActive(true);
    setTranscript("");
    hasStartedRef.current = true;

    if (announceOnStart) {
      runPhaseRef.current(entryPhase);
      return;
    }

    // Straight into listening, with no spoken greeting: one tap unlocks the mic
    // and the user talks immediately.
    phaseRef.current = entryPhase;
    setPhase(entryPhase);
    armListening((turnRef.current += 1));
  }, [announceOnStart, armListening, entryPhase, isRecognitionSupported, isTtsSupported]);

  const stop = useCallback(() => finish(false), [finish]);

  /** Lets the preset chips drive the same conversation without a microphone. */
  const submitText = useCallback(
    (text: string) => {
      setIsActive(true);
      hasStartedRef.current = true;
      if (phaseRef.current === "idle" || phaseRef.current === "denied") {
        phaseRef.current = entryPhase;
        setPhase(entryPhase);
      }
      handleFinalRef.current(text);
    },
    [entryPhase],
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
