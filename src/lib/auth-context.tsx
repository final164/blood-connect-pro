import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminRole } from "@/lib/api";
import { peekStoredSession } from "@/lib/auth-peek";
import { realAuthEmail } from "@/lib/auth-email";
import { isAdminIdentity } from "@/lib/phone-auth";

type Ctx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAnonymous: boolean;
  /** Apply session immediately after sign-in (do not wait on auth lock / events). */
  applySession: (session: Session | null) => void;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

function syncProfileEmail(user: User | null | undefined) {
  const email = realAuthEmail(user?.email);
  if (!user?.id || !email) return;
  void supabase
    .from("profiles")
    .update({ email } as never)
    .eq("id", user.id)
    .then(({ error }) => {
      if (error && !/column.*email|schema cache/i.test(error.message)) {
        console.warn("syncProfileEmail", error.message);
      }
    });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = typeof window !== "undefined" ? peekStoredSession() : null;
  const [session, setSession] = useState<Session | null>(initial);
  // Never block first paint when we already peeked a session.
  const [loading, setLoading] = useState(!initial);
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

  const applySession = useCallback(
    (s: Session | null) => {
      setSession(s);
      setLoading(false);
      syncProfileEmail(s?.user);
      void checkAdmin(s?.user?.id, s?.user?.email);
    },
    [checkAdmin],
  );

  const refreshAdmin = useCallback(async () => {
    await checkAdmin(session?.user?.id, session?.user?.email);
  }, [checkAdmin, session?.user?.id, session?.user?.email]);

  useEffect(() => {
    let alive = true;

    // Hard cap so UI never waits on auth forever.
    const failSafe = window.setTimeout(() => {
      if (alive) setLoading(false);
    }, 800);

    // IMPORTANT: do NOT call getSession() here.
    // It shares a navigator lock with onAuthStateChange / signIn and can deadlock,
    // leaving loading=true or session stuck null after a successful login.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
      window.clearTimeout(failSafe);
      syncProfileEmail(s?.user);
      void checkAdmin(s?.user?.id, s?.user?.email);
    });

    return () => {
      alive = false;
      window.clearTimeout(failSafe);
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
        applySession,
        refreshAdmin,
        signOut: async () => {
          await supabase.auth.signOut();
          setSession(null);
          setIsAdmin(false);
          setLoading(false);
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
