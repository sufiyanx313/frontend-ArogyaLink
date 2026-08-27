/**
 * Transcript matching helpers for the voice-guided Token Booking agent.
 *
 * Design notes
 * ------------
 * `SpeechRecognition.lang` is set to `hi-IN`, so a single utterance can contain
 * Devanagari ("मुझे पुणे में टोकन चाहिए") or romanised Hinglish ("mujhe Pune mein
 * token chahiye") depending on how the engine decodes it. Every helper here is
 * therefore script-agnostic and works off the alias lists in
 * `data/tokenBookingOptions.ts`.
 *
 * Regex note: character classes are written out explicitly
 * (`a-z0-9ऀ-ॿ`) instead of using Unicode property escapes such as
 * `\p{L}`, because the project targets ES2017 and TypeScript rejects `\p{...}`
 * below an ES2018 target.
 */

/** Latin letters, digits, and the full Devanagari block. */
const WORD_CHARS = "a-z0-9\\u0900-\\u097F";
const NON_WORD_RE = new RegExp(`[^${WORD_CHARS}]+`, "gi");

/** Devanagari digits ०–९ (U+0966–U+096F) mapped to ASCII. */
const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * Lowercases, replaces Devanagari numerals with ASCII, and collapses every
 * run of punctuation/whitespace down to a single space.
 */
export function normalizeTranscript(raw: string): string {
  if (!raw) return "";

  let text = raw.toLowerCase();

  // ०१२३ -> 0123 so digit parsing only has to handle ASCII.
  text = text.replace(/[०-९]/g, (char) =>
    String(DEVANAGARI_DIGITS.indexOf(char)),
  );

  return text.replace(NON_WORD_RE, " ").trim();
}

/** Splits a normalized transcript into word tokens. */
export function tokenize(raw: string): string[] {
  const normalized = normalizeTranscript(raw);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

/** Levenshtein distance with a two-row rolling buffer. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1, // insertion
        previous[j] + 1, // deletion
        previous[j - 1] + substitutionCost, // substitution
      );
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/** Edit-distance tolerance that scales with word length. */
function fuzzyTolerance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 6) return 1;
  return 2;
}

/**
 * Scores one alias against a transcript. Higher is better, 0 means no match.
 *
 * Longer aliases score higher so that "general medicine" beats a bare
 * "general", and multi-word phrases get an extra bonus because an exact phrase
 * hit is much stronger evidence than a single shared word.
 */
function scoreAlias(
  alias: string,
  normalizedTranscript: string,
  transcriptTokens: string[],
): number {
  const target = normalizeTranscript(alias);
  if (target.length === 0) return 0;

  // Multi-word alias: require the phrase to appear intact.
  if (target.includes(" ")) {
    return normalizedTranscript.includes(target) ? target.length * 3 : 0;
  }

  let best = 0;

  for (const token of transcriptTokens) {
    if (token === target) {
      best = Math.max(best, target.length * 3);
      continue;
    }

    // Guard short aliases ("ent", "ear", "gas") against loose substring hits.
    if (target.length >= 4) {
      if (token.startsWith(target) || target.startsWith(token)) {
        best = Math.max(best, target.length * 2);
        continue;
      }
      if (token.includes(target)) {
        best = Math.max(best, target.length);
        continue;
      }

      const tolerance = fuzzyTolerance(target.length);
      if (tolerance > 0 && Math.abs(token.length - target.length) <= tolerance) {
        const distance = levenshtein(token, target);
        if (distance <= tolerance) {
          best = Math.max(best, target.length - distance);
        }
      }
    }
  }

  return best;
}

export interface MatchResult<T> {
  option: T;
  score: number;
}

/**
 * Picks the best-scoring option for a transcript, or `null` when nothing
 * clears the confidence floor.
 */
export function matchOption<T>(
  transcript: string,
  options: readonly T[],
  getAliases: (option: T) => readonly string[],
  minScore = 6,
): MatchResult<T> | null {
  const normalized = normalizeTranscript(transcript);
  if (normalized.length === 0 || options.length === 0) return null;

  const tokens = normalized.split(" ");
  let best: MatchResult<T> | null = null;

  for (const option of options) {
    let optionScore = 0;
    for (const alias of getAliases(option)) {
      optionScore = Math.max(optionScore, scoreAlias(alias, normalized, tokens));
    }
    if (optionScore > 0 && (best === null || optionScore > best.score)) {
      best = { option, score: optionScore };
    }
  }

  return best !== null && best.score >= minScore ? best : null;
}

