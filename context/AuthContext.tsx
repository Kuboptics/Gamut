import type { AuthError, Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  // False until the initial session read (from the on-device AsyncStorage
  // cache) has finished, so the Settings screen doesn't flash "signed out"
  // for a moment before a real signed-in session is restored.
  isLoaded: boolean;
  // `needsEmailConfirmation` is true when sign-up succeeded but Supabase
  // didn't hand back a session — meaning the project's "Confirm email"
  // setting is on and the account needs the emailed link clicked first.
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Wraps Supabase Auth's session state, purely so a later friends/social
// screen has something to check ("is anyone signed in?"). Sign up/in/out
// are optional here — nothing in the game reads from this context.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoaded(true);
    });

    // Keeps `session` in sync after sign up/in/out and token refreshes,
    // not just on the initial load above.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoaded,
      signUp: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        return { error, needsEmailConfirmation: !error && !data.session };
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        return { error };
      },
    }),
    [session, isLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
