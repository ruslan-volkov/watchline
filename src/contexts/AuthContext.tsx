import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/db';

type Profile = Tables<'profiles'>;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** True until the initial session + profile fetch settles. */
  initializing: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: TablesUpdate<'profiles'>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const currentUserId = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      currentUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      if (data.session) await fetchProfile(data.session.user.id);
      if (active) setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id ?? null;
      // Different user (login / logout / account switch) → drop all cached data
      // so the previous account's entries/friends don't leak into the new one.
      if (nextId !== currentUserId.current) {
        qc.clear();
        currentUserId.current = nextId;
      }
      setSession(next);
      if (next) {
        fetchProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile, qc]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const updateProfile = useCallback(
    async (patch: TablesUpdate<'profiles'>) => {
      if (!session) return;
      // Optimistic: reflect immediately (theme / density toggles feel instant).
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id);
      if (error) {
        // Roll back to source of truth on failure.
        await fetchProfile(session.user.id);
        throw error;
      }
    },
    [session, fetchProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, profile, initializing, refreshProfile, updateProfile, signOut }),
    [session, profile, initializing, refreshProfile, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
