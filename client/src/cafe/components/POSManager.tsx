import { DEFAULT_SWISS_VAT_RATE } from '@shared/swissVatRates';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Edit2,
  Trash2,
  Upload,
  Save,
  X,
  Camera,
  Zap,
  Wallet,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Plug,
  SlidersHorizontal,
  List,
  RefreshCw,
  History,
  CreditCard,
  ExternalLink,
  FileText,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePOS } from '../context/POSContext';
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useChfLocale, useLanguage } from '../context/LanguageContext';
import {
  addCashDeposit,
  loadCashDeposits,
  suggestTillFloat,
  sumDepositsInRange,
  type CashDeposit,
} from '../lib/cashDeposits';
import { filterBusinessExpenses } from '../lib/personalBleedFilter';
import {
  addDaysIso,
  buildCashPosition,
  buildInsights,
  buildPaymentMix,
  buildProfitability,
  buildReconciliation,
  findIncomeForZReading,
  monthlyBudgetTarget,
  monthBounds,
  priorPeriodBounds,
  REVENUE_INTERVALS,
  resolveRevenueInterval,
  sumInRange,
  toIsoDate,
  trendAxisTickDates,
  trendForRange,
  zReadingIncomeDescription,
  type RevenueIntervalId,
} from '../lib/revenueAnalytics';
import {
  autoMapColumns,
  csvPreviewToZReadingDraft,
  downloadTextFile,
  missingRequiredColumns,
  parseCsvText,
  previewCsvImport,
  STRIPE_COLUMNS,
  stripeTemplateCsv,
  type CsvPreview,
  type ImportDocType,
  Z_READING_COLUMNS,
  zReadingTemplateCsv,
} from '../lib/revenueImport';
import { BusinessKpiCard } from './BusinessKpiCard';
import { RevenueLedgerTable } from './RevenueLedgerTable';
import { RevenueIndustryModule } from './RevenueIndustryModule';
import type { BusinessTab } from './BusinessSidebarNav';
import {
  addCustomSector,
  ALL_SECTORS,
  assignSectorTag,
  filterExpensesForSectors,
  getSectorMeta,
  loadCustomSectors,
  loadStoredSectors,
  resolveRowSector,
  rowMatchesAnySector,
  saveStoredSectors,
  SECTOR_CATALOG,
  sectorDisplayDesc,
  sectorDisplayTitle,
  type CustomSectorDef,
} from '../lib/revenueSectors';
import { buildDemoSeeds, DEMO_TAG, isDemoDescription } from '../lib/revenueDemoData';
import {
  loadRevenueActivity,
  pushRevenueActivity,
  type RevenueActivity,
} from '../lib/revenueActivityHistory';
import { useDocuments } from '../context/DocumentContext';
import type { POSReading, ProcessedDocument } from '../types';
import { analyzeFinancialDocument } from '../services/geminiService';
import { Z_READING_AI_HINT, parseZReadingFromFinancialData } from '../lib/posZReading';
import '../businessApp.css';

type DatePeriod = 'day' | '7d' | '14d' | 'month' | 'custom';

