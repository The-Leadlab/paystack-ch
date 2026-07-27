import { addDaysIso } from './revenueAnalytics';

export const DEMO_TAG = '[DEMO]';

export type DemoIncomeSeed = {
  date: string;
  amount: number;
  description: string;
  type: 'SALES' | 'RESERVATION';
};

export type DemoExpenseSeed = {
  date: string;
  amount: number;
  category: 'SUPPLIERS' | 'OTHER';
  description: string;
};

export type DemoZSeed = {
  date: string;
  gross_sales: number;
  net_sales: number;
  vat_amount: number;
  cash: number;
  card: number;
  other_payment: number;
  tips: number;
  discounts: number;
  refunds: number;
  notes: string;
};

/** ~30 days of multi-sector income + matching Z-readings + supplier COGS. */
export function buildDemoSeeds(anchorIso: string): {
  income: DemoIncomeSeed[];
  expenses: DemoExpenseSeed[];
  zReadings: DemoZSeed[];
} {
  const income: DemoIncomeSeed[] = [];
  const expenses: DemoExpenseSeed[] = [];
  const zReadings: DemoZSeed[] = [];

  const lines: { tag: string; weight: number }[] = [
    { tag: 'Service labour', weight: 0.08 },
    { tag: 'Parts repair', weight: 0.06 },
    { tag: 'Room booking', weight: 0.08 },
    { tag: 'F&B breakfast', weight: 0.05 },
    { tag: 'Consulting advisory', weight: 0.07 },
    { tag: 'Food dine-in', weight: 0.08 },
    { tag: 'Beverage bar', weight: 0.05 },
    { tag: 'Grocery produce', weight: 0.06 },
    { tag: 'Convenience tobacco', weight: 0.04 },
    { tag: 'Stadium ticket', weight: 0.05 },
    { tag: 'Gym membership', weight: 0.06 },
    { tag: 'Hair stylist cut', weight: 0.05 },
    { tag: 'Dental treatment private', weight: 0.05 },
    { tag: 'Fashion apparel collection', weight: 0.05 },
    { tag: 'Ecommerce order shipping', weight: 0.06 },
    { tag: 'Event sponsor ticket', weight: 0.05 },
    { tag: 'Fuel diesel petrol', weight: 0.06 },
  ];

  for (let i = 29; i >= 0; i -= 1) {
    const date = addDaysIso(anchorIso, -i);
    const dow = new Date(date + 'T12:00:00').getDay();
    const weekend = dow === 0 || dow === 6;
    const dayBase = weekend ? 2200 + (i % 7) * 140 : 3800 + (i % 11) * 220;
    let dayGross = 0;

    for (const line of lines) {
      const jitter = 0.85 + ((i * 17 + line.tag.length) % 30) / 100;
      const amount = Math.round(dayBase * line.weight * jitter * 100) / 100;
      dayGross += amount;
      income.push({
        date,
        amount,
        type: 'SALES',
        description: `${DEMO_TAG} ${line.tag}`,
      });
    }

    if (i % 5 === 0) {
      const inv = Math.round((400 + (i % 9) * 85) * 100) / 100;
      income.push({
        date,
        amount: inv,
        type: 'RESERVATION',
        description: `${DEMO_TAG} Invoice outstanding`,
      });
      dayGross += inv;
    }

    const cogs = Math.round(dayGross * 0.32 * 100) / 100;
    expenses.push({
      date,
      amount: cogs,
      category: 'SUPPLIERS',
      description: `${DEMO_TAG} Supplier COGS`,
    });

    const vat = Math.round(((dayGross * 0.077) / 1.077) * 100) / 100;
    const net = Math.round((dayGross - vat) * 100) / 100;
    const cash = Math.round(dayGross * 0.32 * 100) / 100;
    const card = Math.round(dayGross * 0.58 * 100) / 100;
    const other = Math.round((dayGross - cash - card) * 100) / 100;

    zReadings.push({
      date,
      gross_sales: Math.round(dayGross * 100) / 100,
      net_sales: net,
      vat_amount: vat,
      cash,
      card,
      other_payment: other,
      tips: Math.round(dayGross * 0.02 * 100) / 100,
      discounts: 0,
      refunds: 0,
      notes: `${DEMO_TAG} Auto-generated Z-reading`,
    });
  }

  return { income, expenses, zReadings };
}

export function isDemoDescription(description?: string): boolean {
  return Boolean(description?.includes(DEMO_TAG));
}
