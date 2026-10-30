/** Phone-only segmented control for Revenue ↔ Expenses under the Money tab. */
export function MobileMoneySegment({
  active,
  onChange,
  revenueLabel,
  expensesLabel,
}: {
  active: 'revenue' | 'expenses';
  onChange: (tab: 'revenue' | 'expenses') => void;
  revenueLabel: string;
  expensesLabel: string;
}) {
  return (
    <div className="ba-mobile-money-segment md:hidden" role="tablist" aria-label={revenueLabel}>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'revenue'}
        data-active={active === 'revenue'}
        className="ba-mobile-money-seg-btn"
        onClick={() => onChange('revenue')}
      >
        {revenueLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'expenses'}
        data-active={active === 'expenses'}
        className="ba-mobile-money-seg-btn"
        onClick={() => onChange('expenses')}
      >
        {expensesLabel}
      </button>
    </div>
  );
}
