import React, { useEffect, useState } from 'react';
import { TestTube } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Input } from '../components/ui';
import api from '../api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [reg, setReg] = useState({ email: '', password: '', first_name: '', last_name: '' });

  useEffect(() => {
    try {
      const prefs = localStorage.getItem('tc_prefs');
      if (prefs) {
        const js = JSON.parse(prefs);
        if (typeof js?.remember === 'boolean') setRemember(js.remember);
        if (js?.email) setUsername(js.email);
        if (js?.tenant_id !== undefined && js?.tenant_id !== null) setTenantId(String(js.tenant_id));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      if (remember) {
        localStorage.setItem(
          'tc_prefs',
          JSON.stringify({
            remember: true,
            email: username,
            tenant_id: tenantId ? Number(tenantId) : null,
          }),
        );
      } else {
        localStorage.removeItem('tc_prefs');
      }
    } catch (_) {}
  }, [remember, username, tenantId]);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const tid = tenantId ? parseInt(tenantId, 10) : undefined;
      await login(username, password, tid);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);
    try {
      await api.register(reg.email, reg.password, reg.first_name, reg.last_name);
      setUsername(reg.email);
      setPassword(reg.password);
      setRegisterMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
            <TestTube className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">TestCloud</h1>
          <p className="text-gray-600">Професійна платформа тест-менеджменту</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {!registerMode ? (
          <div className="space-y-4">
            <Input label="Email" type="email" value={username} onChange={setUsername} required />
            <Input label="Пароль" type="password" value={password} onChange={setPassword} required />
            <Input label="Tenant ID (опціонально)" type="number" value={tenantId} onChange={setTenantId} />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">Запам'ятати мене</span>
              </label>
              <button className="text-blue-600 hover:underline" onClick={() => setRegisterMode(true)}>
                Створити акаунт
              </button>
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full" >
              {loading ? 'Вхід...' : 'Увійти'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="Email" type="email" value={reg.email} onChange={(val) => setReg({ ...reg, email: val })} required />
            <Input label="Пароль" type="password" value={reg.password} onChange={(val) => setReg({ ...reg, password: val })} required />
            <Input label="Ім'я" value={reg.first_name} onChange={(val) => setReg({ ...reg, first_name: val })} />
            <Input label="Прізвище" value={reg.last_name} onChange={(val) => setReg({ ...reg, last_name: val })} />
            <div className="flex items-center gap-3">
              <Button onClick={handleRegister} disabled={loading} className="flex-1">
                {loading ? 'Реєстрація...' : 'Зареєструватись'}
              </Button>
              <Button variant="secondary" onClick={() => setRegisterMode(false)} className="flex-1">
                Назад
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
