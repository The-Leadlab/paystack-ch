import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ExternalLink,
  FileText,
  History,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Wallet,
  X,
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
import { useFinance } from '../context/FinanceContext';
import { useSession } from '../context/SessionContext';
import { useDocuments } from '../context/DocumentContext';
import { useChfLocale, useLanguage } from '../context/LanguageContext';
import { filterBusinessExpenses } from '../lib/personalBleedFilter';
import { formatInsightText, localizeLedgerDescription } from '../lib/localizeLedgerCopy';
import {
  addDaysIso,
  buildCategoryMix,
  buildExpenseDemoSeeds,
  buildExpenseInsights,
  buildProfitability,
  buildTopVendors,
  EXPENSE_CATEGORY_FILTERS,
  filterExpensesByCategory,
  isExpenseDemoDescription,
  monthlyExpenseBudgetTarget,
  priorPeriodBounds,
  REVENUE_INTERVALS,
  resolveExpenseInterval,
  sumExpensesInRange,
  toIsoDate,
  trendAxisTickDates,
  trendExpensesForRange,
  type LedgerExpenseCategory,
  type RevenueIntervalId,
} from '../lib/expenseAnalytics';
import {
  loadExpenseActivity,
  pushExpenseActivity,
  type ExpenseActivity,
} from '../lib/expenseActivityHistory';
import { BusinessKpiCard } from './BusinessKpiCard';
import { RevenueLedgerTable } from './RevenueLedgerTable';
import type { BusinessTab } from './BusinessSidebarNav';
import type { ProcessedDocument } from '../types';
import '../businessApp.css';

const CHART_RED = '#f87171';
const CAT_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a78bfa', '#60a5fa', '#34d399'];

