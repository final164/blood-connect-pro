import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminRole } from "@/lib/api";
import { isAdminIdentity } from "@/lib/phone-auth";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAnonymous: boolean;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = useCallback(async (uid?: string | null, email?: string | null) => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }
    try {
      const roleAdmin = await hasAdminRole(uid);
      setIsAdmin(roleAdmin || isAdminIdentity(email));
    } catch {
      setIsAdmin(isAdminIdentity(email));
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    await checkAdmin(session?.user?.id, session?.user?.email);
  }, [checkAdmin, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
      void checkAdmin(s?.user?.id, s?.user?.email);
    });
    // Prefer local session ASAP so the app shell can paint without waiting on admin role.
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
      void checkAdmin(data.session?.user?.id, data.session?.user?.email);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const isAnonymous = !!session?.user?.is_anonymous;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAdmin,
        isAnonymous,
        refreshAdmin,
        signOut: async () => {
          await supabase.auth.signOut();
          setIsAdmin(false);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
