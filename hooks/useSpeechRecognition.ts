"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Continuous `SpeechRecognition` wrapper built for a long-running voice wizard.
 *
 * Browser quirks handled here
 * ---------------------------
 * 1. The constructor is unprefixed only in newer Chrome; `webkitSpeechRecognition`
 *    is still required for Safari and older Chromium.
 * 2. Chrome fires `end` after a few seconds of silence even when
 *    `continuous = true`, so the session is transparently restarted while the
 *    caller still wants to listen. Restarts use a small backoff to avoid a hot
 *    loop if the engine refuses to come back.
 * 3. `start()` throws `InvalidStateError` if the engine is already running, so
 *    every call is guarded by a started flag and wrapped in try/catch.
 * 4. `no-speech` and `aborted` are normal operating noise, not failures — only
 *    permission and hardware errors are surfaced as terminal.
 *
 * The caller is expected to `stop()` before speaking through TTS and `start()`
 * afterwards, otherwise the microphone transcribes the assistant's own voice.
 */

const RESTART_DELAY_MS = 300;
const MAX_RESTART_ATTEMPTS = 8;

export interface UseSpeechRecognitionOptions {
  /** BCP-47 tag. `hi-IN` transcribes Hindi/Marathi speech in Devanagari. */
  lang?: string;
  /** Fired once per finalised utterance. */
  onFinalResult?: (transcript: string) => void;
  /** Fired continuously while the user is mid-sentence. */
  onInterimResult?: (transcript: string) => void;
  /** Fired when the user blocks the microphone or no device is available. */
  onTerminalError?: (error: SpeechRecognitionErrorCode) => void;
}

export interface UseSpeechRecognitionResult {
  /** `false` when the browser exposes no SpeechRecognition implementation. */
  isSupported: boolean;
  /** True between a successful `start()` and the matching `end` event. */
  isListening: boolean;
  /** True while `start()` has been requested, including across auto-restarts. */
  isMicRequested: boolean;
  interimTranscript: string;
  errorCode: SpeechRecognitionErrorCode | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
  clearError: () => void;
}

function resolveConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
  const { lang = "hi-IN" } = options;

  const [isListening, setIsListening] = useState(false);
  const [isMicRequested, setIsMicRequested] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorCode, setErrorCode] = useState<SpeechRecognitionErrorCode | null>(
    null,
  );

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** Whether the caller currently wants the mic open. */
  const shouldListenRef = useRef(false);
  /** Whether the engine reports itself as running. */
  const isStartedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartAttemptsRef = useRef(0);
  const langRef = useRef(lang);

  // Callbacks live in refs so the recognition instance is built once and never
  // rebound; otherwise every parent render would tear down the mic session.
  const onFinalResultRef = useRef(options.onFinalResult);
  const onInterimResultRef = useRef(options.onInterimResult);
  const onTerminalErrorRef = useRef(options.onTerminalError);

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
    onInterimResultRef.current = options.onInterimResult;
    onTerminalErrorRef.current = options.onTerminalError;
  });

  // Resolved after hydration: the server has no `window` to inspect.
  const isSupported = useHydrated() && resolveConstructor() !== null;

  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Attempts `recognition.start()`, tolerating an already-running engine. */
  const startEngine = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || isStartedRef.current) return;

    recognition.lang = langRef.current;
    try {
      recognition.start();
      isStartedRef.current = true;
    } catch {
      // InvalidStateError means it is already live — nothing to do. Anything
      // else is retried by the `end`/backoff path.
      isStartedRef.current = false;
    }
  }, []);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    if (!shouldListenRef.current) return;

    if (restartAttemptsRef.current >= MAX_RESTART_ATTEMPTS) {
      shouldListenRef.current = false;
      setIsMicRequested(false);
      return;
    }

    restartAttemptsRef.current += 1;
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (shouldListenRef.current) startEngine();
    }, RESTART_DELAY_MS);
  }, [clearRestartTimer, startEngine]);

  /** Builds the recognition instance on first use and wires its events. */
  const ensureRecognition = useCallback((): SpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const Constructor = resolveConstructor();
    if (!Constructor) return null;

    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langRef.current;

    recognition.onstart = () => {
      isStartedRef.current = true;
      setIsListening(true);
    };

    recognition.onspeechstart = () => {
      // Real audio came through, so the session is healthy again.
      restartAttemptsRef.current = 0;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      restartAttemptsRef.current = 0;

      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) final += transcript;
        else interim += transcript;
      }

      if (interim.trim().length > 0) {
        setInterimTranscript(interim);
        onInterimResultRef.current?.(interim);
      }

      if (final.trim().length > 0) {
        setInterimTranscript("");
        onFinalResultRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;

      // Expected during normal operation: silence, or our own stop()/abort().
      if (code === "no-speech" || code === "aborted") return;

      if (
        code === "not-allowed" ||
        code === "service-not-allowed" ||
        code === "audio-capture"
      ) {
        shouldListenRef.current = false;
        clearRestartTimer();
        setIsMicRequested(false);
        setErrorCode(code);
        onTerminalErrorRef.current?.(code);
        return;
      }

      // network, bad-grammar, language-not-supported: report and let the
      // `end` handler decide whether to retry.
      setErrorCode(code);
    };

    recognition.onend = () => {
      isStartedRef.current = false;
      setIsListening(false);
      setInterimTranscript("");
      // Chrome ends the session on silence; reopen it if the caller still
      // wants to be listening.
      scheduleRestart();
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [clearRestartTimer, scheduleRestart]);

  const start = useCallback(() => {
    const recognition = ensureRecognition();
    if (!recognition) return;

    setErrorCode(null);
    restartAttemptsRef.current = 0;
    shouldListenRef.current = true;
    setIsMicRequested(true);
    clearRestartTimer();
    startEngine();
  }, [clearRestartTimer, ensureRecognition, startEngine]);

  /** Ends the session gracefully, flushing any pending final result. */
  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    setIsMicRequested(false);
    setInterimTranscript("");

    const recognition = recognitionRef.current;
    if (recognition && isStartedRef.current) {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    }
  }, [clearRestartTimer]);

  /** Ends the session immediately, discarding pending audio. */
  const abort = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    setIsMicRequested(false);
    setInterimTranscript("");

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Already torn down.
      }
    }
    isStartedRef.current = false;
    setIsListening(false);
  }, [clearRestartTimer]);

  const clearError = useCallback(() => setErrorCode(null), []);

  // Tear everything down on unmount so a stale session cannot hold the mic.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.onstart = null;
        recognition.onspeechstart = null;
        try {
          recognition.abort();
        } catch {
          // Nothing to abort.
        }
      }
      recognitionRef.current = null;
      isStartedRef.current = false;
    };
  }, []);

  return {
    isSupported,
    isListening,
    isMicRequested,
    interimTranscript,
    errorCode,
    start,
    stop,
    abort,
    clearError,
  };
}
