import { useCallback, useEffect, useState } from "react";

/** Persist Apollo-style sidebar collapse across reloads. */
export function usePersistedSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
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
