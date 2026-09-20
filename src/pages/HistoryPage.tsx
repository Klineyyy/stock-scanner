import { IonButton, IonIcon } from "@ionic/react";
import { addCircleOutline, helpCircleOutline, removeCircleOutline, scanOutline, trashOutline } from "ionicons/icons";
import Page from "../components/Page";
import { clearHistory, useHistory, type HistoryEntry } from "../lib/history";

const ICONS: Record<HistoryEntry["kind"], string> = {
  scan: scanOutline,
  add: addCircleOutline,
  remove: removeCircleOutline,
  miss: helpCircleOutline,
};

export default function HistoryPage() {
  const entries = useHistory();

  return (
    <Page title="History">
      {entries.length === 0 ? (
        <p className="hint">Nothing yet. Your scans and stock changes on this device show up here.</p>
      ) : (
        <>
          <ul className="cards" data-testid="history">
            {entries.map((e) => (
              <li className={`history-row history-${e.kind}`} key={e.id} data-testid="history-row">
                <IonIcon icon={ICONS[e.kind]} />
                <div>
                  <strong>{e.name ?? e.code}</strong>
                  <p className="item-codes">{e.detail}</p>
                </div>
                <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            ))}
          </ul>
          <IonButton fill="clear" color="medium" onClick={clearHistory}>
            <IonIcon slot="start" icon={trashOutline} />
            Clear history
          </IonButton>
        </>
      )}
    </Page>
  );
}
