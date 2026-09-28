import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { UserProfile } from "./types";

const CONFIG_ERROR =
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env, then restart npm run dev.";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured()) {
      setBootstrapping(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setBootstrapping(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    enabled: Boolean(session?.access_token),
    retry: false,
  });

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) throw new Error(CONFIG_ERROR);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Provision / sync app `users` row (created on first authenticated API call).
    if (data.session?.access_token) {
      try {
        await queryClient.fetchQuery({ queryKey: ["me"], queryFn: () => api.me() });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "API rejected the session";
        throw new Error(
          `Signed in to Auth, but profile sync failed (${detail}). Check SUPABASE_URL on Railway and that the API is reachable.`,
        );
      }
    }
  }, [queryClient]);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    if (!isSupabaseConfigured()) throw new Error(CONFIG_ERROR);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(
        "Account created in Authentication, but email confirmation is required before we can save your profile. In Supabase: Auth → Providers → Email → turn off “Confirm email”, or confirm the email then sign in.",
      );
    }
    // Creates the row in public.users via GET /users/me → ensure_from_auth.
    try {
      await queryClient.fetchQuery({ queryKey: ["me"], queryFn: () => api.me() });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "API rejected the session";
      throw new Error(
        `Auth account exists, but saving to the users table failed (${detail}). Set SUPABASE_URL on Railway, redeploy, then sign in once.`,
      );
    }
  }, [queryClient]);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error(CONFIG_ERROR);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: meQuery.data ?? null,
      loading: bootstrapping || (Boolean(session) && meQuery.isLoading),
      signIn,
      signUp,
      signOut,
    }),
    [session, meQuery.data, meQuery.isLoading, bootstrapping, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
