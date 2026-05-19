import { createRoot } from "react-dom/client";
import App from "./App";
import { scheduleDeferredThirdParty } from "./lib/deferredThirdParty";
import "./index.css";

function hideStaticLcpFallback() {
  const el = document.getElementById("static-hero-fallback");
  if (el) el.hidden = true;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
  hideStaticLcpFallback();
}

scheduleDeferredThirdParty();
