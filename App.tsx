import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClientProvider, useClient } from './context/ClientContext';
import { Login } from './components/Login';
import { ClientOnboarding } from './components/ClientOnboarding';
import { Dashboard } from './components/Dashboard';
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

  // If user signed up with email/password, enforce verification.
  const isPasswordUser = user.providerData?.some((p) => p.providerId === 'password');
  if (isPasswordUser && !user.emailVerified) {
    return <EmailVerificationGate />;
  }

  return (
    <ClientProvider>
      <AppWithClient />
    </ClientProvider>
  );
}

function AppWithClient() {
  const { currentClient, loading: clientLoading } = useClient();

  if (clientLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse font-black text-ypsom-deep uppercase tracking-widest text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!currentClient) {
    return <ClientOnboarding />;
  }

  return <Dashboard />;
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
