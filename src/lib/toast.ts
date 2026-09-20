import { useSyncExternalStore } from "react";

// One message at the top of the screen; a new one replaces whatever is still showing.
// (Ionic's useIonToast hook ignores a new toast while another is open, which would hide an error
// that arrives right after a success.) <ToastHost /> in App.tsx draws it.

export interface ToastState {
  id: number;
  message: string;
  color: "success" | "danger";
  duration: number;
}

let current: ToastState | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit(next: ToastState | null) {
  current = next;
  listeners.forEach((l) => l());
}

export function showToast(message: string, color: ToastState["color"], duration = 3000) {
  emit({ id: ++counter, message, color, duration });
}

/** Clears the toast, but only if it is still the one that just finished (not a newer one). */
export function dismissToast(id: number) {
  if (current?.id === id) emit(null);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useToast(): ToastState | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