/* ------------------------------------------------------------------ */
/* Ordinal selection: "pehla wala", "second one", "teesra"            */
/* ------------------------------------------------------------------ */

/**
 * Unambiguous ordinal words, checked first.
 *
 * Bare cardinals ("one", "do") are kept in a separate lower-priority table
 * because they double as fillers — "second one" must resolve to index 1, not to
 * index 0 via the trailing "one".
 */
const ORDINAL_STRICT: string[][] = [
  ["first", "1st", "pehla", "pehli", "phela", "पहला", "पहिला", "पहली"],
  ["second", "2nd", "dusra", "dusri", "doosra", "दूसरा", "दुसरा", "दूसरी"],
  ["third", "3rd", "teesra", "tisra", "तीसरा", "तिसरा"],
  ["fourth", "4th", "chautha", "chotha", "चौथा"],
  ["fifth", "5th", "panchva", "पांचवा", "पाचवा"],
  ["sixth", "6th", "chhatha", "छठा", "सहावा"],
];

/** Ambiguous cardinals — only consulted when no strict ordinal matched. */
const ORDINAL_CARDINAL: string[][] = [
  ["one", "ek", "एक"],
  ["two", "do", "don", "दो", "दोन"],
  ["three", "teen", "तीन"],
  ["four", "char", "चार"],
  ["five", "panch", "पांच", "पाच"],
  ["six", "chhe", "छह", "सहा"],
];

const LAST_ALIASES = ["last", "aakhri", "akhri", "final", "आखरी", "आखिरी", "शेवटचा", "अंतिम"];

/**
 * Resolves positional phrases to a zero-based index, so a user can say
 * "pehla wala" instead of a hospital name. Returns `null` if nothing matches
 * or the index falls outside the list.
 */
