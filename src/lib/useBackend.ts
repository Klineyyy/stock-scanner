import { useMemo } from "react";
import { createBackend } from "./backends";
import { useSettings } from "./settings";
import type { StockBackend } from "./types";

/** The backend chosen in Settings. Changes when the user switches or edits the ERPNext details. */
export function useBackend(): StockBackend {
  const { backend, erp } = useSettings();
  return useMemo(() => createBackend(backend, erp), [backend, erp]);
}
