import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  AlertCircle, CheckCircle, Plus, LogOut, User, Building, FolderOpen, 
  TestTube, PlayCircle, FileText, BarChart3, TrendingUp, Clock, 
  CheckCircle2, XCircle, AlertTriangle, Pause, Settings, Search,
  ChevronRight, Calendar, Activity
} from 'lucide-react';

// ============================================================================
// API Client & Auth Context
// ============================================================================

const API_BASE = 'http://localhost';
const TENANTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

class ApiClient {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.tenantId = null;
    this.restoreSession();
  }

  restoreSession() {
    try {
      const saved = localStorage.getItem('tc_auth');
      if (saved) {
        const { access, refresh, tenant_id } = JSON.parse(saved);
        if (access) this.token = access;
        if (refresh) this.refreshToken = refresh;
        if (tenant_id) this.tenantId = tenant_id;
      }
    } catch (_) {}
  }

  setAuth(token, tenantId, refresh = null) {
    this.token = token;
    this.tenantId = tenantId;
    if (refresh) this.refreshToken = refresh;
    
    try {
      const saved = localStorage.getItem('tc_auth') || '{}';
      const data = JSON.parse(saved);
      localStorage.setItem('tc_auth', JSON.stringify({
        access: token || data.access || '',
        refresh: refresh || data.refresh || '',
        tenant_id: tenantId !== undefined ? tenantId : data.tenant_id,
      }));
    } catch (_) {}
  }

  clearAuth() {
    this.token = null;
    this.refreshToken = null;
    this.tenantId = null;
    try { 
      localStorage.removeItem('tc_auth');
      localStorage.removeItem('tc_prefs');
      localStorage.removeItem('tc_tenants');
      localStorage.removeItem('tc_tenants_cached_at');
    } catch (_) {}
  }

  async request(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.tenantId && !url.includes('/auth/')) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    const doFetch = async () => fetch(`${API_BASE}${url}`, { ...options, headers });
    let response = await doFetch();
    
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccess();
      if (refreshed) {
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        response = await doFetch();
      }
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async login(username, password, tenantId, remember = false) {
    const data = await this.request('/auth/api/auth/token', {
      method: 'POST',
      body: JSON.stringify({ username, password, tenant_id: tenantId }),
    });
    
    this.setAuth(data.access, tenantId, data.refresh);
    
    if (remember) {
      try {
        localStorage.setItem('tc_prefs', JSON.stringify({ 
          remember: true, 
          email: username, 
          tenant_id: tenantId 
        }));
      } catch (_) {}
    }
    
    return data;
  }

  async refreshAccess() {
    try {
      const saved = localStorage.getItem('tc_auth');
      if (!saved) return false;
      const js = JSON.parse(saved);
      const refresh = js?.refresh || this.refreshToken;
      if (!refresh) return false;
      
      const resp = await fetch(`${API_BASE}/auth/api/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      
      if (!resp.ok) return false;
      const data = await resp.json();
      const newAccess = data?.access;
      if (!newAccess) return false;
      
      this.setAuth(newAccess, this.tenantId || js?.tenant_id, refresh);
      return true;
    } catch (_) {
      return false;
    }
  }

  async register(email, password, first_name = '', last_name = '') {
    return this.request('/auth/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, first_name, last_name }),
    });
  }

  async getMe() {
    return this.request('/auth/api/auth/me');
  }

  async getTenants() {
    return this.request('/orgs/api/tenants/');
  }

  async getMemberships(userId) {
    return this.request(`/orgs/api/memberships/?user_id=${userId}`);
  }

  async switchTenant(tenantId) {
    const data = await this.request('/auth/api/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    
    if (data && data.access) {
      this.setAuth(data.access, tenantId, this.refreshToken);
    }
    return data;
  }

  async getProjects() {
    return this.request('/tms/api/projects/');
  }

  async getTestCases(projectId) {
    return this.request(`/tms/api/testcases/?project=${projectId}`);
  }

  async getPlans(projectId) {
    return this.request(`/tms/api/plans/?project=${projectId}`);
  }

  async getRuns(projectId) {
    return this.request(`/tms/api/runs/?project=${projectId}`);
  }
}

const api = new ApiClient();

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [tenants, setTenants] = useState([]);

  const tenantNameById = (id) => {
    const t = tenants.find((x) => x.id === id);
    return t ? t.name : `Tenant ${id}`;
  };

  const switchTenantCtx = async (tenantId) => {
    await api.switchTenant(tenantId);
    setCurrentTenant(tenantId);
  };

  const refreshTenants = async () => {
    try {
      const ts = await api.getTenants();
      const list = ts.results || ts || [];
      setTenants(list);
      try {
        localStorage.setItem('tc_tenants', JSON.stringify(list));
        localStorage.setItem('tc_tenants_cached_at', String(Date.now()));
      } catch (_) {}
    } catch (_) {}
  };

  useEffect(() => {
    (async () => {
      try {
        const cachedTenants = localStorage.getItem('tc_tenants');
        if (cachedTenants) {
          try { setTenants(JSON.parse(cachedTenants) || []); } catch (_) {}
        }
        
        const saved = localStorage.getItem('tc_auth');
        if (saved) {
          const { access, refresh, tenant_id } = JSON.parse(saved);
          if (access && refresh) {
            api.setAuth(access, tenant_id || null, refresh);
            const me = await api.getMe();
            setUser(me);
            setCurrentTenant(tenant_id);
            
            const m = await api.getMemberships(me.id);
            const arr = m.results || m || [];
            setMemberships(arr);
            
            await refreshTenants();
          }
        }
      } catch (_) {
        api.clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password, tenantId, remember = false) => {
    const data = await api.login(username, password, tenantId, remember);
    const userData = await api.getMe();
    setUser(userData);
    
    try {
      const m = await api.getMemberships(userData.id);
      const arr = m.results || m || [];
      setMemberships(arr);
      await refreshTenants();
      
      if (tenantId) {
        setCurrentTenant(tenantId);
      } else if (arr.length > 0) {
        const preferred = arr.find(x => x.role_key === 'owner') || 
                         arr.find(x => x.role_key === 'admin') || 
                         arr[0];
        if (preferred) {
          await api.switchTenant(preferred.tenant);
          setCurrentTenant(preferred.tenant);
        }
      }
    } catch (_) {}
  };

  const logout = () => {
    api.clearAuth();
    setUser(null);
    setCurrentTenant(null);
    setMemberships([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, login, logout, memberships, currentTenant, 
      switchTenantCtx, tenants, tenantNameById, refreshTenants 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// UI Components
// ============================================================================

function Alert({ type = 'info', children }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`border-l-4 p-4 mb-4 rounded-r ${styles[type]}`}>
      <div className="flex items-center gap-2">
        {type === 'error' && <AlertCircle className="w-5 h-5" />}
        {type === 'success' && <CheckCircle className="w-5 h-5" />}
        <div>{children}</div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', icon: Icon, disabled, className = '' }) {
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${styles[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function Card({ title, children, actions, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, color = 'blue' }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl shadow-lg p-6 text-white`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className="bg-white/20 p-3 rounded-lg">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, placeholder, required }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
    </div>
  );
}

