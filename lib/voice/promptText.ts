/**
 * Small text helpers shared by the service voice agents.
 *
 * Lives apart from `matching.ts` on purpose: that module turns speech into
 * values, this one turns values back into speech. Keeping the two directions
 * separate stops the matcher from acquiring presentation concerns.
 */

/**
 * Joins options into a naturally spoken list: "A, B, or C".
 *
 * A raw `join(", ")` makes text-to-speech run the last two items together, and
 * the listener loses track of where the choices end.
 */
export function spokenList(items: readonly string[], conjunction = "or"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;

  const head = items.slice(0, -1).join(", ");
  return `${head}, ${conjunction} ${items[items.length - 1]}`;
}

/**
 * Spaces out a digit string so it is read out one digit at a time.
 *
 * Without this, "9876543210" is spoken as a single astronomical number, which is
 * useless for confirming a mobile number back to the caller.
 */
export function spellDigits(value: string): string {
  return value.split("").join(" ");
}

/**
 * Devanagari-friendly ordinal words, for referring to a position in a list
 * that has just been read out.
 */
export function ordinalWord(index: number): { hi: string; en: string } {
  const hi = ["पहला", "दूसरा", "तीसरा", "चौथा", "पाँचवा", "छठा", "सातवाँ"];
  const en = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
  const position = Math.max(0, Math.min(index, en.length - 1));
  return { hi: hi[position], en: en[position] };
}
