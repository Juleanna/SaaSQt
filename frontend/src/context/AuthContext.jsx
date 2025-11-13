import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const TENANTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export function AuthProvider({ children }) {
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
        const cachedAt = localStorage.getItem('tc_tenants_cached_at');
        if (cachedTenants) {
          const fresh = !cachedAt || Date.now() - Number(cachedAt) < TENANTS_CACHE_TTL_MS;
          if (fresh) {
            try { setTenants(JSON.parse(cachedTenants) || []); } catch (_) {}
          }
        }

        const saved = localStorage.getItem('tc_auth');
        if (saved) {
          const { access, refresh, tenant_id } = JSON.parse(saved);
          if (access && refresh) {
            api.setAuth(access, tenant_id || null, refresh);
            const me = await api.getMe();
            setUser(me);
            setCurrentTenant(tenant_id);
            const membershipData = await api.getMemberships(me.id);
            const arr = membershipData.results || membershipData || [];
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

  const login = async (username, password, tenantId) => {
    const data = await api.login(username, password, tenantId);
    const userData = await api.getMe();
    setUser(userData);

    try {
      const membershipData = await api.getMemberships(userData.id);
      const arr = membershipData.results || membershipData || [];
      setMemberships(arr);
      await refreshTenants();

      if (tenantId) {
        setCurrentTenant(tenantId);
      } else if (arr.length > 0) {
        const preferred =
          arr.find((x) => x.role_key === 'owner') ||
          arr.find((x) => x.role_key === 'admin') ||
          arr[0];
        if (preferred) {
          await api.switchTenant(preferred.tenant);
          setCurrentTenant(preferred.tenant);
        }
      }
    } catch (_) {}

    return data;
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
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        memberships,
        currentTenant,
        switchTenantCtx,
        tenants,
        tenantNameById,
        refreshTenants,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
