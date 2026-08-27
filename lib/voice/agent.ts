/**
 * The contract every voice agent in the portal satisfies.
 *
 * Why this exists
 * ---------------
 * `AiChamberView` routes one microphone between four service agents by way of
 * an `activeService` switch. Without a shared shape, `activeService === "beds"
 * ? bedVoice : tokenVoice` produces a union of four different object types and
 * TypeScript refuses to let you call `.start()` or read `.caption` off it.
 *
 * `phase` is deliberately typed as `string` rather than a union: each agent has
 * its own phase vocabulary, and the chamber only ever compares it to
 * `"denied"`. Keeping it loose here means `useVoiceTokenBooking` — which was
 * written before this file existed and returns its own `VoicePhase` union —
 * satisfies `VoiceAgentHandle` structurally, with no edits to a hook that is
 * already shipped and tested.
 */

/** A prompt in both scripts. See `resolvePromptText` in the engine. */
export interface VoicePrompt {
  /** Devanagari, used when a Hindi TTS voice is installed. */
  hi: string;
  /** Romanised Hinglish — the en-IN fallback, and the roman caption. */
  en: string;
}

export interface VoiceAgentHandle {
  /** Agent-specific phase id. `"denied"` means the mic was blocked. */
  phase: string;
  isActive: boolean;
  isSupported: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  /** What the assistant is saying, in the script being spoken. */
  caption: string;
  /** The same line romanised. */
  captionRoman: string;
  /** Last finalised user utterance. */
  transcript: string;
  /** Live partial utterance while the user is still talking. */
  interimTranscript: string;
  micError: SpeechRecognitionErrorCode | null;
  /** Begins the conversation. Must originate from a user gesture. */
  start: () => void;
  /** Ends the conversation and releases the microphone. */
  stop: () => void;
  /** Feeds text through the same pipeline as speech (preset chips). */
  submitText: (text: string) => void;
}

/**
 * The read-only slice of an agent that modals render as a status strip.
 * Presentational only — supplying it never changes how a wizard behaves,
 * because every on-screen option must stay tappable while the agent talks.
 */
export interface VoiceServiceState {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  caption: string;
  transcript: string;
  interimTranscript: string;
}
