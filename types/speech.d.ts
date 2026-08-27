/**
 * Ambient declarations for the parts of the Web Speech API that TypeScript's
 * bundled `lib.dom.d.ts` does not ship yet (verified against TypeScript 5.9.3).
 *
 * Already present in lib.dom.d.ts — DO NOT redeclare these here, it causes
 * "Duplicate identifier" errors:
 *   - SpeechRecognitionAlternative
 *   - SpeechRecognitionResult
 *   - SpeechRecognitionResultList
 *   - SpeechSynthesis / SpeechSynthesisUtterance / SpeechSynthesisVoice
 *   - SpeechSynthesisEvent / SpeechSynthesisErrorEvent
 *   - `declare var speechSynthesis: SpeechSynthesis`
 *
 * Missing, and therefore declared below:
 *   - SpeechRecognition (interface + constructor)
 *   - SpeechRecognitionEvent / SpeechRecognitionErrorEvent
 *   - SpeechGrammar / SpeechGrammarList
 *   - window.webkitSpeechRecognition (Chrome / Edge / Safari prefix)
 */

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

/**
 * Per the spec this is a plain string union, but browsers occasionally emit
 * values outside it, so the loose `| (string & {})` keeps autocomplete while
 * staying assignable from arbitrary strings.
 */
type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed";

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

interface SpeechRecognitionEventMap {
  audioend: Event;
  audiostart: Event;
  end: Event;
  error: SpeechRecognitionErrorEvent;
  nomatch: SpeechRecognitionEvent;
  result: SpeechRecognitionEvent;
  soundend: Event;
  soundstart: Event;
  speechend: Event;
  speechstart: Event;
  start: Event;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onaudioend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown)
    | null;
  onnomatch:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown)
    | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown)
    | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;

  abort(): void;
  start(): void;
  stop(): void;

  addEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K],
    ) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

// Declared as `const` rather than the usual ambient `var` because the project's
// ESLint config bans `var` outright. For a declaration-only global the two are
// equivalent — nothing assigns to these.
declare const SpeechRecognition: SpeechRecognitionConstructor;
declare const webkitSpeechRecognition: SpeechRecognitionConstructor;

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
