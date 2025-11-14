import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Building,
  Settings,
  Save,
  ChevronRight,
  Edit,
  Shield,
  Mail,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Card, Input } from '../components/ui';
import api from '../api/client';

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
  const {
    user,
    memberships,
    currentTenant,
    switchTenantCtx,
    tenantNameById,
    tenants,
    refreshTenants,
    refreshMemberships,
  } = useAuth();
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [status, setStatus] = useState(null);

  const [manageTenantId, setManageTenantId] = useState(null);
  const [manageForm, setManageForm] = useState({ name: '', slug: '' });
  const [manageStatus, setManageStatus] = useState(null);
  const [tenantMembers, setTenantMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '' });
  const [inviteStatus, setInviteStatus] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);

  const membershipTenants = useMemo(() => Array.from(new Set(memberships.map((m) => m.tenant))), [memberships]);
  const managingMembership = useMemo(
    () => memberships.find((m) => m.tenant === manageTenantId),
    [manageTenantId, memberships],
  );
  const canManageTenant = managingMembership && ['owner', 'admin'].includes(managingMembership.role_key);

  const handleSave = async () => {
    try {
      localStorage.setItem('tc_profile_prefs', JSON.stringify(prefs));
      if (prefs.preferredTenant && prefs.preferredTenant !== currentTenant) {
        await switchTenantCtx(prefs.preferredTenant);
      }
      setStatus({ type: 'success', message: 'Налаштування збережено.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Не вдалося зберегти налаштування' });
    } finally {
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const fetchMembers = async (tenantId) => {
    if (!tenantId) return;
    setMembersLoading(true);
    try {
      const payload = await api.getTenantMembers(tenantId);
      const list = payload.results || payload || [];
      setTenantMembers(list);
    } catch (_) {
      setTenantMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!manageTenantId) return;
    const tenantData = tenants.find((t) => t.id === manageTenantId);
    if (tenantData) {
      setManageForm({ name: tenantData.name || '', slug: tenantData.slug || '' });
    }
    fetchMembers(manageTenantId);
  }, [manageTenantId, tenants]);

  const handleTenantUpdate = async (event) => {
    event.preventDefault();
    if (!manageTenantId || !canManageTenant) return;
    setManageStatus({ type: 'info', message: 'Зберігаємо зміни...' });
    try {
      await api.updateTenant(manageTenantId, {
        name: manageForm.name.trim(),
        slug: manageForm.slug.trim(),
      });
      await refreshTenants();
      setManageStatus({ type: 'success', message: 'Tenant оновлено.' });
    } catch (err) {
      setManageStatus({ type: 'error', message: err.message || 'Не вдалося оновити tenant' });
    }
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    if (!manageTenantId || !inviteForm.email.trim() || !canManageTenant) return;
    setInviteStatus({ type: 'info', message: 'Надсилаємо запрошення...' });
    try {
      await api.createInvitation({
        tenant: manageTenantId,
        email: inviteForm.email.trim(),
      });
      setInviteForm({ email: '' });
      setInviteStatus({ type: 'success', message: 'Запрошення надіслано.' });
    } catch (err) {
      setInviteStatus({ type: 'error', message: err.message || 'Не вдалося надіслати запрошення' });
    }
  };

  const handleRemoveMember = async (member) => {
    if (!canManageTenant || !member?.id || member.user_id === user?.id) return;
    try {
      await api.deleteMembership(member.id);
      await fetchMembers(manageTenantId);
    } catch (_) {}
  };

  const manageTenantName = manageTenantId ? tenantNameById(manageTenantId) : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-8 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Профіль</h1>
          <p className="text-gray-500">Налаштування облікового запису та доступів до організацій.</p>
        </div>
        <Button onClick={onBack} variant="secondary" icon={ChevronRight}>
          Повернутися
        </Button>
      </div>
      {status && <Alert type={status.type}>{status.message}</Alert>}

      <Card title="Обліковий запис" className="border border-gray-100">
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
          <Input label="Імʼя" value={user?.first_name || ''} onChange={() => {}} disabled />
          <Input label="Прізвище" value={user?.last_name || ''} onChange={() => {}} disabled />
        </div>
      </Card>

      <Card title="Членства" className="border border-gray-100">
        {memberships.length === 0 ? (
          <p className="text-gray-500 text-sm">Немає організацій, до яких надано доступ.</p>
        ) : (
          <div className="space-y-3">
            {memberships.map((m) => (
              <div
                key={`${m.tenant}-${m.id || m.role_key}`}
                className="flex items-center justify-between border rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">{tenantNameById(m.tenant)}</p>
                  <p className="text-sm text-gray-500">Роль: {m.role_key}</p>
                </div>
                <div className="flex items-center gap-2">
                  {['owner', 'admin'].includes(m.role_key) && (
                    <Button
                      variant="secondary"
                      className="text-sm px-3 py-1"
                      icon={Edit}
                      onClick={() => {
                        setManageTenantId(m.tenant);
                        setManageStatus(null);
                        setInviteStatus(null);
                        setShowManageModal(true);
                        fetchMembers(m.tenant);
                      }}
                    >
                      Керувати
                    </Button>
                  )}
                  <Building className="w-6 h-6 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {manageTenantId && showManageModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase text-gray-500">Керування tenant</p>
                <h2 className="text-2xl font-bold text-gray-900">{manageTenantName}</h2>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowManageModal(false);
                  setManageTenantId(null);
                  setManageStatus(null);
                  setInviteStatus(null);
                }}
              >
                Закрити
              </Button>
            </div>
          {manageStatus && <Alert type={manageStatus.type}>{manageStatus.message}</Alert>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleTenantUpdate} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Параметри tenant
              </h3>
              <Input
                label="Назва"
                value={manageForm.name}
                onChange={(val) => setManageForm((prev) => ({ ...prev, name: val }))}
                disabled={!canManageTenant}
              />
              <Input
                label="Slug"
                value={manageForm.slug}
                onChange={(val) => setManageForm((prev) => ({ ...prev, slug: val }))}
                disabled={!canManageTenant}
              />
              {canManageTenant ? (
                <Button type="submit" icon={Save}>
                  Зберегти
                </Button>
              ) : (
                <p className="text-sm text-gray-500">Редагування доступне лише власникам або адміністраторам.</p>
              )}
            </form>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Запросити нового учасника
              </h3>
              {inviteStatus && <Alert type={inviteStatus.type}>{inviteStatus.message}</Alert>}
              <Input
                label="Email"
                type="email"
                placeholder="user@example.com"
                value={inviteForm.email}
                onChange={(val) => setInviteForm({ email: val })}
                disabled={!canManageTenant}
              />
              <Button type="submit" icon={Mail} disabled={!canManageTenant}>
                Надіслати запрошення
              </Button>
            </form>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Учасники</h3>
            {membersLoading ? (
              <p className="text-sm text-gray-500">Завантажуємо...</p>
            ) : tenantMembers.length === 0 ? (
              <p className="text-sm text-gray-500">Ще немає учасників.</p>
            ) : (
              <div className="space-y-2">
                {tenantMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between border rounded-lg px-4 py-2"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">Користувач #{member.user_id}</p>
                      <p className="text-sm text-gray-500">Роль: {member.role_key || 'member'}</p>
                    </div>
                    {canManageTenant && member.user_id !== user?.id && (
                      <Button
                        variant="secondary"
                        className="text-sm"
                        icon={Trash2}
                        onClick={() => handleRemoveMember(member)}
                      >
                        Видалити
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      <Card title="Профіль та тема" className="border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Відображуване імʼя"
            value={prefs.displayName}
            onChange={(val) => setPrefs((prev) => ({ ...prev, displayName: val }))}
            placeholder="Ваша назва в команді"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant за замовчуванням</label>
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
              <option value="">Не вибрано</option>
              {membershipTenants.map((tid) => (
                <option key={tid} value={tid}>
                  {tenantNameById(tid)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Використовується під час входу, якщо tenant не обрано.</p>
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
          <span>У майбутньому тут зʼявляться налаштування MFA та керування ключами доступу.</span>
        </div>
      </Card>
    </div>
  );
}
