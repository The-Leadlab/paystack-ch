export type LabLang = "en" | "fr" | "de" | "it";

type Dict = Record<string, string>;

const en: Dict = {
  signInHint: "Sign in to sync lab data with Firestore (optional — local fallback works).",
  month: "Month",
  category: "Category",
  budget: "Budget CHF",
  spent: "Spent",
  variance: "Variance",
  zeroBased: "Zero-based",
  traditional: "Traditional",
  addBill: "Add bill",
  due: "Due",
  daysUntil: "days",
  overdue: "Overdue",
  goalName: "Goal name",
  target: "Target CHF",
  addGoal: "Add goal",
  csvUpload: "Upload bank CSV",
  importRows: "Import to ledger",
  preview: "Preview",
  forecast: "90-day projection",
  ruleMatch: "If text contains",
  addRule: "Add rule",
  testRule: "Test",
  holding: "Holding",
  offlineQueue: "Offline queue",
  inviteEmail: "Invite email",
  role: "Role",
  save: "Save",
  delete: "Delete",
  noData: "No data yet",
  firebaseOk: "Firestore sync active",
  localOnly: "Local storage only (sign in for cloud sync)",
};

const fr: Dict = {
  ...en,
  signInHint: "Connectez-vous pour synchroniser le labo avec Firestore.",
  month: "Mois",
  category: "Catégorie",
  budget: "Budget CHF",
  spent: "Dépensé",
  variance: "Écart",
  addBill: "Ajouter facture",
  due: "Échéance",
  goalName: "Nom de l'objectif",
  addGoal: "Ajouter objectif",
  csvUpload: "Importer CSV bancaire",
  forecast: "Projection 90 jours",
  save: "Enregistrer",
};

const de: Dict = {
  ...en,
  signInHint: "Anmelden, um Lab-Daten mit Firestore zu synchronisieren.",
  month: "Monat",
  category: "Kategorie",
  budget: "Budget CHF",
  spent: "Ausgegeben",
  variance: "Abweichung",
  addBill: "Rechnung hinzufügen",
  due: "Fällig",
  goalName: "Zielname",
  addGoal: "Ziel hinzufügen",
  csvUpload: "Bank-CSV hochladen",
  forecast: "90-Tage-Prognose",
  save: "Speichern",
};

const it: Dict = {
  ...en,
  signInHint: "Accedi per sincronizzare il lab con Firestore.",
  month: "Mese",
  category: "Categoria",
  budget: "Budget CHF",
  spent: "Speso",
  variance: "Scostamento",
  addBill: "Aggiungi bolletta",
  due: "Scadenza",
  goalName: "Nome obiettivo",
  addGoal: "Aggiungi obiettivo",
  csvUpload: "Carica CSV banca",
  forecast: "Proiezione 90 giorni",
  save: "Salva",
};

const MAP: Record<LabLang, Dict> = { en, fr, de, it };

export function labT(lang: LabLang, key: keyof typeof en): string {
  return MAP[lang][key] ?? en[key] ?? key;
}
