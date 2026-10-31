import { useCallback, useEffect, useState } from "react";

/** Persist Apollo-style sidebar collapse across reloads. */
export function usePersistedSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1") return true;
      if (stored === "0") return false;
      // No preference yet: default rail on tablet (768–1023) so content isn't squeezed.
      return window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, storageKey]);

  const setCollapsed = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState(next);
  }, []);

  const toggle = useCallback(() => setCollapsedState((v) => !v), []);

  return { collapsed, setCollapsed, toggle };
}

export const PERSONAL_SIDEBAR_COLLAPSED_KEY = "paystack-personal-sidebar-collapsed";
export const BUSINESS_SIDEBAR_COLLAPSED_KEY = "paystack-business-sidebar-collapsed";
