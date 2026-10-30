import {
  Camera,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Wallet,
} from 'lucide-react';
import type { BusinessTab } from './BusinessSidebarNav';

export type MobilePrimarySlot = 'home' | 'money' | 'capture' | 'docs' | 'more';

function moneyActive(tab: BusinessTab) {
  return tab === 'revenue' || tab === 'expenses';
}

function moreActive(tab: BusinessTab) {
  return tab === 'invoices' || tab === 'inventory' || tab === 'reports' || tab === 'billing';
}

export function MobileTabBar({
  activeTab,
  showMoneyTab,
  moreOpen,
  labels,
  ariaLabel,
  onHome,
  onMoney,
  onCapture,
  onDocs,
  onMore,
}: {
  activeTab: BusinessTab;
  showMoneyTab: boolean;
  moreOpen: boolean;
  labels: {
    home: string;
    money: string;
    capture: string;
    docs: string;
    more: string;
  };
  ariaLabel: string;
  onHome: () => void;
  onMoney: () => void;
  onCapture: () => void;
  onDocs: () => void;
  onMore: () => void;
}) {
  const slotActive = (slot: MobilePrimarySlot) => {
    if (slot === 'home') return activeTab === 'dashboard';
    if (slot === 'money') return moneyActive(activeTab);
    if (slot === 'docs') return activeTab === 'documents';
    if (slot === 'more') return moreOpen || moreActive(activeTab);
    return false;
  };

  return (
    <nav className="ba-mobile-tabbar md:hidden" aria-label={ariaLabel}>
      <div className="ba-mobile-tabbar-inner">
        <button
          type="button"
          data-tour="biz-mobile-tab-home"
          data-active={slotActive('home')}
          className="ba-mobile-tab"
          onClick={onHome}
        >
          <LayoutDashboard className="ba-mobile-tab-icon" aria-hidden />
          <span className="ba-mobile-tab-label">{labels.home}</span>
        </button>

        {showMoneyTab ? (
          <button
            type="button"
            data-tour="biz-mobile-tab-money"
            data-active={slotActive('money')}
            className="ba-mobile-tab"
            onClick={onMoney}
          >
            <Wallet className="ba-mobile-tab-icon" aria-hidden />
            <span className="ba-mobile-tab-label">{labels.money}</span>
          </button>
        ) : null}

        <button
          type="button"
          data-tour="biz-mobile-tab-capture"
          className="ba-mobile-tab ba-mobile-tab--capture"
          onClick={onCapture}
          aria-label={labels.capture}
        >
          <span className="ba-mobile-capture-fab">
            <Camera className="w-5 h-5" aria-hidden />
          </span>
          <span className="ba-mobile-tab-label">{labels.capture}</span>
        </button>

        <button
          type="button"
          data-tour="biz-mobile-tab-docs"
          data-active={slotActive('docs')}
          className="ba-mobile-tab"
          onClick={onDocs}
        >
          <FileText className="ba-mobile-tab-icon" aria-hidden />
          <span className="ba-mobile-tab-label">{labels.docs}</span>
        </button>

        <button
          type="button"
          data-tour="biz-mobile-tab-more"
          data-active={slotActive('more')}
          className="ba-mobile-tab"
          onClick={onMore}
        >
          <MoreHorizontal className="ba-mobile-tab-icon" aria-hidden />
          <span className="ba-mobile-tab-label">{labels.more}</span>
        </button>
      </div>
    </nav>
  );
}
