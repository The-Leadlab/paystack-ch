import type { LucideIcon } from 'lucide-react';

export type BusinessTab = 'dashboard' | 'revenue' | 'reports' | 'documents' | 'billing';

export function BusinessSidebarNav({
  activeTab,
  onTabChange,
  showRevenueTab,
  items,
}: {
  activeTab: BusinessTab;
  onTabChange: (tab: BusinessTab) => void;
  showRevenueTab: boolean;
  items: { id: BusinessTab; label: string; icon: LucideIcon }[];
}) {
  return (
    <nav className="space-y-1 mb-4" aria-label="Main navigation">
      {items
        .filter((item) => (item.id === 'revenue' ? showRevenueTab : true))
        .map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-active={active}
              onClick={() => onTabChange(item.id)}
              className="ba-sidebar-nav-btn"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
    </nav>
  );
}
