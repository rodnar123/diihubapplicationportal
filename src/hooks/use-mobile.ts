import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Tracks the mobile breakpoint.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the viewport is
 * an external store, and reading it this way avoids the extra render (and the
 * momentary wrong value) that a syncing effect produces. The server snapshot
 * is `false`, so the desktop layout is what gets rendered on the server.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
