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

  return (
    <>
      <DashboardPage onOpenAccount={() => setView('account')} />
      <button
        type="button"
        onClick={() => setView('account')}
        className="fixed bottom-6 right-6 bg-blue-600 text-white font-semibold shadow-xl px-5 py-3 rounded-full border border-blue-100 hover:bg-blue-700 transition"
      >
        Особистий кабінет
      </button>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
