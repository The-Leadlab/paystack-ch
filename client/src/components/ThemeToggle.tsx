import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

/** Global light/dark toggle (landing + auth + café). Syncs with ThemeProvider on `document.documentElement`. */
export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm hover:border-brand-red/40"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? "Clair" : "Sombre"}
    </button>
  );
}
