import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  clienteId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

async function fetchClienteId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_negocios" as never)
    .select("cliente_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Error fetching cliente_id", error);
    return null;
  }
  return (data as { cliente_id: string } | null)?.cliente_id ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user?.id) {
        const cid = await fetchClienteId(s.user.id);
        if (mounted) setClienteId(cid);
      } else {
        setClienteId(null);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // defer supabase calls out of the callback
      setTimeout(() => applySession(s), 0);
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user?.id) {
      const cid = await fetchClienteId(data.user.id);
      setClienteId(cid);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setClienteId(null);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, clienteId, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