function resolveIncomeDateRange(
  period: DatePeriod,
  anchorDate: string,
  customStart: string,
  customEnd: string
): { start: string; end: string } {
  switch (period) {
    case 'day':
      return { start: anchorDate, end: anchorDate };
    case '7d':
      return { start: addDaysIso(anchorDate, -6), end: anchorDate };
    case '14d':
      return { start: addDaysIso(anchorDate, -13), end: anchorDate };
    case 'month':
      return monthBounds(anchorDate);
    case 'custom': {
      const a = customStart || anchorDate;
      const b = customEnd || anchorDate;
      return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
    default:
      return { start: anchorDate, end: anchorDate };
  }
}

const CHART_GREEN = '#34d399';
const CHART_BLUE = '#60a5fa';
const CHART_GOLD = '#fbbf24';

export function POSManager({
  onNavigateTab,
  onNavigateToDocument,
}: {
  onNavigateTab?: (tab: BusinessTab) => void;
  onNavigateToDocument?: (doc: ProcessedDocument) => void;
}) {
  const { posReadings, addPOSReading, updatePOSReading, deletePOSReading } = usePOS();
  const { income, expenses, addIncome, addExpense, deleteIncome, deleteExpense, updateIncome } = useFinance();
  const { documents } = useDocuments();
  const { currentSession, isAllSessionsView, sessions } = useSession();
  const { t } = useLanguage();
  const chfLocale = useChfLocale();
  const [editingReading, setEditingReading] = useState<POSReading | null>(null);
  const [activeSectors, setActiveSectors] = useState<string[]>(() => loadStoredSectors());
  const [showSectorPicker, setShowSectorPicker] = useState(false);
  const [sectorLog, setSectorLog] = useState<string[]>([]);
  const [customSectors, setCustomSectors] = useState<CustomSectorDef[]>(() => loadCustomSectors());
  const [customName, setCustomName] = useState('');
  const [customKeywords, setCustomKeywords] = useState('');
  const [customIcon, setCustomIcon] = useState('📌');
  const [demoLoading, setDemoLoading] = useState(false);
  const [intervalId, setIntervalId] = useState<RevenueIntervalId>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hubTab, setHubTab] = useState<'trend' | 'documents' | 'reconciliation'>('trend');
  const [docVisible, setDocVisible] = useState(10);
  const [demoHold, setDemoHold] = useState<{
    income: { date: string; amount: number; type: string; description?: string }[];
    expenses: { date: string; amount: number; category: string; description?: string }[];
    pos: typeof posReadings;
  } | null>(null);
  const [zVisible, setZVisible] = useState(10);
  const [moduleVisible, setModuleVisible] = useState(2);
  const [recipeTick, setRecipeTick] = useState(0);
  const [activity, setActivity] = useState<RevenueActivity[]>(() => loadRevenueActivity());
  const [activityVisible, setActivityVisible] = useState(10);
  const [cashDeposits, setCashDeposits] = useState<CashDeposit[]>(() => loadCashDeposits());
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCashDeposit, setShowCashDeposit] = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  const existingSessionIds = sessions.map((s) => s.id);
  const filteredIncome = isAllSessionsView
    ? income.filter((i) => existingSessionIds.includes(i.session_id))
    : income.filter((i) => i.session_id === currentSession?.id);

  useEffect(() => {
    setZVisible(10);
  }, [posReadings.length]);

  useEffect(() => {
    setModuleVisible(2);
  }, [activeSectors.join('|')]);

  const visibleZReadings = posReadings.slice(0, zVisible);
  const zRemaining = Math.max(0, posReadings.length - zVisible);

  const filteredExpenses = filterBusinessExpenses(
    isAllSessionsView
      ? expenses.filter((e) => existingSessionIds.includes(e.session_id))
      : expenses.filter((e) => e.session_id === currentSession?.id)
  );

  const incomeRows = useMemo(
    () =>
      filteredIncome.map((i) => ({
        date: i.date,
        amount: i.amount,
        type: i.type,
        description: i.description,
      })),
    [filteredIncome]
  );

  const expenseRows = useMemo(
    () =>
      filteredExpenses.map((e) => ({
        date: e.date,
        amount: e.amount,
        category: e.category,
        description: e.description,
      })),
    [filteredExpenses]
  );

  const baseIncomeRows = demoHold?.income ?? incomeRows;
  const baseExpenseRows = demoHold?.expenses ?? expenseRows;
  const basePosReadings = demoHold?.pos ?? posReadings;

  const sectorIncomeRows = useMemo(() => {
    void recipeTick;
    if (!activeSectors.length) return [];
    return baseIncomeRows.filter((r) => rowMatchesAnySector(r.description || '', activeSectors));
  }, [baseIncomeRows, activeSectors, recipeTick]);

  const allIncomeTotal = useMemo(
    () => baseIncomeRows.reduce((s, r) => s + r.amount, 0),
    [baseIncomeRows]
  );
  const sectorIncomeTotal = useMemo(
    () => sectorIncomeRows.reduce((s, r) => s + r.amount, 0),
    [sectorIncomeRows]
  );

  const sectorExpenseRows = useMemo(() => {
    void recipeTick;
    return filterExpensesForSectors(
      baseExpenseRows,
      allIncomeTotal,
      sectorIncomeTotal,
      activeSectors
    );
  }, [baseExpenseRows, allIncomeTotal, sectorIncomeTotal, activeSectors, recipeTick]);

  /** Scale POS totals by sector share so payment mix tracks sector selection. */
  const sectorPosReadings = useMemo(() => {
    const share = allIncomeTotal > 0 ? sectorIncomeTotal / allIncomeTotal : 0;
    if (share <= 0) return [];
    if (share >= 0.999) return basePosReadings;
    return basePosReadings.map((r) => ({
      ...r,
      gross_sales: Math.round(r.gross_sales * share * 100) / 100,
      net_sales: Math.round(r.net_sales * share * 100) / 100,
      vat_amount: Math.round(r.vat_amount * share * 100) / 100,
      cash: Math.round(r.cash * share * 100) / 100,
      card: Math.round(r.card * share * 100) / 100,
      other_payment: Math.round(r.other_payment * share * 100) / 100,
      tips: Math.round(r.tips * share * 100) / 100,
      discounts: Math.round(r.discounts * share * 100) / 100,
      refunds: Math.round(r.refunds * share * 100) / 100,
    }));
  }, [basePosReadings, allIncomeTotal, sectorIncomeTotal]);

  const visibleModules = activeSectors.slice(0, moduleVisible);
  const moduleRemaining = Math.max(0, activeSectors.length - moduleVisible);
  const visibleActivity = activity.slice(0, activityVisible);
  const activityRemaining = Math.max(0, activity.length - activityVisible);

  const today = toIsoDate(new Date());
  const range = useMemo(
    () =>
      resolveRevenueInterval(
        intervalId,
        today,
        sectorIncomeRows,
        intervalId === 'custom' ? { start: customStart || today, end: customEnd || today } : null
      ),
    [intervalId, today, sectorIncomeRows, customStart, customEnd]
  );
  const { start: rangeStart, end: rangeEnd } = range;

  useEffect(() => {
    if (intervalId === 'custom') return;
    setCustomStart(rangeStart);
    setCustomEnd(rangeEnd);
  }, [intervalId, rangeStart, rangeEnd]);

  const prior = useMemo(() => priorPeriodBounds(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const periodIncomeRows = useMemo(
    () => sectorIncomeRows.filter((r) => r.date >= rangeStart && r.date <= rangeEnd),
    [sectorIncomeRows, rangeStart, rangeEnd]
  );

  const revPeriod = sumInRange(sectorIncomeRows, rangeStart, rangeEnd);
  const revPrior = sumInRange(sectorIncomeRows, prior.start, prior.end);
  const revToday = sumInRange(sectorIncomeRows, today, today);
  const growthPct =
    revPrior > 0 ? ((revPeriod - revPrior) / revPrior) * 100 : revPeriod > 0 ? 100 : 0;

  let periodDays = 0;
  for (let iso = rangeStart; iso <= rangeEnd; iso = addDaysIso(iso, 1)) periodDays += 1;
  const dailyAvg = periodDays > 0 ? revPeriod / periodDays : 0;

  const budgetMonth = monthlyBudgetTarget(sectorIncomeRows, today);
  const budgetPct = budgetMonth > 0 ? Math.min(100, (revPeriod / budgetMonth) * 100) : 0;

  const depositedYtd = sumDepositsInRange(`${today.slice(0, 4)}-01-01`, today);
  const cash = buildCashPosition(periodIncomeRows, sectorPosReadings, today, depositedYtd);
  const profit = buildProfitability(sectorIncomeRows, sectorExpenseRows, rangeStart, rangeEnd);
  const paymentMix = buildPaymentMix(sectorPosReadings, sectorIncomeRows, rangeStart, rangeEnd);
  const reconciliation = buildReconciliation(
    sectorIncomeRows,
    sectorPosReadings,
    rangeStart,
    rangeEnd,
    today
  );
  const posDaysWithData = useMemo(() => {
    const days = new Set(sectorPosReadings.map((r) => r.date));
    return days.size;
  }, [sectorPosReadings]);
  const avgDailyCash =
    posDaysWithData > 0
      ? sectorPosReadings.reduce((s, r) => s + r.cash, 0) / posDaysWithData
      : 0;
  const tillAdvice = suggestTillFloat(avgDailyCash);
  const insights = buildInsights({
    revToday,
    revWeek: revPeriod,
    revPrevWeek: revPrior,
    revMonth: revPeriod,
    budgetMonth,
    reconciliationOpen: reconciliation.openCount,
    reconciliationVariance: reconciliation.variance,
    posCount: sectorPosReadings.length,
    posDaysWithData,
    incomeCount: periodIncomeRows.length,
    incomingInvoices: cash.incoming,
    cashOnHand: cash.onHand,
    cashFromPos: cash.fromPos,
    tillAdviceChf: tillAdvice,
  });

  const handleInsightClick = (action?: string) => {
    if (action === 'reconciliation') setHubTab('reconciliation');
    else if (action === 'documents') setHubTab('documents');
    else if (action === 'upload_z') {
      setHubTab('trend');
      uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action === 'cash_deposit') {
      setShowCashDeposit(true);
      setHubTab('trend');
    }
  };

  const submitCashDeposit = () => {
    const amount = Number(String(depositAmount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    addCashDeposit({ date: depositDate, amount });
    setCashDeposits(loadCashDeposits());
    setDepositAmount('');
    setShowCashDeposit(false);
  };

  const paymentBase = Math.max(paymentMix.cash + paymentMix.card + paymentMix.other, 1);
  const flowBase = Math.max(revPeriod, dailyAvg, paymentMix.gross, 1);

  const fmt = (n: number) =>
    n.toLocaleString(chfLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtChf = (n: number) => `${fmt(n)} CHF`;
  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(chfLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const fmtDateLong = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(chfLocale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const findDocument = (documentId?: string | null): ProcessedDocument | undefined => {
    if (!documentId) return undefined;
    return documents.find((d) => d.id === documentId || d.persistedDocumentId === documentId);
  };

  const openDocument = (doc: ProcessedDocument) => {
    onNavigateToDocument?.(doc);
    onNavigateTab?.('documents');
  };

  const periodDocs = useMemo(() => {
    type Row = {
      key: string;
      date: string;
      amount: number;
      description: string;
      incomeId?: string;
      sectorId: string | null;
      doc?: ProcessedDocument;
    };
    const byKey = new Map<string, Row>();

    for (const row of filteredIncome) {
      if (row.date < rangeStart || row.date > rangeEnd) continue;
      if (!rowMatchesAnySector(row.description || '', activeSectors)) continue;
      const doc = findDocument(row.document_id);
      const sectorId = resolveRowSector(row.description, activeSectors);
      byKey.set(`income:${row.id}`, {
        key: `income:${row.id}`,
        date: row.date,
        amount: row.amount,
        description: row.description || '',
        incomeId: row.id,
        sectorId,
        doc,
      });
    }

    const sessionDocs = isAllSessionsView
      ? documents.filter((d) => !d.session_id || existingSessionIds.includes(d.session_id))
      : documents.filter((d) => !d.session_id || d.session_id === currentSession?.id);

    for (const doc of sessionDocs) {
      const date = (doc.data?.date || doc.created_at || '').slice(0, 10);
      if (!date || date < rangeStart || date > rangeEnd) continue;
      const blob = [doc.fileName, doc.data?.issuer, doc.data?.documentType, ...(doc.data?.lineItems?.map((l) => l.description) || [])]
        .filter(Boolean)
        .join(' ');
      const amount = doc.data?.amountInCHF || doc.data?.totalAmount || 0;
      const docType = doc.data?.documentType || '';
      const isPosLike =
        docType === 'Ticket/Receipt' ||
        docType === 'Z2 Multi-Ticket Sheet' ||
        docType === 'Bank Deposit' ||
        docType === 'Bank Statement';
      const matchesSector = rowMatchesAnySector(blob, activeSectors);
      const linked = filteredIncome.some(
        (i) => i.document_id === doc.id || i.document_id === doc.persistedDocumentId
      );
      if (!matchesSector && !(isPosLike && activeSectors.includes('restaurants')) && !linked) {
        continue;
      }
      const already = [...byKey.values()].some((r) => r.doc?.id === doc.id);
      if (already) continue;
      byKey.set(`doc:${doc.id}`, {
        key: `doc:${doc.id}`,
        date,
        amount,
        description: doc.fileName || doc.data?.issuer || t('rhDocSource'),
        sectorId: resolveRowSector(blob, activeSectors),
        doc,
      });
    }

    return [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [
    filteredIncome,
    rangeStart,
    rangeEnd,
    activeSectors,
    documents,
    recipeTick,
    isAllSessionsView,
    existingSessionIds,
    currentSession?.id,
    t,
  ]);

  const handleCategoryChange = async (incomeId: string, sectorId: string) => {
    const row = filteredIncome.find((i) => i.id === incomeId);
    if (!row) return;
    const nextDesc = assignSectorTag(row.description, sectorId);
    await updateIncome(incomeId, { description: nextDesc });
    setRecipeTick((n) => n + 1);
  };

  const trendData = useMemo(
    () => trendForRange(sectorIncomeRows, rangeStart, rangeEnd, chfLocale),
    [sectorIncomeRows, rangeStart, rangeEnd, chfLocale]
  );
  const trendTickDates = useMemo(
    () => trendAxisTickDates(trendData.map((d) => d.date), 6),
    [trendData]
  );
  const trendRangeLabel =
    rangeStart && rangeEnd ? `${fmtDateLong(rangeStart)} → ${fmtDateLong(rangeEnd)}` : '';

  useEffect(() => {
    setDocVisible(10);
  }, [intervalId, activeSectors.join('|'), hubTab, customStart, customEnd]);

  const visibleDocs = periodDocs.slice(0, docVisible);
  const docsRemaining = Math.max(0, periodDocs.length - docVisible);
  const docsWithFile = periodDocs.filter((d) => d.doc).length;

  const categoryOptions = useMemo(() => {
    const ids = [...activeSectors, ...SECTOR_CATALOG.map((s) => s.id), ...customSectors.map((c) => c.id)];
    return Array.from(new Set(ids));
  }, [activeSectors, customSectors]);

  const paymentMethods = useMemo(() => {
    const items = [
      { name: t('posCash'), amount: paymentMix.cash, fill: CHART_GREEN },
      { name: t('posCard'), amount: paymentMix.card, fill: CHART_BLUE },
      { name: t('rhPaymentTwint'), amount: paymentMix.other, fill: CHART_GOLD },
    ].filter((x) => x.amount > 0);
    return items.length ? items : [{ name: t('posCash'), amount: 0, fill: CHART_GREEN }];
  }, [paymentMix.cash, paymentMix.card, paymentMix.other, t]);

  const hasTransactions = sectorIncomeRows.length > 0 || sectorPosReadings.length > 0;
  const hasPayments = paymentMix.gross > 0;

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const logActivity = (entry: Omit<RevenueActivity, 'id' | 'at'> & { at?: string }) => {
    setActivity(pushRevenueActivity(entry));
  };

  const toggleSector = (id: string) => {
    setActiveSectors((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      const resolved = next.length ? next : [id];
      saveStoredSectors(resolved);
      const meta = getSectorMeta(id);
      setSectorLog((log) =>
        [
          `${new Date().toLocaleTimeString(chfLocale)} — ${sectorDisplayTitle(meta, t)}`,
          ...log,
        ].slice(0, 8)
      );
      queueMicrotask(() =>
        logActivity({
          type: 'sector_change',
          label: t('rhActivitySectorChange'),
          detail: resolved.map((s) => sectorDisplayTitle(getSectorMeta(s), t)).join(', '),
        })
      );
      return resolved;
    });
  };

  const selectAllSectors = () => {
    const all = [...ALL_SECTORS, ...customSectors.map((c) => c.id)];
    setActiveSectors(all);
    saveStoredSectors(all);
    setSectorLog((log) => [`${new Date().toLocaleTimeString(chfLocale)} — ${t('rhSelectAllSectors')}`, ...log].slice(0, 8));
    logActivity({
      type: 'sector_change',
      label: t('rhActivitySectorChange'),
      detail: t('rhSelectAllSectors'),
    });
  };

  const clearToDefaultSector = () => {
    const next = ['restaurants'];
    setActiveSectors(next);
    saveStoredSectors(next);
    logActivity({
      type: 'sector_change',
      label: t('rhActivitySectorChange'),
      detail: t(getSectorMeta('restaurants').titleKey),
    });
  };

  const handleAddCustomCategory = () => {
    const created = addCustomSector({
      name: customName,
      icon: customIcon,
      keywords: customKeywords.split(/[,;\n]+/),
    });
    if (!created) {
      alert(t('rhCustomCategoryInvalid'));
      return;
    }
    setCustomSectors(loadCustomSectors());
    setActiveSectors((prev) => {
      const next = prev.includes(created.id) ? prev : [...prev, created.id];
      saveStoredSectors(next);
      return next;
    });
    setCustomName('');
    setCustomKeywords('');
    setCustomIcon('📌');
    setRecipeTick((n) => n + 1);
    logActivity({
      type: 'sector_change',
      label: t('rhActivityCustomCategory'),
      detail: created.name,
    });
  };

  const syncZReadingToIncome = async (
    data: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!currentSession?.id || data.gross_sales <= 0) return;
    const existing = findIncomeForZReading(incomeRows, data.date);
    if (existing) return;
    await addIncome(
      data.date,
      'SALES',
      data.gross_sales,
      zReadingIncomeDescription(data.date),
      currentSession.id,
      undefined,
      data.vat_amount
    );
  };

  const handleAddZReading = async (
    data: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>
  ) => {
    await addPOSReading(data);
    await syncZReadingToIncome(data);
    logActivity({
      type: 'z_reading',
      label: t('rhActivityZReading'),
      detail: data.date,
      amountChf: data.gross_sales,
    });
  };

  const seedDemoData = async () => {
    if (!currentSession?.id) return;
    const { income: seeds, expenses: expenseSeeds, zReadings } = buildDemoSeeds(today);
    const sid = currentSession.id;
    // Parallel batches keep Firestore under rate limits while staying reasonably fast.
    const chunk = async <T,>(items: T[], size: number, fn: (item: T) => Promise<unknown>) => {
      for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(fn));
      }
    };
    await chunk(seeds, 8, (row) => addIncome(row.date, row.type, row.amount, row.description, sid));
    await chunk(expenseSeeds, 8, (exp) =>
      addExpense(exp.date, exp.category, exp.amount, exp.description, sid)
    );
    await chunk(zReadings, 6, (z) => addPOSReading(z));
    // Keep the user's sector filter — do not force all sectors on demo load/refresh.
    setSectorLog((log) => [`${new Date().toLocaleTimeString(chfLocale)} — ${t('rhDemoLoaded')}`, ...log].slice(0, 8));
  };

  const loadDemoData = async () => {
    if (!currentSession?.id) return;
    if (!confirm(t('rhDemoConfirm'))) return;
    setDemoHold({ income: incomeRows, expenses: expenseRows, pos: posReadings });
    setDemoLoading(true);
    try {
      await seedDemoData();
      logActivity({ type: 'demo_load', label: t('rhActivityDemoLoad'), detail: t('rhDemoLoaded') });
    } finally {
      setDemoLoading(false);
      setDemoHold(null);
    }
  };

  const refreshDemoData = async () => {
    if (!currentSession?.id) return;
    const oldIncomeIds = filteredIncome.filter((i) => isDemoDescription(i.description)).map((i) => i.id);
    const oldExpenseIds = filteredExpenses
      .filter((e) => isDemoDescription(e.description))
      .map((e) => e.id);
    const oldPosIds = posReadings.filter((p) => p.notes?.includes(DEMO_TAG)).map((p) => p.id);

    setDemoHold({ income: incomeRows, expenses: expenseRows, pos: posReadings });
    setDemoLoading(true);
    try {
      // Seed first so the live ledger never empties; hold snapshot covers KPIs until done.
      await seedDemoData();
      for (const id of oldIncomeIds) await deleteIncome(id);
      for (const id of oldExpenseIds) await deleteExpense(id);
      for (const id of oldPosIds) await deletePOSReading(id);
      logActivity({
        type: 'demo_refresh',
        label: t('rhActivityDemoRefresh'),
        detail: t('rhDemoRefreshing'),
      });
    } finally {
      setDemoLoading(false);
      setDemoHold(null);
    }
  };

  return (
    <div className="ba-revenue-stack">
      <div className="ba-revenue-toolbar">
        <div className="ba-revenue-toolbar__sectors">
          {activeSectors.length === 0 ? (
            <button type="button" className="ba-sector-pill" onClick={() => setShowSectorPicker(true)}>
              {t('rhChooseSectors')}
            </button>
          ) : (
            activeSectors.map((id) => {
              const meta = getSectorMeta(id);
              return (
                <button
                  key={id}
                  type="button"
                  className="ba-sector-pill ba-sector-pill--active"
                  onClick={() => setShowSectorPicker(true)}
                  title={sectorDisplayDesc(meta, t)}
                >
                  {meta.icon} {sectorDisplayTitle(meta, t)}
                </button>
              );
            })
          )}
        </div>
        <div className="ba-revenue-toolbar__actions">
          <button type="button" className="ba-revenue-link-btn" onClick={() => scrollTo(uploadRef)}>
            <Plug className="w-3.5 h-3.5" /> {t('rhConnectData')}
          </button>
          <button type="button" className="ba-revenue-link-btn" onClick={() => setShowSectorPicker((v) => !v)}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> {t('rhChangeSectors')}
          </button>
          <button
            type="button"
            className="ba-revenue-link-btn"
            onClick={() =>
              setSectorLog((log) =>
                log.length
                  ? []
                  : [
                      `${t('rhSectorLog')} — ${
                        activeSectors.map((s) => sectorDisplayTitle(getSectorMeta(s), t)).join(', ') ||
                        t('rhNoSectorsSelected')
                      }`,
                    ]
              )
            }
          >
            <List className="w-3.5 h-3.5" /> {t('rhSectorLog')}
          </button>
          <button type="button" className="ba-revenue-cta" onClick={() => scrollTo(uploadRef)}>
            <Upload className="w-4 h-4" /> {t('rhUploadZ')}
          </button>
        </div>
      </div>

      <div className="ba-revenue-secondary">
        <button type="button" className="ba-revenue-link-btn" onClick={() => scrollTo(activityRef)}>
          <History className="w-3.5 h-3.5" /> {t('rhImportHistory')}
        </button>
        <button type="button" className="ba-revenue-link-btn" disabled={demoLoading} onClick={() => void refreshDemoData()}>
          <RefreshCw className={`w-3.5 h-3.5 ${demoLoading ? 'animate-spin' : ''}`} /> {t('rhRefreshDemo')}
        </button>
        <button type="button" className="ba-revenue-link-btn" disabled={demoLoading} onClick={() => void loadDemoData()}>
          {t('rhLoadDemo')}
        </button>
      </div>

      {showSectorPicker ? (
        <div className="ba-sector-picker">
          <div className="ba-sector-picker__head">
            <div>
              <p className="ba-sector-picker__title">{t('rhSelectSectors')}</p>
              <p className="ba-sector-picker__hint">{t('rhSelectSectorsHint')}</p>
            </div>
            <div className="ba-sector-picker__actions">
              <button type="button" className="ba-revenue-link-btn" onClick={selectAllSectors}>
                {t('rhSelectAllSectors')}
              </button>
              <button type="button" className="ba-revenue-link-btn" onClick={clearToDefaultSector}>
                {t('rhResetSectors')}
              </button>
              <button type="button" className="ba-revenue-link-btn" onClick={() => setShowSectorPicker(false)}>
                {t('rhDoneSectors')}
              </button>
            </div>
          </div>
          <div className="ba-sector-picker__grid">
            {SECTOR_CATALOG.map((meta) => {
              const active = activeSectors.includes(meta.id);
              return (
                <button
                  key={meta.id}
                  type="button"
                  className={`ba-sector-card ${active ? 'ba-sector-card--active' : ''}`}
                  onClick={() => toggleSector(meta.id)}
                >
                  <span className="ba-sector-card__icon">{meta.icon}</span>
                  <span className="ba-sector-card__label">{t(meta.titleKey)}</span>
                  <span className="ba-sector-card__desc">{t(meta.descKey)}</span>
                  <span className="ba-sector-card__check">{active ? '✓' : ''}</span>
                </button>
              );
            })}
            {customSectors.map((c) => {
              const meta = getSectorMeta(c.id);
              const active = activeSectors.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`ba-sector-card ${active ? 'ba-sector-card--active' : ''}`}
                  onClick={() => toggleSector(c.id)}
                >
                  <span className="ba-sector-card__icon">{meta.icon}</span>
                  <span className="ba-sector-card__label">{sectorDisplayTitle(meta, t)}</span>
                  <span className="ba-sector-card__desc">{sectorDisplayDesc(meta, t)}</span>
                  <span className="ba-sector-card__check">{active ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
          <div className="ba-custom-category">
            <p className="ba-custom-category__title">{t('rhAddCustomCategory')}</p>
            <p className="ba-custom-category__hint">{t('rhAddCustomCategoryHint')}</p>
            <div className="ba-custom-category__form">
              <input
                type="text"
                className="ba-verify-field"
                placeholder={t('rhCustomCategoryName')}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <input
                type="text"
                className="ba-verify-field ba-custom-category__icon"
                placeholder={t('rhCustomCategoryIcon')}
                value={customIcon}
                onChange={(e) => setCustomIcon(e.target.value)}
                maxLength={4}
              />
              <input
                type="text"
                className="ba-verify-field ba-custom-category__keywords"
                placeholder={t('rhCustomCategoryKeywords')}
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
              />
              <button type="button" className="ba-revenue-cta" onClick={handleAddCustomCategory}>
                {t('rhSaveCustomCategory')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sectorLog.length > 0 ? (
        <div className="ba-panel text-xs text-cdlp-muted space-y-1">
          {sectorLog.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : null}

      <div className="ba-revenue-hero">
        <div>
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhOverview')}</p>
          <h1 className="ba-revenue-hero__title">{t('rhPeriodAtGlance')}</h1>
          <p className="text-[10px] text-cdlp-muted mt-1 uppercase tracking-wide">{trendRangeLabel}</p>
        </div>
        <div className="ba-revenue-hero__today">
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhPeriodTotal')}</p>
          <p className="text-2xl md:text-3xl font-bold text-emerald-400 tabular-nums">{fmtChf(revPeriod)}</p>
        </div>
      </div>

      {!hasTransactions ? (
        <div className="ba-revenue-empty-banner">
          <p className="text-sm text-cdlp-muted max-w-xl">{t('rhEmptyBanner')}</p>
          <button type="button" className="ba-revenue-cta" disabled={demoLoading} onClick={() => void loadDemoData()}>
            {t('rhLoadDemo')}
          </button>
        </div>
      ) : null}

      <div className="ba-interval-bar">
        <div className="ba-interval-bar__chips">
          {REVENUE_INTERVALS.map((iv) => (
            <button
              key={iv.id}
              type="button"
              className={`ba-filter-chip ${intervalId === iv.id ? 'ba-filter-chip--active' : ''}`}
              onClick={() => setIntervalId(iv.id)}
            >
              {t(iv.labelKey)}
            </button>
          ))}
          <button
            type="button"
            className={`ba-filter-chip ${intervalId === 'custom' ? 'ba-filter-chip--active' : ''}`}
            onClick={() => setIntervalId('custom')}
          >
            {t('rhIntervalCustom')}
          </button>
        </div>
        <div className="ba-interval-bar__dates">
          <label className="ba-interval-bar__date-field">
            <span>{t('rhFromDate')}</span>
            <input
              type="date"
              className="ba-verify-field"
              value={customStart || rangeStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setIntervalId('custom');
              }}
            />
          </label>
          <label className="ba-interval-bar__date-field">
            <span>{t('rhToDate')}</span>
            <input
              type="date"
              className="ba-verify-field"
              value={customEnd || rangeEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setIntervalId('custom');
              }}
            />
          </label>
        </div>
        <p className="ba-interval-bar__span">
          <strong>{t('rhActiveFilter')}:</strong> {fmtDateLong(rangeStart)} → {fmtDateLong(rangeEnd)}
          {range.firstDoc && range.lastDoc ? (
            <>
              <span className="ba-interval-bar__sep">·</span>
              {t('rhDataSpan')
                .replace('{first}', fmtDateLong(range.firstDoc))
                .replace('{last}', fmtDateLong(range.lastDoc))}
            </>
          ) : null}
        </p>
      </div>

      <div className="ba-kpi-grid-4">
        <BusinessKpiCard
          label={t('rhKpiPeriod')}
          value={fmt(revPeriod)}
          icon={Wallet}
          tone="neutral"
          progressPct={(revPeriod / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('rhKpiVsPrior')}
          value={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`}
          hint={t('rhVsPriorPeriod')}
          icon={CalendarDays}
          tone="green"
          progressPct={Math.min(100, Math.abs(growthPct))}
        />
        <BusinessKpiCard
          label={t('rhKpiDailyAvg')}
          value={fmt(dailyAvg)}
          icon={CalendarRange}
          tone="blue"
          progressPct={(dailyAvg / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('rhKpiEntries')}
          value={String(periodIncomeRows.length)}
          hint={t('rhDocsLinked').replace('{n}', String(docsWithFile))}
          icon={TrendingUp}
          tone="gold"
          progressPct={periodIncomeRows.length ? 70 : 0}
        />
      </div>

      <div className="ba-hub-tabs" role="tablist" aria-label={t('rhHubTabs')}>
        {(
          [
            { id: 'trend' as const, label: t('rhTabTrend') },
            { id: 'documents' as const, label: t('rhTabDocuments') },
            { id: 'reconciliation' as const, label: t('rhTabReconciliation') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={hubTab === tab.id}
            className={`ba-hub-tabs__btn ${hubTab === tab.id ? 'ba-hub-tabs__btn--active' : ''}`}
            onClick={() => setHubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {hubTab === 'trend' ? (
      <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="ba-panel lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhRevTrend')}</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {fmtChf(revPeriod)}{' '}
                <span className="text-xs text-cdlp-muted font-normal">{t('rhInFilter')}</span>
              </p>
              {trendRangeLabel ? (
                <p className="text-[10px] text-cdlp-muted mt-1 uppercase tracking-wide">
                  {t('rhTrendRange').replace('{range}', trendRangeLabel)}
                </p>
              ) : null}
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-400">
              {growthPct >= 0 ? '+' : ''}
              {growthPct.toFixed(1)}% {t('rhVsPriorShort')}
            </span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_GREEN} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_GREEN} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#3d4450" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  ticks={trendTickDates}
                  tickFormatter={(iso: string) => {
                    const row = trendData.find((d) => d.date === iso);
                    return row?.label || iso;
                  }}
                  tick={{ fontSize: 11, fill: '#9aa0a6' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: '#2d3238',
                    border: '1px solid #3d4450',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#fff',
                  }}
                  labelFormatter={(_label, payload) => {
                    const row = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return row?.fullLabel || '';
                  }}
                  formatter={(value: number) => [fmtChf(value), t('revenue')]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={CHART_GREEN}
                  fill="url(#revTrendFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ba-panel">
          <p className="text-xs text-cdlp-muted uppercase tracking-wide mb-1">{t('rhBudgetActual')}</p>
          <p className="text-lg font-bold text-white tabular-nums">{fmtChf(revPeriod)}</p>
          <p className="text-xs text-cdlp-muted mt-1">
            {t('rhOfTarget').replace('{v}', fmtChf(budgetMonth))}
          </p>
          <div className="mt-3 h-2 rounded-full bg-cdlp-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-cdlp-muted">{t('rhAvgTx')}</p>
              <p className="font-bold tabular-nums">
                {profit.txCount ? fmtChf(profit.avgTransaction) : '—'}
              </p>
            </div>
            <div>
              <p className="text-cdlp-muted">{t('rhTxCount')}</p>
              <p className="font-bold tabular-nums">{profit.txCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ba-panel ba-revenue-stat-panel">
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhCashPosition')}</p>
          <p className="ba-revenue-stat-panel__value tabular-nums">{fmtChf(cash.total)}</p>
          <div className="space-y-2 mt-2">
            <div className="ba-revenue-stat-row"><span>{t('rhInBank')}</span><span>{fmtChf(cash.inBank)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhOnHand')}</span><span>{fmtChf(cash.onHand)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhIncoming')}</span><span>{fmtChf(cash.incoming)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhPendingDeposits')}</span><span>{fmtChf(cash.pendingDeposits)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhTillAdvice')}</span><span>{fmtChf(tillAdvice)}</span></div>
          </div>
          <button
            type="button"
            className="ba-filter-chip mt-3 w-full justify-center"
            onClick={() => setShowCashDeposit((v) => !v)}
          >
            {t('rhLogDeposit')}
          </button>
          {showCashDeposit ? (
            <div className="mt-3 space-y-2 border-t border-cdlp-border pt-3">
              <input
                type="date"
                className="ba-verify-field"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
              <input
                type="text"
                inputMode="decimal"
                className="ba-verify-field"
                placeholder={t('rhDepositAmount')}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button type="button" className="ba-btn-approve w-full !h-9" onClick={submitCashDeposit}>
                {t('rhSaveDeposit')}
              </button>
              {cashDeposits.slice(0, 3).map((d) => (
                <p key={d.id} className="text-[10px] text-cdlp-muted">
                  {d.date}: {fmtChf(d.amount)}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ba-panel ba-revenue-stat-panel">
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhProfitability')}</p>
          <p className="ba-revenue-stat-panel__value tabular-nums">{fmtChf(profit.netProfit)}</p>
          <p className="text-xs text-cdlp-muted">{t('rhNetProfit')}</p>
          <div className="space-y-2 mt-3">
            <div className="ba-revenue-stat-row"><span>{t('rhCogs')}</span><span>{fmtChf(profit.cogs)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhOperating')}</span><span>{fmtChf(profit.operating)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhPayrollCost')}</span><span>{fmtChf(profit.payroll)}</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhMargin')}</span><span>{profit.marginPct.toFixed(1)}%</span></div>
            <div className="ba-revenue-stat-row"><span>{t('rhAvgTransaction')}</span><span>{fmtChf(profit.avgTransaction)}</span></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ba-panel">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('rhPaymentMethodMtd')}</p>
            <CreditCard className="w-4 h-4 text-cdlp-muted" />
          </div>
          {paymentMethods.every((p) => p.amount === 0) || !hasPayments ? (
            <p className="text-sm text-cdlp-muted py-6 text-center">{t('rhNoPayments')}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentMethods.map((pm) => {
                  const pct = paymentBase > 0 ? (pm.amount / paymentBase) * 100 : 0;
                  return (
                    <div key={pm.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-cdlp-muted">{pm.name}</span>
                        <span className="font-bold tabular-nums">{fmtChf(pm.amount)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-cdlp-border/40">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pm.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentMethods} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: '#9aa0a6' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#2d3238', border: '1px solid #3d4450', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [fmtChf(value), t('rhAmount')]} />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      {paymentMethods.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div className="ba-panel">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-cdlp-gold" />
            <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('rhAiInsights')}</h2>
          </div>
          {insights.length === 0 ? (
            <p className="text-sm text-cdlp-muted">{t('rhNoInsights')}</p>
          ) : (
            <ul className="space-y-3">
              {insights.map((ins) => (
                <li key={ins.id}>
                  <button
                    type="button"
                    onClick={() => handleInsightClick(ins.action)}
                    className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                      ins.tone === 'warn'
                        ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                        : ins.tone === 'positive'
                          ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-cdlp-border bg-cdlp-card/30 hover:bg-cdlp-card/50'
                    } ${ins.action ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <p className="font-bold text-[var(--ba-text,#fff)]">{ins.title}</p>
                    <p className="text-xs text-cdlp-muted mt-1">{ins.body}</p>
                    {ins.action === 'reconciliation' ? (
                      <p className="text-[10px] text-cdlp-gold mt-2 uppercase font-bold">{t('rhOpenRecon')}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </>
      ) : null}

      {hubTab === 'documents' ? (
        <div className="ba-panel ba-revenue-docs">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('rhTabDocuments')}</h2>
              <p className="text-xs text-cdlp-muted mt-1">
                {t('rhDocsTableHint')
                  .replace('{n}', String(periodDocs.length))
                  .replace('{range}', trendRangeLabel || '—')}
              </p>
            </div>
          </div>
          {periodDocs.length === 0 ? (
            <p className="text-sm text-cdlp-muted py-8 text-center">{t('rhDocsEmpty')}</p>
          ) : (
            <>
              <div className="ba-revenue-docs__table-wrap">
                <table className="ba-revenue-docs__table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('rhDocCategory')}</th>
                      <th>{t('rhDocDescription')}</th>
                      <th className="text-right">{t('rhAmount')}</th>
                      <th>{t('rhDocSource')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocs.map((entry) => {
                      const sectorId = entry.sectorId;
                      const meta = sectorId ? getSectorMeta(sectorId) : null;
                      return (
                        <tr key={entry.key}>
                          <td className="whitespace-nowrap">{fmtDate(entry.date)}</td>
                          <td>
                            {entry.incomeId ? (
                              <select
                                className="ba-verify-field ba-revenue-docs__category"
                                value={sectorId || ''}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  if (next && entry.incomeId) void handleCategoryChange(entry.incomeId, next);
                                }}
                              >
                                <option value="" disabled>
                                  {t('rhChooseCategory')}
                                </option>
                                {categoryOptions.map((id) => {
                                  const m = getSectorMeta(id);
                                  return (
                                    <option key={id} value={id}>
                                      {m.icon} {sectorDisplayTitle(m, t)}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <span className="whitespace-nowrap">
                                {meta ? `${meta.icon} ${sectorDisplayTitle(meta, t)}` : '—'}
                              </span>
                            )}
                          </td>
                          <td className="max-w-[14rem] truncate" title={entry.description}>
                            {entry.description || '—'}
                          </td>
                          <td className="text-right tabular-nums font-bold">{fmtChf(entry.amount)}</td>
                          <td className="max-w-[10rem] truncate text-cdlp-muted">
                            {entry.doc?.fileName || (entry.doc ? entry.doc.id : t('rhLedgerOnly'))}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="ba-revenue-link-btn"
                              disabled={!entry.doc}
                              title={entry.doc ? t('rhOpenDocument') : t('rhLedgerOnly')}
                              onClick={() => {
                                if (entry.doc) openDocument(entry.doc);
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <ExternalLink className="w-3 h-3" />
                              {t('rhOpenDocument')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {periodDocs.length > 10 ? (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {docsRemaining > 0 ? (
                    <button
                      type="button"
                      className="ba-filter-chip"
                      onClick={() => setDocVisible((n) => Math.min(periodDocs.length, n + 10))}
                    >
                      {t('rhLoadMore').replace('{n}', String(docsRemaining))}
                    </button>
                  ) : (
                    <button type="button" className="ba-filter-chip" onClick={() => setDocVisible(10)}>
                      {t('rhShowLess')}
                    </button>
                  )}
                  <span className="text-[10px] text-cdlp-muted uppercase tracking-wide">
                    {Math.min(docVisible, periodDocs.length)} / {periodDocs.length}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {hubTab === 'reconciliation' ? (
        <div className="ba-panel ba-revenue-stat-panel">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('rhTabReconciliation')}</h2>
            {reconciliation.openCount > 0 ? (
              <span className="ba-revenue-badge-open">
                {reconciliation.openCount} {t('rhOpen')}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-cdlp-muted mb-3">{trendRangeLabel}</p>
          <p className="ba-revenue-stat-panel__value tabular-nums">{fmtChf(reconciliation.variance)}</p>
          <p className="text-xs text-cdlp-muted">{t('rhTotalVariance')}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {reconciliation.items.length === 0 ? (
              <li className="text-cdlp-muted">{t('rhAllClear')}</li>
            ) : (
              reconciliation.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-cdlp-border/60 p-3">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-bold">{item.description}</p>
                      <p className="text-[10px] text-cdlp-muted uppercase mt-1">{item.label}</p>
                    </div>
                    {item.amount !== 0 ? (
                      <span
                        className={`tabular-nums shrink-0 font-bold ${item.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}
                      >
                        {fmtChf(item.amount)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {visibleModules.map((sectorId) => (
        <RevenueIndustryModule
          key={`${sectorId}-${recipeTick}`}
          sector={sectorId}
          rows={sectorIncomeRows.filter((r) => r.date >= rangeStart && r.date <= rangeEnd)}
          fmt={fmt}
          fmtChf={fmtChf}
          t={t}
          onRecipeSaved={() => setRecipeTick((n) => n + 1)}
          onCustomDeleted={(id) => {
            setCustomSectors(loadCustomSectors());
            setActiveSectors((prev) => {
              const next = prev.filter((s) => s !== id);
              const resolved = next.length ? next : ['restaurants'];
              saveStoredSectors(resolved);
              return resolved;
            });
            setRecipeTick((n) => n + 1);
          }}
        />
      ))}
      {activeSectors.length > 2 ? (
        <div className="flex flex-wrap items-center gap-2">
          {moduleRemaining > 0 ? (
            <button
              type="button"
              className="ba-filter-chip"
              onClick={() => setModuleVisible((n) => Math.min(activeSectors.length, n + 2))}
            >
              {t('rhLoadMore').replace('{n}', String(moduleRemaining))}
            </button>
          ) : (
            <button type="button" className="ba-filter-chip" onClick={() => setModuleVisible(2)}>
              {t('rhShowLess')}
            </button>
          )}
          <span className="text-[10px] text-cdlp-muted uppercase tracking-wide">
            {Math.min(moduleVisible, activeSectors.length)} / {activeSectors.length} {t('rhIndustryModules')}
          </span>
        </div>
      ) : null}

      {paymentMix.fromPos === false && hasPayments ? (
        <p className="text-[10px] text-cdlp-muted uppercase tracking-wide">
          {t('posFromIncome')} · {t('posEstimated')}
        </p>
      ) : null}

      <RevenueLedgerTable
        income={filteredIncome.filter(
          (i) =>
            i.date >= rangeStart &&
            i.date <= rangeEnd &&
            rowMatchesAnySector(i.description || '', activeSectors)
        )}
        expenses={[]}
        incomeOnly
      />

      <div className="ba-panel" ref={activityRef}>
        <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('rhActivityHistory')}</h2>
        <p className="text-xs text-cdlp-muted mb-4">{t('rhActivityHistoryDesc')}</p>
        {activity.length === 0 ? (
          <p className="text-sm text-cdlp-muted">{t('rhActivityEmpty')}</p>
        ) : (
          <>
            <ul className="ba-activity-list">
              {visibleActivity.map((item) => (
                <li key={item.id} className="ba-activity-list__item">
                  <div>
                    <p className="ba-activity-list__label">{item.label}</p>
                    {item.detail ? <p className="ba-activity-list__detail">{item.detail}</p> : null}
                  </div>
                  <div className="ba-activity-list__meta">
                    <time dateTime={item.at}>
                      {new Date(item.at).toLocaleString(chfLocale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </time>
                    {item.amountChf != null ? (
                      <span className="tabular-nums font-bold text-emerald-400">{fmtChf(item.amountChf)}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {activity.length > 10 ? (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {activityRemaining > 0 ? (
                  <button
                    type="button"
                    className="ba-filter-chip"
                    onClick={() => setActivityVisible((n) => Math.min(activity.length, n + 10))}
                  >
                    {t('rhLoadMore').replace('{n}', String(activityRemaining))}
                  </button>
                ) : (
                  <button type="button" className="ba-filter-chip" onClick={() => setActivityVisible(10)}>
                    {t('rhShowLess')}
                  </button>
                )}
                <span className="text-[10px] text-cdlp-muted uppercase tracking-wide">
                  {Math.min(activityVisible, activity.length)} / {activity.length}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div ref={uploadRef}>
        <POSModal
          inline
          reading={null}
          onClose={() => undefined}
          onSave={handleAddZReading}
          onCsvReady={(preview) =>
            logActivity({
              type: 'csv_import',
              label: t('rhActivityCsvImport'),
              detail: `${preview.validRows} ${t('rhValidRows')}`,
              amountChf: preview.totals.gross,
            })
          }
        />
      </div>

      <div className="ba-panel" ref={historyRef}>
        <h2 className="text-sm font-black uppercase text-cdlp-gold mb-4">
          {t('posDailyZReadings').replace('{n}', String(posReadings.length))}
        </h2>
        {posReadings.length === 0 ? (
          <p className="text-cdlp-muted text-sm">{t('posNoZReadingsHint')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleZReadings.map((reading) => (
                <div key={reading.id} className="ba-panel hover:border-cdlp-gold transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-cdlp-gold">
                        {new Date(reading.date).toLocaleDateString(chfLocale, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-cdlp-muted mt-1">{reading.notes || t('posNoNotes')}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingReading(reading)}
                        className="p-1.5 hover:bg-cdlp-card rounded text-cdlp-muted hover:text-cdlp-gold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('posDeleteZConfirm'))) void deletePOSReading(reading.id);
                        }}
                        className="p-1.5 hover:bg-cdlp-card rounded text-cdlp-muted hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-cdlp-muted">{t('posGrossSales')}:</span>
                      <span className="font-bold text-emerald-500">{fmtChf(reading.gross_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cdlp-muted">{t('posNetSales')}:</span>
                      <span className="font-bold ba-field-value">{fmtChf(reading.net_sales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cdlp-muted">{t('posCash')} / {t('posCard')}:</span>
                      <span className="font-bold tabular-nums">
                        {fmt(reading.cash)} / {fmt(reading.card)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {posReadings.length > 10 ? (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {zRemaining > 0 ? (
                  <button
                    type="button"
                    className="ba-filter-chip"
                    onClick={() => setZVisible((n) => Math.min(posReadings.length, n + 10))}
                  >
                    {t('rhLoadMore').replace('{n}', String(zRemaining))}
                  </button>
                ) : (
                  <button type="button" className="ba-filter-chip" onClick={() => setZVisible(10)}>
                    {t('rhShowLess')}
                  </button>
                )}
                <span className="text-[10px] text-cdlp-muted uppercase tracking-wide">
                  {Math.min(zVisible, posReadings.length)} / {posReadings.length}
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {editingReading ? (
        <POSModal
          reading={editingReading}
          onClose={() => setEditingReading(null)}
          onSave={async (data) => {
            await updatePOSReading(editingReading.id, data);
            setEditingReading(null);
          }}
        />
      ) : null}
    </div>
  );
}

function POSModal({
  reading,
  onClose,
  onSave,
  inline = false,
  onCsvReady,
}: {
  reading: POSReading | null;
  onClose: () => void;
  onSave: (
    data: Omit<POSReading, 'id' | 'restaurant_id' | 'session_id' | 'created_at' | 'updated_at'>
  ) => Promise<void>;
  inline?: boolean;
  onCsvReady?: (preview: CsvPreview) => void;
}) {
  const { income } = useFinance();
  const { currentSession } = useSession();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'manual' | 'upload' | 'auto' | 'csv'>(reading ? 'manual' : 'auto');
  const [uploading, setUploading] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(Boolean(reading));
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('day');
  const [customStart, setCustomStart] = useState(() => addDaysIso(new Date().toISOString().slice(0, 10), -6));
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

  const [csvDocType, setCsvDocType] = useState<ImportDocType>('z_reading');
  const [csvMatrix, setCsvMatrix] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, number>>({});
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvStep, setCsvStep] = useState<'pick' | 'map' | 'preview'>('pick');

  const [date, setDate] = useState(reading?.date || new Date().toISOString().split('T')[0]);
  const [grossSales, setGrossSales] = useState(reading?.gross_sales.toString() || '');
  const [netSales, setNetSales] = useState(reading?.net_sales.toString() || '');
  const [vatAmount, setVatAmount] = useState(reading?.vat_amount.toString() || '');
  const [cash, setCash] = useState(reading?.cash.toString() || '');
  const [card, setCard] = useState(reading?.card.toString() || '');
  const [otherPayment, setOtherPayment] = useState(reading?.other_payment.toString() || '0');
  const [tips, setTips] = useState(reading?.tips.toString() || '0');
  const [discounts, setDiscounts] = useState(reading?.discounts.toString() || '0');
  const [refunds, setRefunds] = useState(reading?.refunds.toString() || '0');
  const [notes, setNotes] = useState(reading?.notes || '');

  const columnDefs = csvDocType === 'z_reading' ? Z_READING_COLUMNS : STRIPE_COLUMNS;
  const missingCols = missingRequiredColumns(csvMapping, columnDefs);

  const incomeRange = useMemo(
    () => resolveIncomeDateRange(datePeriod, date, customStart, customEnd),
    [datePeriod, date, customStart, customEnd]
  );

  const applyDraft = (draft: ReturnType<typeof parseZReadingFromFinancialData>) => {
    setDate(draft.date);
    setGrossSales(draft.gross_sales.toString());
    setNetSales(draft.net_sales.toString());
    setVatAmount(draft.vat_amount.toString());
    setCash(draft.cash.toString());
    setCard(draft.card.toString());
    setOtherPayment(draft.other_payment.toString());
    setTips(draft.tips.toString());
    setDiscounts(draft.discounts.toString());
    setRefunds(draft.refunds.toString());
    setNotes(draft.notes);
    setShowEntryForm(true);
    setMode('manual');
  };

  const handleAutoGenerate = () => {
    const { start, end } = incomeRange;
    const rangedIncome = income.filter(
      (i) => i.session_id === currentSession?.id && i.date >= start && i.date <= end
    );
    const totalIncome = rangedIncome.reduce((sum, i) => sum + i.amount, 0);
    const vatRate = DEFAULT_SWISS_VAT_RATE / 100;
    const gross = totalIncome;
    const vat = gross * (vatRate / (1 + vatRate));
    const net = gross - vat;
    setDate(end);
    setGrossSales(gross.toFixed(2));
    setVatAmount(vat.toFixed(2));
    setNetSales(net.toFixed(2));
    setCard((gross * 0.6).toFixed(2));
    setCash((gross * 0.4).toFixed(2));
    setNotes(
      start === end
        ? t('posAutoNotes').replace('{n}', String(rangedIncome.length))
        : t('posAutoNotesRange')
            .replace('{n}', String(rangedIncome.length))
            .replace('{from}', start)
            .replace('{to}', end)
    );
    setShowEntryForm(true);
    setMode('manual');
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        const matrix = parseCsvText(text);
        const headers = matrix[0] || [];
        setCsvMatrix(matrix);
        setCsvHeaders(headers);
        setCsvMapping(autoMapColumns(headers, columnDefs));
        setCsvStep('map');
        setMode('csv');
        return;
      }
      const result = await analyzeFinancialDocument(file, 'CHF', Z_READING_AI_HINT);
      applyDraft(parseZReadingFromFinancialData(result, date));
    } catch (error) {
      alert(
        t('posAlertAnalyzeError').replace(
          '{msg}',
          error instanceof Error ? error.message : t('errorUnknown')
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const runCsvPreview = () => {
    if (!csvMatrix) return;
    const preview = previewCsvImport({
      kind: csvDocType,
      matrix: csvMatrix,
      mapping: csvMapping,
      headerDate: date,
      currency: 'CHF',
    });
    setCsvPreview(preview);
    setCsvStep('preview');
  };

  const applyCsvPreview = () => {
    if (!csvPreview) return;
    onCsvReady?.(csvPreview);
    applyDraft(csvPreviewToZReadingDraft(csvPreview, date));
    setCsvStep('pick');
    setCsvMatrix(null);
    setCsvPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      date,
      gross_sales: parseFloat(grossSales) || 0,
      net_sales: parseFloat(netSales) || 0,
      vat_amount: parseFloat(vatAmount) || 0,
      cash: parseFloat(cash) || 0,
      card: parseFloat(card) || 0,
      other_payment: parseFloat(otherPayment) || 0,
      tips: parseFloat(tips) || 0,
      discounts: parseFloat(discounts) || 0,
      refunds: parseFloat(refunds) || 0,
      notes,
    });
    if (inline && !reading) {
      setGrossSales('');
      setNetSales('');
      setVatAmount('');
      setCash('');
      setCard('');
      setOtherPayment('0');
      setTips('0');
      setDiscounts('0');
      setRefunds('0');
      setNotes('');
      setShowEntryForm(false);
      setMode('auto');
      setCsvStep('pick');
      return;
    }
    onClose();
  };

  const shellClass = inline
    ? 'ba-panel w-full'
    : 'fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto';
  const panelClass = inline ? 'w-full' : 'ba-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto';

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-cdlp-gold uppercase">
              {reading ? t('posEditZReading') : inline ? t('posZWorkspace') : t('posAddZReadingTitle')}
            </h3>
            {inline && !reading ? (
              <p className="text-xs text-cdlp-muted mt-1">{t('rhImportDesc')}</p>
            ) : null}
          </div>
          {!inline ? (
            <button type="button" onClick={onClose} className="text-cdlp-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>

        {!reading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(
              [
                ['auto', Zap, 'posAutoGenerate'],
                ['manual', Edit2, 'posManualEntry'],
                ['upload', Camera, 'posUploadPhoto'],
                ['csv', FileSpreadsheet, 'rhImportCsv'],
              ] as const
            ).map(([id, Icon, labelKey]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id);
                  if (id === 'manual') setShowEntryForm(true);
                  if (id === 'csv') setCsvStep('pick');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 ba-filter-chip ${mode === id ? 'ba-filter-chip--active' : ''}`}
              >
                <Icon className="w-4 h-4" /> {t(labelKey)}
              </button>
            ))}
          </div>
        )}

        {mode === 'auto' && !reading && (
          <div className="mb-6 ba-subpanel">
            <div className="text-center mb-4">
              <Zap className="w-12 h-12 text-cdlp-gold mx-auto mb-3" />
              <h4 className="text-sm font-bold text-cdlp-gold uppercase mb-2">{t('posAutoGenerateTitle')}</h4>
              <p className="text-xs text-cdlp-muted mb-4">{t('posAutoGenerateDesc')}</p>
            </div>
            <div className="mb-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">
                  {t('posDatePeriod')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['day', 'posPeriodDay'],
                      ['7d', 'posPeriod7d'],
                      ['14d', 'posPeriod14d'],
                      ['month', 'posPeriodMonth'],
                      ['custom', 'posPeriodCustom'],
                    ] as const
                  ).map(([id, labelKey]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDatePeriod(id)}
                      className={`ba-filter-chip ${datePeriod === id ? 'ba-filter-chip--active' : ''}`}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              {datePeriod === 'custom' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">
                      {t('posPeriodFrom')}
                    </label>
                    <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="ba-verify-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">
                      {t('posPeriodTo')}
                    </label>
                    <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="ba-verify-field" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">
                    {datePeriod === 'day' ? t('posSelectDate') : datePeriod === 'month' ? t('posSelectMonthDate') : t('posSelectEndDate')}
                  </label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ba-verify-field" />
                </div>
              )}
              <p className="text-[10px] text-cdlp-muted uppercase tracking-wide">
                {t('posPeriodActive').replace('{from}', incomeRange.start).replace('{to}', incomeRange.end)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoGenerate}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cdlp-gold text-cdlp-black text-sm font-bold uppercase rounded hover:bg-cdlp-gold-light"
            >
              <Zap className="w-5 h-5" /> {t('posGenerateFromIncome')}
            </button>
          </div>
        )}

        {mode === 'upload' && !reading && (
          <div className="mb-6">
            <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-cdlp-border rounded cursor-pointer hover:bg-cdlp-card transition-colors">
              <Upload className="w-8 h-8 mb-3 text-cdlp-muted" />
              <span className="text-xs font-bold uppercase text-cdlp-gold">{t('rhUploadAny')}</span>
              <span className="text-[10px] text-cdlp-muted uppercase mt-1">{t('rhFileTypesExtended')}</span>
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/jpg,image/png,text/csv,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
                disabled={uploading}
              />
            </label>
            {uploading ? <p className="text-center text-xs text-cdlp-gold mt-2">{t('posAnalyzing')}</p> : null}
          </div>
        )}

        {mode === 'csv' && !reading && (
          <div className="mb-6 space-y-4">
            {csvStep === 'pick' && (
              <>
                <label className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-cdlp-border rounded cursor-pointer hover:bg-cdlp-card">
                  <FileSpreadsheet className="w-6 h-6 text-cdlp-muted" />
                  <span className="text-xs font-bold uppercase text-cdlp-gold">{t('rhChooseCsv')}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const matrix = parseCsvText(await file.text());
                      const headers = matrix[0] || [];
                      setCsvMatrix(matrix);
                      setCsvHeaders(headers);
                      setCsvMapping(autoMapColumns(headers, columnDefs));
                      setCsvStep('map');
                    }}
                  />
                </label>
                <div className="ba-subpanel">
                  <p className="text-sm font-bold text-cdlp-gold mb-1">{t('rhCsvTemplates')}</p>
                  <p className="text-xs text-cdlp-muted mb-3">{t('rhCsvTemplatesDesc')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ba-filter-chip"
                      onClick={() => downloadTextFile('z-reading-template.csv', zReadingTemplateCsv())}
                    >
                      <Download className="w-3.5 h-3.5 inline mr-1" /> Z-reading
                    </button>
                    <button
                      type="button"
                      className="ba-filter-chip"
                      onClick={() => downloadTextFile('stripe-export-template.csv', stripeTemplateCsv())}
                    >
                      <Download className="w-3.5 h-3.5 inline mr-1" /> Stripe
                    </button>
                  </div>
                </div>
              </>
            )}

            {csvStep === 'map' && csvMatrix && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">
                      {t('rhDocType')}
                    </label>
                    <select
                      value={csvDocType}
                      onChange={(e) => {
                        const kind = e.target.value as ImportDocType;
                        setCsvDocType(kind);
                        setCsvMapping(autoMapColumns(csvHeaders, kind === 'z_reading' ? Z_READING_COLUMNS : STRIPE_COLUMNS));
                      }}
                      className="ba-verify-field"
                    >
                      <option value="z_reading">{t('rhDocZReading')}</option>
                      <option value="stripe_statement">{t('rhDocStripe')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('date')}</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ba-verify-field" />
                  </div>
                </div>
                <div className="ba-panel overflow-hidden p-0">
                  <div className="border-b border-cdlp-border px-3 py-2 text-xs font-bold uppercase text-cdlp-muted">
                    {t('rhMapCsv')}
                  </div>
                  <div className="divide-y divide-cdlp-border">
                    {columnDefs.map((col) => (
                      <div key={col.key} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 items-center">
                        <div>
                          <p className="text-sm font-medium">
                            {col.label}
                            {col.required ? <span className="text-red-400"> *</span> : null}
                          </p>
                          {col.hint ? <p className="text-xs text-cdlp-muted">{col.hint}</p> : null}
                        </div>
                        <select
                          value={csvMapping[col.key] == null ? '' : String(csvMapping[col.key])}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCsvMapping((prev) => {
                              const next = { ...prev };
                              if (v === '') delete next[col.key];
                              else next[col.key] = Number(v);
                              return next;
                            });
                          }}
                          className="ba-verify-field"
                        >
                          <option value="">{t('rhNotMapped')}</option>
                          {csvHeaders.map((h, idx) => (
                            <option key={idx} value={String(idx)}>
                              {h || `(column ${idx + 1})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                {missingCols.length > 0 ? (
                  <div className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/5 p-3 text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-400">{t('rhMapRequired')}</p>
                      <p className="text-xs text-cdlp-muted">{missingCols.map((c) => c.label).join(', ')}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setCsvStep('pick')} className="ba-filter-chip">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={missingCols.length > 0}
                    onClick={runCsvPreview}
                    className="ba-filter-chip ba-filter-chip--active"
                  >
                    {t('rhPreviewImport')}
                  </button>
                </div>
              </div>
            )}

            {csvStep === 'preview' && csvPreview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-cdlp-muted text-xs">{t('rhValidRows')}</p>
                    <p className="font-bold">{csvPreview.validRows}</p>
                  </div>
                  <div>
                    <p className="text-cdlp-muted text-xs">{t('rhIssues')}</p>
                    <p className="font-bold text-amber-400">{csvPreview.issues.length}</p>
                  </div>
                  <div>
                    <p className="text-cdlp-muted text-xs">{t('posGrossSales')}</p>
                    <p className="font-bold tabular-nums">{csvPreview.totals.gross.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-cdlp-muted text-xs">{t('posNetSales')}</p>
                    <p className="font-bold tabular-nums">{csvPreview.totals.net.toFixed(2)}</p>
                  </div>
                </div>
                {csvPreview.issues.length > 0 ? (
                  <ul className="text-xs text-amber-400 space-y-1 max-h-24 overflow-auto">
                    {csvPreview.issues.slice(0, 8).map((iss, i) => (
                      <li key={i}>
                        Row {iss.row}: {iss.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setCsvStep('map')} className="ba-filter-chip">
                    {t('rhBack')}
                  </button>
                  <button type="button" onClick={applyCsvPreview} className="ba-filter-chip ba-filter-chip--active">
                    {t('rhImportToBooks')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {(showEntryForm || reading) && mode === 'manual' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('date')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="ba-verify-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posGrossSalesChf')}</label>
                <input type="number" step="0.01" value={grossSales} onChange={(e) => setGrossSales(e.target.value)} required className="ba-verify-field" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posNetSalesChf')}</label>
                <input type="number" step="0.01" value={netSales} onChange={(e) => setNetSales(e.target.value)} required className="ba-verify-field" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posVatAmount')}</label>
              <input type="number" step="0.01" value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} required className="ba-verify-field" />
            </div>
            <div className="border-t border-cdlp-border pt-4">
              <h4 className="text-xs font-bold uppercase text-cdlp-gold mb-3">{t('posPaymentMethods')}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posCash')}</label>
                  <input type="number" step="0.01" value={cash} onChange={(e) => setCash(e.target.value)} required className="ba-verify-field" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posCard')}</label>
                  <input type="number" step="0.01" value={card} onChange={(e) => setCard(e.target.value)} required className="ba-verify-field" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posOther')}</label>
                  <input type="number" step="0.01" value={otherPayment} onChange={(e) => setOtherPayment(e.target.value)} className="ba-verify-field" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posTips')}</label>
                <input type="number" step="0.01" value={tips} onChange={(e) => setTips(e.target.value)} className="ba-verify-field" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posDiscounts')}</label>
                <input type="number" step="0.01" value={discounts} onChange={(e) => setDiscounts(e.target.value)} className="ba-verify-field" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posRefunds')}</label>
                <input type="number" step="0.01" value={refunds} onChange={(e) => setRefunds(e.target.value)} className="ba-verify-field" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-cdlp-muted mb-2">{t('posNotes')}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="ba-verify-field resize-none !h-auto min-h-[5rem] py-2" placeholder={t('posNotesPlaceholder')} />
            </div>
            <div className="flex gap-2 pt-4">
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cdlp-gold text-cdlp-black text-xs font-bold uppercase rounded hover:bg-cdlp-gold-light">
                <Save className="w-4 h-4" /> {reading ? t('posEditZReading') : t('posAddZReading')}
              </button>
              {!inline ? (
                <button type="button" onClick={onClose} className="px-6 py-2.5 border border-cdlp-border text-xs font-bold uppercase rounded hover:bg-cdlp-border/50 text-white">
                  {t('cancel')}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
