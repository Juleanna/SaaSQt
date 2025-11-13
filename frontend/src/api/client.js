const API_BASE = 'http://localhost';

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
      if (!saved) return;
      const { access, refresh, tenant_id } = JSON.parse(saved);
      if (access) this.token = access;
      if (refresh) this.refreshToken = refresh;
      if (tenant_id) this.tenantId = tenant_id;
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
      localStorage.removeItem('tc_tenants');
      localStorage.removeItem('tc_tenants_cached_at');
    } catch (_) {}
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.tenantId && !path.includes('/auth/')) {
      headers['X-Tenant-ID'] = this.tenantId;
    }

    const execFetch = async () => fetch(`${API_BASE}${path}`, { ...options, headers });
    let response = await execFetch();

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccess();
      if (refreshed) {
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
        response = await execFetch();
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
    this.setAuth(data.access, tenantId, data.refresh);
    return data;
  }

  async refreshAccess() {
    try {
      const saved = localStorage.getItem('tc_auth');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      const refresh = parsed?.refresh || this.refreshToken;
      if (!refresh) return false;

      const resp = await fetch(`${API_BASE}/auth/api/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (!data?.access) return false;
      this.setAuth(data.access, this.tenantId || parsed?.tenant_id, refresh);
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
    if (data?.access) {
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
export default api;
