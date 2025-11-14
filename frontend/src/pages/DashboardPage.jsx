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
        <span className="font-semibold">{open ? 'Р—Р°РєСЂРёС‚Рё' : 'РЁРІРёРґРєС– РґС–С—'}</span>
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

  const [sectionForm, setSectionForm] = useState({ name: '', parent: '' });
  const [sectionStatus, setSectionStatus] = useState(null);

  const [testCaseForm, setTestCaseForm] = useState({ title: '', description: '', section: '' });
  const [testCaseStatus, setTestCaseStatus] = useState(null);

  const [planReleaseForm, setPlanReleaseForm] = useState({
    plan: '',
    releaseName: '',
    releaseVersion: '',
    runName: '',
  });
  const [planReleaseStatus, setPlanReleaseStatus] = useState(null);

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
        label: 'РџСЂРѕС”РєС‚Рё',
        value: projects.length,
        color: 'blue',
      },
      {
        icon: ListChecks,
        label: 'РџР»Р°РЅРё',
        value: plans.length,
        color: 'green',
      },
      {
        icon: PlayCircle,
        label: 'РџСЂРѕРіРѕРЅРё',
        value: runs.length,
        trend: `${activeRuns} Р°РєС‚РёРІРЅС–`,
        color: 'orange',
      },
      {
        icon: Layers,
        label: 'Р РѕР·РґС–Р»Рё',
        value: sections.length,
        color: 'purple',
      },
    ];
  }, [plans.length, projects.length, runs, sections.length]);

  const handleTenantSwitch = async (tenantId) => {
    if (!tenantId) return;
    const numericId = Number(tenantId);
    if (!accessibleTenantSet.has(numericId)) {
      setPageMessage({ type: 'error', text: 'Р’Рё РЅРµ С” СѓС‡Р°СЃРЅРёРєРѕРј С†СЊРѕРіРѕ tenant.' });
      return;
    }
    try {
      await switchTenantCtx(numericId);
      setPageMessage(null);
    } catch (err) {
      setPageMessage({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·РјС–РЅРёС‚Рё tenant' });
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
          setPageMessage({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РїСЂРѕС”РєС‚Рё' });
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
          setPageMessage({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё РїРѕРІ\'СЏР·Р°РЅС– РґР°РЅС–' });
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
      setTenantStatus({ type: 'error', text: 'Р’РєР°Р¶С–С‚СЊ РЅР°Р·РІСѓ tenant.' });
      return;
    }
    if (!tenantForm.slug.trim()) {
      setTenantStatus({ type: 'error', text: 'Slug РѕР±РѕРІКјСЏР·РєРѕРІРёР№.' });
      return;
    }
    if (tenantSlugExists) {
      setTenantStatus({ type: 'error', text: 'РўР°РєРёР№ slug РІР¶Рµ РІРёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚СЊСЃСЏ. РћР±РµСЂС–С‚СЊ С–РЅС€РёР№.' });
      return;
    }
    setTenantStatus({ type: 'info', text: 'РЎС‚РІРѕСЂСЋС”РјРѕ tenant...' });
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
      setTenantStatus({ type: 'success', text: `Tenant ${response.name} СЃС‚РІРѕСЂРµРЅРѕ Р№ СѓРІС–РјРєРЅРµРЅРѕ.` });
    } catch (err) {
      setTenantStatus({ type: 'error', text: err.message || 'РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµРЅРЅСЏ tenant' });
    }
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    if (!currentTenant) {
      setProjectStatus({ type: 'error', text: 'РЎРїРµСЂС€Сѓ РѕР±РµСЂС–С‚СЊ tenant, С‰РѕР± РґРѕРґР°С‚Рё РїСЂРѕС”РєС‚.' });
      return;
    }
    if (!projectForm.key.trim() || !projectForm.name.trim()) {
      setProjectStatus({ type: 'error', text: 'РљР»СЋС‡ С– РЅР°Р·РІР° РїСЂРѕС”РєС‚Сѓ С” РѕР±РѕРІКјСЏР·РєРѕРІРёРјРё.' });
      return;
    }
    setProjectStatus({ type: 'info', text: 'Р—Р±РµСЂС–РіР°С”РјРѕ РїСЂРѕС”РєС‚...' });
    try {
      const payload = {
        key: projectForm.key.trim().toUpperCase(),
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
        tenant_id: currentTenant,
      };
      const created = await api.createProject(payload);
      await refreshProjects();
      if (created?.id) {
        setSelectedProjectId(created.id);
      }
      setProjectForm({ key: '', name: '', description: '' });
      setProjectStatus({ type: 'success', text: `РџСЂРѕС”РєС‚ ${payload.name} СЃС‚РІРѕСЂРµРЅРѕ.` });
    } catch (err) {
      setProjectStatus({ type: 'error', text: err.message || 'РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµРЅРЅСЏ РїСЂРѕС”РєС‚Сѓ' });
    }
  };

  const handlePlanSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setPlanStatus({ type: 'error', text: 'РЎРїРµСЂС€Сѓ РѕР±РµСЂС–С‚СЊ РїСЂРѕС”РєС‚.' });
      return;
    }
    if (!planForm.name.trim()) {
      setPlanStatus({ type: 'error', text: 'РќР°Р·РІР° РїР»Р°РЅСѓ С” РѕР±РѕРІКјСЏР·РєРѕРІРѕСЋ.' });
      return;
    }
    setPlanStatus({ type: 'info', text: 'РЎС‚РІРѕСЂСЋС”РјРѕ РїР»Р°РЅ...' });
    try {
      const payload = {
        project: selectedProjectId,
        name: planForm.name.trim(),
        description: planForm.description.trim(),
      };
      await api.createPlan(payload);
      await refreshPlans(selectedProjectId);
      setPlanForm({ name: '', description: '' });
      setPlanStatus({ type: 'success', text: 'РџР»Р°РЅ СЃС‚РІРѕСЂРµРЅРѕ.' });
    } catch (err) {
      setPlanStatus({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ СЃС‚РІРѕСЂРёС‚Рё РїР»Р°РЅ' });
    }
  };

  const handleRunSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setRunStatus({ type: 'error', text: 'РћР±СЂР°С‚Рё РїСЂРѕС”РєС‚ РѕР±РѕРІКјСЏР·РєРѕРІРѕ РґР»СЏ РїСЂРѕРіРѕРЅР°.' });
      return;
    }
    if (!runForm.name.trim()) {
      setRunStatus({ type: 'error', text: 'Р”Р°Р№С‚Рµ РЅР°Р·РІСѓ РїСЂРѕРіРѕРЅР°.' });
      return;
    }
    setRunStatus({ type: 'info', text: 'Р—Р°РїСѓСЃРєР°С”РјРѕ РїСЂРѕРіРѕРЅ...' });
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
      setRunStatus({ type: 'success', text: 'РџСЂРѕРіРѕРЅ СЃС‚РІРѕСЂРµРЅРѕ.' });
    } catch (err) {
      setRunStatus({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ СЃС‚РІРѕСЂРёС‚Рё РїСЂРѕРіРѕРЅ' });
    }
  };

    const handleSectionSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setSectionStatus({ type: 'error', text: 'Оберіть проєкт для створення секцій.' });
      return;
    }
    if (!sectionForm.name.trim()) {
      setSectionStatus({ type: 'error', text: 'Назва секції обовʼязкова.' });
      return;
    }
    setSectionStatus({ type: 'info', text: 'Створюємо секцію...' });
    try {
      const payload = {
        project: selectedProjectId,
        name: sectionForm.name.trim(),
      };
      if (sectionForm.parent) {
        payload.parent = Number(sectionForm.parent);
      }
      await api.createSection(payload);
      await refreshSections(selectedProjectId);
      setSectionForm({ name: '', parent: '' });
      setSectionStatus({ type: 'success', text: 'Секцію створено.' });
    } catch (err) {
      setSectionStatus({ type: 'error', text: err.message || 'Не вдалося створити секцію' });
    }
  };

  const handleTestCaseSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setTestCaseStatus({ type: 'error', text: 'Оберіть проєкт для тест-кейсу.' });
      return;
    }
    if (!testCaseForm.title.trim()) {
      setTestCaseStatus({ type: 'error', text: 'Назва кейсу обовʼязкова.' });
      return;
    }
    setTestCaseStatus({ type: 'info', text: 'Створюємо тест-кейс...' });
    try {
      const payload = {
        project: selectedProjectId,
        title: testCaseForm.title.trim(),
        description: testCaseForm.description.trim(),
        steps: [],
        tags: [],
      };
      if (testCaseForm.section) {
        payload.section = Number(testCaseForm.section);
      }
      await api.createTestCase(payload);
      setTestCaseForm({ title: '', description: '', section: '' });
      setTestCaseStatus({ type: 'success', text: 'Тест-кейс створено.' });
    } catch (err) {
      setTestCaseStatus({ type: 'error', text: err.message || 'Не вдалося створити тест-кейс' });
    }
  };

  const handlePlanReleaseSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setPlanReleaseStatus({ type: 'error', text: 'Оберіть проєкт.' });
      return;
    }
    if (!planReleaseForm.plan) {
      setPlanReleaseStatus({ type: 'error', text: 'Оберіть план.' });
      return;
    }
    if (!planReleaseForm.releaseName.trim()) {
      setPlanReleaseStatus({ type: 'error', text: 'Назва релізу обовʼязкова.' });
      return;
    }
    setPlanReleaseStatus({ type: 'info', text: 'Створюємо реліз та прогон...' });
    try {
      const release = await api.createRelease({
        project: selectedProjectId,
        name: planReleaseForm.releaseName.trim(),
        version: planReleaseForm.releaseVersion.trim(),
      });
      const planId = Number(planReleaseForm.plan);
      if (release?.id) {
        await api.updatePlan(planId, { release: release.id });
      }
      const planName = plans.find((p) => p.id === planId)?.name || 'План';
      const runName =
        planReleaseForm.runName.trim() || `${planName} · ${planReleaseForm.releaseName.trim()}`;
      await api.createRun({
        project: selectedProjectId,
        plan: planId,
        name: runName,
      });
      await refreshPlans(selectedProjectId);
      await refreshRuns(selectedProjectId);
      setPlanReleaseForm({ plan: '', releaseName: '', releaseVersion: '', runName: '' });
      setPlanReleaseStatus({ type: 'success', text: 'Реліз створено, план привʼязано та прогон запущено.' });
    } catch (err) {
      setPlanReleaseStatus({
        type: 'error',
        text: err.message || 'Не вдалося створити реліз та прогон',
      });
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
      setPageMessage({ type: 'success', text: 'Р”Р°РЅС– РїРѕРЅРѕРІР»РµРЅРѕ.' });
    } catch (err) {
      setPageMessage({ type: 'error', text: err.message || 'РќРµ РІРґР°Р»РѕСЃСЏ РѕРЅРѕРІРёС‚Рё РґР°РЅС–' });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      id: 'tenant-form',
      label: 'РќРѕРІРёР№ tenant',
      description: 'РЎС‚РІРѕСЂРёС‚Рё РЅРѕРІСѓ РѕСЂРіР°РЅС–Р·Р°С†С–СЋ С‚Р° РІС–РґСЂР°Р·Сѓ РїРµСЂРµР№С‚Рё РґРѕ РЅРµС—.',
      disabled: false,
    },
    {
      id: 'project-form',
      label: 'РќРѕРІРёР№ РїСЂРѕС”РєС‚',
      description: currentTenant ? 'Р”РѕРґР°С‚Рё РїСЂРѕС”РєС‚ Сѓ РІРёР±СЂР°РЅРѕРјСѓ tenant.' : 'РЎРїРµСЂС€Сѓ РѕР±РµСЂС–С‚СЊ/СЃС‚РІРѕСЂС–С‚СЊ tenant.',
      disabled: !currentTenant,
    },
    {
      id: 'plan-form',
      label: 'РџР»Р°РЅ С‚РµСЃС‚СѓРІР°РЅРЅСЏ',
      description: selectedProject ? 'Р—Р±РµСЂС–С‚СЊ С‚РµСЃС‚-РєРµР№СЃРё РґР»СЏ СЂРµР»С–Р·Сѓ.' : 'РќРµРѕР±С…С–РґРЅРѕ РѕР±СЂР°С‚Рё РїСЂРѕС”РєС‚.',
      disabled: !selectedProjectId,
    },
    {
      id: 'run-form',
      label: 'РџСЂРѕРіРѕРЅ',
      description: selectedProject ? 'Р—Р°РїСѓСЃС‚С–С‚СЊ РїСЂРѕРіРѕРЅРё РІСЂСѓС‡РЅСѓ Р°Р±Рѕ Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ.' : 'РќРµРѕР±С…С–РґРЅРѕ РѕР±СЂР°С‚Рё РїСЂРѕС”РєС‚.',
      disabled: !selectedProjectId,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap gap-4 justify-between items-center">
          <div>
            <p className="text-sm text-gray-500 uppercase">Р›Р°СЃРєР°РІРѕ РїСЂРѕСЃРёРјРѕ</p>
            <h1 className="text-3xl font-bold text-gray-900">
              {user?.first_name || user?.username}, РґР°РІР°Р№С‚Рµ РєРµСЂСѓРІР°С‚Рё С‚РµСЃС‚СѓРІР°РЅРЅСЏРј
            </h1>
            <p className="text-gray-500">
              {currentTenant
                ? `РђРєС‚РёРІРЅРёР№ tenant: ${
                    tenants.find((t) => t.id === currentTenant)?.name || `#${currentTenant}`
                  }`
                : 'РћР±РµСЂС–С‚СЊ Р°Р±Рѕ СЃС‚РІРѕСЂС–С‚СЊ tenant, С‰РѕР± РїСЂР°С†СЋРІР°С‚Рё Р· РїСЂРѕС”РєС‚Р°РјРё.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={RefreshCcw}
              onClick={handleGlobalRefresh}
              disabled={loading}
            >
              РћРЅРѕРІРёС‚Рё
            </Button>
            <div className="flex gap-3">
              <Button variant="primary" icon={Settings} onClick={onOpenAccount}>
                РџСЂРѕС„С–Р»СЊ
              </Button>
              <Button variant="danger" onClick={logout}>
                Р’РёР№С‚Рё
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
            title="РћСЂРіР°РЅС–Р·Р°С†С–С—"
            actions={
              tenants.length > 0 && (
                <select
                  value={
                    currentTenant !== null && currentTenant !== undefined ? String(currentTenant) : ''
                  }
                  onChange={(e) => handleTenantSwitch(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  <option value="">РћР±РµСЂС–С‚СЊ tenant</option>
                  {tenants
                    .filter((tenant) => accessibleTenantSet.has(tenant.id))
                    .map((tenant) => (
                      <option key={tenant.id} value={String(tenant.id)}>
                        {tenant.name}
                      </option>
                    ))}
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
                  РЎС‚РІРѕСЂС–С‚СЊ tenant РґР»СЏ РЅРѕРІРѕС— РєРѕРјРїР°РЅС–С—/РєРѕРјР°РЅРґРё. Р’Рё Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ Р±СѓРґРµС‚Рµ РїРµСЂРµРјРєРЅРµРЅС– РЅР° РЅСЊРѕРіРѕ.
                </p>
              </div>
              <Input
                label="РќР°Р·РІР°"
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
                    РўР°РєРёР№ slug РІР¶Рµ С–СЃРЅСѓС”. РЎРїСЂРѕР±СѓР№С‚Рµ С–РЅС€РёР№.
                  </p>
                )}
              </div>
              <Button type="submit" icon={UserPlus}>
                РЎС‚РІРѕСЂРёС‚Рё tenant
              </Button>
            </form>
          </Card>

          <Card title="РџСЂРѕС”РєС‚Рё" className="lg:col-span-2">
            <form id="project-form" onSubmit={handleProjectSubmit} className="space-y-4">
              {projectStatus && <Alert type={projectStatus.type}>{projectStatus.text}</Alert>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="РљР»СЋС‡"
                  value={projectForm.key}
                  onChange={(val) => setProjectForm((prev) => ({ ...prev, key: val }))}
                  placeholder="TC"
                  required
                />
                <div className="md:col-span-2">
                  <Input
                    label="РќР°Р·РІР°"
                    value={projectForm.name}
                    onChange={(val) => setProjectForm((prev) => ({ ...prev, name: val }))}
                    placeholder="TestCloud Suite"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">РћРїРёСЃ</label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="РљРѕСЂРѕС‚РєРёР№ РѕРїРёСЃ РїСЂРѕС”РєС‚Сѓ"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-500">
                  {currentTenant
                    ? 'РќРѕРІРёР№ РїСЂРѕС”РєС‚ Р±СѓРґРµ СЃС‚РІРѕСЂРµРЅРѕ Сѓ РІРёР±СЂР°РЅРѕРјСѓ tenant.'
                    : 'Р©РѕР± СЃС‚РІРѕСЂРёС‚Рё РїСЂРѕС”РєС‚, СЃРїРµСЂС€Сѓ Р°РєС‚РёРІСѓР№С‚Рµ tenant.'}
                </p>
                <Button type="submit" icon={FolderPlus} disabled={!currentTenant}>
                  Р”РѕРґР°С‚Рё РїСЂРѕС”РєС‚
                </Button>
              </div>
            </form>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-800">РЎРїРёСЃРѕРє РїСЂРѕС”РєС‚С–РІ</h4>
                <span className="text-sm text-gray-500">{loading ? 'Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ...' : `${projects.length} С€С‚.`}</span>
              </div>
              {projects.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {currentTenant
                    ? 'Р©Рµ РЅРµРјР°С” Р¶РѕРґРЅРѕРіРѕ РїСЂРѕС”РєС‚Сѓ. РЎС‚РІРѕСЂС–С‚СЊ РїРµСЂС€РёР№ Р·Р° РґРѕРїРѕРјРѕРіРѕСЋ С„РѕСЂРјРё РІРёС‰Рµ.'
                    : 'Р¦РµР№ СЃРїРёСЃРѕРє Р·КјСЏРІРёС‚СЊСЃСЏ РїС–СЃР»СЏ РІРёР±РѕСЂСѓ tenant.'}
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
          <Card title="РџР»Р°РЅРё С‚Р° РїСЂРѕРіРѕРЅРё" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form id="plan-form" onSubmit={handlePlanSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-green-600" />
                  <h5 className="font-semibold text-gray-800">РЁРІРёРґРєРµ СЃС‚РІРѕСЂРµРЅРЅСЏ РїР»Р°РЅСѓ</h5>
                </div>
                {planStatus && <Alert type={planStatus.type}>{planStatus.text}</Alert>}
                <Input
                  label="РќР°Р·РІР° РїР»Р°РЅСѓ"
                  value={planForm.name}
                  onChange={(val) => setPlanForm((prev) => ({ ...prev, name: val }))}
                  placeholder="Regression Sprint 24"
                  required
                  disabled={!selectedProjectId}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">РћРїРёСЃ</label>
                  <textarea
                    value={planForm.description}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Р¦С–Р»С–, СЂРµР»С–Р·, РїРѕРєСЂРёС‚С‚СЏ..."
                    disabled={!selectedProjectId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50"
                  />
                </div>
                <Button type="submit" icon={ListChecks} disabled={!selectedProjectId}>
                  РЎС‚РІРѕСЂРёС‚Рё РїР»Р°РЅ
                </Button>
              </form>

              <form id="run-form" onSubmit={handleRunSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-orange-600" />
                  <h5 className="font-semibold text-gray-800">Р—Р°РїСѓСЃС‚РёС‚Рё РїСЂРѕРіРѕРЅ</h5>
                </div>
                {runStatus && <Alert type={runStatus.type}>{runStatus.text}</Alert>}
                <Input
                  label="РќР°Р·РІР° РїСЂРѕРіРѕРЅР°"
                  value={runForm.name}
                  onChange={(val) => setRunForm((prev) => ({ ...prev, name: val }))}
                  placeholder="Smoke build 1.5"
                  required
                  disabled={!selectedProjectId}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">РџР»Р°РЅ (РЅРµРѕР±РѕРІКјСЏР·РєРѕРІРѕ)</label>
                  <select
                    value={runForm.plan}
                    onChange={(e) => setRunForm((prev) => ({ ...prev, plan: e.target.value }))}
                    disabled={!selectedProjectId || plans.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Р‘РµР· РїР»Р°РЅСѓ</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={String(plan.id)}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" icon={PlayCircle} disabled={!selectedProjectId}>
                  РЎС‚РІРѕСЂРёС‚Рё РїСЂРѕРіРѕРЅ
                </Button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="text-sm uppercase text-gray-500 font-semibold mb-2">РћСЃС‚Р°РЅРЅС– РїР»Р°РЅРё</h5>
                {plans.length === 0 ? (
                  <p className="text-sm text-gray-500">РќРµРјР°С” РїР»Р°РЅС–РІ РґР»СЏ РІРёР±СЂР°РЅРѕРіРѕ РїСЂРѕС”РєС‚Сѓ.</p>
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
                <h5 className="text-sm uppercase text-gray-500 font-semibold mb-2">РђРєС‚РёРІРЅС– РїСЂРѕРіРѕРЅРё</h5>
                {runs.length === 0 ? (
                  <p className="text-sm text-gray-500">РџРѕРєРё С‰Рѕ РЅРµРјР°С” РїСЂРѕРіРѕРЅС–РІ.</p>
                ) : (
                  <ul className="space-y-2">
                    {runs.slice(0, 4).map((run) => (
                      <li key={run.id} className="border rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{run.name}</p>
                            <p className="text-xs text-gray-500">РЎС‚Р°С‚СѓСЃ: {run.status}</p>
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
                  <p className="text-sm uppercase text-blue-600 font-semibold">РђРєС‚РёРІРЅРёР№ РїСЂРѕС”РєС‚</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{selectedProject.name}</p>
                  <p className="text-sm text-blue-700 mt-1">
                    РљР»СЋС‡: {selectedProject.key} В· РћРЅРѕРІР»РµРЅРѕ{' '}
                    {selectedProjectUpdatedLabel}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Layers className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">РЎС‚СЂСѓРєС‚СѓСЂР°</p>
                      <p className="text-2xl font-bold text-gray-900">{sections.length}</p>
                      <p className="text-xs text-gray-500">Р РѕР·РґС–Р»Рё РґР»СЏ РіСЂСѓРїСѓРІР°РЅРЅСЏ С‚РµСЃС‚С–РІ</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <ClipboardCheck className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">РџР»Р°РЅРё / РџСЂРѕРіРѕРЅРё</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {plans.length} / {runs.length}
                      </p>
                      <p className="text-xs text-gray-500">Р“РѕС‚РѕРІРЅС–СЃС‚СЊ РґРѕ СЂРµР»С–Р·С–РІ</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Clock3 className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">РђРєС‚РёРІРЅС– РїСЂРѕРіРѕРЅРё</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {runs.filter((run) => run.status !== 'completed').length}
                      </p>
                      <p className="text-xs text-gray-500">РђРІС‚Рѕ + СЂСѓС‡РЅС–</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex items-start gap-3 shadow-sm">
                    <Rocket className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">РЁРІРёРґРєС– РґС–С—</p>
                      <p className="text-xs text-gray-500">
                        Р’РёРєРѕСЂРёСЃС‚РѕРІСѓР№С‚Рµ РїР»Р°РІР°СЋС‡Сѓ РєРЅРѕРїРєСѓ РІРЅРёР·Сѓ, С‰РѕР± СЃС‚РІРѕСЂСЋРІР°С‚Рё СЃСѓС‚РЅРѕСЃС‚С– Р±РµР· РїРѕС€СѓРєСѓ С„РѕСЂРј.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Р©Рѕ РґР°Р»С–?</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>РЎС‚РІРѕСЂС–С‚СЊ СЃРµРєС†С–С— РґР»СЏ РјРѕРґСѓР»С–РІ РїСЂРѕРґСѓРєС‚Сѓ.</li>
                    <li>Р†РјРїРѕСЂС‚СѓР№С‚Рµ С‚РµСЃС‚-РєРµР№СЃРё Р°Р±Рѕ РґРѕРґР°Р№С‚Рµ С—С… РІСЂСѓС‡РЅСѓ.</li>
                    <li>Р—РІКјСЏР¶С–С‚СЊ РїР»Р°РЅРё Р· СЂРµР»С–Р·Р°РјРё С‚Р° СЃС„РѕСЂРјСѓР№С‚Рµ РїСЂРѕРіРѕРЅ.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">РћР±РµСЂС–С‚СЊ РїСЂРѕС”РєС‚, С‰РѕР± Р±Р°С‡РёС‚Рё С–РЅСЃР°Р№С‚Рё Test Manager.</p>
            )}
          </Card>
        </section>
      </main>

      <section className="grid grid-cols-1 gap-6">
        <Card title="Дії з тест-менеджменту" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form id="section-form" onSubmit={handleSectionSubmit} className="space-y-3">
              <h5 className="text-sm uppercase text-gray-500 font-semibold">Секції для модулів</h5>
              {sectionStatus && <Alert type={sectionStatus.type}>{sectionStatus.text}</Alert>}
              <Input
                label="Назва секції"
                value={sectionForm.name}
                onChange={(val) => setSectionForm((prev) => ({ ...prev, name: val }))}
                placeholder="Модуль платежів"
                disabled={!selectedProjectId}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Батьківська секція</label>
                <select
                  value={sectionForm.parent}
                  onChange={(e) => setSectionForm((prev) => ({ ...prev, parent: e.target.value }))}
                  disabled={!selectedProjectId || sections.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                >
                  <option value="">(верхній рівень)</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" icon={Layers} disabled={!selectedProjectId}>
                Створити секцію
              </Button>
            </form>

            <form id="testcase-form" onSubmit={handleTestCaseSubmit} className="space-y-3">
              <h5 className="text-sm uppercase text-gray-500 font-semibold">Тест-кейси</h5>
              {testCaseStatus && <Alert type={testCaseStatus.type}>{testCaseStatus.text}</Alert>}
              <Input
                label="Назва тест-кейсу"
                value={testCaseForm.title}
                onChange={(val) => setTestCaseForm((prev) => ({ ...prev, title: val }))}
                placeholder="Перевірка логіну"
                disabled={!selectedProjectId}
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                <textarea
                  value={testCaseForm.description}
                  onChange={(e) => setTestCaseForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Очікуваний результат, кроки..."
                  rows={3}
                  disabled={!selectedProjectId}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Секція</label>
                <select
                  value={testCaseForm.section}
                  onChange={(e) => setTestCaseForm((prev) => ({ ...prev, section: e.target.value }))}
                  disabled={!selectedProjectId || sections.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                >
                  <option value="">(без секції)</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" icon={ClipboardCheck} disabled={!selectedProjectId}>
                Додати тест-кейс
              </Button>
            </form>
          </div>

          <form id="release-form" onSubmit={handlePlanReleaseSubmit} className="space-y-3">
            <h5 className="text-sm uppercase text-gray-500 font-semibold">
              Звʼязати план з релізом та створити прогон
            </h5>
            {planReleaseStatus && <Alert type={planReleaseStatus.type}>{planReleaseStatus.text}</Alert>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">План</label>
                <select
                  value={planReleaseForm.plan}
                  onChange={(e) => setPlanReleaseForm((prev) => ({ ...prev, plan: e.target.value }))}
                  disabled={!selectedProjectId || plans.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                >
                  <option value="">Оберіть план</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Назва релізу"
                value={planReleaseForm.releaseName}
                onChange={(val) => setPlanReleaseForm((prev) => ({ ...prev, releaseName: val }))}
                placeholder="Release 1.0"
                disabled={!selectedProjectId}
                required
              />
              <Input
                label="Версія (необовʼязково)"
                value={planReleaseForm.releaseVersion}
                onChange={(val) => setPlanReleaseForm((prev) => ({ ...prev, releaseVersion: val }))}
                placeholder="1.0.0"
                disabled={!selectedProjectId}
              />
              <Input
                label="Назва прогона"
                value={planReleaseForm.runName}
                onChange={(val) => setPlanReleaseForm((prev) => ({ ...prev, runName: val }))}
                placeholder="Smoke Release 1.0"
                disabled={!selectedProjectId}
              />
            </div>
            <Button type="submit" icon={Rocket} disabled={!selectedProjectId}>
              Привʼязати та створити прогон
            </Button>
          </form>
        </Card>
      </section>
      <FloatingActions actions={quickActions} open={fabOpen} onToggle={setFabOpen} />
    </div>
  );
}


