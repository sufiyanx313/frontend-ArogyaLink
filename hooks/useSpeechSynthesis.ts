"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";

const VOICE_PREFERENCE: Array<(voice: SpeechSynthesisVoice) => boolean> = [
  (v) => v.lang === "hi-IN" && /google/i.test(v.name), // First priority: Google Hindi
  (v) => v.lang === "hi-IN" && /female/i.test(v.name), 
  (v) => v.lang === "hi-IN",
  (v) => v.lang.toLowerCase().startsWith("hi"),
  (v) => v.lang === "en-IN" && /google/i.test(v.name), // Fallback: Google Indian English
  (v) => v.lang === "en-IN" && /female/i.test(v.name),
  (v) => v.lang === "en-IN",
  (v) => /india|hindi|हिन/i.test(v.name),
];

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  activeVoice: SpeechSynthesisVoice | null;
  speak: (text: string, options?: SpeakOptions) => Promise<boolean>;
  cancel: () => void;
}

export function useSpeechSynthesis(lang = "hi-IN"): UseSpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);

  const isSupported =
    useHydrated() &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window;

  const generationRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;

    const loadAndLockVoice = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length === 0) return;

      // Agar pehle se Google Hindi voice locked hai, toh change mat karo
      if (
        activeVoice &&
        activeVoice.lang === "hi-IN" &&
        /google/i.test(activeVoice.name)
      ) {
        return; 
      }

      let bestVoice: SpeechSynthesisVoice | null = null;

      // Find the best voice based on our strict preferences
      for (const preference of VOICE_PREFERENCE) {
        const found = availableVoices.find(preference);
        if (found) {
          bestVoice = found;
          break;
        }
      }

      // Lock the voice
      if (bestVoice) {
        setActiveVoice(bestVoice);
      } else {
        setActiveVoice(availableVoices[0]);
      }
    };

    loadAndLockVoice();
    
    // Listen for voice updates, but our lock logic prevents mid-sentence weirdness
    synth.addEventListener("voiceschanged", loadAndLockVoice);

    return () => {
      synth.removeEventListener("voiceschanged", loadAndLockVoice);
      synth.cancel();
    };
  }, [activeVoice]); // Dependency on activeVoice ensures we check before overriding

  const cancel = useCallback(() => {
    generationRef.current += 1;
    utteranceRef.current = null;
    setIsSpeaking(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}): Promise<boolean> => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        text.trim().length === 0
      ) {
        return Promise.resolve(false);
      }

      const synth = window.speechSynthesis;
      generationRef.current += 1;
      const generation = generationRef.current;
      synth.cancel();

      return new Promise<boolean>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang ?? activeVoice?.lang ?? lang;
        
        // Ensure strictly locked voice is applied
        if (activeVoice) {
          utterance.voice = activeVoice;
        }

        utterance.rate = options.rate ?? 0.95;
        utterance.pitch = options.pitch ?? 1.05;
        utterance.volume = options.volume ?? 1;

        let settled = false;

        const settle = (completed: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          if (generationRef.current === generation) {
            utteranceRef.current = null;
            setIsSpeaking(false);
          }
          resolve(completed && generationRef.current === generation);
        };

        utterance.onstart = () => {
          if (generationRef.current === generation) setIsSpeaking(true);
        };
        utterance.onend = () => settle(true);
        utterance.onerror = () => settle(false);

        utteranceRef.current = utterance;

        const watchdog = setTimeout(
          () => settle(true),
          Math.min(30_000, 2_500 + text.length * 95)
        );

        synth.speak(utterance);
      });
    },
    [activeVoice, lang]
  );

  useEffect(() => cancel, [cancel]);

  return { isSupported, isSpeaking, activeVoice, speak, cancel };
}