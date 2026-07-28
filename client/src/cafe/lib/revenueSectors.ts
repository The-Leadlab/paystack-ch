import type { IncomeRow } from './revenueAnalytics';

/** Full Lovable industry catalog (ids stable). */
export type SectorId =
  | 'restaurants'
  | 'supermarkets'
  | 'night_shop'
  | 'stadium'
  | 'fiduciary'
  | 'hotel'
  | 'gym'
  | 'salon'
  | 'garage'
  | 'medical'
  | 'fashion'
  | 'ecommerce'
  | 'events'
  | 'fuel_station'
  | 'general';

export type SectorMeta = {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  /** When set, UI shows this instead of t(titleKey) — used for custom categories. */
  titleOverride?: string;
  descOverride?: string;
  keywords: string[];
  leftTitleKey: string;
  rightTitleKey: string;
  /** KPI builder uses keyword buckets + totals */
  kpiMode:
    | 'restaurants'
    | 'supermarkets'
    | 'night_shop'
    | 'stadium'
    | 'fiduciary'
    | 'hotel'
    | 'gym'
    | 'salon'
    | 'garage'
    | 'medical'
    | 'fashion'
    | 'ecommerce'
    | 'events'
    | 'fuel_station'
    | 'general';
  isCustom?: boolean;
};

