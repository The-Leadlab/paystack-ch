import { createRoot } from "react-dom/client";
import App from "./App";
import { scheduleDeferredThirdParty } from "./lib/deferredThirdParty";
import "./index.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
  const hero = document.getElementById("static-hero-fallback");
  if (hero) hero.hidden = true;
  const appShell = document.getElementById("static-app-lcp-fallback");
  if (appShell && !appShell.hidden) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        appShell.hidden = true;
      });
    });
  }
}

scheduleDeferredThirdParty();
