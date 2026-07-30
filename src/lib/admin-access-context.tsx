import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isAdminIdentity } from "@/lib/phone-auth";
import type { AdminModule, PermissionKey } from "@/lib/admin-permissions";
import {
  DEFAULT_USERS_GEO_SCOPE,
  normalizeUsersGeoScope,
  type UsersGeoScope,
} from "@/lib/users-geo-scope";

type Ctx = {
  loading: boolean;
  keys: Set<string>;
  isSuper: boolean;
  isStaff: boolean;
  usersGeoScope: UsersGeoScope;
  can: (key: PermissionKey | string) => boolean;
  canAny: (...keys: (PermissionKey | string)[]) => boolean;
  canModule: (module: AdminModule) => boolean;
  refresh: () => Promise<void>;
};

const AdminAccessContext = createContext<Ctx | null>(null);

export function AdminAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rawKeys, setRawKeys] = useState<string[]>([]);
  const [usersGeoScope, setUsersGeoScope] = useState<UsersGeoScope>(DEFAULT_USERS_GEO_SCOPE);

  const refresh = useCallback(async () => {
    if (!user) {
      setRawKeys([]);
      setUsersGeoScope(DEFAULT_USERS_GEO_SCOPE);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isAdmin || isAdminIdentity(user.email)) {
        setRawKeys(["*"]);
        setUsersGeoScope(DEFAULT_USERS_GEO_SCOPE);
        return;
      }
      const [{ data, error }, geoRes] = await Promise.all([
        supabase.rpc("get_my_admin_permissions"),
        supabase.rpc("get_my_users_geo_scope"),
      ]);
      if (error) {
        setRawKeys(isAdmin ? ["*"] : []);
      } else {
        setRawKeys((data as string[] | null) ?? []);
      }
      if (!geoRes.error && geoRes.data) {
        setUsersGeoScope(normalizeUsersGeoScope(geoRes.data));
      } else {
        setUsersGeoScope(DEFAULT_USERS_GEO_SCOPE);
      }
    } catch {
      setRawKeys(isAdmin || isAdminIdentity(user.email) ? ["*"] : []);
      setUsersGeoScope(DEFAULT_USERS_GEO_SCOPE);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const keys = useMemo(() => new Set(rawKeys), [rawKeys]);
  const isSuper = keys.has("*") || isAdmin || isAdminIdentity(user?.email);
  const isStaff = isSuper || keys.size > 0;

  const can = useCallback(
    (key: PermissionKey | string) => {
      if (isSuper || keys.has("*")) return true;
      return keys.has(key);
    },
    [isSuper, keys],
  );

  const canAny = useCallback(
    (...list: (PermissionKey | string)[]) => list.some((k) => can(k)),
    [can],
  );

  const canModule = useCallback(
    (module: AdminModule) => can(`${module}.view`) || [...keys].some((k) => k.startsWith(`${module}.`)),
    [can, keys],
  );

  const value = useMemo(
    () => ({
      loading: authLoading || loading,
      keys,
      isSuper,
      isStaff,
      usersGeoScope: isSuper ? DEFAULT_USERS_GEO_SCOPE : usersGeoScope,
      can,
      canAny,
      canModule,
      refresh,
    }),
    [authLoading, loading, keys, isSuper, isStaff, usersGeoScope, can, canAny, canModule, refresh],
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess outside AdminAccessProvider");
  return ctx;
}
