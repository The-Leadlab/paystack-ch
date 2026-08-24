import { Languages, Moon, Sun } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/cafe/context/LanguageContext";

/**
 * Floating chrome control.
 * On /app and /personal → language (EN/FR). Elsewhere → theme (light/dark).
 * Product tour sits at z-120 so it stays above this FAB (z-100).
 */
export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [loc] = useLocation();
  const isAppShell =
    loc === "/app" ||
    loc.startsWith("/app/") ||
    loc === "/personal" ||
    loc.startsWith("/personal/");

  const bottomClass = isAppShell
    ? "bottom-[max(5.75rem,env(safe-area-inset-bottom)+4.75rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
    : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]";

  const fabClass = `fixed right-4 z-[100] flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm hover:border-brand-red/40 touch-manipulation ${bottomClass}`;

  if (isAppShell) {
    const next = language === "en" ? "fr" : "en";
    const short = language === "en" ? t("languageToggleShortEn") : t("languageToggleShortFr");
    return (
      <button
        type="button"
        onClick={() => setLanguage(next)}
        className={fabClass}
        aria-label={language === "en" ? t("navSwitchToFrench") : t("navSwitchToEnglish")}
        title={`${t("languageToggleLabel")}: ${short}`}
      >
        <Languages size={14} />
        <span>{short}</span>
      </button>
    );
  }

  if (!switchable || !toggleTheme) {
    return null;
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={fabClass}
      aria-label={dark ? t("themeAriaLight") : t("themeAriaDark")}
      title={dark ? t("themeTitleLight") : t("themeTitleDark")}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      <span className="hidden sm:inline">{dark ? t("themeLabelLight") : t("themeLabelDark")}</span>
    </button>
  );
}
