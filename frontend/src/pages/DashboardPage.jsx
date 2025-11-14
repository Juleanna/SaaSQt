import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  FolderPlus,
  ListChecks,
  PlayCircle,
  RefreshCcw,
  Layers,
  ClipboardCheck,
  Clock3,
  Rocket,
  Plus,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Alert, Button, Card, Input, StatCard } from '../components/ui';

const normalizeList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

const slugify = (value) =>
  value
    ?.toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || '';

function FloatingActions({ actions, open, onToggle }) {
  return (
    <div className="fixed bottom-6 right-6 z-40 space-y-3">
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-64 p-4 space-y-3">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                onToggle(false);
                if (typeof document !== 'undefined') {
                  const el = document.getElementById(action.id);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              }}
              className={`w-full text-left border rounded-xl px-3 py-2 transition ${
                action.disabled
                  ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                  : 'hover:border-blue-400 hover:bg-blue-50 bg-white border-gray-200'
              }`}
            >
              <p className="font-semibold text-gray-800">{action.label}</p>
              <p className="text-sm text-gray-500">{action.description}</p>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-xl transition"
      >
        <Plus className="w-5 h-5" />
        <span className="font-semibold">{open ? 'Закрити' : 'Швидкі дії'}</span>
      </button>
    </div>
  );
}

