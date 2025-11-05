import React, { useState, useEffect, createContext, useContext } from 'react';
import { AlertCircle, CheckCircle, Plus, LogOut, User, Building, FolderOpen, TestTube, PlayCircle, FileText } from 'lucide-react';

// ============================================================================
// API Client & Auth Context
// ============================================================================

const API_BASE = 'http://localhost';
const TENANTS_CACHE_TTL_HOURS = 6; // auto-refresh cache every N hours
const TENANTS_CACHE_TTL_MS = TENANTS_CACHE_TTL_HOURS * 60 * 60 * 1000;

class ApiClient {
  constructor() {
    this.token = null;
    this.tenantId = null;
    try {
      const saved = localStorage.getItem('tc_auth');
      if (saved) {
        const { access, tenant_id } = JSON.parse(saved);
        if (access) this.token = access;
        if (tenant_id) this.tenantId = tenant_id;
      }
    } catch (_) {}
  }

  setAuth(token, tenantId) {
    this.token = token;
    this.tenantId = tenantId;
    try {
      const saved = localStorage.getItem('tc_auth');
      if (saved) {
        const js = JSON.parse(saved);
        const persistedTenant = (tenantId !== undefined && tenantId !== null) ? tenantId : (js?.tenant_id ?? null);
        localStorage.setItem('tc_auth', JSON.stringify({
          access: token || js?.access || '',
          refresh: js?.refresh || '',
          tenant_id: persistedTenant,
        }));
      }
    } catch (_) {}
  }

