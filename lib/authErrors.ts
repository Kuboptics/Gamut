import type { AuthError } from '@supabase/supabase-js';

// A deliberately loose "does this look like an email" check — just enough
// to catch obvious typos (a missing @ or domain) before hitting the
// network. Supabase itself is the real source of truth for validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

// Supabase's raw error messages are written for developers, not players.
// This translates the handful we'll actually see on the sign up/in forms
// into plain language; anything unrecognized just falls back to the raw
// message rather than hiding it.
export function describeAuthError(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Incorrect email or password.';
    case 'User already registered':
      return 'An account with that email already exists — try signing in instead.';
    case 'Email not confirmed':
      return 'Check your email to confirm your account, then sign in.';
    default:
      return error.message;
  }
}
