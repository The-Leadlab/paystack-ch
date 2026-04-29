import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

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
      className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm hover:border-brand-red/40"
      aria-label="Toggle theme"
      title={dark ? "Switch to white/red theme" : "Switch to red/black theme"}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? "White / Red" : "Red / Black"}
    </button>
  );
}