export const SECTOR_CATALOG: SectorMeta[] = [
  {
    id: 'restaurants',
    icon: '🍷',
    titleKey: 'rhSectorRestaurants',
    descKey: 'rhSectorRestaurantsDesc',
    keywords: ['food', 'beverage', 'dine', 'dine-in', 'takeaway', 'catering', 'bar', 'alcohol', 'cafe', 'café', 'z-reading'],
    leftTitleKey: 'rhSecRevByCategory',
    rightTitleKey: 'rhSecRevByOutlet',
    kpiMode: 'restaurants',
  },
  {
    id: 'supermarkets',
    icon: '🛒',
    titleKey: 'rhSectorSupermarkets',
    descKey: 'rhSectorSupermarketsDesc',
    keywords: ['grocery', 'produce', 'dairy', 'bakery', 'department', 'supermarket', 'fresh'],
    leftTitleKey: 'rhSecRevByDept',
    rightTitleKey: 'rhSecRevByBasket',
    kpiMode: 'supermarkets',
  },
  {
    id: 'night_shop',
    icon: '🌃',
    titleKey: 'rhSectorNightShop',
    descKey: 'rhSectorNightShopDesc',
    keywords: ['convenience', 'night shop', 'tobacco', 'lottery', 'kiosk', 'snack'],
    leftTitleKey: 'rhSecRevByProductCat',
    rightTitleKey: 'rhSecRevByShift',
    kpiMode: 'night_shop',
  },
  {
    id: 'stadium',
    icon: '🏟️',
    titleKey: 'rhSectorStadium',
    descKey: 'rhSectorStadiumDesc',
    keywords: ['stadium ticket', 'stadium', 'arena', 'stadium merch', 'hospitality box', 'visitor scan'],
    leftTitleKey: 'rhSecRevByCategory',
    rightTitleKey: 'rhSecRevByEvent',
    kpiMode: 'stadium',
  },
  {
    id: 'fiduciary',
    icon: '📑',
    titleKey: 'rhSectorFiduciary',
    descKey: 'rhSectorFiduciaryDesc',
    keywords: ['consulting', 'audit', 'tax', 'advisory', 'compliance', 'bookkeeping', 'fiduciary'],
    leftTitleKey: 'rhSecRevByService',
    rightTitleKey: 'rhSecRevByClient',
    kpiMode: 'fiduciary',
  },
  {
    id: 'hotel',
    icon: '🏨',
    titleKey: 'rhSectorHotels',
    descKey: 'rhSectorHotelsDesc',
    keywords: ['room booking', 'room', 'f&b breakfast', 'spa', 'breakfast', 'minibar', 'hotel', 'adr'],
    leftTitleKey: 'rhSecRevByRoom',
    rightTitleKey: 'rhSecRevByChannel',
    kpiMode: 'hotel',
  },
  {
    id: 'gym',
    icon: '🏋️',
    titleKey: 'rhSectorGym',
    descKey: 'rhSectorGymDesc',
    keywords: ['membership', 'pt', 'personal training', 'gym', 'fitness', 'renewal', 'signup'],
    leftTitleKey: 'rhSecRevByProduct',
    rightTitleKey: 'rhSecRevBySignup',
    kpiMode: 'gym',
  },
  {
    id: 'salon',
    icon: '💇',
    titleKey: 'rhSectorSalon',
    descKey: 'rhSectorSalonDesc',
    keywords: ['hair', 'stylist', 'beauty', 'salon', 'cut', 'color', 'nail', 'treatment'],
    leftTitleKey: 'rhSecRevByService',
    rightTitleKey: 'rhSecRevByStylist',
    kpiMode: 'salon',
  },
  {
    id: 'garage',
    icon: '🏎️',
    titleKey: 'rhSectorGarages',
    descKey: 'rhSectorGaragesDesc',
    keywords: ['service', 'parts', 'tyre', 'labour', 'oil', 'brake', 'repair', 'mechanic', 'garage'],
    leftTitleKey: 'rhSecRevByService',
    rightTitleKey: 'rhSecRevByMechanic',
    kpiMode: 'garage',
  },
  {
    id: 'medical',
    icon: '🩺',
    titleKey: 'rhSectorMedical',
    descKey: 'rhSectorMedicalDesc',
    keywords: ['dental', 'medical', 'clinic', 'doctor', 'insurance', 'private', 'treatment', 'patient'],
    leftTitleKey: 'rhSecRevByTreatment',
    rightTitleKey: 'rhSecRevByDoctor',
    kpiMode: 'medical',
  },
  {
    id: 'fashion',
    icon: '👗',
    titleKey: 'rhSectorFashion',
    descKey: 'rhSectorFashionDesc',
    keywords: ['fashion', 'apparel', 'collection', 'markdown', 'return', 'season', 'clothing'],
    leftTitleKey: 'rhSecRevByCategory',
    rightTitleKey: 'rhSecRevByCollection',
    kpiMode: 'fashion',
  },
  {
    id: 'ecommerce',
    icon: '📦',
    titleKey: 'rhSectorEcommerce',
    descKey: 'rhSectorEcommerceDesc',
    keywords: ['order', 'aov', 'shipping', 'marketplace', 'online', 'ecommerce', 'e-commerce', 'refund'],
    leftTitleKey: 'rhSecRevByProductLine',
    rightTitleKey: 'rhSecRevByCustomerType',
    kpiMode: 'ecommerce',
  },
  {
    id: 'events',
    icon: '🎟️',
    titleKey: 'rhSectorEvents',
    descKey: 'rhSectorEventsDesc',
    keywords: ['event ticket', 'event sponsor', 'sponsor', 'venue', 'conference', 'wedding', 'event '],
    leftTitleKey: 'rhSecRevByCategory',
    rightTitleKey: 'rhSecRevByEvent',
    kpiMode: 'events',
  },
  {
    id: 'fuel_station',
    icon: '⛽',
    titleKey: 'rhSectorFuel',
    descKey: 'rhSectorFuelDesc',
    keywords: ['fuel', 'diesel', 'petrol', 'gasoline', 'car wash', 'carwash', 'pump', 'station'],
    leftTitleKey: 'rhSecRevByProduct',
    rightTitleKey: 'rhSecRevByShift',
    kpiMode: 'fuel_station',
  },
  {
    id: 'general',
    icon: '🏢',
    titleKey: 'rhSectorGeneral',
    descKey: 'rhSectorGeneralDesc',
    keywords: ['general', 'misc', 'other', 'sundry'],
    leftTitleKey: 'rhSecRevByCategory',
    rightTitleKey: 'rhSecRevByReference',
    kpiMode: 'general',
  },
];

export const ALL_SECTORS: SectorId[] = SECTOR_CATALOG.map((s) => s.id);

/** First-run default — user can add more from the full catalog. */
export const DEFAULT_SECTORS: SectorId[] = ['restaurants'];

export const SECTORS_STORAGE_KEY = 'paystack.revenue.activeSectors';

const LEGACY_MAP: Record<string, SectorId> = {
  garages: 'garage',
  hotels: 'hotel',
  restaurants: 'restaurants',
  fiduciary: 'fiduciary',
};

