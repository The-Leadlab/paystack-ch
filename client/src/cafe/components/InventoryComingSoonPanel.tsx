import { Lock, Package, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const PREVIEW_ROWS = [
  { name: 'Coffee beans', sku: 'COF-BEANS', category: 'Beverages', onHand: '5 kg', value: '140.00' },
  { name: 'Whole milk', sku: 'DAI-MILK', category: 'Food', onHand: '20 l', value: '32.00' },
  { name: 'Soft drinks (cans)', sku: 'BEV-SOFT', category: 'Beverages', onHand: '48 pcs', value: '40.80' },
  { name: 'Cooking oil', sku: 'FOOD-OIL', category: 'Food', onHand: '10 l', value: '45.00' },
  { name: 'Napkins / packaging', sku: 'SUP-PACK', category: 'Supplies', onHand: '12 pack', value: '96.00' },
] as const;

/**
 * Teaser for users without inventory unlock: show the feature exists,
 * blur the preview, and mark it as testing / coming soon.
 */
export function InventoryComingSoonPanel() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-[420px] rounded-lg overflow-hidden border border-cdlp-border">
      <div
        className="pointer-events-none select-none blur-[6px] opacity-70 p-4 sm:p-6 space-y-4"
        aria-hidden
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-cdlp-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t('inventoryTab')}
            </h2>
            <p className="text-sm text-cdlp-muted mt-0.5">{t('invPanelSubtitle')}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-cdlp-muted">{t('invTotalStockValue')}</div>
            <div className="text-sm font-semibold text-cdlp-white">353.80 CHF</div>
          </div>
        </div>

        <div className="border border-cdlp-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cdlp-border bg-cdlp-card/50">
                <th className="text-left px-3 py-2 text-cdlp-muted font-medium">{t('invColProduct')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium hidden sm:table-cell">
                  {t('invColCategory')}
                </th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColOnHand')}</th>
                <th className="text-right px-3 py-2 text-cdlp-muted font-medium">{t('invColValue')}</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_ROWS.map((row) => (
                <tr key={row.sku} className="border-b border-cdlp-border/60">
                  <td className="px-3 py-2.5 text-cdlp-white">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-[10px] text-cdlp-muted">{row.sku}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-cdlp-muted hidden sm:table-cell">
                    {row.category}
                  </td>
                  <td className="px-3 py-2.5 text-right text-cdlp-white">{row.onHand}</td>
                  <td className="px-3 py-2.5 text-right text-cdlp-white">{row.value} CHF</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-cdlp-black/55 px-4">
        <div className="max-w-md w-full rounded-xl border border-cdlp-gold/35 bg-cdlp-card/95 shadow-xl px-5 py-6 text-center space-y-3">
          <div className="mx-auto w-11 h-11 rounded-full bg-cdlp-gold/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cdlp-gold" aria-hidden />
          </div>
          <h3 className="text-lg font-black uppercase tracking-wide text-cdlp-white">
            {t('invComingSoonTitle') || t('comingSoon') || 'Coming soon'}
          </h3>
          <p className="text-sm text-cdlp-muted leading-relaxed">
            {t('invComingSoonBody') ||
              'Stock & inventory is in final testing. Full access rolls out in the next few days.'}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-cdlp-gold/90 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden />
            {t('invComingSoonTesting') || 'Available for testers only right now'}
          </p>
          <button
            type="button"
            disabled
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-sm bg-cdlp-gold/80 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 opacity-90 cursor-not-allowed"
          >
            {t('invComingSoonCta') || t('comingSoon') || 'Coming soon'}
          </button>
        </div>
      </div>
    </div>
  );
}
