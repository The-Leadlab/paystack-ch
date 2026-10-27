import type { LucideIcon } from 'lucide-react';

export type BusinessTab =
  | 'dashboard'
  | 'revenue'
  | 'expenses'
  | 'invoices'
  | 'reports'
  | 'documents'
  | 'inventory'
  | 'billing';

export function BusinessSidebarNav({
  activeTab,
  onTabChange,
  showRevenueTab,
  showInventoryTab = false,
  inventoryLocked = false,
  inventorySoonLabel = 'Soon',
  items,
  collapsed = false,
}: {
  activeTab: BusinessTab;
  onTabChange: (tab: BusinessTab) => void;
  showRevenueTab: boolean;
  showInventoryTab?: boolean;
  /** When true, Inventory stays visible but marked Coming soon (testers unlocked). */
  inventoryLocked?: boolean;
  inventorySoonLabel?: string;
  items: { id: BusinessTab; label: string; icon: LucideIcon }[];
  collapsed?: boolean;
}) {
  return (
    <nav className="space-y-0.5 mb-0" aria-label="Main navigation">
      {items
        .filter((item) => {
          if (item.id === 'revenue' || item.id === 'expenses') return showRevenueTab;
          if (item.id === 'inventory') return showInventoryTab;
          return true;
        })
        .map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const showSoon = item.id === 'inventory' && inventoryLocked;
          return (
            <button
              key={item.id}
              type="button"
              data-active={active}
              data-tour={`biz-nav-${item.id}`}
              title={showSoon ? `${item.label} — ${inventorySoonLabel}` : item.label}
              onClick={() => onTabChange(item.id)}
              className={`ba-sidebar-nav-btn${collapsed ? ' ba-sidebar-nav-btn--rail' : ''}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {!collapsed ? (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
                  <span className="truncate">{item.label}</span>
                  {showSoon ? (
                    <span className="shrink-0 text-[8px] font-black uppercase tracking-tight text-cdlp-gold bg-cdlp-gold/15 rounded px-1 py-0.5">
                      {inventorySoonLabel}
                    </span>
                  ) : null}
                </span>
              ) : showSoon ? (
                <span className="sr-only">{inventorySoonLabel}</span>
              ) : null}
            </button>
          );
        })}
    </nav>
  );
}
