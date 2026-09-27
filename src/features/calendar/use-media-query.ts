"use client";

import * as React from "react";

/** Reageert op een CSS media query (op de server altijd `false`). */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tablet en groter (Tailwind `md`) */
export function useIsWide(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
