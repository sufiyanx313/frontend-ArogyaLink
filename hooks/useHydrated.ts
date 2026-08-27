"use client";

import { useSyncExternalStore } from "react";

/** A store that never emits — the two snapshots alone carry the information. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` while server-rendering and during the hydration pass, `true` after.
 *
 * Browser-only capability checks (`window.SpeechRecognition`, `document.body`)
 * must not change what the *first* client render produces, or React reports a
 * hydration mismatch. Reading them behind this hook defers them until after
 * hydration without an effect-plus-setState round trip, which the project's
 * React Compiler lint rules forbid.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
