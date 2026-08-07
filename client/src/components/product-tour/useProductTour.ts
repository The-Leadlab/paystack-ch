import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { TourLength, TourNavigate, TourStep } from "./tourSteps";
import {
  readTourDone,
  readTourLength,
  writeTourDone,
  stepsForLength,
} from "./tourSteps";

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

export function useProductTour(opts: {
  storageKey: string;
  lengthKey: string;
  surface: "personal" | "business";
  /** When false, tour never auto-starts (e.g. lab surface / onboarding open). */
  enabled?: boolean;
  /** Ignore done flag (tester email). */
  force?: boolean;
  /** Delay auto-start so layout / onboarding can settle. */
  autoStartDelayMs?: number;
  onNavigate?: (nav: TourNavigate) => void;
}) {
  const {
    storageKey,
    lengthKey,
    surface,
    enabled = true,
    force = false,
    autoStartDelayMs = 600,
    onNavigate,
  } = opts;

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [rect, setRect] = useState<TourRect | null>(null);

  const buildSteps = useCallback(
    (override?: TourLength | null) => {
      const length = override ?? readTourLength(lengthKey) ?? "short";
      if (length === "skip") return [] as TourStep[];
      return stepsForLength(surface, length);
    },
    [lengthKey, surface]
  );

  const start = useCallback(
    (overrideLength?: TourLength) => {
      const next = buildSteps(overrideLength ?? null);
      if (next.length === 0) {
        writeTourDone(storageKey);
        return;
      }
      setSteps(next);
      setIndex(0);
      setActive(true);
    },
    [buildSteps, storageKey]
  );

  const finish = useCallback(() => {
    writeTourDone(storageKey);
    setActive(false);
    setRect(null);
  }, [storageKey]);

  const skip = finish;

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (!force && readTourDone(storageKey)) return;
    const length = readTourLength(lengthKey);
    if (!force && length === "skip") {
      writeTourDone(storageKey);
      return;
    }
    // Wait for onboarding to choose length unless force-replay
    if (!force && length == null && !readTourDone(storageKey)) {
      // Prefer starting only when length was chosen in onboarding.
      // If length missing but tour not done (legacy), default short once.
    }
    const t = window.setTimeout(() => {
      if (!force && readTourDone(storageKey)) return;
      const len = readTourLength(lengthKey);
      if (len === "skip") {
        writeTourDone(storageKey);
        return;
      }
      // Only auto-start when length is set, or force tester
      if (force || len === "short" || len === "long") {
        start(len ?? "short");
      }
    }, autoStartDelayMs);
    return () => window.clearTimeout(t);
  }, [enabled, storageKey, lengthKey, autoStartDelayMs, start, force]);

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

  const current = active ? steps[index] ?? null : null;

  useLayoutEffect(() => {
    if (!current) {
      setRect(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (current.navigate && onNavigate) {
        onNavigate(current.navigate);
        await new Promise((r) => setTimeout(r, 280));
      }
      if (cancelled) return;
      const el = findTarget(current.target);
      if (!el) {
        setIndex((i) => {
          if (i >= steps.length - 1) {
            finish();
            return i;
          }
          return i + 1;
        });
        return;
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      setRect(measure(el));
    };
    void run();

    const update = () => {
      const el = findTarget(current.target);
      if (el) setRect(measure(el));
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current, steps.length, finish, onNavigate]);

  return {
    active,
    current,
    index,
    total: steps.length,
    rect,
    start,
    skip,
    goNext,
    goBack,
    finish,
  };
}