// ============================================================================
// Login Page
// ============================================================================

function LoginPage() {
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

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const tid = tenantId ? parseInt(tenantId) : undefined;
      await login(username, password, tid, remember);
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
                  onChange={(e)=>setRemember(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">Запам'ятати мене</span>
              </label>
              <button className="text-blue-600 hover:underline" onClick={()=>setRegisterMode(true)}>
                Створити акаунт
              </button>
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
              {loading ? 'Вхід...' : 'Увійти'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="Email" type="email" value={reg.email} onChange={(v)=>setReg({...reg, email:v})} required />
            <Input label="Пароль" type="password" value={reg.password} onChange={(v)=>setReg({...reg, password:v})} required />
            <Input label="Ім'я" value={reg.first_name} onChange={(v)=>setReg({...reg, first_name:v})} />
            <Input label="Прізвище" value={reg.last_name} onChange={(v)=>setReg({...reg, last_name:v})} />
            <div className="flex items-center justify-between text-sm">
              <button className="text-gray-600 hover:underline" onClick={()=>setRegisterMode(false)}>
                Назад до входу
              </button>
            </div>
            <Button onClick={handleRegister} disabled={loading} className="w-full justify-center">
              {loading ? 'Створення...' : 'Створити акаунт'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard
// ============================================================================

function Dashboard() {
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
                    placeholder="Пошук..."
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
              Вийти
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
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Огляд</h2>
              <p className="text-gray-600">Загальна статистика вашого проекту</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard 
                icon={FolderOpen} 
                label="Проєкти" 
                value={projects.length}
                color="blue"
              />
              <StatCard 
                icon={TestTube} 
                label="Тест-кейси" 
                value={testCases.length}
                color="green"
              />
              <StatCard 
                icon={FileText} 
                label="Тест-плани" 
                value={plans.length}
                color="purple"
              />
              <StatCard 
                icon={PlayCircle} 
                label="Прогони" 
                value={runs.length}
                color="yellow"
              />
            </div>

            <Card title="Проєкти" className="mb-8">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Немає проєктів</p>
                  <p className="text-sm mt-2">Створіть проєкт для початку роботи</p>
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
                <p className="text-gray-600">Детальна інформація проєкту</p>
              </div>
              <Button onClick={() => { setView('dashboard'); setSelectedProject(null); }} variant="secondary">
                Назад
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard 
                icon={CheckCircle2} 
                label="Завершено" 
                value={stats.completed}
                color="green"
              />
              <StatCard 
                icon={Activity} 
                label="Виконується" 
                value={stats.running}
                color="blue"
              />
              <StatCard 
                icon={Clock} 
                label="Заплановано" 
                value={stats.planned}
                color="yellow"
              />
              <StatCard 
                icon={BarChart3} 
                label="Всього" 
                value={stats.total}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Тест-кейси" actions={<span className="text-sm text-gray-600">{testCases.length} кейсів</span>}>
                {testCases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TestTube className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Немає тест-кейсів</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {testCases.slice(0, 5).map((tc) => (
                      <div key={tc.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800">{tc.title}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tc.description || 'Без опису'}</p>
                            <div className="flex gap-2 mt-3">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${tc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {tc.status === 'active' ? 'Активний' : 'Архівований'}
                              </span>
                              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                                v{tc.version}
                              </span>
                              {tc.is_automated && (
                                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 font-medium">
                                  Автоматизований
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {testCases.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        та ще {testCases.length - 5} кейсів...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="Тест-прогони" actions={<span className="text-sm text-gray-600">{runs.length} прогонів</span>}>
                {runs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Немає прогонів</p>
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
                                Початок: {new Date(run.started_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-medium ${
                            run.status === 'completed' ? 'bg-green-100 text-green-800' :
                            run.status === 'running' ? 'bg-blue-100 text-blue-800' :
                            run.status === 'canceled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {run.status === 'completed' ? 'Завершено' :
                             run.status === 'running' ? 'Виконується' :
                             run.status === 'canceled' ? 'Скасовано' : 
                             'Заплановано'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {runs.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        та ще {runs.length - 5} прогонів...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="Тест-плани" actions={<span className="text-sm text-gray-600">{plans.length} планів</span>}>
                {plans.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Немає планів</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {plans.slice(0, 5).map((plan) => (
                      <div key={plan.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50">
                        <h4 className="font-medium text-gray-800">{plan.name}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{plan.description || 'Без опису'}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(plan.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {plans.length > 5 && (
                      <p className="text-center text-sm text-gray-500 pt-2">
                        та ще {plans.length - 5} планів...
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Card title="Активність">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="p-2 bg-blue-200 rounded">
                      <Activity className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Останні зміни</p>
                      <p className="text-xs text-gray-600">Проєкт оновлено сьогодні</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <div className="p-2 bg-green-200 rounded">
                      <CheckCircle2 className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Завершені прогони</p>
                      <p className="text-xs text-gray-600">{stats.completed} з {stats.total}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                    <div className="p-2 bg-purple-200 rounded">
                      <FileText className="w-5 h-5 text-purple-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Документація</p>
                      <p className="text-xs text-gray-600">{testCases.length} тест-кейсів</p>
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

function App() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <LoginPage />;
}

export default function AppWithProvider() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}