export function matchOrdinal(transcript: string, listLength: number): number | null {
  if (listLength === 0) return null;

  const normalized = normalizeTranscript(transcript);
  if (normalized.length === 0) return null;
  const tokens = normalized.split(" ");

  for (const alias of LAST_ALIASES) {
    if (tokens.includes(normalizeTranscript(alias))) return listLength - 1;
  }

  for (const table of [ORDINAL_STRICT, ORDINAL_CARDINAL]) {
    for (let index = 0; index < table.length; index += 1) {
      for (const alias of table[index]) {
        if (tokens.includes(normalizeTranscript(alias))) {
          return index < listLength ? index : null;
        }
      }
    }
  }

  // Bare numeral, e.g. "number 3" or just "3".
  const numeralMatch = normalized.match(/\b([1-9])\b/);
  if (numeralMatch) {
    const index = Number(numeralMatch[1]) - 1;
    if (index < listLength) return index;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Yes / no confirmation                                              */
/* ------------------------------------------------------------------ */

const AFFIRMATIVE = [
  "yes", "yeah", "yep", "yup", "haan", "han", "ha", "haa", "sahi", "theek",
  "thik", "correct", "right", "ok", "okay", "okey", "barobar", "bilkul",
  "हाँ", "हां", "हा", "जी", "सही", "ठीक", "बरोबर", "बिलकुल", "हो", "होय",
];

const NEGATIVE = [
  "no", "nope", "nah", "nahi", "nahin", "galat", "wrong", "incorrect",
  "नहीं", "नही", "नाही", "गलत", "चुकीचे", "चूक",
];

/** `true` for yes, `false` for no, `null` when the answer is unclear. */
export function matchYesNo(transcript: string): boolean | null {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return null;

  // Check negatives first: "nahi nahi theek hai" should read as a correction.
  for (const token of tokens) {
    if (NEGATIVE.includes(token)) return false;
  }
  for (const token of tokens) {
    if (AFFIRMATIVE.includes(token)) return true;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Spoken digits -> mobile number                                     */
/* ------------------------------------------------------------------ */

const DIGIT_WORDS: Record<string, string> = {
  // English
  zero: "0", oh: "0", o: "0", nought: "0",
  one: "1", two: "2", three: "3", four: "4", for: "4",
  five: "5", six: "6", seven: "7", eight: "8", ate: "8", nine: "9",
  // Romanised Hindi / Marathi
  shunya: "0", sunya: "0", zeero: "0",
  ek: "1", ik: "1",
  do: "2", don: "2", doe: "2",
  teen: "3", tin: "3",
  char: "4", chaar: "4",
  panch: "5", paanch: "5", pach: "5", paach: "5",
  chhe: "6", che: "6", chah: "6", chhah: "6", saha: "6",
  saat: "7", sat: "7",
  aath: "8", ath: "8",
  // Deliberately no `no: "9"` — it would collide with the negation word.
  nau: "9", nao: "9", nav: "9",
  // Devanagari
  "शून्य": "0", // शून्य
  "एक": "1", // एक
  "दो": "2", // दो
  "दोन": "2", // दोन
  "तीन": "3", // तीन
  "चार": "4", // चार
  "पांच": "5", // पांच
  "पाँच": "5", // पाँच
  "पाच": "5", // पाच
  "नौ": "9", // नौ
  "नऊ": "9", // नऊ
  "सात": "7", // सात
  "आठ": "8", // आठ
  "छह": "6", // छह
  "छे": "6", // छे
  "सहा": "6", // सहा
};

const MULTIPLIER_WORDS: Record<string, number> = {
  double: 2, dubble: 2, "डबल": 2, // डबल
  triple: 3, tripple: 3, "ट्रिपल": 3, // ट्रिपल
};

/**
 * Extracts digits from a spoken phrase.
 *
 * Handles bare numerals ("9876543210"), digit words in English, romanised
 * Hindi/Marathi and Devanagari ("nau aath saat", "नौ आठ सात"), and repeat
 * modifiers ("double five" -> "55"). Devanagari numerals are folded to ASCII
 * by `normalizeTranscript` before this runs.
 */
export function parseSpokenDigits(transcript: string): string {
  const tokens = tokenize(transcript);
  let digits = "";
  let pendingMultiplier = 1;

  for (const token of tokens) {
    const multiplier = MULTIPLIER_WORDS[token];
    if (multiplier !== undefined) {
      pendingMultiplier = multiplier;
      continue;
    }

    // A run of numerals, e.g. "98765" or "43210".
    if (/^\d+$/.test(token)) {
      digits += pendingMultiplier > 1 ? token.repeat(pendingMultiplier) : token;
      pendingMultiplier = 1;
      continue;
    }

    const word = DIGIT_WORDS[token];
    if (word !== undefined) {
      digits += word.repeat(pendingMultiplier);
      pendingMultiplier = 1;
      continue;
    }

    // Unknown word (e.g. "mera number hai") — ignore, keep any multiplier.
  }

  return digits;
}

/**
 * Extracts a valid 10-digit Indian mobile number, or `null`.
 *
 * Tolerates a leading country code / trunk prefix (+91, 0) and requires the
 * number to start with 6–9 as Indian mobile numbers do.
 */
export function parseMobileNumber(transcript: string): string | null {
  let digits = parseSpokenDigits(transcript);

  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);

  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/* ------------------------------------------------------------------ */
/* Spoken person name                                                 */
/* ------------------------------------------------------------------ */

/**
 * Carrier words stripped out of a spoken name.
 *
 * People almost never answer "what is the patient's name?" with a bare name —
 * they say "mera naam Sufiyan Shaikh hai" or "रुग्णाचे नाव अनिता आहे". Everything
 * in this set is a lead-in, a postposition or a trailing copula, so removing it
 * leaves the name itself. The list is kept deliberately conservative: a word
 * that could plausibly be somebody's name does not belong here.
 */
const NAME_FILLERS = new Set([
  // English
  "my", "mine", "name", "names", "is", "am", "the", "this", "it", "of", "for",
  "please", "sir", "madam", "patient", "patients", "called", "call", "his",
  "her", "their", "kindly", "actually",
  // Romanised Hindi / Marathi
  "mera", "meri", "mere", "naam", "nam", "naav", "nav", "naanv", "hai", "hain",
  "he", "ahe", "aahe", "majhe", "maze", "mazha", "majha", "mazi", "rugna",
  "rugnache", "marij", "mariz", "ka", "ki", "ke", "cha", "che", "chi", "ji",
  // Devanagari
  "मेरा", "मेरी", "मेरे", "नाम", "नाव", "नांव", "माझे", "माझं", "माझा", "माझी",
  "है", "हैं", "आहे", "रुग्ण", "रुग्णाचे", "मरीज", "का", "की", "के", "चा", "चे",
  "ची", "जी", "कृपया",
]);

/** Honorifics that precede a name and are not part of it. */
const NAME_HONORIFICS = new Set([
  "mr", "mrs", "ms", "miss", "master", "shri", "shree", "smt", "sau", "dr",
  "doctor", "श्री", "श्रीमती", "सौ", "कु", "डॉ", "डॉक्टर",
]);

/**
 * Pulls a person's name out of a spoken phrase, or returns `null`.
 *
 * The result is title-cased for Latin script and passed through unchanged for
 * Devanagari, where case does not apply. Digits disqualify a token, so a mobile
 * number read out at the name prompt is rejected rather than stored as a name.
 */
export function extractPersonName(transcript: string, maxWords = 4): string | null {
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return null;

  const kept: string[] = [];

  for (const token of tokens) {
    if (NAME_FILLERS.has(token) || NAME_HONORIFICS.has(token)) continue;
    // Anything containing a digit is not a name.
    if (/\d/.test(token)) continue;
    kept.push(token);
    if (kept.length === maxWords) break;
  }

  if (kept.length === 0) return null;
  // A lone two-letter leftover is almost always a stray particle, not a name.
  if (kept.length === 1 && kept[0].length < 3) return null;

  return kept
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Intent detection                                                   */
/* ------------------------------------------------------------------ */

export type VoiceIntent =
  | "token_booking"
  | "bed_availability"
  | "doctor_availability"
  | "appointment"
  | "cancel"
  | "repeat"
  | "unknown";

interface IntentDefinition {
  intent: VoiceIntent;
  phrases: string[];
}

/**
 * Ordered by priority — `cancel` and `repeat` are checked before the service
 * intents so "no, repeat that" never books anything.
 */
const INTENTS: IntentDefinition[] = [
  {
    intent: "cancel",
    phrases: [
      "cancel", "stop", "band karo", "band kar", "rehne do", "chhodo", "exit",
      "quit", "बंद", "रहने दो", "रद्द", "थांब", // बंद, रहने दो, रद्द, थांब
    ],
  },
  {
    intent: "repeat",
    phrases: [
      "repeat", "dobara", "dubara", "phir se", "again", "samajh nahi",
      "दोबारा", "पुनहा", "फिर से", "पर्त", // दोबारा, पुनहा, फिर से, पर्त
    ],
  },
  {
    intent: "token_booking",
    phrases: [
      "token", "tokan", "opd", "o p d", "opd pass", "opd token", "queue",
      "number lagana", "parchi", "slip", "token book", "book token",
      "टोकन", "ओपीडी", "पर्ची", "रांग", // टोकन, ओपीडी, पर्ची, रांग
    ],
  },
  {
    intent: "bed_availability",
    phrases: [
      "bed", "beds", "icu", "i c u", "bistar", "ventilator", "oxygen",
      "बेड", "बिस्तर", "खाट", "ऑक्सिजन", // बेड, बिस्तर, खाट, ऑक्सिजन
    ],
  },
  {
    intent: "doctor_availability",
    phrases: [
      "doctor available", "doctor availability", "doctor slot", "doctor timing",
      "doctor kab", "specialist", "डॉक्टर कब", "डॉक्टर केव्हा", // डॉक्टर कब, डॉक्टर केव्हा
    ],
  },
  {
    intent: "appointment",
    phrases: [
      "appointment", "apointment", "appoinment", "milna hai", "consultation",
      "अपॉइंटमेंट", "मुलाकात", // अपॉइंटमेंट, मुलाकात
    ],
  },
];

/** Classifies a free-form utterance into a portal intent. */
export function detectIntent(transcript: string): VoiceIntent {
  const normalized = normalizeTranscript(transcript);
  if (normalized.length === 0) return "unknown";

  const match = matchOption(
    normalized,
    INTENTS,
    (definition) => definition.phrases,
    // Lower floor than option matching: intent keywords are short ("opd", "bed").
    3,
  );

  return match?.option.intent ?? "unknown";
}
