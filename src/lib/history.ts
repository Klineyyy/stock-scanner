import { useSyncExternalStore } from "react";

// A short log of what this device scanned and changed, kept in localStorage.

export interface HistoryEntry {
  id: string;
  at: string;
  kind: "scan" | "add" | "remove" | "miss";
  code: string;
  name?: string;
  detail: string;
}

const KEY = "stockscan:history";
const MAX = 100;
const EMPTY: HistoryEntry[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: HistoryEntry[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): HistoryEntry[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as HistoryEntry[]) : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function addHistory(entry: Omit<HistoryEntry, "id" | "at">) {
  const next = [{ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() }, ...getSnapshot()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cachedRaw = undefined;
    cached = next;
  }
  listeners.forEach((l) => l());
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    cachedRaw = undefined;
    cached = EMPTY;
  }
  listeners.forEach((l) => l());
}