export default function DashboardPage({ onOpenAccount }) {
  const {
    user,
    tenants,
    currentTenant,
    switchTenantCtx,
    refreshTenants,
    refreshMemberships,
    memberships,
    logout,
  } = useAuth();
  const [projects, setProjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [runs, setRuns] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState(null);

  const [tenantForm, setTenantForm] = useState({ name: '', slug: '' });
  const [tenantSlugLocked, setTenantSlugLocked] = useState(false);
  const [tenantStatus, setTenantStatus] = useState(null);

  const [projectForm, setProjectForm] = useState({ key: '', name: '', description: '' });
  const [projectStatus, setProjectStatus] = useState(null);

  const [planForm, setPlanForm] = useState({ name: '', description: '' });
  const [planStatus, setPlanStatus] = useState(null);

  const [runForm, setRunForm] = useState({ name: '', plan: '' });
  const [runStatus, setRunStatus] = useState(null);

  const [fabOpen, setFabOpen] = useState(false);

  useEffect(() => {
    if (tenantSlugLocked) return;
    setTenantForm((prev) => {
      const nextSlug = slugify(prev.name);
      if (prev.slug === nextSlug) return prev;
      return { ...prev, slug: nextSlug };
    });
  }, [tenantForm.name, tenantSlugLocked]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const selectedProjectUpdatedLabel = useMemo(() => {
    if (!selectedProject) return '---';
    const ts = selectedProject.updated_at || selectedProject.created_at;
    if (!ts) return '---';
    try {
      return new Date(ts).toLocaleString();
    } catch (_) {
      return ts;
    }
  }, [selectedProject]);

  const normalizedTenantSlug = useMemo(
    () => tenantForm.slug.trim().toLowerCase(),
    [tenantForm.slug],
  );

  const tenantSlugExists = useMemo(() => {
    if (!normalizedTenantSlug) return false;
    return tenants.some((tenant) => (tenant.slug || '').toLowerCase() === normalizedTenantSlug);
  }, [normalizedTenantSlug, tenants]);

  const accessibleTenantSet = useMemo(() => {
    const set = new Set(memberships.map((membership) => membership.tenant));
    tenants.forEach((tenant) => {
      if (tenant.owner_user_id && user?.id && tenant.owner_user_id === user.id) {
        set.add(tenant.id);
      }
    });
    return set;
  }, [memberships, tenants, user?.id]);

  const stats = useMemo(() => {
    const activeRuns = runs.filter((run) => ['scheduled', 'running', 'in_progress'].includes(run.status)).length;
    return [
      {
        icon: LayoutDashboard,
        label: 'Проєкти',
        value: projects.length,
        color: 'blue',
      },
      {
        icon: ListChecks,
        label: 'Плани',
        value: plans.length,
        color: 'green',
      },
      {
        icon: PlayCircle,
        label: 'Прогони',
        value: runs.length,
        trend: `${activeRuns} активні`,
        color: 'orange',
      },
      {
        icon: Layers,
        label: 'Розділи',
        value: sections.length,
        color: 'purple',
      },
    ];
  }, [plans.length, projects.length, runs, sections.length]);

  const handleTenantSwitch = async (tenantId) => {
    if (!tenantId) return;
    const numericId = Number(tenantId);
    if (!accessibleTenantSet.has(numericId)) {
      setPageMessage({ type: 'error', text: 'Ви не є учасником цього tenant.' });
      return;
    }
    try {
      await switchTenantCtx(numericId);
      setPageMessage(null);
    } catch (err) {
      setPageMessage({ type: 'error', text: err.message || 'Не вдалося змінити tenant' });
    }
  };

  const refreshProjects = useCallback(async () => {
    if (!currentTenant) {
      setProjects([]);
      setSelectedProjectId(null);
      return [];
    }
    const payload = await api.getProjects();
    const list = normalizeList(payload);
    setProjects(list);
    setSelectedProjectId((prev) => {
      if (prev && list.some((item) => item.id === prev)) {
        return prev;
      }
      return list[0]?.id ?? null;
    });
    return list;
  }, [currentTenant]);

  const refreshPlans = useCallback(async (projectId) => {
    if (!projectId) {
      setPlans([]);
      return [];
    }
    const payload = await api.getPlans(projectId);
    const list = normalizeList(payload);
    setPlans(list);
    return list;
  }, []);

  const refreshRuns = useCallback(async (projectId) => {
    if (!projectId) {
      setRuns([]);
      return [];
    }
    const payload = await api.getRuns(projectId);
    const list = normalizeList(payload);
    setRuns(list);
    return list;
  }, []);

  const refreshSections = useCallback(async (projectId) => {
    if (!projectId) {
      setSections([]);
      return [];
    }
    const payload = await api.getSections(projectId);
    const list = normalizeList(payload);
    setSections(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentTenant) {
        setProjects([]);
        setSelectedProjectId(null);
        return;
      }
      setLoading(true);
      try {
        await refreshProjects();
      } catch (err) {
        if (!cancelled) {
          setPageMessage({ type: 'error', text: err.message || 'Не вдалося завантажити проєкти' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTenant, refreshProjects]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setPlans([]);
      setRuns([]);
      setSections([]);
      return;
    }
    const load = async () => {
      try {
        await Promise.all([
          refreshPlans(selectedProjectId),
          refreshRuns(selectedProjectId),
          refreshSections(selectedProjectId),
        ]);
      } catch (err) {
        if (!cancelled) {
          setPageMessage({ type: 'error', text: err.message || 'Не вдалося оновити пов\'язані дані' });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshPlans, refreshRuns, refreshSections, selectedProjectId]);

  const handleTenantSubmit = async (event) => {
    event.preventDefault();
    if (!tenantForm.name.trim()) {
      setTenantStatus({ type: 'error', text: 'Вкажіть назву tenant.' });
      return;
    }
    if (!tenantForm.slug.trim()) {
      setTenantStatus({ type: 'error', text: 'Slug обовʼязковий.' });
      return;
    }
    if (tenantSlugExists) {
      setTenantStatus({ type: 'error', text: 'Такий slug вже використовується. Оберіть інший.' });
      return;
    }
    setTenantStatus({ type: 'info', text: 'Створюємо tenant...' });
    try {
      const response = await api.createTenant({
        name: tenantForm.name.trim(),
        slug: tenantForm.slug.trim(),
      });
      await refreshTenants();
      await refreshMemberships(user?.id);
      if (response?.id) {
        await switchTenantCtx(response.id);
      }
      setTenantForm({ name: '', slug: '' });
      setTenantSlugLocked(false);
      setTenantStatus({ type: 'success', text: `Tenant ${response.name} створено й увімкнено.` });
    } catch (err) {
      setTenantStatus({ type: 'error', text: err.message || 'Помилка створення tenant' });
    }
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    if (!currentTenant) {
      setProjectStatus({ type: 'error', text: 'Спершу оберіть tenant, щоб додати проєкт.' });
      return;
    }
    if (!projectForm.key.trim() || !projectForm.name.trim()) {
      setProjectStatus({ type: 'error', text: 'Ключ і назва проєкту є обовʼязковими.' });
      return;
    }
    setProjectStatus({ type: 'info', text: 'Зберігаємо проєкт...' });
    try {
      const payload = {
        key: projectForm.key.trim().toUpperCase(),
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
      };
      const created = await api.createProject(payload);
      await refreshProjects();
      if (created?.id) {
        setSelectedProjectId(created.id);
      }
      setProjectForm({ key: '', name: '', description: '' });
      setProjectStatus({ type: 'success', text: `Проєкт ${payload.name} створено.` });
    } catch (err) {
      setProjectStatus({ type: 'error', text: err.message || 'Помилка створення проєкту' });
    }
  };

  const handlePlanSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setPlanStatus({ type: 'error', text: 'Спершу оберіть проєкт.' });
      return;
    }
    if (!planForm.name.trim()) {
      setPlanStatus({ type: 'error', text: 'Назва плану є обовʼязковою.' });
      return;
    }
    setPlanStatus({ type: 'info', text: 'Створюємо план...' });
    try {
      const payload = {
        project: selectedProjectId,
        name: planForm.name.trim(),
        description: planForm.description.trim(),
      };
      await api.createPlan(payload);
      await refreshPlans(selectedProjectId);
      setPlanForm({ name: '', description: '' });
      setPlanStatus({ type: 'success', text: 'План створено.' });
    } catch (err) {
      setPlanStatus({ type: 'error', text: err.message || 'Не вдалося створити план' });
    }
  };

  const handleRunSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setRunStatus({ type: 'error', text: 'Обрати проєкт обовʼязково для прогона.' });
      return;
    }
    if (!runForm.name.trim()) {
      setRunStatus({ type: 'error', text: 'Дайте назву прогона.' });
      return;
    }
    setRunStatus({ type: 'info', text: 'Запускаємо прогон...' });
    try {
      const payload = {
        project: selectedProjectId,
        name: runForm.name.trim(),
      };
      if (runForm.plan) {
        payload.plan = Number(runForm.plan);
      }
      await api.createRun(payload);
      await refreshRuns(selectedProjectId);
      setRunForm({ name: '', plan: '' });
      setRunStatus({ type: 'success', text: 'Прогон створено.' });
    } catch (err) {
      setRunStatus({ type: 'error', text: err.message || 'Не вдалося створити прогон' });
    }
  };

  const handleGlobalRefresh = async () => {
    setLoading(true);
    try {
      await refreshProjects();
      if (selectedProjectId) {
        await Promise.all([
          refreshPlans(selectedProjectId),
          refreshRuns(selectedProjectId),
          refreshSections(selectedProjectId),
        ]);
      }
      setPageMessage({ type: 'success', text: 'Дані поновлено.' });
    } catch (err) {
      setPageMessage({ type: 'error', text: err.message || 'Не вдалося оновити дані' });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      id: 'tenant-form',
      label: 'Новий tenant',
      description: 'Створити нову організацію та відразу перейти до неї.',
      disabled: false,
    },
    {
      id: 'project-form',
      label: 'Новий проєкт',
      description: currentTenant ? 'Додати проєкт у вибраному tenant.' : 'Спершу оберіть/створіть tenant.',
      disabled: !currentTenant,
    },
    {
      id: 'plan-form',
      label: 'План тестування',
      description: selectedProject ? 'Зберіть тест-кейси для релізу.' : 'Необхідно обрати проєкт.',
      disabled: !selectedProjectId,
    },
    {
      id: 'run-form',
      label: 'Прогон',
      description: selectedProject ? 'Запустіть прогони вручну або автоматично.' : 'Необхідно обрати проєкт.',
      disabled: !selectedProjectId,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap gap-4 justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 uppercase">Ласкаво просимо</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {user?.first_name || user?.username}, давайте керувати тестуванням
            </h1>
            <p className="text-gray-500">
              {currentTenant
                ? `Активний tenant: ${
                    tenants.find((t) => t.id === currentTenant)?.name || `#${currentTenant}`
                  }`
                : 'Оберіть або створіть tenant, щоб працювати з проєктами.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={RefreshCcw}
              onClick={handleGlobalRefresh}
              disabled={loading}
            >
              Оновити
            </Button>
            <div className="flex gap-3">
              <Button variant="primary" icon={Settings} onClick={onOpenAccount}>
                Профіль
              </Button>
              <Button variant="danger" onClick={logout}>
                Вийти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {pageMessage && <Alert type={pageMessage.type}>{pageMessage.text}</Alert>}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card
            title="Організації"
            actions={
              tenants.length > 0 && (
                <select
                  value={
                    currentTenant !== null && currentTenant !== undefined ? String(currentTenant) : ''
                  }
                  onChange={(e) => handleTenantSwitch(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">Оберіть tenant</option>
                  {tenants.map((tenant) => {
                    const hasAccess = accessibleTenantSet.has(tenant.id);
                    return (
                      <option key={tenant.id} value={String(tenant.id)} disabled={!hasAccess}>
                        {tenant.name}
                        {!hasAccess ? ' (немає доступу)' : ''}
                      </option>
                    );
                  })}
                </select>
              )
            }
            className="lg:col-span-1"
          >
            <form id="tenant-form" onSubmit={handleTenantSubmit} className="space-y-4">
              {tenantStatus && <Alert type={tenantStatus.type}>{tenantStatus.text}</Alert>}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Створіть tenant для нової компанії/команди. Ви автоматично будете перемкнені на нього.
                </p>
              </div>
              <Input
                label="Назва"
                value={tenantForm.name}
                onChange={(val) => setTenantForm((prev) => ({ ...prev, name: val }))}
                placeholder="TestCloud Labs"
                required
              />
              <div>
                <Input
                  label="Slug"
                  value={tenantForm.slug}
                  onChange={(val) => {
                    setTenantSlugLocked(true);
                    setTenantForm((prev) => ({ ...prev, slug: val }));
                  }}
                  placeholder="testcloud"
                  required
                />
                {tenantSlugExists && (
                  <p className="text-sm text-red-600 -mt-2 mb-2">
                    Такий slug вже існує. Спробуйте інший.
                  </p>
                )}
              </div>
              <Button type="submit" icon={UserPlus}>
                Створити tenant
              </Button>
            </form>
          </Card>

          <Card title="Проєкти" className="lg:col-span-2">
            <form id="project-form" onSubmit={handleProjectSubmit} className="space-y-4">
              {projectStatus && <Alert type={projectStatus.type}>{projectStatus.text}</Alert>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Ключ"
                  value={projectForm.key}
                  onChange={(val) => setProjectForm((prev) => ({ ...prev, key: val }))}
                  placeholder="TC"
                  required
                />
                <div className="md:col-span-2">
                  <Input
                    label="Назва"
                    value={projectForm.name}
                    onChange={(val) => setProjectForm((prev) => ({ ...prev, name: val }))}
                    placeholder="TestCloud Suite"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Короткий опис проєкту"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-500">
                  {currentTenant
                    ? 'Новий проєкт буде створено у вибраному tenant.'
                    : 'Щоб створити проєкт, спершу активуйте tenant.'}
                </p>
                <Button type="submit" icon={FolderPlus} disabled={!currentTenant}>
                  Додати проєкт
                </Button>
              </div>
            </form>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-800">Список проєктів</h4>
                <span className="text-sm text-gray-500">{loading ? 'Завантаження...' : `${projects.length} шт.`}</span>
              </div>
              {projects.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {currentTenant
                    ? 'Ще немає жодного проєкту. Створіть перший за допомогою форми вище.'
                    : 'Цей список зʼявиться після вибору tenant.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full text-left border rounded-xl px-4 py-3 transition ${
                        selectedProjectId === project.id
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm uppercase font-semibold text-gray-500">{project.key}</p>
                          <p className="text-lg font-semibold text-gray-900">{project.name}</p>
                        </div>
                        <ClipboardCheck className="w-5 h-5 text-gray-400" />
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{project.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Плани та прогони" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form id="plan-form" onSubmit={handlePlanSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-green-600" />
                  <h5 className="font-semibold text-gray-800">Швидке створення плану</h5>
                </div>
                {planStatus && <Alert type={planStatus.type}>{planStatus.text}</Alert>}
                <Input
                  label="Назва плану"
                  value={planForm.name}
                  onChange={(val) => setPlanForm((prev) => ({ ...prev, name: val }))}
                  placeholder="Regression Sprint 24"
                  required
                  disabled={!selectedProjectId}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                  <textarea
                    value={planForm.description}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Цілі, реліз, покриття..."
                    disabled={!selectedProjectId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50"
                  />
                </div>
                <Button type="submit" icon={ListChecks} disabled={!selectedProjectId}>
                  Створити план
                </Button>
              </form>

              <form id="run-form" onSubmit={handleRunSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-orange-600" />
                  <h5 className="font-semibold text-gray-800">Запустити прогон</h5>
                </div>
                {runStatus && <Alert type={runStatus.type}>{runStatus.text}</Alert>}
                <Input
                  label="Назва прогона"
                  value={runForm.name}
                  onChange={(val) => setRunForm((prev) => ({ ...prev, name: val }))}
                  placeholder="Smoke build 1.5"
                  required
                  disabled={!selectedProjectId}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">План (необовʼязково)</label>
                  <select
                    value={runForm.plan}
                    onChange={(e) => setRunForm((prev) => ({ ...prev, plan: e.target.value }))}
                    disabled={!selectedProjectId || plans.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Без плану</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={String(plan.id)}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" icon={PlayCircle} disabled={!selectedProjectId}>
                  Створити прогон
                </Button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="text-sm uppercase text-gray-500 font-semibold mb-2">Останні плани</h5>
                {plans.length === 0 ? (
                  <p className="text-sm text-gray-500">Немає планів для вибраного проєкту.</p>
                ) : (
                  <ul className="space-y-2">
                    {plans.slice(0, 4).map((plan) => (
                      <li key={plan.id} className="border rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{plan.name}</p>
                          {plan.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{plan.description}</p>
                          )}
                        </div>
                        <Clock3 className="w-4 h-4 text-gray-400" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h5 className="text-sm uppercase text-gray-500 font-semibold mb-2">Активні прогони</h5>
                {runs.length === 0 ? (
                  <p className="text-sm text-gray-500">Поки що немає прогонів.</p>
                ) : (
                  <ul className="space-y-2">
                    {runs.slice(0, 4).map((run) => (
                      <li key={run.id} className="border rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{run.name}</p>
                            <p className="text-xs text-gray-500">Статус: {run.status}</p>
                          </div>
                          <Rocket className="w-4 h-4 text-gray-400" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card title="Test Manager Hub" className="space-y-6" id="manager-panel">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="border border-dashed border-blue-200 rounded-xl p-4 bg-blue-50">
                  <p className="text-sm uppercase text-blue-600 font-semibold">Активний проєкт</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{selectedProject.name}</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Ключ: {selectedProject.key} · Оновлено{' '}
                    {selectedProjectUpdatedLabel}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Layers className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Структура</p>
                      <p className="text-2xl font-bold text-gray-900">{sections.length}</p>
                      <p className="text-xs text-gray-500">Розділи для групування тестів</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <ClipboardCheck className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Плани / Прогони</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {plans.length} / {runs.length}
                      </p>
                      <p className="text-xs text-gray-500">Готовність до релізів</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Clock3 className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Активні прогони</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {runs.filter((run) => run.status !== 'completed').length}
                      </p>
                      <p className="text-xs text-gray-500">Авто + ручні</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Rocket className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Швидкі дії</p>
                      <p className="text-xs text-gray-500">
                        Використовуйте плаваючу кнопку внизу, щоб створювати сутності без пошуку форм.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Що далі?</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Створіть секції для модулів продукту.</li>
                    <li>Імпортуйте тест-кейси або додайте їх вручну.</li>
                    <li>Звʼяжіть плани з релізами та сформуйте прогон.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Оберіть проєкт, щоб бачити інсайти Test Manager.</p>
            )}
          </Card>
        </section>
      </main>

      <FloatingActions actions={quickActions} open={fabOpen} onToggle={setFabOpen} />
    </div>
  );
}
