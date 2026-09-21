import { useSyncExternalStore } from "react";
import { defaultBackend, supabaseAvailable } from "./backends";
import type { BackendId } from "./types";

// Which backend the app talks to, plus the ERPNext address and API key. Kept in localStorage.

export interface Settings {
  backend: BackendId;
  /** Also read QR codes with the camera (product barcodes are always read). */
  qr: boolean;
  erp: { url: string; key: string; secret: string };
}

const KEY = "stockscan:settings";
const DEFAULTS: Settings = { backend: defaultBackend, qr: false, erp: { url: "", key: "", secret: "" } };

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Settings = DEFAULTS;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<Settings>;
    // A saved "supabase" choice is meaningless in a build that has no Supabase credentials.
    const backend = value.backend === "supabase" && !supabaseAvailable ? defaultBackend : value.backend;
    return { backend: backend ?? DEFAULTS.backend, qr: value.qr === true, erp: { ...DEFAULTS.erp, ...value.erp } };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): Settings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}

export function saveSettings(next: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the choice lasts until the page is closed
    cachedRaw = undefined;
    cached = next;
  }
  listeners.forEach((l) => l());
}
