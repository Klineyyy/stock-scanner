import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import type { ReactNode } from "react";

/** The frame every tab shares: a title bar and a centred, phone-width column. */
export default function Page({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          {actions}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="page">{children}</div>
      </IonContent>
    </IonPage>
  );
}
