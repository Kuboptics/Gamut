// Talks to the `profiles` and `friend_requests` tables in Supabase (see
// the SQL in the Stage 4/5 setup notes for the tables + RLS policies). Pure
// network functions — no React here; app/friends.tsx decides when to call
// these and how to show a failure.

import { supabase } from './supabase';

// Deliberately excludes 0/O/1/I/l — the characters people most often
// misread or mistype when copying a code by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const UNIQUE_VIOLATION = '23505';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export type Profile = {
  friendCode: string;
  displayName: string;
};

export type IncomingRequest = {
  id: string;
  senderId: string;
  senderDisplayName: string;
};

export type OutgoingRequest = {
  id: string;
  receiverId: string;
  receiverDisplayName: string;
};

export type Friend = {
  // The friend_requests row id — not needed for display, but stable and
  // unique, so it doubles as a good list key.
  id: string;
  userId: string;
  displayName: string;
};

// Returns the signed-in user's friend code + display name, creating the
// profile row the first time it's needed (first Friends/Settings visit,
// or right after sign-up if a session came back immediately). Both
// Settings and Friends call this independently, so two calls can race on
// a brand-new account — the select happens at the *top of every retry*
// (not just once before the loop), so if a concurrent call wins the
// insert, the next iteration's select finds its row instead of assuming
// every duplicate-key error must mean "my friend_code collided, try a
// fresh one" and looping forever on an id that already exists.
export async function ensureProfile(userId: string, fallbackDisplayName: string): Promise<Profile> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('friend_code, display_name')
      .eq('id', userId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) {
      return { friendCode: existing.friend_code, displayName: existing.display_name };
    }

    const code = generateCode();
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, friend_code: code, display_name: fallbackDisplayName });
    if (!insertError) return { friendCode: code, displayName: fallbackDisplayName };
    if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
    // A duplicate-key error here means either a concurrent call already
    // created this profile (a violation on the *id* primary key — the
    // next loop iteration's select above will find it) or a `friend_code`
    // collision with someone else's row (fixed by simply trying a fresh
    // code next time around) — looping back handles both correctly.
  }

  throw new Error('Could not create or load your profile. Try again.');
}

// Names can be changed as often as the player likes — no cooldown.
export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}

async function lookupUserIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('friend_code', code)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// The most recent row (if any) between two users, in either direction.
// There's normally only ever one *active* (pending/accepted) row per pair
// — the database's partial unique index guarantees that — but a decline
// followed by a fresh request leaves the old declined row in place
// alongside the new one, so this reads the latest rather than assuming
// exactly one match exists.
async function findRequestBetween(userId: string, otherId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, status')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type SendFriendRequestResult = { ok: true } | { ok: false; message: string };

// Resolves a typed-in code to a user, checks the easy-to-explain failure
// cases up front for a friendly message, then inserts the request. The
// database's own constraints (see the SQL) are still the real guarantee —
// this is just what makes a rejection legible instead of a raw Postgres
// error.
export async function sendFriendRequest(userId: string, rawCode: string): Promise<SendFriendRequestResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: 'Enter a friend code.' };

  const targetId = await lookupUserIdByCode(code);
  if (!targetId) return { ok: false, message: "That code doesn't match anyone." };
  if (targetId === userId) return { ok: false, message: "That's your own code." };

  const existing = await findRequestBetween(userId, targetId);
  if (existing) {
    if (existing.status === 'accepted') return { ok: false, message: "You're already friends." };
    if (existing.status === 'pending') {
      return {
        ok: false,
        message:
          existing.sender_id === userId ? 'Request already sent.' : 'They already sent you a request — check Requests below.',
      };
    }
    // status === 'declined' falls through to sending a fresh request —
    // the partial unique index in the database allows this.
  }

  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: userId, receiver_id: targetId, status: 'pending' });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, message: 'A request between you two already exists.' };
    throw error;
  }
  return { ok: true };
}

export async function respondToRequest(requestId: string, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

// Looks up display names for a set of user ids in one query — shared by
// every function below that needs to turn ids into something to show.
async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
  if (error) throw error;
  return new Map((data ?? []).map((profile) => [profile.id, profile.display_name]));
}

// Incoming pending requests, joined with the sender's display name.
export async function fetchIncomingRequests(userId: string): Promise<IncomingRequest[]> {
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id')
    .eq('receiver_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const nameById = await fetchDisplayNames(requests.map((request) => request.sender_id));
  return requests.map((request) => ({
    id: request.id,
    senderId: request.sender_id,
    senderDisplayName: nameById.get(request.sender_id) ?? 'Player',
  }));
}

// Outgoing pending requests you've sent, still awaiting the other side.
export async function fetchOutgoingRequests(userId: string): Promise<OutgoingRequest[]> {
  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('id, receiver_id')
    .eq('sender_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const nameById = await fetchDisplayNames(requests.map((request) => request.receiver_id));
  return requests.map((request) => ({
    id: request.id,
    receiverId: request.receiver_id,
    receiverDisplayName: nameById.get(request.receiver_id) ?? 'Player',
  }));
}

// Accepted friendships, whichever side of the row the user is on — see
// the Stage 4 plan for why this single query is enough for a bidirectional
// friendship instead of needing two mirrored rows.
export async function fetchFriends(userId: string): Promise<Friend[]> {
  const { data: rows, error } = await supabase
    .from('friend_requests')
    .select('id, sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const friendIds = rows.map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id));
  const nameById = await fetchDisplayNames(friendIds);
  return rows.map((row) => {
    const friendId = row.sender_id === userId ? row.receiver_id : row.sender_id;
    return { id: row.id, userId: friendId, displayName: nameById.get(friendId) ?? 'Player' };
  });
}

// Ends a friendship by deleting its one shared friend_requests row — see
// fetchFriends above for why there's only ever one row per pair, not a
// mirrored row per side. Deleting it is enough to remove the friendship
// for both people at once (both stop appearing on each other's leaderboard,
// since fetchLeaderboard's friend list comes from this same query).
//
// Chained with .select('id') so we get back the row(s) Postgres actually
// deleted. This matters because RLS doesn't turn a denied delete into an
// error: a DELETE with no matching policy just filters the target row out
// of view, so Postgres reports "deleted 0 rows" with no error at all — the
// call looks identical to a real success unless the affected-row count is
// checked. Treating an empty result as a failure is the only way to catch
// that silently-denied case (see the profiles/friend_requests RLS bugs
// from earlier stages — same class of issue).
export async function removeFriend(requestId: string): Promise<void> {
  const { data, error } = await supabase.from('friend_requests').delete().eq('id', requestId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("That friendship couldn't be removed — it may already be gone, or you may not have permission.");
  }
}
