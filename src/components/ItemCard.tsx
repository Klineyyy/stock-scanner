import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";
import { addOutline, removeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { addHistory } from "../lib/history";
import { showToast } from "../lib/toast";
import type { ItemInfo, StockBackend, StockRow } from "../lib/types";

interface Props {
  item: ItemInfo;
  backend: StockBackend;
  /** Called with the refreshed item after stock was added or removed. */
  onChanged: (item: ItemInfo) => void;
}

const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

function StockLine({ row }: { row: StockRow }) {
  // The bar is full at twice the reorder level, so "at the level" reads as half full.
  const progress = row.reorder_level ? Math.min(row.qty / (row.reorder_level * 2), 1) : null;
  return (
    <li className="stock-line" data-testid="stock-line">
      <div className="stock-line-top">
        <span className="warehouse">{row.warehouse}</span>
        <span className="qty">
          <strong>{fmt(row.qty)}</strong>
          {row.low && <IonBadge color="danger">LOW</IonBadge>}
        </span>
      </div>
      {progress !== null && (
        <>
          <IonProgressBar value={progress} color={row.low ? "danger" : "success"} />
          <span className="reorder-note">Reorder at {fmt(row.reorder_level!)}</span>
        </>
      )}
    </li>
  );
}

export default function ItemCard({ item, backend, onChanged }: Props) {
  const [mode, setMode] = useState<"remove" | "add">("remove");
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState(item.stock[0]?.warehouse ?? "");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  // A newly scanned item starts from a clean form.
  useEffect(() => {
    setMode("remove");
    setQty("1");
    setWarehouse(item.stock.reduce<StockRow | undefined>((best, r) => (!best || r.qty > best.qty ? r : best), undefined)?.warehouse ?? "");
  }, [item.item_code]);

  useEffect(() => {
    let cancelled = false;
    backend
      .warehouses()
      .then((list) => {
        if (cancelled) return;
        setWarehouses(list);
        setWarehouse((current) => current || list[0] || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const amount = Number(qty);
  const valid = Number.isFinite(amount) && amount > 0 && warehouse !== "";
  const options = warehouses.length ? warehouses : item.stock.map((s) => s.warehouse);

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    try {
      const change = mode === "add" ? amount : -amount;
      const before = item.stock.find((s) => s.warehouse === warehouse)?.qty ?? 0;
      const result = await backend.adjustStock(item.item_code, warehouse, change);
      const detail = `${warehouse}: ${fmt(before)} → ${fmt(result.qty)} (${change > 0 ? "+" : "−"}${fmt(amount)})`;
      addHistory({ kind: mode, code: item.item_code, name: item.item_name, detail });
      showToast(`${item.item_name}. ${detail}`, "success");
      onChanged(await backend.lookupItem(item.item_code));
      setQty("1");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong.", "danger", 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonCard className="item-card" data-testid="item-card">
      <IonCardContent>
        <div className="item-head">
          <div>
            <h2 data-testid="item-name">{item.item_name}</h2>
            <p className="item-codes">
              {item.item_code} · {item.scanned}
            </p>
          </div>
          {item.low_stock && (
            <IonBadge color="danger" data-testid="low-badge">
              LOW STOCK
            </IonBadge>
          )}
        </div>

        <p className="total">
          <span data-testid="total-qty">{fmt(item.total_qty)}</span> {item.stock_uom} on hand
        </p>

        <ul className="stock-lines">
          {item.stock.map((row) => (
            <StockLine key={row.warehouse} row={row} />
          ))}
        </ul>

        <div className="adjust">
          <IonSegment value={mode} onIonChange={(e) => setMode((e.detail.value as "remove" | "add") ?? "remove")}>
            <IonSegmentButton value="remove" data-testid="mode-remove">
              <IonLabel>Remove</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="add" data-testid="mode-add">
              <IonLabel>Add</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <div className="adjust-row">
            <IonSelect
              label="Warehouse"
              labelPlacement="stacked"
              interface="popover"
              value={warehouse}
              onIonChange={(e) => setWarehouse(e.detail.value)}
              data-testid="warehouse"
            >
              {options.map((w) => (
                <IonSelectOption key={w} value={w}>
                  {w}
                </IonSelectOption>
              ))}
            </IonSelect>

            <div className="stepper">
              <IonButton fill="outline" size="small" aria-label="Fewer" onClick={() => setQty(String(Math.max(1, amount - 1 || 1)))}>
                <IonIcon slot="icon-only" icon={removeOutline} />
              </IonButton>
              <IonInput
                type="number"
                inputmode="numeric"
                min={1}
                value={qty}
                aria-label="Quantity"
                data-testid="qty"
                onIonInput={(e) => setQty(String(e.detail.value ?? ""))}
              />
              <IonButton fill="outline" size="small" aria-label="More" onClick={() => setQty(String((amount || 0) + 1))}>
                <IonIcon slot="icon-only" icon={addOutline} />
              </IonButton>
            </div>
          </div>

          <IonButton
            expand="block"
            color={mode === "add" ? "success" : "primary"}
            disabled={!valid || busy}
            onClick={confirm}
            data-testid="confirm"
          >
            {mode === "add" ? `Add ${valid ? fmt(amount) : ""} to stock` : `Remove ${valid ? fmt(amount) : ""} from stock`}
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
}
