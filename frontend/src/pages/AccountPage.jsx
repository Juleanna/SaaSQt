import React, { useMemo, useState } from 'react';
import { User, Building, Settings, Save, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Card, Input } from '../components/ui';

const defaultPrefs = () => {
  try {
    return (
      JSON.parse(localStorage.getItem('tc_profile_prefs')) || {
        displayName: '',
        theme: 'system',
        preferredTenant: null,
      }
    );
  } catch (_) {
    return { displayName: '', theme: 'system', preferredTenant: null };
  }
};

export default function AccountPage({ onBack }) {
  const { user, memberships, currentTenant, switchTenantCtx, tenantNameById } = useAuth();
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [status, setStatus] = useState(null);

  const membershipTenants = useMemo(() => Array.from(new Set(memberships.map((m) => m.tenant))), [memberships]);

  const handleSave = async () => {
    try {
      localStorage.setItem('tc_profile_prefs', JSON.stringify(prefs));
      if (prefs.preferredTenant && prefs.preferredTenant !== currentTenant) {
        await switchTenantCtx(prefs.preferredTenant);
      }
      setStatus({ type: 'success', message: 'Налаштування збережено' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Не вдалося зберегти' });
    } finally {
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-8 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Особистий кабінет</h1>
          <p className="text-gray-500">Керуйте профілем і налаштуваннями TestCloud.</p>
        </div>
        <Button onClick={onBack} variant="secondary" icon={ChevronRight}>
          До дашборду
        </Button>
      </div>
      {status && <Alert type={status.type}>{status.message}</Alert>}

      <Card title="Профіль" className="border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-sm uppercase text-gray-500">Email</p>
            <p className="text-xl font-semibold text-gray-800">{user?.email}</p>
            <p className="text-sm text-gray-500">Username: {user?.username}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Input label="Ім'я" value={user?.first_name || ''} onChange={() => {}} disabled />
          <Input label="Прізвище" value={user?.last_name || ''} onChange={() => {}} disabled />
        </div>
      </Card>

      <Card title="Членства" className="border border-gray-100">
        {memberships.length === 0 ? (
          <p className="text-gray-500 text-sm">Немає прив'язок до жодного тенанта.</p>
        ) : (
          <div className="space-y-3">
            {memberships.map((m) => (
              <div key={`${m.tenant}-${m.id || m.role_key}`} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-800">{tenantNameById(m.tenant)}</p>
                  <p className="text-sm text-gray-500">Роль: {m.role_key}</p>
                </div>
                <Building className="w-6 h-6 text-gray-400" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Особисті налаштування" className="border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Відображуване ім'я"
            value={prefs.displayName}
            onChange={(val) => setPrefs((prev) => ({ ...prev, displayName: val }))}
            placeholder="Наприклад, Олена"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тема</label>
            <select
              value={prefs.theme}
              onChange={(e) => setPrefs((prev) => ({ ...prev, theme: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="system">Системна</option>
              <option value="light">Світла</option>
              <option value="dark">Темна</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Тенант за замовчуванням</label>
            <select
              value={prefs.preferredTenant ?? ''}
              onChange={(e) =>
                setPrefs((prev) => ({
                  ...prev,
                  preferredTenant: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Обрати автоматично</option>
              {membershipTenants.map((tid) => (
                <option key={tid} value={tid}>
                  {tenantNameById(tid)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Буде активовано під час наступного входу.</p>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} icon={Save}>
            Зберегти
          </Button>
        </div>
      </Card>

      <Card title="Безпека" className="border border-gray-100">
        <div className="flex items-center gap-3 text-gray-600">
          <Settings className="w-5 h-5" />
          <span>Функції зміни пароля/2FA будуть доступні найближчим часом.</span>
        </div>
      </Card>
    </div>
  );
}
