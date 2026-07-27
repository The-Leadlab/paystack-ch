/** Revenue analytics — live sums, cash, profit, reconciliation, insights (no UI). */

export type IncomeRow = {
  date: string;
  amount: number;
  type?: string;
  description?: string;
};

export type ExpenseRow = {
  date: string;
  amount: number;
  category?: string;
  description?: string;
};

export type PosReadingRow = {
  id: string;
  date: string;
  gross_sales: number;
  net_sales: number;
  cash: number;
  card: number;
  other_payment: number;
  tips: number;
  notes?: string;
};

export type PosTotals = {
  gross: number;
  net: number;
  cash: number;
  card: number;
  other: number;
  tips: number;
  count: number;
};

export type ReconciliationItem = {
  id: string;
  kind: 'variance' | 'missing_z' | 'duplicate_day' | 'pos_vs_bank' | 'cash_drawer' | 'unmatched' | 'pending_deposit';
  label: string;
  description: string;
  amount: number;
};

export type RevenueInsight = {
  id: string;
  tone: 'info' | 'warn' | 'positive';
  title: string;
  body: string;
};

export type CashPosition = {
  total: number;
  inBank: number;
  onHand: number;
  incoming: number;
  pendingDeposits: number;
};

export type Profitability = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  avgTransaction: number;
  txCount: number;
};

export type PaymentMix = {
  cash: number;
  card: number;
  other: number;
  gross: number;
  fromPos: boolean;
};

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return toIsoDate(dt);
}

