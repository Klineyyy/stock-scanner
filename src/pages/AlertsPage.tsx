import { IonBadge, IonRefresher, IonRefresherContent, IonSpinner } from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import Page from "../components/Page";
import type { LowStockRow } from "../lib/types";
import { useBackend } from "../lib/useBackend";
import { useIsActive } from "../lib/useIsActive";

const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

export default function AlertsPage() {
  const backend = useBackend();
  const [rows, setRows] = useState<LowStockRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await backend.lowStock());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the alerts.");
    }
  }, [backend]);

  // Reload every time this tab is opened, so it never shows stale numbers.
  const active = useIsActive("/alerts");
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  // A different backend means different data: don't show the old list while the new one loads.
  useEffect(() => {
    setRows(null);
  }, [backend]);

  return (
    <Page title="Running low">
      <IonRefresher
        slot="fixed"
        onIonRefresh={async (e) => {
          await load();
          e.detail.complete();
        }}
      >
        <IonRefresherContent />
      </IonRefresher>

      {error && (
        <div className="notice notice-error" role="alert">
          <strong>Couldn't load</strong>
          <p>{error}</p>
        </div>
      )}

      {!rows && !error && (
        <div className="centered">
          <IonSpinner name="dots" />
        </div>
      )}

      {rows && rows.length === 0 && <p className="hint">Nothing is running low. Everything is above its reorder level.</p>}

      {rows && rows.length > 0 && (
        <ul className="cards" data-testid="alerts">
          {rows.map((r) => (
            <li className="alert-card" key={`${r.item_code}|${r.warehouse}`} data-testid="alert-row">
              <div>
                <strong>{r.item_name}</strong>
                <p className="item-codes">
                  {r.item_code} · {r.warehouse}
                </p>
              </div>
              <div className="alert-qty">
                <IonBadge color="danger">{fmt(r.qty)} left</IonBadge>
                <span className="reorder-note">
                  reorder at {fmt(r.reorder_level)}
                  {r.reorder_qty ? `, order ${fmt(r.reorder_qty)}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
