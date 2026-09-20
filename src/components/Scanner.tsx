import { IonButton, IonIcon } from "@ionic/react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { cameraOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";

// A live camera preview that reads barcodes with ZXing (pure JavaScript, so it works in any
// browser, including iPhone Safari, where the native BarcodeDetector API doesn't exist).

type Status = "starting" | "scanning" | "denied" | "no-camera" | "insecure" | "error";

const MESSAGES: Record<Exclude<Status, "scanning">, string> = {
  starting: "Starting the camera…",
  denied: "Camera access is blocked. Allow it in your browser's site settings, then try again.",
  "no-camera": "No camera was found on this device.",
  insecure: "The camera only works on a secure (https) page.",
  error: "The camera couldn't be started.",
};

// The formats products carry. Restricting them makes decoding faster and avoids false reads
// (QR codes are left out on purpose: this app reads product barcodes).
const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

const SAME_CODE_COOLDOWN_MS = 2500;

interface Props {
  /** Only runs the camera while true, so it is off when the tab isn't on screen. */
  active: boolean;
  onDetected: (code: string) => void;
}

function classify(error: unknown): Status {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-camera";
  return "error";
}

export default function Scanner({ active, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [attempt, setAttempt] = useState(0);

  // Keep the newest callback without restarting the camera every time the parent re-renders.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    if (!active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("insecure");
      return;
    }

    let cancelled = false;
    let controls: IScannerControls | undefined;
    let last = { code: "", at: 0 };
    setStatus("starting");

    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 120 });
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current!, (result) => {
        if (!result) return; // called on every frame that has no barcode in it
        const code = result.getText();
        const now = Date.now();
        if (code === last.code && now - last.at < SAME_CODE_COOLDOWN_MS) return;
        last = { code, at: now };
        onDetectedRef.current(code);
      })
      .then((c) => {
        if (cancelled) c.stop();
        else {
          controls = c;
          setStatus("scanning");
        }
      })
      .catch((error) => {
        if (!cancelled) setStatus(classify(error));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [active, attempt]);

  return (
    <div className="scanner">
      <div className="viewfinder">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        <div className="reticle" aria-hidden="true">
          <span />
        </div>
        {status !== "scanning" && (
          <div className="viewfinder-message">
            <IonIcon icon={cameraOutline} />
            <p>{MESSAGES[status]}</p>
            {status !== "starting" && (
              <IonButton size="small" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </IonButton>
            )}
          </div>
        )}
      </div>
      <p className="scanner-status" data-testid="scanner-status" data-status={status} aria-live="polite">
        {status === "scanning" ? "Point the camera at a barcode" : MESSAGES[status]}
      </p>
    </div>
  );
}
