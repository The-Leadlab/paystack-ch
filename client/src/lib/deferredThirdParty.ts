/**
 * Load analytics tags after the critical path (post-LCP) to reduce main-thread contention.
 */

/** Run after window `load` so gtag/GTM does not compete with LCP (especially on /app). */
function afterLoadThenIdle(fn: () => void, idleTimeoutMs = 10_000): void {
  if (typeof window === "undefined") return;
  const run = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(fn, { timeout: idleTimeoutMs });
    } else {
      window.setTimeout(fn, 5000);
    }
  };
  if (document.readyState === "complete") {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}

function injectGoogleTagManager(containerId: string): void {
  if (document.querySelector(`script[data-gtm-id="${containerId}"]`)) return;

  const w = window as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  script.dataset.gtmId = containerId;
  document.head.appendChild(script);
}

/** Schedule GTM (and similar) after idle — set VITE_GTM_ID in env. */
export function scheduleDeferredThirdParty(): void {
  const gtmId = import.meta.env.VITE_GTM_ID?.trim();
  if (!gtmId) return;

  afterLoadThenIdle(() => {
    try {
      injectGoogleTagManager(gtmId);
    } catch (error) {
      console.warn("[analytics] deferred GTM load failed:", error);
    }
  });
}
