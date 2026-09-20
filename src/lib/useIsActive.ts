import { useLocation } from "react-router-dom";

/**
 * True while the tab for `path` is the one on screen.
 *
 * Ionic keeps every tab mounted, so a page needs to know when it is the visible one (to run the
 * camera, or to refresh its data). Ionic's own view-lifecycle hooks (useIonViewWillEnter and
 * friends) don't fire on tab switches with React Router 6, so this reads the router location instead.
 */
export function useIsActive(path: string): boolean {
  const { pathname } = useLocation();
  return pathname === path || pathname.startsWith(`${path}/`);
}