  clearAuth() {
    this.token = null;
    this.tenantId = null;
    try { localStorage.removeItem('tc_auth'); } catch (_) {}
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
    if (response.status === 401) {
      const refreshed = await this.refreshAccess();
      if (refreshed) {
        // update header and retry once
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

  async login(username, password, tenantId) {
    const data = await this.request('/auth/api/auth/token', {
      method: 'POST',
      body: JSON.stringify({ username, password, tenant_id: tenantId }),
    });
    this.setAuth(data.access, tenantId);
    return data;
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
    // Update access token while keeping tenant header
    if (data && data.access) {
      this.setAuth(data.access, tenantId);
      try {
        const saved = localStorage.getItem('tc_auth');
        if (saved) {
          const js = JSON.parse(saved);
          localStorage.setItem('tc_auth', JSON.stringify({ access: data.access, refresh: js?.refresh || '', tenant_id: tenantId }));
        }
      } catch(_){}
    }
    return data;
  }

  async refreshAccess() {
    try {
      const saved = localStorage.getItem('tc_auth');
      if (!saved) return false;
      const js = JSON.parse(saved);
      const refresh = js?.refresh;
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
      this.setAuth(newAccess, this.tenantId || js?.tenant_id || null);
      try {
        localStorage.setItem('tc_auth', JSON.stringify({ access: newAccess, refresh, tenant_id: this.tenantId || js?.tenant_id || null }));
      } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }

  async getProjects() {
    return this.request('/tms/api/projects/');
  }

  async getTestCases(projectId) {
    return this.request(`/tms/api/testcases/?project=${projectId}`);
  }

  async createTestCase(data) {
    return this.request('/tms/api/testcases/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPlans(projectId) {
    return this.request(`/tms/api/plans/?project=${projectId}`);
  }

  async getRuns(projectId) {
    return this.request(`/tms/api/runs/?project=${projectId}`);
  }

  async createRun(data) {
    return this.request('/tms/api/runs/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startRun(runId) {
    return this.request(`/tms/api/runs/${runId}/start/`, { method: 'POST' });
  }

  async getInstances(runId) {
    return this.request(`/tms/api/instances/?run=${runId}`);
  }

  async passInstance(instanceId) {
    return this.request(`/tms/api/instances/${instanceId}/pass_case/`, { method: 'POST' });
  }

  async failInstance(instanceId, actualResult) {
    return this.request(`/tms/api/instances/${instanceId}/fail_case/`, {
      method: 'POST',
      body: JSON.stringify({ actual_result: actualResult }),
    });
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
  const [loading, setLoading] = useState(false);
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

  const isTenantsCacheStale = () => {
    try {
      const ts = parseInt(localStorage.getItem('tc_tenants_cached_at') || '0', 10);
      return !ts || (Date.now() - ts) > TENANTS_CACHE_TTL_MS;
    } catch (_) { return true; }
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

  // Periodic auto-refresh when memberships change or cache stale
  useEffect(() => {
    let timer = null;
    let disposed = false;
    const tick = async () => {
      if (disposed || !user) return;
      try {
        // Always check memberships first
        const m = await api.getMemberships(user.id);
        const arr = m.results || m || [];
        const prevIds = new Set(memberships.map((x) => x.tenant));
        const nextIds = new Set((arr || []).map((x) => x.tenant));
        const changed = prevIds.size !== nextIds.size || [...nextIds].some((id) => !prevIds.has(id));
        if (changed) {
          setMemberships(arr);
          await refreshTenants();
        } else if (isTenantsCacheStale()) {
          await refreshTenants();
        }
      } catch (_) {}
    };
    // run on focus as well
    const onFocus = () => { tick(); };
    window.addEventListener('focus', onFocus);
    timer = setInterval(tick, 60000); // every 60s
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, memberships]);

  useEffect(() => {
    // Try restore session from localStorage
    (async () => {
      try {
        const cachedTenants = localStorage.getItem('tc_tenants');
        if (cachedTenants) {
          try { setTenants(JSON.parse(cachedTenants) || []); } catch (_) {}
        }
        const saved = localStorage.getItem('tc_auth');
        if (saved) {
          const { access, tenant_id } = JSON.parse(saved);
          if (access) {
            api.setAuth(access, tenant_id || null);
            const me = await api.getMe();
            setUser(me);
            // background refresh if cache is stale
            if (isTenantsCacheStale()) {
              await refreshTenants();
            }
            // If tenant_id is missing in persisted auth, auto-activate a preferred one
            try {
              if (!tenant_id) {
                const m = await api.getMemberships(me.id);
                const arr = m.results || m || [];
                setMemberships(arr);
                if (!tenants || tenants.length === 0 || isTenantsCacheStale()) {
                  await refreshTenants();
                }
                const choosePreferredTenantId = (list) => {
                  if (!Array.isArray(list) || list.length === 0) return null;
                  const order = ['owner', 'admin', 'member'];
                  for (const r of order) {
                    const hit = list.find(x => (x?.role_key || '').toLowerCase() === r);
                    if (hit && hit.tenant) return hit.tenant;
                  }
                  return list[0]?.tenant || null;
                };
                const tId = choosePreferredTenantId(arr);
                if (tId) {
                  await api.switchTenant(tId);
                  setCurrentTenant(tId);
                }
              } else {
                setCurrentTenant(tenant_id);
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    })();
  }, []);

  const login = async (username, password, tenantId, remember = false) => {
    const data = await api.login(username, password, tenantId);
    if (remember) {
      try { localStorage.setItem('tc_auth', JSON.stringify({ access: data.access, refresh: data.refresh, tenant_id: tenantId })); } catch (_) {}
    }
    const userData = await api.getMe();
    setUser(userData);
    // Load memberships automatically
    try {
      const m = await api.getMemberships(userData.id);
      const arr = m.results || m || [];
      setMemberships(arr);
      // Load tenants to display names (from cache if possible, or refresh if stale)
      if (!tenants || tenants.length === 0 || isTenantsCacheStale()) {
        await refreshTenants();
      }
      const choosePreferredTenantId = (list) => {
        if (!Array.isArray(list) || list.length === 0) return null;
        const order = ['owner', 'admin', 'member'];
        for (const r of order) {
          const hit = list.find(x => (x?.role_key || '').toLowerCase() === r);
          if (hit && hit.tenant) return hit.tenant;
        }
        return list[0]?.tenant || null;
      };
      if (tenantId) {
        setCurrentTenant(tenantId);
      } else if (Array.isArray(arr) && arr.length >= 1) {
        const tId = choosePreferredTenantId(arr);
        if (tId) {
          await api.switchTenant(tId);
          setCurrentTenant(tId);
        }
      }
    } catch (_) { /* ignore */ }
  };

  const logout = () => {
    api.clearAuth();
    setUser(null);
    try { localStorage.removeItem('tc_auth'); localStorage.removeItem('tc_refresh'); } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, memberships, currentTenant, switchTenantCtx, tenants, tenantNameById, refreshTenants }}>
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
    <div className={`border-l-4 p-4 mb-4 ${styles[type]}`}>
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
      className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${styles[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

function Card({ title, children, actions }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
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
        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

  // Prefill from saved preferences (remember me)
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
      // Save lightweight preferences for next time (without tokens)
      try {
        if (remember) {
          localStorage.setItem('tc_prefs', JSON.stringify({ remember: true, email: username, tenant_id: tid ?? null }));
        } else {
          localStorage.removeItem('tc_prefs');
        }
      } catch (_) {}
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
      // auto fill and switch back to login
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <TestTube className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">TestCloud</h1>
          <p className="text-gray-600">Test Management Platform</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {!registerMode ? (
          <div className="space-y-4">
            <Input label="Email" type="email" value={username} onChange={setUsername} required />
            <Input label="Password" type="password" value={password} onChange={setPassword} required />
            <Input label="Tenant ID" type="number" value={tenantId} onChange={setTenantId} placeholder="optional" />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
                Remember me
              </label>
              <button className="text-blue-600 hover:underline" onClick={()=>setRegisterMode(true)}>Create account</button>
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="Email" type="email" value={reg.email} onChange={(v)=>setReg({...reg, email:v})} required />
            <Input label="Password" type="password" value={reg.password} onChange={(v)=>setReg({...reg, password:v})} required />
            <Input label="First name" value={reg.first_name} onChange={(v)=>setReg({...reg, first_name:v})} />
            <Input label="Last name" value={reg.last_name} onChange={(v)=>setReg({...reg, last_name:v})} />
            <div className="flex items-center justify-between text-sm">
              <button className="text-gray-600 hover:underline" onClick={()=>setRegisterMode(false)}>Back to Sign in</button>
            </div>
            <Button onClick={handleRegister} disabled={loading} className="w-full justify-center">
              {loading ? 'Creating...' : 'Create account'}
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
  const [view, setView] = useState('projects');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

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
      setView('testcases');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPlans = async (projectId) => {
    try {
      const data = await api.getPlans(projectId);
      setPlans(data.results || data);
      setView('plans');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadRuns = async (projectId) => {
    try {
      const data = await api.getRuns(projectId);
      setRuns(data.results || data);
      setView('runs');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setError('');
    setSuccess('');
    loadTestCases(project.id);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setView('projects');
    setError('');
    setSuccess('');
  };

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
              {Array.isArray(memberships) && memberships.length > 1 ? (
                <>
                <input
                  type="text"
                  placeholder="Search tenant..."
                  className="border rounded px-2 py-1 text-xs mr-2"
                  value={tenantFilter}
                  onChange={(e)=>setTenantFilter(e.target.value)}
                />
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={String(api.tenantId || currentTenant || '')}
                  onChange={async (e)=>{ const tid=parseInt(e.target.value); await switchTenantCtx(tid); setSelectedProject(null); setView('projects'); loadProjects(); }}
                >
                  {Array.from(new Set(memberships.map(m=>m.tenant)))
                    .filter(tid => tenantNameById(tid).toLowerCase().includes(tenantFilter.toLowerCase()))
                    .map(tid => (
                      <option key={tid} value={String(tid)}>{tenantNameById(tid)}</option>
                    ))}
                </select>
                <button
                  className="ml-2 text-xs px-2 py-1 border rounded hover:bg-gray-50"
                  title="Refresh tenants"
                  onClick={async ()=>{ await refreshTenants(); }}
                >
                  Refresh
                </button>
                </>
              ) : (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {tenantNameById(api.tenantId || currentTenant) || 'Tenant —'}
                </span>
              )}
            </div>
            <Button onClick={logout} variant="secondary" icon={LogOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* Navigation */}
        {selectedProject && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <Button
              onClick={() => loadTestCases(selectedProject.id)}
              variant={view === 'testcases' ? 'primary' : 'secondary'}
              icon={TestTube}
            >
              Test Cases ({testCases.length})
            </Button>
            <Button
              onClick={() => loadPlans(selectedProject.id)}
              variant={view === 'plans' ? 'primary' : 'secondary'}
              icon={FileText}
            >
              Test Plans ({plans.length})
            </Button>
            <Button
              onClick={() => loadRuns(selectedProject.id)}
              variant={view === 'runs' ? 'primary' : 'secondary'}
              icon={PlayCircle}
            >
              Test Runs ({runs.length})
            </Button>
            <Button
              onClick={handleBackToProjects}
              variant="secondary"
            >
              Back to Projects
            </Button>
          </div>
        )}

        {/* Projects View */}
        {view === 'projects' && (
          <Card title="Projects" actions={
            <p className="text-sm text-gray-600">{projects.length} project(s)</p>
          }>
            {projects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
                <p className="text-sm mt-2">Create a project to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <FolderOpen className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{project.key}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Created: {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Test Cases View */}
        {view === 'testcases' && selectedProject && (
          <Card title={`Test Cases`}>
            {testCases.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <TestTube className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No test cases found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testCases.map((tc) => (
                  <div key={tc.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{tc.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{tc.description || 'No description'}</p>
                        <div className="flex gap-2 mt-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${tc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {tc.status}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                            v{tc.version}
                          </span>
                          {tc.is_automated && (
                            <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 font-medium">
                              Automated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Test Plans View */}
        {view === 'plans' && selectedProject && (
          <Card title={`Test Plans`}>
            {plans.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No test plans found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-gray-800">{plan.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{plan.description || 'No description'}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Created: {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Test Runs View */}
        {view === 'runs' && selectedProject && (
          <Card title={`Test Runs`}>
            {runs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No test runs found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{run.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Created: {new Date(run.created_at).toLocaleDateString()}
                        </p>
                        {run.started_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Started: {new Date(run.started_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        run.status === 'completed' ? 'bg-green-100 text-green-800' :
                        run.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        run.status === 'canceled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {run.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
