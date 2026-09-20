import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { alertCircleOutline, scanOutline, settingsOutline, timeOutline } from "ionicons/icons";
import { Navigate, Route } from "react-router-dom";
import ToastHost from "./components/ToastHost";
import AlertsPage from "./pages/AlertsPage";
import HistoryPage from "./pages/HistoryPage";
import ScanPage from "./pages/ScanPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<Navigate to="/scan" replace />} />
          </IonRouterOutlet>

          <IonTabBar slot="bottom">
            <IonTabButton tab="scan" href="/scan" data-testid="tab-scan">
              <IonIcon icon={scanOutline} />
              <IonLabel>Scan</IonLabel>
            </IonTabButton>
            <IonTabButton tab="alerts" href="/alerts" data-testid="tab-alerts">
              <IonIcon icon={alertCircleOutline} />
              <IonLabel>Low stock</IonLabel>
            </IonTabButton>
            <IonTabButton tab="history" href="/history" data-testid="tab-history">
              <IonIcon icon={timeOutline} />
              <IonLabel>History</IonLabel>
            </IonTabButton>
            <IonTabButton tab="settings" href="/settings" data-testid="tab-settings">
              <IonIcon icon={settingsOutline} />
              <IonLabel>Settings</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
      <ToastHost />
    </IonApp>
  );
}