export function ExpensesManager({
  onNavigateTab,
  onNavigateToDocument,
}: {
  onNavigateTab?: (tab: BusinessTab) => void;
  onNavigateToDocument?: (doc: ProcessedDocument) => void;
}) {
  const { income, expenses, addExpense, deleteExpense, updateExpense } = useFinance();
  const { documents } = useDocuments();
  const { currentSession, isAllSessionsView, sessions } = useSession();
  const { t } = useLanguage();
  const chfLocale = useChfLocale();

  const [categoryFilter, setCategoryFilter] = useState<LedgerExpenseCategory | 'ALL'>('ALL');
  const [intervalId, setIntervalId] = useState<RevenueIntervalId>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hubTab, setHubTab] = useState<'trend' | 'categories' | 'documents'>('trend');
  const [docVisible, setDocVisible] = useState(10);
  const [demoLoading, setDemoLoading] = useState(false);
  const [activity, setActivity] = useState<ExpenseActivity[]>(() => loadExpenseActivity());
  const [activityVisible, setActivityVisible] = useState(10);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addCategory, setAddCategory] = useState<LedgerExpenseCategory>('BILLS');
  const [addAmount, setAddAmount] = useState('');
  const [addDescription, setAddDescription] = useState('');

  const addFormRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);

  const existingSessionIds = sessions.map((s) => s.id);

  const filteredExpenses = filterBusinessExpenses(
    isAllSessionsView
      ? expenses.filter((e) => existingSessionIds.includes(e.session_id))
      : expenses.filter((e) => e.session_id === currentSession?.id)
  );

  const filteredIncome = isAllSessionsView
    ? income.filter((i) => existingSessionIds.includes(i.session_id))
    : income.filter((i) => i.session_id === currentSession?.id);

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

  const categoryRows = useMemo(
    () => filterExpensesByCategory(expenseRows, categoryFilter),
    [expenseRows, categoryFilter]
  );

  const today = toIsoDate(new Date());
  const range = useMemo(
    () =>
      resolveExpenseInterval(
        intervalId,
        today,
        categoryRows,
        intervalId === 'custom' ? { start: customStart || today, end: customEnd || today } : null
      ),
    [intervalId, today, categoryRows, customStart, customEnd]
  );
  const { start: rangeStart, end: rangeEnd } = range;

  useEffect(() => {
    if (intervalId === 'custom') return;
    setCustomStart(rangeStart);
    setCustomEnd(rangeEnd);
  }, [intervalId, rangeStart, rangeEnd]);

  const prior = useMemo(() => priorPeriodBounds(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const periodExpenseRows = useMemo(
    () => categoryRows.filter((r) => r.date >= rangeStart && r.date <= rangeEnd),
    [categoryRows, rangeStart, rangeEnd]
  );

  const spendPeriod = sumExpensesInRange(categoryRows, rangeStart, rangeEnd);
  const spendPrior = sumExpensesInRange(categoryRows, prior.start, prior.end);
  const spendToday = sumExpensesInRange(categoryRows, today, today);
  const growthPct =
    spendPrior > 0 ? ((spendPeriod - spendPrior) / spendPrior) * 100 : spendPeriod > 0 ? 100 : 0;

  let periodDays = 0;
  for (let iso = rangeStart; iso <= rangeEnd; iso = addDaysIso(iso, 1)) periodDays += 1;
  const dailyAvg = periodDays > 0 ? spendPeriod / periodDays : 0;

  const budgetMonth = monthlyExpenseBudgetTarget(categoryRows, today);
  const budgetPct = budgetMonth > 0 ? Math.min(150, (spendPeriod / budgetMonth) * 100) : 0;

  const profit = buildProfitability(incomeRows, categoryRows, rangeStart, rangeEnd);
  const categoryMix = useMemo(
    () => buildCategoryMix(categoryRows, rangeStart, rangeEnd),
    [categoryRows, rangeStart, rangeEnd]
  );
  const topVendors = useMemo(
    () => buildTopVendors(categoryRows, rangeStart, rangeEnd, 8),
    [categoryRows, rangeStart, rangeEnd]
  );

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
      category: string;
      expenseId?: string;
      doc?: ProcessedDocument;
    };
    const byKey = new Map<string, Row>();

    for (const row of filteredExpenses) {
      if (row.date < rangeStart || row.date > rangeEnd) continue;
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) continue;
      const doc = findDocument(row.document_id);
      byKey.set(`expense:${row.id}`, {
        key: `expense:${row.id}`,
        date: row.date,
        amount: row.amount,
        description: row.description || '',
        category: row.category,
        expenseId: row.id,
        doc,
      });
    }

    return Array.from(byKey.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [filteredExpenses, rangeStart, rangeEnd, categoryFilter, documents]);

  const docsWithFile = periodDocs.filter((d) => d.doc).length;
  const visibleDocs = periodDocs.slice(0, docVisible);
  const docsRemaining = Math.max(0, periodDocs.length - docVisible);

  const insights = buildExpenseInsights({
    spendPeriod,
    spendPrior,
    spendMonth: spendPeriod,
    budgetMonth,
    expenseCount: periodExpenseRows.length,
    docsLinked: docsWithFile,
    topCategory: categoryMix[0]?.category,
    topCategoryPct: categoryMix[0]?.pct,
  });

  const trendData = useMemo(
    () => trendExpensesForRange(categoryRows, rangeStart, rangeEnd, chfLocale),
    [categoryRows, rangeStart, rangeEnd, chfLocale]
  );
  const trendTickDates = useMemo(
    () => trendAxisTickDates(trendData.map((d) => d.date), 6),
    [trendData]
  );
  const trendRangeLabel =
    rangeStart && rangeEnd ? `${fmtDateLong(rangeStart)} → ${fmtDateLong(rangeEnd)}` : '';

  useEffect(() => {
    setDocVisible(10);
  }, [intervalId, categoryFilter, hubTab, customStart, customEnd]);

  const hasTransactions = categoryRows.length > 0;
  const flowBase = Math.max(spendPeriod, dailyAvg, 1);
  const visibleActivity = activity.slice(0, activityVisible);
  const activityRemaining = Math.max(0, activity.length - activityVisible);

  const logActivity = (entry: Omit<ExpenseActivity, 'id' | 'at'> & { at?: string }) => {
    setActivity(pushExpenseActivity(entry));
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleInsightClick = (action?: string) => {
    if (action === 'categories') setHubTab('categories');
    else if (action === 'documents') {
      setHubTab('documents');
      scrollTo(docsRef);
    } else if (action === 'add_expense') {
      setShowAddForm(true);
      scrollTo(addFormRef);
    }
  };

  const handleCategoryChange = async (expenseId: string, category: LedgerExpenseCategory) => {
    await updateExpense(expenseId, { category });
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(String(addAmount).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || !currentSession?.id) return;
    await addExpense(addDate, addCategory, amount, addDescription || t('ehManualEntry'), currentSession.id);
    logActivity({
      type: 'expense_add',
      label: t('ehActivityAdd'),
      detail: `${addCategory} · ${addDescription || t('ehManualEntry')}`,
      amountChf: amount,
    });
    setAddAmount('');
    setAddDescription('');
    setShowAddForm(false);
  };

  const chunk = async <T,>(items: T[], size: number, fn: (item: T) => Promise<unknown>) => {
    for (let i = 0; i < items.length; i += size) {
      const slice = items.slice(i, i + size);
      await Promise.all(slice.map(fn));
    }
  };

  const loadDemoData = async () => {
    if (!currentSession?.id || demoLoading) return;
    setDemoLoading(true);
    try {
      const seeds = buildExpenseDemoSeeds(today);
      await chunk(seeds, 8, (exp) =>
        addExpense(exp.date, exp.category, exp.amount, exp.description, currentSession.id)
      );
      const total = seeds.reduce((s, e) => s + e.amount, 0);
      logActivity({
        type: 'demo_load',
        label: t('ehActivityDemoLoad'),
        detail: `${seeds.length} ${t('ehEntries')}`,
        amountChf: total,
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const refreshDemoData = async () => {
    if (!currentSession?.id || demoLoading) return;
    setDemoLoading(true);
    try {
      const demoIds = filteredExpenses.filter((e) => isExpenseDemoDescription(e.description)).map((e) => e.id);
      for (const id of demoIds) await deleteExpense(id);
      const seeds = buildExpenseDemoSeeds(today);
      await chunk(seeds, 8, (exp) =>
        addExpense(exp.date, exp.category, exp.amount, exp.description, currentSession.id)
      );
      logActivity({
        type: 'demo_refresh',
        label: t('ehActivityDemoRefresh'),
        detail: t('ehDemoRefreshing'),
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const categoryLabel = (cat: string) => {
    const known = ['BILLS', 'SUPPLIERS', 'PAYROLL', 'PAYROLL_TAXES', 'OTHER'];
    if (known.includes(cat)) return t(cat);
    return cat;
  };

  const mixChartData = categoryMix.map((c) => ({
    name: categoryLabel(c.category),
    amount: c.amount,
    pct: c.pct,
  }));

  const ledgerExpenses = filteredExpenses.filter(
    (e) =>
      e.date >= rangeStart &&
      e.date <= rangeEnd &&
      (categoryFilter === 'ALL' || e.category === categoryFilter)
  );

  return (
    <div className="ba-expense-stack ba-revenue-stack">
      <div className="ba-expense-toolbar ba-revenue-toolbar">
        <div className="ba-expense-toolbar__cats ba-revenue-toolbar__sectors">
          {EXPENSE_CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`ba-sector-pill ${categoryFilter === cat.id ? 'ba-sector-pill--active' : ''}`}
              onClick={() => {
                setCategoryFilter(cat.id);
                logActivity({
                  type: 'category_filter',
                  label: t('ehActivityFilter'),
                  detail: t(cat.labelKey),
                });
              }}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
        <div className="ba-revenue-toolbar__actions">
          <button
            type="button"
            className="ba-revenue-link-btn"
            onClick={() => {
              setShowAddForm(true);
              scrollTo(addFormRef);
            }}
          >
            <Plus className="w-3.5 h-3.5" /> {t('ehAddExpense')}
          </button>
          <button type="button" className="ba-expense-cta ba-revenue-cta" onClick={() => onNavigateTab?.('documents')}>
            <FileText className="w-4 h-4" /> {t('ehUploadDocs')}
          </button>
        </div>
      </div>

      <div className="ba-revenue-secondary">
        <button type="button" className="ba-revenue-link-btn" onClick={() => scrollTo(activityRef)}>
          <History className="w-3.5 h-3.5" /> {t('ehImportHistory')}
        </button>
        <button
          type="button"
          className="ba-revenue-link-btn"
          disabled={demoLoading}
          onClick={() => void refreshDemoData()}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${demoLoading ? 'animate-spin' : ''}`} /> {t('rhRefreshDemo')}
        </button>
        <button
          type="button"
          className="ba-revenue-link-btn"
          disabled={demoLoading}
          onClick={() => void loadDemoData()}
        >
          {t('rhLoadDemo')}
        </button>
      </div>

      <div className="ba-expense-hero ba-revenue-hero">
        <div>
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('ehOverview')}</p>
          <h1 className="ba-revenue-hero__title">{t('ehPeriodAtGlance')}</h1>
          <p className="text-[10px] text-cdlp-muted mt-1 uppercase tracking-wide">{trendRangeLabel}</p>
        </div>
        <div className="ba-revenue-hero__today">
          <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('ehPeriodTotal')}</p>
          <p className="text-2xl md:text-3xl font-bold text-red-400 tabular-nums">{fmtChf(spendPeriod)}</p>
        </div>
      </div>

      {!hasTransactions ? (
        <div className="ba-revenue-empty-banner">
          <p className="text-sm text-cdlp-muted max-w-xl">{t('ehEmptyBanner')}</p>
          <button
            type="button"
            className="ba-expense-cta ba-revenue-cta"
            disabled={demoLoading}
            onClick={() => void loadDemoData()}
          >
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
          label={t('ehKpiPeriod')}
          value={fmt(spendPeriod)}
          icon={Wallet}
          tone="red"
          progressPct={(spendPeriod / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('ehKpiVsPrior')}
          value={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%`}
          hint={t('rhVsPriorPeriod')}
          icon={CalendarDays}
          tone={growthPct > 5 ? 'red' : 'green'}
          progressPct={Math.min(100, Math.abs(growthPct))}
        />
        <BusinessKpiCard
          label={t('ehKpiDailyAvg')}
          value={fmt(dailyAvg)}
          icon={CalendarRange}
          tone="blue"
          progressPct={(dailyAvg / flowBase) * 100}
        />
        <BusinessKpiCard
          label={t('ehKpiEntries')}
          value={String(periodExpenseRows.length)}
          hint={t('rhDocsLinked').replace('{n}', String(docsWithFile))}
          icon={TrendingDown}
          tone="gold"
          progressPct={periodExpenseRows.length ? 70 : 0}
        />
      </div>

      <div className="ba-hub-tabs" role="tablist" aria-label={t('ehHubTabs')}>
        {(
          [
            { id: 'trend' as const, label: t('ehTabTrend') },
            { id: 'categories' as const, label: t('ehTabCategories') },
            { id: 'documents' as const, label: t('ehTabDocuments') },
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
                  <p className="text-xs text-cdlp-muted uppercase tracking-wide">{t('ehSpendTrend')}</p>
                  <p className="text-lg font-bold text-white tabular-nums">
                    {fmtChf(spendPeriod)}{' '}
                    <span className="text-xs text-cdlp-muted font-normal">{t('rhInFilter')}</span>
                  </p>
                  {trendRangeLabel ? (
                    <p className="text-[10px] text-cdlp-muted mt-1 uppercase tracking-wide">
                      {t('rhTrendRange').replace('{range}', trendRangeLabel)}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`text-xs font-bold tabular-nums ${growthPct > 0 ? 'text-red-400' : 'text-emerald-400'}`}
                >
                  {growthPct >= 0 ? '+' : ''}
                  {growthPct.toFixed(1)}% {t('rhVsPriorShort')}
                </span>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_RED} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_RED} stopOpacity={0.02} />
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
                      }}
                      formatter={(value: number | string) => [fmtChf(Number(value)), t('ehSpend')]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={CHART_RED}
                      fill="url(#expTrendFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ba-panel ba-revenue-stat-panel">
              <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehBudgetActual')}</h2>
              <p className="ba-revenue-stat-panel__value tabular-nums text-red-400">{fmtChf(spendPeriod)}</p>
              <p className="text-xs text-cdlp-muted mb-3">
                {t('rhOfTarget').replace('{v}', fmtChf(budgetMonth))}
              </p>
              <div className="ba-kpi-track mb-4">
                <div
                  className={`ba-kpi-fill ${budgetPct > 100 ? 'bg-red-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('ehToday')}</span>
                <span>{fmtChf(spendToday)}</span>
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('ehPace')}</span>
                <span>{budgetPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 mt-4">
            <div className="ba-panel ba-revenue-stat-panel">
              <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehSpendBuckets')}</h2>
              <p className="ba-revenue-stat-panel__value tabular-nums text-red-400">
                {fmtChf(profit.totalExpenses)}
              </p>
              <div className="ba-revenue-stat-row">
                <span>{t('rhCogs')}</span>
                <span>{fmtChf(profit.cogs)}</span>
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('rhOperating')}</span>
                <span>{fmtChf(profit.operating)}</span>
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('rhPayrollCost')}</span>
                <span>{fmtChf(profit.payroll)}</span>
              </div>
            </div>

            <div className="ba-panel ba-revenue-stat-panel">
              <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehProfitStrip')}</h2>
              <p
                className={`ba-revenue-stat-panel__value tabular-nums ${
                  profit.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {fmtChf(profit.netProfit)}
              </p>
              <div className="ba-revenue-stat-row">
                <span>{t('income')}</span>
                <span>{fmtChf(profit.revenue)}</span>
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('expenses')}</span>
                <span>{fmtChf(profit.totalExpenses)}</span>
              </div>
              <div className="ba-revenue-stat-row">
                <span>{t('rhMargin')}</span>
                <span>{profit.marginPct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="ba-panel">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-cdlp-gold" />
                <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('ehAiInsights')}</h2>
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
                        <p className="font-bold text-[var(--ba-text,#fff)]">
                          {formatInsightText(ins.titleKey, t, ins.params)}
                        </p>
                        <p className="text-xs text-cdlp-muted mt-1">
                          {formatInsightText(ins.bodyKey, t, ins.params)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      {hubTab === 'categories' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ba-panel">
            <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehCategoryMix')}</h2>
            <p className="text-xs text-cdlp-muted mb-4">{trendRangeLabel}</p>
            {mixChartData.length === 0 ? (
              <p className="text-sm text-cdlp-muted py-8 text-center">{t('ehNoCategoryData')}</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mixChartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid stroke="#3d4450" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa0a6' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: '#2d3238',
                        border: '1px solid #3d4450',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number | string) => [fmtChf(Number(value)), t('ehSpend')]}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {mixChartData.map((_, i) => (
                        <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="mt-4 space-y-2">
              {categoryMix.map((c) => (
                <li key={c.category} className="ba-revenue-stat-row">
                  <span>{categoryLabel(c.category)}</span>
                  <span className="tabular-nums">
                    {fmtChf(c.amount)} · {c.pct.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ba-panel">
            <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehTopVendors')}</h2>
            <p className="text-xs text-cdlp-muted mb-4">{t('ehTopVendorsDesc')}</p>
            {topVendors.length === 0 ? (
              <p className="text-sm text-cdlp-muted py-8 text-center">{t('ehNoCategoryData')}</p>
            ) : (
              <ul className="space-y-3">
                {topVendors.map((v) => (
                  <li
                    key={v.description}
                    className="flex items-center justify-between gap-3 rounded-lg border border-cdlp-border/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{v.description}</p>
                      <p className="text-[10px] text-cdlp-muted uppercase mt-1">
                        {v.count} {t('ehEntries')}
                      </p>
                    </div>
                    <span className="tabular-nums font-bold text-red-400 shrink-0">{fmtChf(v.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {hubTab === 'documents' ? (
        <div className="ba-panel ba-revenue-docs" ref={docsRef}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('ehTabDocuments')}</h2>
              <p className="text-xs text-cdlp-muted mt-1">
                {t('rhDocsTableHint')
                  .replace('{n}', String(periodDocs.length))
                  .replace('{range}', trendRangeLabel || '—')}
              </p>
            </div>
          </div>
          {periodDocs.length === 0 ? (
            <p className="text-sm text-cdlp-muted py-8 text-center">{t('ehDocsEmpty')}</p>
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
                    {visibleDocs.map((entry) => (
                      <tr key={entry.key}>
                        <td className="whitespace-nowrap">{fmtDate(entry.date)}</td>
                        <td>
                          {entry.expenseId ? (
                            <select
                              className="ba-verify-field ba-revenue-docs__category"
                              value={entry.category}
                              onChange={(e) => {
                                if (entry.expenseId) {
                                  void handleCategoryChange(
                                    entry.expenseId,
                                    e.target.value as LedgerExpenseCategory
                                  );
                                }
                              }}
                            >
                              {(['BILLS', 'SUPPLIERS', 'PAYROLL', 'PAYROLL_TAXES', 'OTHER'] as const).map(
                                (id) => (
                                  <option key={id} value={id}>
                                    {t(id)}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <span>{categoryLabel(entry.category)}</span>
                          )}
                        </td>
                        <td
                          className="max-w-[14rem] truncate"
                          title={localizeLedgerDescription(entry.description, t) || undefined}
                        >
                          {localizeLedgerDescription(entry.description, t) || '—'}
                        </td>
                        <td className="text-right tabular-nums font-bold text-red-400">
                          {fmtChf(entry.amount)}
                        </td>
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
                    ))}
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

      <div ref={addFormRef} className="mt-4">
        {showAddForm ? (
          <div className="ba-panel">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-black uppercase text-cdlp-gold">{t('addExpenseTitle')}</h2>
              <button type="button" className="ba-revenue-link-btn" onClick={() => setShowAddForm(false)}>
                <X className="w-3.5 h-3.5" /> {t('cancel')}
              </button>
            </div>
            <form onSubmit={(e) => void handleAddExpense(e)} className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-bold uppercase text-cdlp-muted">
                {t('date')}
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-cdlp-muted">
                {t('category')}
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as LedgerExpenseCategory)}
                  className="mt-1 w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                >
                  {(['BILLS', 'SUPPLIERS', 'PAYROLL', 'PAYROLL_TAXES', 'OTHER'] as const).map((id) => (
                    <option key={id} value={id}>
                      {t(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase text-cdlp-muted">
                {t('amount')}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-cdlp-muted">
                {t('description')}
                <input
                  type="text"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-cdlp-card border border-cdlp-border rounded text-sm text-white"
                />
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="ba-expense-cta ba-revenue-cta">
                  <Plus className="w-4 h-4" /> {t('ehAddExpense')}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>

      <RevenueLedgerTable income={[]} expenses={ledgerExpenses} expensesOnly />

      <div className="ba-panel" ref={activityRef}>
        <h2 className="text-sm font-black uppercase text-cdlp-gold mb-2">{t('ehActivityHistory')}</h2>
        <p className="text-xs text-cdlp-muted mb-4">{t('ehActivityHistoryDesc')}</p>
        {activity.length === 0 ? (
          <p className="text-sm text-cdlp-muted">{t('ehActivityEmpty')}</p>
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
                      <span className="tabular-nums font-bold text-red-400">{fmtChf(item.amountChf)}</span>
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
    </div>
  );
}
