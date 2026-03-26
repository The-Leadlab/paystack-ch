import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { FinanceProvider } from './context/FinanceContext';
import { Login } from './components/Login';
import { RestaurantDashboard } from './components/RestaurantDashboard';
import { FirebaseMissing } from './components/FirebaseMissing';
import { firebaseReady } from './lib/firebase';
import { EmailVerificationGate } from './components/EmailVerificationGate';

function AppContent() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse font-black text-ypsom-deep uppercase tracking-widest text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isPasswordUser = user.providerData?.some((p) => p.providerId === 'password');
  if (isPasswordUser && !user.emailVerified) {
    return <EmailVerificationGate />;
  }

  return (
    <EmployeeProvider>
      <FinanceProvider>
        <RestaurantDashboard />
      </FinanceProvider>
    </EmployeeProvider>
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
