import { createContext, useContext, useState, type ReactNode } from "react";
import { labT, type LabLang } from "../i18n/labStrings";

type Ctx = {
  lang: LabLang;
  setLang: (l: LabLang) => void;
  t: (key: Parameters<typeof labT>[1]) => string;
};

const LabLanguageContext = createContext<Ctx | null>(null);

export function LabLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<LabLang>("en");
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
