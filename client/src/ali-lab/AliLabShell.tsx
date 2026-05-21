import type { ReactNode } from "react";
import { SubscriptionProvider } from "@/cafe/context/SubscriptionContext";
import { SessionProvider } from "@/cafe/context/SessionContext";
import { FinanceProvider } from "@/cafe/context/FinanceContext";
import { DocumentProvider } from "@/cafe/context/DocumentContext";
import { LabLanguageProvider } from "./context/LabLanguageContext";
import { AliLabAuthBanner } from "./components/AliLabAuthBanner";
import { LabLedgerSnapshot } from "./components/LabLedgerSnapshot";
import { firebaseReady } from "@/cafe/lib/firebase";

export function AliLabShell({ children }: { children: ReactNode }) {
  return (
    <LabLanguageProvider>
      <div className="min-h-[100dvh] bg-background text-foreground">
        {!firebaseReady && (
          <p className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-200 px-4 py-2 text-center">
            Firebase not configured — lab features use localStorage only.
          </p>
        )}
        <SubscriptionProvider>
          <SessionProvider>
            <FinanceProvider>
              <DocumentProvider>
                <div className="p-4 md:p-6 max-w-5xl mx-auto">
                  <AliLabAuthBanner />
                  <LabLedgerSnapshot />
                  {children}
                </div>
              </DocumentProvider>
            </FinanceProvider>
          </SessionProvider>
        </SubscriptionProvider>
      </div>
    </LabLanguageProvider>
  );
}
