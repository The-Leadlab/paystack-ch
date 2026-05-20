import { createRoot } from "react-dom/client";
import App from "./App";
import { scheduleDeferredThirdParty } from "./lib/deferredThirdParty";
import "./index.css";

function hideStaticLcpFallbacks() {
  const hero = document.getElementById("static-hero-fallback");
  if (hero) hero.hidden = true;
  const appShell = document.getElementById("static-app-lcp-fallback");
  if (appShell) appShell.hidden = true;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
  hideStaticLcpFallbacks();
}

scheduleDeferredThirdParty();
