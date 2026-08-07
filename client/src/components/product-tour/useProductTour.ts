import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { TourStep } from "./tourSteps";
import { readTourDone, writeTourDone } from "./tourSteps";

export type TourRect = { top: number; left: number; width: number; height: number };

function findTarget(selector: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-tour="${selector}"]`);
  } catch {
    return null;
  }
}

function measure(el: HTMLElement): TourRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Skip steps whose targets are missing in the current DOM. */
export function resolveVisibleSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((s) => findTarget(s.target) != null);
}

export function useProductTour(opts: {
  storageKey: string;
  steps: TourStep[];
  /** When false, tour never auto-starts (e.g. lab surface). */
  enabled?: boolean;
  /** Delay auto-start so layout / onboarding can settle. */
  autoStartDelayMs?: number;
}) {
  const { storageKey, steps, enabled = true, autoStartDelayMs = 600 } = opts;
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState<TourStep[]>([]);
  const [rect, setRect] = useState<TourRect | null>(null);

  const refreshVisible = useCallback(() => {
    const next = resolveVisibleSteps(steps);
    setVisibleSteps(next);
    return next;
  }, [steps]);

  const start = useCallback(() => {
    const next = refreshVisible();
    if (next.length === 0) return;
    setIndex(0);
    setActive(true);
  }, [refreshVisible]);

  const finish = useCallback(() => {
    writeTourDone(storageKey);
    setActive(false);
    setRect(null);
  }, [storageKey]);

  const skip = finish;

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= visibleSteps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [visibleSteps.length, finish]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (readTourDone(storageKey)) return;
    const t = window.setTimeout(() => start(), autoStartDelayMs);
    return () => window.clearTimeout(t);
  }, [enabled, storageKey, autoStartDelayMs, start]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onRestart = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail && detail !== storageKey) return;
      start();
    };
    window.addEventListener("paystack-product-tour-start", onRestart);
    return () => window.removeEventListener("paystack-product-tour-start", onRestart);
  }, [enabled, storageKey, start]);

  const current = active ? visibleSteps[index] ?? null : null;

  useLayoutEffect(() => {
    if (!current) {
      setRect(null);
      return;
    }
    const el = findTarget(current.target);
    if (!el) {
      setIndex((i) => {
        if (i >= visibleSteps.length - 1) {
          finish();
          return i;
        }
        return i + 1;
      });
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const update = () => setRect(measure(el));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current, visibleSteps.length, finish]);

  return {
    active,
    current,
    index,
    total: visibleSteps.length,
    rect,
    start,
    skip,
    goNext,
    goBack,
    finish,
  };
}
