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
  items,
  collapsed = false,
}: {
  activeTab: BusinessTab;
  onTabChange: (tab: BusinessTab) => void;
  showRevenueTab: boolean;
  showInventoryTab?: boolean;
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
          return (
            <button
              key={item.id}
              type="button"
              data-active={active}
              data-tour={`biz-nav-${item.id}`}
              title={item.label}
              onClick={() => onTabChange(item.id)}
              className={`ba-sidebar-nav-btn${collapsed ? ' ba-sidebar-nav-btn--rail' : ''}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {!collapsed ? item.label : null}
            </button>
          );
        })}
    </nav>
  );
}
