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

type Ctx = {
  loading: boolean;
  keys: Set<string>;
  isSuper: boolean;
  isStaff: boolean;
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

  const refresh = useCallback(async () => {
    if (!user) {
      setRawKeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isAdmin || isAdminIdentity(user.email)) {
        setRawKeys(["*"]);
        return;
      }
      const { data, error } = await supabase.rpc("get_my_admin_permissions");
      if (error) {
        // Fallback: table missing or RPC not applied yet
        setRawKeys(isAdmin ? ["*"] : []);
        return;
      }
      setRawKeys((data as string[] | null) ?? []);
    } catch {
      setRawKeys(isAdmin || isAdminIdentity(user.email) ? ["*"] : []);
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
      can,
      canAny,
      canModule,
      refresh,
    }),
    [authLoading, loading, keys, isSuper, isStaff, can, canAny, canModule, refresh],
  );

  return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) throw new Error("useAdminAccess outside AdminAccessProvider");
  return ctx;
}
