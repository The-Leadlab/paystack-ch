import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { labT, type LabLang } from "../i18n/labStrings";

type Ctx = {
  lang: LabLang;
  setLang: (l: LabLang) => void;
  t: (key: Parameters<typeof labT>[1]) => string;
};

const LabLanguageContext = createContext<Ctx | null>(null);

function globalToLab(global: "en" | "fr"): LabLang {
  return global;
}

export function LabLanguageProvider({ children }: { children: ReactNode }) {
  const { language: globalLang, setLanguage: setGlobalLang } = useLanguage();
  const [lang, setLangState] = useState<LabLang>(() => globalToLab(globalLang));

  useEffect(() => {
    if (globalLang === "en" || globalLang === "fr") {
      setLangState((prev) => (prev === "de" || prev === "it" ? prev : globalLang));
    }
  }, [globalLang]);

  const setLang = (l: LabLang) => {
    setLangState(l);
    if (l === "en" || l === "fr") setGlobalLang(l);
  };

  const t = (key: Parameters<typeof labT>[1]) => labT(lang, key);

  return (
    <LabLanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LabLanguageContext.Provider>
  );
}

export function useLabLanguage() {
  const ctx = useContext(LabLanguageContext);
  if (!ctx) throw new Error("useLabLanguage requires LabLanguageProvider");
  return ctx;
}
