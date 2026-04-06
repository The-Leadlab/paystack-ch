import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessionProvider } from './context/SessionContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { FinanceProvider } from './context/FinanceContext';
import { DocumentProvider } from './context/DocumentContext';
import { POSProvider } from './context/POSContext';
import { LanguageProvider } from './context/LanguageContext';
import { Login } from './components/Login';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { FirebaseMissing } from './components/FirebaseMissing';
import { firebaseReady } from './lib/firebase';
import { EmailVerificationGate } from './components/EmailVerificationGate';

function AppContent() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cdlp-dark flex items-center justify-center">
        <div className="animate-pulse font-black text-cdlp-gold uppercase tracking-widest text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Check if user is admin (bypass email verification)
  const isAdmin = user.email === 'admin@test.com';
  
  // Email verification check (bypass for admin)
  const isPasswordUser = user.providerData?.some((p) => p.providerId === 'password');
  if (isPasswordUser && !user.emailVerified && !isAdmin) {
    return <EmailVerificationGate />;
  }

  return (
    <LanguageProvider>
      <SessionProvider>
        <EmployeeProvider>
          <FinanceProvider>
            <POSProvider>
              <DocumentProvider>
                <RestaurantDashboard />
              </DocumentProvider>
            </POSProvider>
          </FinanceProvider>
        </EmployeeProvider>
      </SessionProvider>
    </LanguageProvider>
  );
}

function App() {
  if (!firebaseReady) {
    return <FirebaseMissing />;
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
