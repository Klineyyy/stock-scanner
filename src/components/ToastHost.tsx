import { useEffect } from "react";
import { dismissToast, useToast } from "../lib/toast";

// A plain element on purpose. Ionic's own IonToast moves itself to another part of the page when
// it opens, and React then crashed the whole app trying to remove it when a second toast arrived.
export default function ToastHost() {
  const toast = useToast();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    // key={id}: a new message is a new element, so it replays the slide-in.
    <div key={toast.id} className={`toast toast-${toast.color}`} role={toast.color === "danger" ? "alert" : "status"}>
      {toast.message}
    </div>
  );
}