export function getSectorMeta(id: string): SectorMeta {
  if (isCustomSectorId(id)) {
    const custom = loadCustomSectors().find((c) => c.id === id);
    if (custom) return customSectorToMeta(custom);
  }
  const base = SECTOR_CATALOG.find((s) => s.id === id) || SECTOR_CATALOG[SECTOR_CATALOG.length - 1];
  const overrides = loadKeywordOverrides()[id as SectorId];
  if (!overrides?.length) return base;
  return { ...base, keywords: overrides };
}

const KEYWORD_OVERRIDES_KEY = 'paystack.revenue.sectorKeywordOverrides';

export function loadKeywordOverrides(): Partial<Record<SectorId, string[]>> {
  try {
    const raw = localStorage.getItem(KEYWORD_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<SectorId, string[]>>;
  } catch {
    return {};
  }
}

export function saveKeywordOverrides(map: Partial<Record<SectorId, string[]>>) {
  try {
    localStorage.setItem(KEYWORD_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function setSectorKeywords(sector: string, keywords: string[]) {
  const cleaned = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (isCustomSectorId(sector)) {
    const list = loadCustomSectors().map((c) =>
      c.id === sector ? { ...c, keywords: cleaned.length ? cleaned : c.keywords } : c
    );
    saveCustomSectors(list);
    return;
  }
  const next = { ...loadKeywordOverrides(), [sector]: cleaned.length ? cleaned : undefined };
  if (!cleaned.length) delete next[sector as SectorId];
  saveKeywordOverrides(next);
}

/** True if description matches any of the selected sector recipes. */
export function rowMatchesAnySector(description: string, sectors: string[]): boolean {
  if (!sectors.length) return false;
  const lower = (description || '').toLowerCase();
  // Manual Z-readings sync to income without sector tags — count under restaurants.
  if (lower.includes('z-reading') && sectors.includes('restaurants')) return true;
  return sectors.some((s) => matchSector(description, s));
}

/** Scale untagged supplier COGS by sector income share so margins stay realistic. */
export function filterExpensesForSectors<
  T extends { amount: number; category: string; description?: string },
>(expenses: T[], allIncomeTotal: number, sectorIncomeTotal: number, sectors: string[]): T[] {
  if (!sectors.length) return [];
  const share = allIncomeTotal > 0 ? sectorIncomeTotal / allIncomeTotal : 0;
  const out: T[] = [];
  for (const e of expenses) {
    if (rowMatchesAnySector(e.description || '', sectors)) {
      out.push(e);
      continue;
    }
    if (e.category === 'SUPPLIERS' && share > 0) {
      out.push({ ...e, amount: Math.round(e.amount * share * 100) / 100 });
    }
  }
  return out;
}

export type SectorKpi = { labelKey: string; value: string; sub?: string };

export type SectorBreakdown = { name: string; amount: number };

export type SectorModuleData = {
  kpis: SectorKpi[];
  leftTitleKey: string;
  rightTitleKey: string;
  leftBars: SectorBreakdown[];
  rightBars: SectorBreakdown[];
};

export function matchSector(description: string, sector: string): boolean {
  const lower = description.toLowerCase();
  const meta = getSectorMeta(sector);
  if (sector === 'general') {
    // Catch rows that match no other industry keyword (built-in + custom)
    const others = [
      ...SECTOR_CATALOG.filter((s) => s.id !== 'general').map((s) => s.id),
      ...loadCustomSectors().map((c) => c.id),
    ];
    return !others.some((id) => getSectorMeta(id).keywords.some((k) => lower.includes(k)));
  }
  return meta.keywords.some((k) => lower.includes(k));
}

function filterRowsForSector(rows: IncomeRow[], sector: string): IncomeRow[] {
  return rows.filter((r) => matchSector(r.description || '', sector));
}

function groupByKeyword(rows: IncomeRow[], sector: string): SectorBreakdown[] {
  const meta = getSectorMeta(sector);
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const desc = row.description || '';
    const key = meta.keywords.find((k) => desc.toLowerCase().includes(k)) || 'Other';
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    buckets.set(label, (buckets.get(label) || 0) + row.amount);
  }
  return Array.from(buckets.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

function groupByDescription(rows: IncomeRow[]): SectorBreakdown[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const raw = row.description || 'Untagged';
    const key = raw.replace(/^\[DEMO\]\s*/i, '').slice(0, 40);
    buckets.set(key, (buckets.get(key) || 0) + row.amount);
  }
  return Array.from(buckets.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

function pctOf(total: number, part: number): string {
  if (total <= 0) return '—';
  return `${((part / total) * 100).toFixed(0)}%`;
}

function amountNamed(bars: SectorBreakdown[], needle: string): number {
  return bars
    .filter((b) => b.name.toLowerCase().includes(needle))
    .reduce((s, b) => s + b.amount, 0);
}

function uniqueRefs(rows: IncomeRow[]): number {
  return Array.from(
    new Set(
      rows
        .map((r) => (r.description || '').replace(/^\[DEMO\]\s*/i, '').split(/[—-]/)[0]?.trim())
        .filter(Boolean)
    )
  ).length;
}

export function computeSectorModule(
  sector: string,
  rows: IncomeRow[],
  fmt: (n: number) => string
): SectorModuleData {
  const meta = getSectorMeta(sector);
  const sectorRows = filterRowsForSector(rows, sector);
  const total = sectorRows.reduce((s, r) => s + r.amount, 0);
  const count = sectorRows.length;
  const avg = count > 0 ? total / count : 0;
  const leftBars = groupByKeyword(sectorRows, sector);
  const rightBars = groupByDescription(sectorRows);

  const kpis: SectorKpi[] = (() => {
    switch (meta.kpiMode) {
      case 'garage':
        return [
          { labelKey: 'rhSecAvgRepair', value: fmt(avg) },
          { labelKey: 'rhSecLabourPct', value: pctOf(total, amountNamed(leftBars, 'labour') + amountNamed(leftBars, 'service')) },
          { labelKey: 'rhSecPartsPct', value: pctOf(total, amountNamed(leftBars, 'parts')) },
          { labelKey: 'rhSecTyres', value: fmt(amountNamed(leftBars, 'tyre')) },
        ];
      case 'hotel':
        return [
          { labelKey: 'rhSecRoomRev', value: fmt(amountNamed(leftBars, 'room') + amountNamed(leftBars, 'booking')) },
          { labelKey: 'rhSecAdr', value: fmt(avg) },
          { labelKey: 'rhSecRevpar', value: fmt(total / 30) },
          { labelKey: 'rhSecFbSpa', value: fmt(amountNamed(leftBars, 'f&b') + amountNamed(leftBars, 'spa') + amountNamed(leftBars, 'breakfast')) },
        ];
      case 'fiduciary':
        return [
          { labelKey: 'rhSecAvgFee', value: fmt(avg), sub: `${count} entries` },
          { labelKey: 'rhSecTopService', value: leftBars[0]?.name || '—', sub: fmt(leftBars[0]?.amount || 0) },
          { labelKey: 'rhSecActiveClients', value: String(uniqueRefs(sectorRows)) },
          { labelKey: 'rhSecConsultingPct', value: pctOf(total, amountNamed(leftBars, 'consult') + amountNamed(leftBars, 'advisory')) },
        ];
      case 'restaurants':
        return [
          { labelKey: 'rhSecCovers', value: String(count) },
          { labelKey: 'rhSecAvgTicket', value: fmt(avg) },
          { labelKey: 'rhSecFoodPct', value: pctOf(total, amountNamed(leftBars, 'food') + amountNamed(leftBars, 'dine')) },
          { labelKey: 'rhSecBev', value: fmt(amountNamed(leftBars, 'beverage') + amountNamed(leftBars, 'bar') + amountNamed(leftBars, 'alcohol')) },
        ];
      case 'supermarkets':
        return [
          { labelKey: 'rhSecAvgBasket', value: fmt(avg) },
          { labelKey: 'rhSecBaskets', value: String(count) },
          { labelKey: 'rhSecTopDept', value: leftBars[0]?.name || '—' },
          { labelKey: 'rhSecDeptsActive', value: String(leftBars.length) },
        ];
      case 'night_shop':
        return [
          { labelKey: 'rhSecSales', value: fmt(total) },
          { labelKey: 'rhSecTobaccoPct', value: pctOf(total, amountNamed(leftBars, 'tobacco')) },
          { labelKey: 'rhSecAlcoholPct', value: pctOf(total, amountNamed(leftBars, 'alcohol') + amountNamed(leftBars, 'snack')) },
          { labelKey: 'rhSecLotteryPct', value: pctOf(total, amountNamed(leftBars, 'lottery')) },
        ];
      case 'stadium':
        return [
          { labelKey: 'rhSecTicketsShare', value: pctOf(total, amountNamed(leftBars, 'ticket')) },
          { labelKey: 'rhSecFnbShare', value: pctOf(total, amountNamed(leftBars, 'hospitality') + amountNamed(leftBars, 'food')) },
          { labelKey: 'rhSecMerch', value: fmt(amountNamed(leftBars, 'merch')) },
          { labelKey: 'rhSecRevVisitor', value: fmt(avg) },
        ];
      case 'gym':
        return [
          { labelKey: 'rhSecMrrProxy', value: fmt(amountNamed(leftBars, 'membership') + amountNamed(leftBars, 'renewal')) },
          { labelKey: 'rhSecPtRevenue', value: fmt(amountNamed(leftBars, 'pt') + amountNamed(leftBars, 'personal')) },
          { labelKey: 'rhSecShop', value: fmt(amountNamed(leftBars, 'shop') + amountNamed(leftBars, 'retail')) },
          { labelKey: 'rhSecNewMembers', value: String(Math.max(1, Math.round(count * 0.15))) },
        ];
      case 'salon':
        return [
          { labelKey: 'rhSecAvgAppointment', value: fmt(avg) },
          { labelKey: 'rhSecServicePct', value: pctOf(total, amountNamed(leftBars, 'cut') + amountNamed(leftBars, 'color') + amountNamed(leftBars, 'hair') + amountNamed(leftBars, 'treatment')) },
          { labelKey: 'rhSecRetailPct', value: pctOf(total, amountNamed(leftBars, 'retail') + amountNamed(leftBars, 'beauty')) },
          { labelKey: 'rhSecTopStylist', value: rightBars[0]?.name || '—' },
        ];
      case 'medical':
        return [
          { labelKey: 'rhSecAvgTreatment', value: fmt(avg) },
          { labelKey: 'rhSecPrivatePct', value: pctOf(total, amountNamed(leftBars, 'private')) },
          { labelKey: 'rhSecInsurancePct', value: pctOf(total, amountNamed(leftBars, 'insurance')) },
          { labelKey: 'rhSecTopTreatment', value: leftBars[0]?.name || '—' },
        ];
      case 'fashion':
        return [
          { labelKey: 'rhSecItemsSold', value: String(count) },
          { labelKey: 'rhSecMarkdownPct', value: pctOf(total, amountNamed(leftBars, 'markdown')) },
          { labelKey: 'rhSecTopCategory', value: leftBars[0]?.name || '—' },
          { labelKey: 'rhSecAvgTicket', value: fmt(avg) },
        ];
      case 'ecommerce':
        return [
          { labelKey: 'rhSecAov', value: fmt(avg) },
          { labelKey: 'rhSecOrders', value: String(count) },
          { labelKey: 'rhSecReturningPct', value: pctOf(total, amountNamed(leftBars, 'returning') + amountNamed(leftBars, 'refund')) },
          { labelKey: 'rhSecShipping', value: fmt(amountNamed(leftBars, 'shipping') + amountNamed(leftBars, 'marketplace')) },
        ];
      case 'events':
        return [
          { labelKey: 'rhSecTicketsShare', value: pctOf(total, amountNamed(leftBars, 'ticket')) },
          { labelKey: 'rhSecFnbShare', value: pctOf(total, amountNamed(leftBars, 'f&b') + amountNamed(leftBars, 'food')) },
          { labelKey: 'rhSecMerch', value: fmt(amountNamed(leftBars, 'merch') + amountNamed(leftBars, 'sponsor')) },
          { labelKey: 'rhSecAvgTicket', value: fmt(avg) },
        ];
      case 'fuel_station':
        return [
          { labelKey: 'rhSecFuelRevenue', value: fmt(amountNamed(leftBars, 'fuel') + amountNamed(leftBars, 'diesel') + amountNamed(leftBars, 'petrol') + amountNamed(leftBars, 'gasoline')) },
          { labelKey: 'rhSecFuelMargin', value: pctOf(total, amountNamed(leftBars, 'fuel') * 0.12) },
          { labelKey: 'rhSecStorePct', value: pctOf(total, amountNamed(leftBars, 'store') + amountNamed(leftBars, 'shop')) },
          { labelKey: 'rhSecCarWash', value: fmt(amountNamed(leftBars, 'wash')) },
        ];
      default:
        return [
          { labelKey: 'rhSecSales', value: fmt(total) },
          { labelKey: 'rhSecAvgTicket', value: fmt(avg) },
          { labelKey: 'rhSecTopCategory', value: leftBars[0]?.name || '—' },
          { labelKey: 'rhSecOrders', value: String(count) },
        ];
    }
  })();

  return {
    kpis,
    leftTitleKey: meta.leftTitleKey,
    rightTitleKey: meta.rightTitleKey,
    leftBars,
    rightBars,
  };
}

export function normalizeSectorIds(raw: string[]): string[] {
  const customIds = new Set(loadCustomSectors().map((c) => c.id));
  const mapped = raw
    .map((s) => LEGACY_MAP[s] || s)
    .filter((s) => ALL_SECTORS.includes(s as SectorId) || customIds.has(s));
  return Array.from(new Set(mapped));
}

export function loadStoredSectors(): string[] {
  try {
    const raw = localStorage.getItem(SECTORS_STORAGE_KEY);
    if (!raw) return DEFAULT_SECTORS.slice();
    const parsed = JSON.parse(raw) as string[];
    const valid = normalizeSectorIds(parsed);
    return valid.length ? valid : DEFAULT_SECTORS.slice();
  } catch {
    return DEFAULT_SECTORS.slice();
  }
}

export function saveStoredSectors(sectors: string[]) {
  try {
    localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
  } catch {
    /* ignore */
  }
}

const CUSTOM_SECTORS_KEY = 'paystack.revenue.customSectors';

export type CustomSectorDef = {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
};

export function isCustomSectorId(id: string): boolean {
  return id.startsWith('custom_');
}

export function loadCustomSectors(): CustomSectorDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SECTORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomSectorDef[];
    return Array.isArray(parsed) ? parsed.filter((c) => c?.id && c?.name) : [];
  } catch {
    return [];
  }
}

export function saveCustomSectors(list: CustomSectorDef[]) {
  try {
    localStorage.setItem(CUSTOM_SECTORS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export function customSectorToMeta(c: CustomSectorDef): SectorMeta {
  return {
    id: c.id,
    icon: c.icon || '📌',
    titleKey: '',
    descKey: '',
    titleOverride: c.name,
    descOverride: c.keywords.join(', '),
    keywords: c.keywords,
    leftTitleKey: 'rhSecSales',
    rightTitleKey: 'rhSecTopCategory',
    kpiMode: 'general',
    isCustom: true,
  };
}

/** Create a custom category from user input (name + keywords). No AI. */
export function addCustomSector(input: {
  name: string;
  keywords: string[];
  icon?: string;
}): CustomSectorDef | null {
  const name = input.name.trim();
  const keywords = input.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (!name || !keywords.length) return null;
  const base = slugifyCategoryName(name) || `cat_${Date.now().toString(36)}`;
  let id = `custom_${base}`;
  const existing = loadCustomSectors();
  if (existing.some((c) => c.id === id)) {
    id = `custom_${base}_${Date.now().toString(36).slice(-4)}`;
  }
  const next: CustomSectorDef = {
    id,
    name,
    icon: input.icon?.trim() || '📌',
    keywords,
  };
  saveCustomSectors([...existing, next]);
  return next;
}

export function updateCustomSector(id: string, patch: Partial<Pick<CustomSectorDef, 'name' | 'icon' | 'keywords'>>) {
  const list = loadCustomSectors().map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      name: patch.name?.trim() || c.name,
      icon: patch.icon?.trim() || c.icon,
      keywords: patch.keywords
        ? patch.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
        : c.keywords,
    };
  });
  saveCustomSectors(list);
}

export function deleteCustomSector(id: string) {
  saveCustomSectors(loadCustomSectors().filter((c) => c.id !== id));
}

/** Display title for a sector (built-in i18n or custom override). */
export function sectorDisplayTitle(meta: SectorMeta, t: (key: string) => string): string {
  if (meta.titleOverride) return meta.titleOverride;
  return meta.titleKey ? t(meta.titleKey) : meta.id;
}

export function sectorDisplayDesc(meta: SectorMeta, t: (key: string) => string): string {
  if (meta.descOverride) return meta.descOverride;
  return meta.descKey ? t(meta.descKey) : '';
}
