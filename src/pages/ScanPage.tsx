import { IonButton, IonIcon, IonInput, IonSpinner } from "@ionic/react";
import { searchOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import ItemCard from "../components/ItemCard";
import Page from "../components/Page";
import Scanner from "../components/Scanner";
import { addHistory } from "../lib/history";
import { beep } from "../lib/sound";
import { NotFoundError, type ItemInfo } from "../lib/types";
import { useSettings } from "../lib/settings";
import { useBackend } from "../lib/useBackend";
import { useIsActive } from "../lib/useIsActive";

export default function ScanPage() {
  const backend = useBackend();
  const { qr } = useSettings();
  const [item, setItem] = useState<ItemInfo | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  // On a phone the result lands below the camera, so bring it into view.
  const scannedCode = item?.item_code;
  useEffect(() => {
    if (scannedCode) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [scannedCode]);

  // The camera runs only while this tab is on screen.
  const cameraOn = useIsActive("/scan");

  const lookup = useCallback(
    async (code: string) => {
      const wanted = code.trim();
      if (!wanted) return;
      setBusy(true);
      setError(null);
      setMissing(null);
      try {
        const found = await backend.lookupItem(wanted);
        setItem(found);
        beep("ok");
        addHistory({ kind: "scan", code: found.item_code, name: found.item_name, detail: `Scanned ${wanted}` });
      } catch (e) {
        setItem(null);
        beep("miss");
        if (e instanceof NotFoundError) {
          setMissing(wanted);
          addHistory({ kind: "miss", code: wanted, detail: "No item with this barcode" });
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  function submitManual() {
    void lookup(manual);
    setManual("");
  }

  return (
    <Page title="Scan">
      <Scanner active={cameraOn} readQr={qr} onDetected={lookup} />

      <div className="manual">
        <IonInput
          label="Or type / scan with a hardware scanner"
          labelPlacement="stacked"
          fill="outline"
          value={manual}
          inputmode="numeric"
          enterkeyhint="search"
          placeholder="4800010000016"
          data-testid="manual"
          onIonInput={(e) => setManual(String(e.detail.value ?? ""))}
          onKeyUp={(e) => e.key === "Enter" && submitManual()}
        />
        <IonButton onClick={submitManual} disabled={!manual.trim() || busy} aria-label="Look up" data-testid="manual-go">
          <IonIcon slot="icon-only" icon={searchOutline} />
        </IonButton>
      </div>

      {busy && (
        <div className="centered">
          <IonSpinner name="dots" />
        </div>
      )}

      {missing && (
        <div className="notice" role="status" data-testid="not-found">
          <strong>No match for {missing}</strong>
          <p>That barcode isn't in the catalogue. Try again, or type the item code.</p>
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert" data-testid="lookup-error">
          <strong>Lookup failed</strong>
          <p>{error}</p>
        </div>
      )}

      <div ref={resultRef}>{item && <ItemCard item={item} backend={backend} onChanged={setItem} />}</div>

      {!item && !missing && !error && !busy && (
        <p className="hint">Scan a barcode to see its stock. Try the demo barcode 4800010000016.</p>
      )}
    </Page>
  );
}
