import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccountPage from './pages/AccountPage';

function AuthenticatedApp() {
  const { user } = useAuth();
  const [view, setView] = useState('dashboard');

  if (!user) {
    return <LoginPage />;
  }

  if (view === 'account') {
    return <AccountPage onBack={() => setView('dashboard')} />;
  }

  return <DashboardPage onOpenAccount={() => setView('account')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
