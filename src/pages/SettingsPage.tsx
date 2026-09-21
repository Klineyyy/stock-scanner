import { IonButton, IonInput, IonItem, IonList, IonRadio, IonRadioGroup, IonToggle } from "@ionic/react";
import { useState } from "react";
import Page from "../components/Page";
import { createBackend, supabaseAvailable } from "../lib/backends";
import { saveSettings, useSettings } from "../lib/settings";
import { showToast } from "../lib/toast";
import type { BackendId } from "../lib/types";
import { useBackend } from "../lib/useBackend";

export default function SettingsPage() {
  const settings = useSettings();
  const backend = useBackend();
  const [testing, setTesting] = useState(false);

  const setBackend = (id: BackendId) => saveSettings({ ...settings, backend: id });
  const setErp = (field: "url" | "key" | "secret", value: string) =>
    saveSettings({ ...settings, erp: { ...settings.erp, [field]: value } });

  async function testConnection() {
    setTesting(true);
    try {
      await createBackend(settings.backend, settings.erp).ping();
      showToast(`Connected to ${backend.label}.`, "success", 2500);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Connection failed.", "danger", 5000);
    } finally {
      setTesting(false);
    }
  }

  async function resetDemo() {
    try {
      await backend.reset?.();
      showToast("Demo data restored.", "success", 2000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't reset.", "danger", 4000);
    }
  }

  return (
    <Page title="Settings">
      <h3 className="section-title">Where is the stock?</h3>
      <IonList inset lines="full">
        <IonRadioGroup value={settings.backend} onIonChange={(e) => setBackend(e.detail.value as BackendId)}>
          <IonItem>
            <IonRadio value="mock" justify="space-between" labelPlacement="start" data-testid="backend-mock">
              <div className="radio-label">
                <strong>Demo</strong>
                <small>Sample items kept in this browser. No server needed.</small>
              </div>
            </IonRadio>
          </IonItem>
          <IonItem>
            <IonRadio value="supabase" disabled={!supabaseAvailable} justify="space-between" labelPlacement="start" data-testid="backend-supabase">
              <div className="radio-label">
                <strong>Supabase</strong>
                <small>{supabaseAvailable ? "Shared online demo database." : "Not configured in this build."}</small>
              </div>
            </IonRadio>
          </IonItem>
          <IonItem>
            <IonRadio value="erpnext" justify="space-between" labelPlacement="start" data-testid="backend-erpnext">
              <div className="radio-label">
                <strong>ERPNext</strong>
                <small>Your server with the Inventory Hub app installed.</small>
              </div>
            </IonRadio>
          </IonItem>
        </IonRadioGroup>
      </IonList>

      {settings.backend === "erpnext" && (
        <IonList inset lines="full" className="erp-form">
          <IonItem>
            <IonInput
              label="Server address"
              labelPlacement="stacked"
              type="url"
              placeholder="http://localhost:8080"
              value={settings.erp.url}
              data-testid="erp-url"
              onIonInput={(e) => setErp("url", String(e.detail.value ?? ""))}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label="API key"
              labelPlacement="stacked"
              autocapitalize="off"
              value={settings.erp.key}
              data-testid="erp-key"
              onIonInput={(e) => setErp("key", String(e.detail.value ?? ""))}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label="API secret"
              labelPlacement="stacked"
              type="password"
              autocapitalize="off"
              value={settings.erp.secret}
              data-testid="erp-secret"
              onIonInput={(e) => setErp("secret", String(e.detail.value ?? ""))}
            />
          </IonItem>
        </IonList>
      )}

      <h3 className="section-title">Scanning</h3>
      <IonList inset lines="full">
        <IonItem>
          <IonToggle
            checked={settings.qr}
            justify="space-between"
            data-testid="qr-toggle"
            onIonChange={(e) => saveSettings({ ...settings, qr: e.detail.checked })}
          >
            <div className="radio-label">
              <strong>Also read QR codes</strong>
              <small>Barcodes are always read. A QR code should hold a barcode number or an item code, like BOND-A4.</small>
            </div>
          </IonToggle>
        </IonItem>
      </IonList>

      <div className="settings-actions">
        <IonButton expand="block" onClick={testConnection} disabled={testing} data-testid="test-connection">
          Test connection
        </IonButton>
        {backend.reset && (
          <IonButton expand="block" fill="outline" color="medium" onClick={resetDemo} data-testid="reset-demo">
            Reset demo data
          </IonButton>
        )}
      </div>

      <p className="hint">
        Currently using <strong data-testid="current-backend">{backend.label}</strong>.
      </p>
    </Page>
  );
}
