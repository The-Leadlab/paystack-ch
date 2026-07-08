import type { AliLabFeatureStatus } from "../featureRegistry";
import type { LabLang } from "./labStrings";

type FeatureCopy = {
  title: string;
  summary: string;
  promoteTo: string;
};

type RegistryEntry = Record<LabLang, FeatureCopy>;

const REGISTRY: Record<string, RegistryEntry> = {
  "session-tasks": {
    en: {
      title: "Session tasks",
      summary:
        "Pick a session, then manage your personal checklist — add, complete, and remove tasks with session progress.",
      promoteTo: "Tasks tab at /app/personal/session-tasks",
    },
    fr: {
      title: "Tâches de session",
      summary:
        "Choisissez une session, puis gérez votre liste — ajouter, cocher et supprimer des tâches avec progression par session.",
      promoteTo: "Onglet Tâches sur /app/personal/session-tasks",
    },
    de: {
      title: "Session-Aufgaben",
      summary:
        "Session wählen, dann persönliche Checkliste verwalten — Aufgaben hinzufügen, erledigen, entfernen; Fortschritt pro Session.",
      promoteTo: "Tab Aufgaben unter /app/personal/session-tasks",
    },
    it: {
      title: "Attività sessione",
      summary:
        "Scegli una sessione e gestisci la checklist — aggiungi, completa e rimuovi attività con progresso per sessione.",
      promoteTo: "Scheda Attività su /app/personal/session-tasks",
    },
  },
  overview: {
    en: {
      title: "Personal overview",
      summary: "Your month at a glance — income, expenses, savings, quick actions, and recent transactions linked to Business.",
      promoteTo: "Personal dashboard home at /app/personal",
    },
    fr: {
      title: "Vue d'ensemble",
      summary: "Votre mois en un coup d'œil — revenus, dépenses, épargne, actions rapides et transactions récentes liées au Business.",
      promoteTo: "Accueil du tableau de bord personnel (/app/personal)",
    },
    de: {
      title: "Persönliche Übersicht",
      summary: "Ihr Monat auf einen Blick — Einnahmen, Ausgaben, Ersparnisse, Schnellaktionen und letzte Transaktionen (mit Business verknüpft).",
      promoteTo: "Startseite persönliches Dashboard (/app/personal)",
    },
    it: {
      title: "Panoramica personale",
      summary: "Il mese a colpo d'occhio — entrate, spese, risparmi, azioni rapide e transazioni recenti collegate al Business.",
      promoteTo: "Home dashboard personale (/app/personal)",
    },
  },
  budgeting: {
    en: {
      title: "Budgeting (budget vs actual)",
      summary:
        "Household budgets vs live expenses — bills, rent, groceries, going out, shopping, savings/invest; income expected (salary, assets, contributions)",
      promoteTo: "New Budget tab in personal dashboard (/app)",
    },
    fr: {
      title: "Budgets (prévu vs réel)",
      summary:
        "Budgets ménage vs dépenses live — factures, loyer, courses, sorties, shopping, épargne/invest ; revenus attendus (salaire, actifs, apports)",
      promoteTo: "Nouvel onglet Budget dans le tableau de bord personnel (/app)",
    },
    de: {
      title: "Budgetierung (Soll vs. Ist)",
      summary:
        "Haushaltsbudgets vs. Live-Ausgaben — Rechnungen, Miete, Lebensmittel, Ausgang, Shopping, Sparen/Invest; erwartete Einnahmen (Gehalt, Vermögen, Beiträge)",
      promoteTo: "Neuer Budget-Tab im persönlichen Dashboard (/app)",
    },
    it: {
      title: "Budget (previsto vs effettivo)",
      summary:
        "Budget domestici vs spese live — bollette, affitto, spesa, uscite, shopping, risparmio/invest; entrate attese (stipendio, asset, contributi)",
      promoteTo: "Nuova scheda Budget nella dashboard personale (/app)",
    },
  },
  "bill-reminders": {
    en: {
      title: "Bill reminders",
      summary: "Serafe, insurance, rent — due dates, overdue highlight, Firestore/local sync",
      promoteTo: "Notifications + recurring bills collection",
    },
    fr: {
      title: "Rappels de factures",
      summary: "Serafe, assurance, loyer — échéances, retard, sync Firestore/local",
      promoteTo: "Notifications + collection factures récurrentes",
    },
    de: {
      title: "Rechnungserinnerungen",
      summary: "Serafe, Versicherung, Miete — Fälligkeit, Überfällig, Firestore/lokal",
      promoteTo: "Benachrichtigungen + wiederkehrende Rechnungen",
    },
    it: {
      title: "Promemoria bollette",
      summary: "Serafe, assicurazione, affitto — scadenze, ritardi, sync Firestore/locale",
      promoteTo: "Notifiche + raccolta bollette ricorrenti",
    },
  },
  goals: {
    en: {
      title: "Goal tracking",
      summary: "Savings & debt goals with progress bars",
      promoteTo: "Dashboard widget + Firestore goals collection",
    },
    fr: {
      title: "Suivi d'objectifs",
      summary: "Objectifs épargne et dette avec barres de progression",
      promoteTo: "Widget tableau de bord + collection objectifs Firestore",
    },
    de: {
      title: "Zielverfolgung",
      summary: "Spar- und Schuldenziele mit Fortschrittsbalken",
      promoteTo: "Dashboard-Widget + Firestore-Ziele",
    },
    it: {
      title: "Tracciamento obiettivi",
      summary: "Obiettivi risparmio e debito con barre di avanzamento",
      promoteTo: "Widget dashboard + raccolta obiettivi Firestore",
    },
  },
  "de-it-i18n": {
    en: {
      title: "German & Italian (DE / IT)",
      summary: "Lab i18n pack (en/fr/de/it) ready to merge into LanguageContext",
      promoteTo: "LanguageContext + full translation pass",
    },
    fr: {
      title: "Allemand & italien (DE / IT)",
      summary: "Pack i18n labo (en/fr/de/it) prêt à fusionner dans LanguageContext",
      promoteTo: "LanguageContext + passage traduction complet",
    },
    de: {
      title: "Deutsch & Italienisch (DE / IT)",
      summary: "Lab-i18n-Paket (en/fr/de/it) bereit für LanguageContext",
      promoteTo: "LanguageContext + vollständige Übersetzung",
    },
    it: {
      title: "Tedesco & italiano (DE / IT)",
      summary: "Pacchetto i18n lab (en/fr/de/it) pronto per LanguageContext",
      promoteTo: "LanguageContext + traduzione completa",
    },
  },
  forecasting: {
    en: {
      title: "Forecasting & cash flow",
      summary: "90-day balance projection from ledger history",
      promoteTo: "Reports tab extension",
    },
    fr: {
      title: "Prévisions & trésorerie",
      summary: "Projection du solde sur 90 jours à partir de l'historique",
      promoteTo: "Extension onglet Rapports",
    },
    de: {
      title: "Prognose & Cashflow",
      summary: "90-Tage-Saldoprognose aus Ledger-Historie",
      promoteTo: "Erweiterung Berichte-Tab",
    },
    it: {
      title: "Previsioni & cassa",
      summary: "Proiezione saldo 90 giorni dallo storico",
      promoteTo: "Estensione scheda Report",
    },
  },
  "automation-rules": {
    en: {
      title: "User automation rules",
      summary: "If description contains X → category Y + keyword fallback test",
      promoteTo: "Settings + rule engine on transaction import",
    },
    fr: {
      title: "Règles d'automatisation",
      summary: "Si description contient X → catégorie Y + test mots-clés",
      promoteTo: "Paramètres + moteur de règles à l'import",
    },
    de: {
      title: "Automatisierungsregeln",
      summary: "Wenn Beschreibung X enthält → Kategorie Y + Keyword-Test",
      promoteTo: "Einstellungen + Regelengine beim Import",
    },
    it: {
      title: "Regole di automazione",
      summary: "Se descrizione contiene X → categoria Y + test parole chiave",
      promoteTo: "Impostazioni + motore regole all'import",
    },
  },
  "shared-access": {
    en: {
      title: "Shared budgets / multi-user",
      summary: "Workspace members + FairSplit settlements synced to Firestore; uses live expense amounts",
      promoteTo: "Firestore rules + invites + roles",
    },
    fr: {
      title: "Budgets partagés / multi-utilisateur",
      summary: "Membres workspace + règlements FairSplit sync Firestore ; montants dépenses live",
      promoteTo: "Règles Firestore + invitations + rôles",
    },
    de: {
      title: "Gemeinsame Budgets / Multi-User",
      summary: "Workspace-Mitglieder + FairSplit-Abrechnungen in Firestore; live Ausgaben",
      promoteTo: "Firestore-Regeln + Einladungen + Rollen",
    },
    it: {
      title: "Budget condivisi / multi-utente",
      summary: "Membri workspace + regolamenti FairSplit su Firestore; spese live",
      promoteTo: "Regole Firestore + inviti + ruoli",
    },
  },
  offline: {
    en: {
      title: "Offline capture & sync",
      summary: "Offline queue in Firestore; flush marks synced; shows /app document library count",
      promoteTo: "Service worker + IndexedDB queue",
    },
    fr: {
      title: "Capture hors ligne & sync",
      summary: "File hors ligne Firestore ; flush marque synchronisé ; compte bibliothèque /app",
      promoteTo: "Service worker + file IndexedDB",
    },
    de: {
      title: "Offline-Erfassung & Sync",
      summary: "Offline-Warteschlange in Firestore; Flush markiert sync; zeigt /app-Dokumentanzahl",
      promoteTo: "Service Worker + IndexedDB-Warteschlange",
    },
    it: {
      title: "Acquisizione offline & sync",
      summary: "Coda offline in Firestore; flush segna sincronizzato; conteggio documenti /app",
      promoteTo: "Service worker + coda IndexedDB",
    },
  },
  investments: {
    en: {
      title: "Investment tracking",
      summary: "Holdings with cost basis, P/L, allocation %, and price updates",
      promoteTo: "Optional module under Reports",
    },
    fr: {
      title: "Suivi des investissements",
      summary: "Positions avec coût, P/L, allocation % et mises à jour de prix",
      promoteTo: "Module optionnel sous Rapports",
    },
    de: {
      title: "Anlageverfolgung",
      summary: "Positionen mit Kostenbasis, G/V, Gewicht % und Kursupdates",
      promoteTo: "Optionales Modul unter Berichte",
    },
    it: {
      title: "Tracciamento investimenti",
      summary: "Posizioni con costo, P/L, peso % e aggiornamenti prezzo",
      promoteTo: "Modulo opzionale sotto Report",
    },
  },
};

const STATUS_LABELS: Record<AliLabFeatureStatus, Record<LabLang, string>> = {
  scaffold: { en: "scaffold", fr: "ébauche", de: "gerüst", it: "bozza" },
  prototype: { en: "prototype", fr: "prototype", de: "prototyp", it: "prototipo" },
  ready: { en: "ready", fr: "prêt", de: "bereit", it: "pronto" },
  promoted: { en: "promoted", fr: "promu", de: "übernommen", it: "promosso" },
};

export function labFeatureCopy(
  featureId: string,
  lang: LabLang
): FeatureCopy | undefined {
  return REGISTRY[featureId]?.[lang] ?? REGISTRY[featureId]?.en;
}

export function labStatusLabel(status: AliLabFeatureStatus, lang: LabLang): string {
  return STATUS_LABELS[status][lang] ?? status;
}
