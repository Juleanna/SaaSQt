import React, { useEffect, useState } from 'react';
import {
  TestTube,
  LogOut,
  User,
  Plus,
  FolderOpen,
  FileText,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
  Settings,
  Search,
  ChevronRight,
  Calendar,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Alert, Button, Card, StatCard } from '../components/ui';

export default function DashboardPage({ onOpenAccount }) {
  const { user, logout, memberships, currentTenant, switchTenantCtx, tenantNameById, refreshTenants } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [plans, setPlans] = useState([]);
  const [runs, setRuns] = useState([]);
  const [view, setView] = useState('dashboard');
  const [error, setError] = useState('');
  const [searchTenant, setSearchTenant] = useState('');

  useEffect(() => {
    loadProjects();
  }, [currentTenant]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data.results || data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadTestCases = async (projectId) => {
    try {
      const data = await api.getTestCases(projectId);
      setTestCases(data.results || data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPlans = async (projectId) => {
    try {
      const data = await api.getPlans(projectId);
      setPlans(data.results || data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadRuns = async (projectId) => {
    try {
      const data = await api.getRuns(projectId);
      setRuns(data.results || data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setError('');
    await Promise.all([
      loadTestCases(project.id),
      loadPlans(project.id),
      loadRuns(project.id)
    ]);
    setView('project-detail');
  };

  const getRunStats = () => {
    const total = runs.length;
    const completed = runs.filter(r => r.status === 'completed').length;
    const running = runs.filter(r => r.status === 'running').length;
    const planned = runs.filter(r => r.status === 'planned').length;
    return { total, completed, running, planned };
  };

  const stats = getRunStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TestTube className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">TestCloud</h1>
              {selectedProject && (
                <p className="text-sm text-gray-600">{selectedProject.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.email}</span>
              {Array.isArray(memberships) && memberships.length > 1 && (
                <>
                  <input
                    type="text"
                    placeholder="РџРѕС€СѓРє..."
                    className="border rounded px-2 py-1 text-xs ml-2"
                    value={searchTenant}
                    onChange={(e)=>setSearchTenant(e.target.value)}
                  />
                  <select
                    className="border rounded px-3 py-1 text-sm"
                    value={String(api.tenantId || currentTenant || '')}
                    onChange={async (e)=>{ 
                      const tid=parseInt(e.target.value); 
                      await switchTenantCtx(tid); 
                      setSelectedProject(null); 
                      setView('dashboard'); 
                      loadProjects(); 
                    }}
                  >
                    {Array.from(new Set(memberships.map(m=>m.tenant)))
                      .filter(tid => tenantNameById(tid).toLowerCase().includes(searchTenant.toLowerCase()))
                      .map(tid => (
                        <option key={tid} value={String(tid)}>{tenantNameById(tid)}</option>
                      ))}
                  </select>
                </>
              )}
            </div>
            <Button onClick={logout} variant="secondary" icon={LogOut}>
              Р’РёР№С‚Рё
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error">{error}</Alert>}

        {/* Dashboard View */}
        {view === 'dashboard' && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">РћРіР»СЏРґ</h2>
              <p className="text-gray-600">Р—Р°РіР°Р»СЊРЅР° СЃС‚Р°С‚РёСЃС‚РёРєР° РІР°С€РѕРіРѕ РїСЂРѕРµРєС‚Сѓ</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                icon={FolderOpen} 
                label="РџСЂРѕС”РєС‚Рё" 
                value={projects.length}
                color="blue"
              />
              <StatCard 
                icon={TestTube} 
                label="РўРµСЃС‚-РєРµР№СЃРё" 
                value={testCases.length}
                color="green"
              />
              <StatCard 
                icon={FileText} 
                label="РўРµСЃС‚-РїР»Р°РЅРё" 
                value={plans.length}
                color="purple"
              />
              <StatCard 
                icon={PlayCircle} 
                label="РџСЂРѕРіРѕРЅРё" 
                value={runs.length}
                color="yellow"
              />
            </div>

            <Card title="РџСЂРѕС”РєС‚Рё" className="mb-8">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">РќРµРјР°С” РїСЂРѕС”РєС‚С–РІ</p>
                  <p className="text-sm mt-2">РЎС‚РІРѕСЂС–С‚СЊ РїСЂРѕС”РєС‚ РґР»СЏ РїРѕС‡Р°С‚РєСѓ СЂРѕР±РѕС‚Рё</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group bg-gradient-to-br from-white to-gray-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
                          <FolderOpen className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition">{project.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{project.key}</p>
                          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {new Date(project.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Project Detail View */}
        {view === 'project-detail' && selectedProject && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedProject.name}</h2>
                <p className="text-gray-600">Р”РµС‚Р°Р»СЊРЅР° С–РЅС„РѕСЂРјР°С†С–СЏ РїСЂРѕС”РєС‚Сѓ</p>
              </div>
              <Button onClick={() => { setView('dashboard'); setSelectedProject(null); }} variant="secondary">
                РќР°Р·Р°Рґ
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard 
                icon={CheckCircle2} 
                label="Р—Р°РІРµСЂС€РµРЅРѕ" 
                value={stats.completed}
                color="green"
              />
              <StatCard 
                icon={Activity} 
                label="Р’РёРєРѕРЅСѓС”С‚СЊСЃСЏ" 
                value={stats.running}
                color="blue"
              />
              <StatCard 
                icon={Clock} 
                label="Р—Р°РїР»Р°РЅРѕРІР°РЅРѕ" 
                value={stats.planned}
                color="yellow"
              />
              <StatCard 
                icon={BarChart3} 
                label="Р’СЃСЊРѕРіРѕ" 
                value={stats.total}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="РўРµСЃС‚-РєРµР№СЃРё" actions={<span className="text-sm text-gray-600">{testCases.length} РєРµР№СЃС–РІ</span>}>
                {testCases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TestTube className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>РќРµРјР°С” С‚РµСЃС‚-РєРµР№СЃС–РІ</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {testCases.slice(0, 5).map((tc) => (
                      <div key={tc.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">{tc.title}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tc.description || 'Р‘РµР· РѕРїРёСЃСѓ'}</p>
                            <div className="flex gap-2 mt-3">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${tc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {tc.status === 'active' ? 'РђРєС‚РёРІРЅРёР№' : 'РђСЂС…С–РІРѕРІР°РЅРёР№'}
                              </span>
                              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                                v{tc.version}
                              </span>
                              {tc.is_automated && (
                                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 font-medium">
                                  РђРІС‚РѕРјР°С‚РёР·РѕРІР°РЅРёР№
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {testCases.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        С‚Р° С‰Рµ {testCases.length - 5} РєРµР№СЃС–РІ...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="РўРµСЃС‚-РїСЂРѕРіРѕРЅРё" actions={<span className="text-sm text-gray-600">{runs.length} РїСЂРѕРіРѕРЅС–РІ</span>}>
                {runs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>РќРµРјР°С” РїСЂРѕРіРѕРЅС–РІ</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {runs.slice(0, 5).map((run) => (
                      <div key={run.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">{run.name}</h4>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(run.created_at).toLocaleDateString()}
                            </div>
                            {run.started_at && (
                              <p className="text-xs text-gray-500 mt-1">
                                РџРѕС‡Р°С‚РѕРє: {new Date(run.started_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-medium ${
                            run.status === 'completed' ? 'bg-green-100 text-green-800' :
                            run.status === 'running' ? 'bg-blue-100 text-blue-800' :
                            run.status === 'canceled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {run.status === 'completed' ? 'Р—Р°РІРµСЂС€РµРЅРѕ' :
                             run.status === 'running' ? 'Р’РёРєРѕРЅСѓС”С‚СЊСЃСЏ' :
                             run.status === 'canceled' ? 'РЎРєР°СЃРѕРІР°РЅРѕ' : 
                             'Р—Р°РїР»Р°РЅРѕРІР°РЅРѕ'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {runs.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        С‚Р° С‰Рµ {runs.length - 5} РїСЂРѕРіРѕРЅС–РІ...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="РўРµСЃС‚-РїР»Р°РЅРё" actions={<span className="text-sm text-gray-600">{plans.length} РїР»Р°РЅС–РІ</span>}>
                {plans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>РќРµРјР°С” РїР»Р°РЅС–РІ</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {plans.slice(0, 5).map((plan) => (
                      <div key={plan.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50">
                        <h4 className="font-medium text-gray-800">{plan.name}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{plan.description || 'Р‘РµР· РѕРїРёСЃСѓ'}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(plan.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {plans.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        С‚Р° С‰Рµ {plans.length - 5} РїР»Р°РЅС–РІ...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="РђРєС‚РёРІРЅС–СЃС‚СЊ">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="p-2 bg-blue-200 rounded">
                      <Activity className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">РћСЃС‚Р°РЅРЅС– Р·РјС–РЅРё</p>
                      <p className="text-xs text-gray-600">РџСЂРѕС”РєС‚ РѕРЅРѕРІР»РµРЅРѕ СЃСЊРѕРіРѕРґРЅС–</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="p-2 bg-green-200 rounded">
                      <CheckCircle2 className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Р—Р°РІРµСЂС€РµРЅС– РїСЂРѕРіРѕРЅРё</p>
                      <p className="text-xs text-gray-600">{stats.completed} Р· {stats.total}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <div className="p-2 bg-purple-200 rounded">
                      <FileText className="w-5 h-5 text-purple-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Р”РѕРєСѓРјРµРЅС‚Р°С†С–СЏ</p>
                      <p className="text-xs text-gray-600">{testCases.length} С‚РµСЃС‚-РєРµР№СЃС–РІ</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================








