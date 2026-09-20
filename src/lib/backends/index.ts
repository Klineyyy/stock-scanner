import type { BackendId, StockBackend } from "../types";
import { createErpnextBackend, type ErpConfig } from "./erpnext";
import { createMockBackend } from "./mock";
import { createSupabaseBackend, createSupabaseClient } from "./supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Supabase now calls it the "publishable key"; the older name is "anon key". Either works.
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

/** True when the build was given Supabase credentials. */
export const supabaseAvailable = Boolean(supabaseUrl && supabaseKey);

/** The backend to use when the user hasn't picked one: Supabase if it's configured, else the demo. */
export const defaultBackend: BackendId = supabaseAvailable ? "supabase" : "mock";

let mock: StockBackend | null = null;
let supabase: StockBackend | null = null;

export function createBackend(id: BackendId, erp: ErpConfig): StockBackend {
  if (id === "erpnext") return createErpnextBackend(erp);
  if (id === "supabase" && supabaseAvailable) {
    supabase ??= createSupabaseBackend(createSupabaseClient(supabaseUrl!, supabaseKey!));
    return supabase;
  }
  mock ??= createMockBackend();
  return mock;
}