export function monthBounds(iso: string): { start: string; end: string } {
  const [y, m] = iso.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, m || 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function sumInRange(rows: IncomeRow[], start: string, end: string): number {
  return rows.reduce((sum, row) => {
    if (row.date < start || row.date > end) return sum;
    return sum + row.amount;
  }, 0);
}

export function sumExpensesInRange(rows: ExpenseRow[], start: string, end: string): number {
  return rows.reduce((sum, row) => {
    if (row.date < start || row.date > end) return sum;
    return sum + row.amount;
  }, 0);
}

/** COGS proxy: supplier + other variable spend (excludes payroll/bills). */
export function sumCogsInRange(rows: ExpenseRow[], start: string, end: string): number {
  return rows.reduce((sum, row) => {
    if (row.date < start || row.date > end) return sum;
    const cat = (row.category || '').toUpperCase();
    if (cat === 'SUPPLIERS' || cat === 'OTHER') return sum + row.amount;
    return sum;
  }, 0);
}

export function sumPosInRange(readings: PosReadingRow[], start: string, end: string): PosTotals {
  const inRange = readings.filter((r) => r.date >= start && r.date <= end);
  return {
    gross: inRange.reduce((s, r) => s + r.gross_sales, 0),
    net: inRange.reduce((s, r) => s + r.net_sales, 0),
    cash: inRange.reduce((s, r) => s + r.cash, 0),
    card: inRange.reduce((s, r) => s + r.card, 0),
    other: inRange.reduce((s, r) => s + r.other_payment, 0),
    tips: inRange.reduce((s, r) => s + r.tips, 0),
    count: inRange.length,
  };
}

export function monthlyBudgetTarget(income: IncomeRow[], anchorIso: string): number {
  const totals: number[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = addDaysIso(anchorIso, -i * 28);
    const { start, end } = monthBounds(d);
    totals.push(sumInRange(income, start, end));
  }
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  if (avg > 0) return avg;
  const { start, end } = monthBounds(anchorIso);
  return sumInRange(income, start, end);
}

export function buildCashPosition(
  income: IncomeRow[],
  readings: PosReadingRow[],
  today: string
): CashPosition {
  const ytdStart = `${today.slice(0, 4)}-01-01`;
  const posYtd = sumPosInRange(readings, ytdStart, today);
  const incomeYtd = sumInRange(income, ytdStart, today);

  const fromPos = posYtd.count > 0;
  const inBank = fromPos ? posYtd.card : incomeYtd * 0.55;
  const onHand = fromPos ? posYtd.cash : incomeYtd * 0.15;

  const incoming = income
    .filter((i) => i.type === 'RESERVATION')
    .reduce((s, i) => s + i.amount, 0);

  const recentStart = addDaysIso(today, -7);
  const recentCash = sumPosInRange(readings, recentStart, today).cash;
  const pendingDeposits = fromPos ? recentCash * 0.35 : Math.max(0, onHand * 0.2);

  const total = inBank + onHand + incoming + pendingDeposits;
  return { total, inBank, onHand, incoming, pendingDeposits };
}

export function buildProfitability(
  income: IncomeRow[],
  expenses: ExpenseRow[],
  monthStart: string,
  monthEnd: string
): Profitability {
  const revenue = sumInRange(income, monthStart, monthEnd);
  const cogs = sumCogsInRange(expenses, monthStart, monthEnd);
  const grossProfit = revenue - cogs;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const txCount = income.filter((i) => i.date >= monthStart && i.date <= monthEnd).length;
  const avgTransaction = txCount > 0 ? revenue / txCount : 0;
  return { revenue, cogs, grossProfit, marginPct, avgTransaction, txCount };
}

export function buildPaymentMix(
  readings: PosReadingRow[],
  income: IncomeRow[],
  monthStart: string,
  monthEnd: string
): PaymentMix {
  const pos = sumPosInRange(readings, monthStart, monthEnd);
  if (pos.count > 0) {
    return {
      cash: pos.cash,
      card: pos.card,
      other: pos.other,
      gross: pos.gross,
      fromPos: true,
    };
  }
  const rev = sumInRange(income, monthStart, monthEnd);
  if (rev <= 0) {
    return { cash: 0, card: 0, other: 0, gross: 0, fromPos: false };
  }
  return {
    cash: rev * 0.4,
    card: rev * 0.55,
    other: rev * 0.05,
    gross: rev,
    fromPos: false,
  };
}

export function buildReconciliation(
  income: IncomeRow[],
  readings: PosReadingRow[],
  monthStart: string,
  monthEnd: string,
  today: string
): { variance: number; items: ReconciliationItem[]; openCount: number } {
  const items: ReconciliationItem[] = [];
  const incomeTotal = sumInRange(income, monthStart, monthEnd);
  const posMonth = sumPosInRange(readings, monthStart, monthEnd);
  const variance = incomeTotal - posMonth.gross;

  if (Math.abs(variance) > 1) {
    items.push({
      id: 'variance-month',
      kind: 'variance',
      label: 'Pos Vs Ledger',
      description: 'Income ledger vs Z-reading gross (this month)',
      amount: variance,
    });
  }

  const incomeByDay = new Map<string, number>();
  for (const row of income) {
    if (row.date < monthStart || row.date > monthEnd) continue;
    incomeByDay.set(row.date, (incomeByDay.get(row.date) || 0) + row.amount);
  }

  const posByDay = new Map<string, PosReadingRow[]>();
  for (const r of readings) {
    if (r.date < monthStart || r.date > monthEnd) continue;
    const list = posByDay.get(r.date) || [];
    list.push(r);
    posByDay.set(r.date, list);
  }

  for (const [day, amt] of incomeByDay) {
    const dayPos = posByDay.get(day);
    if (!dayPos?.length) {
      if (amt > 50) {
        items.push({
          id: `missing-z-${day}`,
          kind: 'missing_z',
          label: 'Missing Z',
          description: `Income on ${day} without Z-reading`,
          amount: amt,
        });
      }
      continue;
    }
    const posGross = dayPos.reduce((s, r) => s + r.gross_sales, 0);
    const dayVar = amt - posGross;
    if (Math.abs(dayVar) > 1) {
      items.push({
        id: `day-var-${day}`,
        kind: 'cash_drawer',
        label: 'Cash Drawer',
        description: `Cash drawer variance — ${day}`,
        amount: dayVar,
      });
    }
  }

  for (const [day, list] of posByDay) {
    if (list.length > 1) {
      items.push({
        id: `dup-${day}`,
        kind: 'duplicate_day',
        label: 'Duplicate',
        description: `${list.length} Z-readings on ${day}`,
        amount: 0,
      });
    }
    const dayIncome = incomeByDay.get(day) || 0;
    const card = list.reduce((s, r) => s + r.card, 0);
    if (dayIncome < 1 && card > 1) {
      items.push({
        id: `unmatched-${day}`,
        kind: 'unmatched',
        label: 'Unmatched',
        description: `Card settlement without matching sale — ${day}`,
        amount: card,
      });
    }
  }

  const recentStart = addDaysIso(today, -7);
  const recentCash = sumPosInRange(readings, recentStart, today).cash;
  if (recentCash > 50) {
    items.push({
      id: 'pending-deposit',
      kind: 'pending_deposit',
      label: 'Pending Deposit',
      description: 'Weekend / recent cash pickup pending',
      amount: Math.round(recentCash * 0.35 * 100) / 100,
    });
  }

  if (posMonth.card > 0 && Math.abs(variance) > 100) {
    items.push({
      id: 'pos-vs-bank',
      kind: 'pos_vs_bank',
      label: 'Pos Vs Bank',
      description: 'POS card totals not yet matched to bank/ledger',
      amount: Math.min(posMonth.card * 0.1, Math.abs(variance)),
    });
  }

  const unique = items.slice(0, 12);
  const openVariance = unique.reduce((s, i) => s + Math.abs(i.amount), 0);
  return {
    variance: openVariance || Math.abs(variance),
    items: unique,
    openCount: unique.length,
  };
}

export function buildInsights(opts: {
  revToday: number;
  revWeek: number;
  revPrevWeek: number;
  revMonth: number;
  budgetMonth: number;
  reconciliationOpen: number;
  reconciliationVariance: number;
  posCount: number;
  incomeCount: number;
  incomingInvoices: number;
  cashOnHand: number;
}): RevenueInsight[] {
  const out: RevenueInsight[] = [];
  const growth =
    opts.revPrevWeek > 0
      ? ((opts.revWeek - opts.revPrevWeek) / opts.revPrevWeek) * 100
      : opts.revWeek > 0
        ? 100
        : 0;

  if (opts.incomingInvoices > 0) {
    out.push({
      id: 'invoices',
      tone: 'info',
      title: 'Outstanding invoices',
      body: `${opts.incomingInvoices.toFixed(0)} CHF in reservation/invoice income expected to hit cash.`,
    });
  }

  if (opts.reconciliationOpen > 0) {
    out.push({
      id: 'recon',
      tone: 'warn',
      title: 'Reconciliation exceptions',
      body: `${opts.reconciliationOpen} item(s) need review (${opts.reconciliationVariance.toFixed(0)} CHF variance).`,
    });
  }

  if (growth >= 5) {
    out.push({
      id: 'growth',
      tone: 'positive',
      title: 'Week-over-week momentum',
      body: `Revenue is up ${growth.toFixed(1)}% vs last week.`,
    });
  } else if (growth <= -5 && opts.revWeek > 0) {
    out.push({
      id: 'decline',
      tone: 'warn',
      title: 'Week-over-week dip',
      body: `Revenue is down ${Math.abs(growth).toFixed(1)}% vs last week.`,
    });
  }

  if (opts.budgetMonth > 0 && opts.revMonth > 0) {
    const pct = (opts.revMonth / opts.budgetMonth) * 100;
    if (pct < 85) {
      out.push({
        id: 'budget-behind',
        tone: 'warn',
        title: 'Behind monthly pace',
        body: `Month revenue is at ${pct.toFixed(0)}% of your trailing average target.`,
      });
    } else if (pct >= 100) {
      out.push({
        id: 'budget-ahead',
        tone: 'positive',
        title: 'On or above target',
        body: `Month revenue reached ${pct.toFixed(0)}% of your trailing average target.`,
      });
    }
  }

  if (opts.cashOnHand > 500) {
    out.push({
      id: 'cash-hand',
      tone: 'info',
      title: 'Cash on hand',
      body: `${opts.cashOnHand.toFixed(0)} CHF sitting in drawer — schedule a deposit.`,
    });
  }

  if (opts.incomeCount > 0 && opts.posCount === 0) {
    out.push({
      id: 'no-z',
      tone: 'info',
      title: 'No Z-readings yet',
      body: 'Import or auto-generate a Z-reading to reconcile POS totals with your income ledger.',
    });
  }

  if (opts.revToday > 0 && out.length === 0) {
    out.push({
      id: 'ok',
      tone: 'info',
      title: 'Revenue engine active',
      body: 'Today has recorded income. Keep Z-readings in sync for clean month-end close.',
    });
  }

  return out.slice(0, 5);
}

export function trendLast30Days(income: IncomeRow[], today: string, locale: string) {
  const days: { date: string; label: string; amount: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const iso = addDaysIso(today, -i);
    const d = new Date(iso + 'T12:00:00');
    days.push({
      date: iso,
      label: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      amount: sumInRange(income, iso, iso),
    });
  }
  return days;
}

/** Description used when a Z-reading is synced into the income ledger. */
export function zReadingIncomeDescription(date: string): string {
  return `Z-reading ${date}`;
}

export function findIncomeForZReading(income: IncomeRow[], date: string): IncomeRow | undefined {
  const needle = zReadingIncomeDescription(date).toLowerCase();
  return income.find((i) => i.date === date && (i.description || '').toLowerCase().includes(needle));
}
