// Talks to the `profiles` table's push-notification columns (see
// supabase/migrations/0001_push_notifications.sql). Pure network
// functions — no React here; hooks/useRegisterPushToken.ts and
// app/(tabs)/settings.tsx decide when to call these.

import { supabase } from './supabase';

// expo_push_token has SELECT revoked for ordinary clients (see the
// 0001 migration's comment — only the notify-friends Edge Function,
// using the service_role key, can read it), so it's never fetched here,
// only written. That's why this only returns the enabled flag, not
// whether a token is currently saved.
export async function fetchNotificationPreference(userId: string): Promise<{ enabled: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('notifications_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return { enabled: data?.notifications_enabled ?? true };
}

// Chained with .select('id') so we get back the row(s) Postgres
// actually updated — same reasoning as updateDisplayName/removeFriend
// in lib/friends.ts: RLS turns a denied update into "0 rows affected"
// with no error, which would otherwise look identical to a real success.
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't save your push token — try again.");
  }
}

export async function setNotificationsEnabled(userId: string, enabled: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ notifications_enabled: enabled })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("That setting couldn't be saved — try again.");
  }
}
