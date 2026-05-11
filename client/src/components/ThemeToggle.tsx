import { Moon, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";

/** Global light/dark toggle (landing + auth + café). Syncs with ThemeProvider on `document.documentElement`. */
export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  const [loc] = useLocation();
  const isAppShell = loc === "/app" || loc.startsWith("/app/");

  if (!switchable || !toggleTheme) {
    return null;
  }

  const dark = theme === "dark";

  const bottomClass = isAppShell
    ? "bottom-[max(5.75rem,env(safe-area-inset-bottom)+4.75rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
    : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`fixed right-4 z-[100] flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm hover:border-brand-red/40 ${bottomClass}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      <span className="hidden sm:inline">{dark ? "Clair" : "Sombre"}</span>
    </button>
  );
}
