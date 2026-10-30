import {
  BarChart3,
  CreditCard,
  FilePenLine,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { BusinessTab } from './BusinessSidebarNav';

export type MobileMoreItem = {
  id: BusinessTab;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export function buildMobileMoreItems({
  labels,
  inventorySoonBadge,
  inventoryLocked,
}: {
  labels: {
    invoices: string;
    inventory: string;
    reports: string;
    billing: string;
  };
  inventorySoonBadge?: string;
  inventoryLocked?: boolean;
}): MobileMoreItem[] {
  return [
    { id: 'invoices', label: labels.invoices, icon: FilePenLine },
    {
      id: 'inventory',
      label: labels.inventory,
      icon: Package,
      badge: inventoryLocked ? inventorySoonBadge : undefined,
    },
    { id: 'reports', label: labels.reports, icon: BarChart3 },
    { id: 'billing', label: labels.billing, icon: CreditCard },
  ];
}

export function MobileMoreSheet({
  open,
  onClose,
  items,
  activeTab,
  onSelect,
  title,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileMoreItem[];
  activeTab: BusinessTab;
  onSelect: (tab: BusinessTab) => void;
  title: string;
}) {
  if (!open) return null;

  const moreActive = items.some((item) => item.id === activeTab);

  return (
    <div
      className="ba-mobile-more-overlay md:hidden"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ba-mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ba-mobile-more-handle" aria-hidden />
        <p className="ba-mobile-more-title">{title}</p>
        <ul className="ba-mobile-more-list">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-active={active}
                  data-tour={`biz-mobile-more-${item.id}`}
                  className="ba-mobile-more-item"
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {item.badge ? (
                    <span className="ba-mobile-more-badge">{item.badge}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {/* Keep screen readers aware More is the overflow host when a More tab is active */}
        <span className="sr-only">{moreActive ? title : null}</span>
      </div>
    </div>
  );
}
