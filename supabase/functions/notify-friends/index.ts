// Supabase Database Webhook target — configured (in the dashboard, not
// here, so the shared secret never lands in git) to fire on INSERT of
// round_results only. That INSERT-only scoping is what keeps this whole
// function idempotent: round_results is upserted on (user_id, date_key),
// so the *first* write for a day is an INSERT and any later same-day
// touch (e.g. SyncContext's resync-on-foreground re-upserting the same
// row) is an UPDATE — this function runs at most once per person per
// day, no matter how many times that row gets touched afterward.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100; // Expo's push API limit per request.
// How stale a submitted day can be and still trigger a notification. A
// first-ever sync for an account can upload several old local days at
// once (SyncContext's syncNow, e.g. someone who played offline for days
// before their first sync, or a reinstall) — each is a genuine INSERT
// for a past date_key, which would wrongly notify friends about a stale
// "just played" event. date_key is the player's *local* date, so this
// is deliberately approximate, not an exact "is it today" check.
const MAX_SUBMISSION_AGE_DAYS = 1;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  // service_role bypasses RLS (and the column-level REVOKE on
  // expo_push_token from the 0001 migration) — this function is the one
  // place server-side that's allowed to read every recipient's token.
  // Never ship this key to the client.
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type RoundResultRow = {
  user_id: string;
  date_key: string; // YYYY-MM-DD, local to the submitter's device
};

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: RoundResultRow;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  details?: { error?: string };
};

function daysSince(dateKey: string): number {
  const submitted = new Date(`${dateKey}T00:00:00Z`).getTime();
  const now = Date.now();
  return (now - submitted) / (1000 * 60 * 60 * 24);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// One of these is picked at random per submission event (not per
// recipient — see pickNotificationBody below), so a given friend's play
// always reads as one consistent message across everyone it's sent to.
// Kept understated and photography-focused, matching Gamut's tone — no
// hype, just an invitation to go look. Each works whether the recipient
// has already played today or not, since this feature notifies everyone
// either way.
const NOTIFICATION_BODY_TEMPLATES: ((name: string) => string)[] = [
  (name) => `${name} found today's color. Come look.`,
  (name) => `${name} just submitted — see the shots.`,
  (name) => `${name}'s photos just landed. Worth a look.`,
  (name) => `New shots from ${name}. Go compare yours.`,
  (name) => `${name} logged today's color. Take a peek.`,
  (name) => `${name}'s score just landed. Go see it.`,
  (name) => `${name} shot today's color. See how it went.`,
  (name) => `Fresh shots from ${name}. Go take a look.`,
  (name) => `${name} submitted today's shots. Have a look.`,
  (name) => `${name}'s attempt is in. Go see it.`,
];

function pickNotificationBody(name: string): string {
  const template = NOTIFICATION_BODY_TEMPLATES[Math.floor(Math.random() * NOTIFICATION_BODY_TEMPLATES.length)];
  return template(name);
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload: WebhookPayload = await req.json();
  // Defense in depth in case the dashboard webhook is ever reconfigured
  // to also send UPDATE/DELETE events — this function must only ever
  // act on a genuinely new submission.
  if (payload.type !== 'INSERT') {
    return new Response('ignored: not an insert', { status: 200 });
  }

  const { user_id: submitterId, date_key: dateKey } = payload.record;
  if (daysSince(dateKey) > MAX_SUBMISSION_AGE_DAYS) {
    return new Response('ignored: stale submission', { status: 200 });
  }

  // Accepted friends of the submitter — same query shape as
  // lib/friends.ts's fetchFriends: one row per pair, either side may be
  // sender or receiver.
  const { data: friendRows, error: friendsError } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${submitterId},receiver_id.eq.${submitterId}`);
  if (friendsError) throw friendsError;

  const friendIds = (friendRows ?? []).map((row) =>
    row.sender_id === submitterId ? row.receiver_id : row.sender_id
  );
  if (friendIds.length === 0) {
    return new Response('ok: no friends', { status: 200 });
  }

  // Every accepted friend is notified, whether or not they've already
  // played today — this is a "come see it" nudge, not just a "your
  // turn" reminder, so already-played friends stay in scope.
  const [{ data: recipients, error: recipientsError }, { data: submitter, error: submitterError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, expo_push_token')
        .in('id', friendIds)
        .eq('notifications_enabled', true)
        .not('expo_push_token', 'is', null),
      supabase.from('profiles').select('display_name').eq('id', submitterId).maybeSingle(),
    ]);
  if (recipientsError) throw recipientsError;
  if (submitterError) throw submitterError;

  if (!recipients || recipients.length === 0) {
    return new Response('ok: no eligible recipients', { status: 200 });
  }

  const submitterName = submitter?.display_name ?? 'A friend';
  // Picked once per invocation (one submission event), not once per
  // recipient — everyone notified about this play sees the same line.
  const body = pickNotificationBody(submitterName);
  const messages = recipients.map((recipient) => ({
    to: recipient.expo_push_token as string,
    title: 'Gamut',
    body,
    data: { type: 'friend-submitted', dateKey },
    sound: 'default',
  }));

  const staleTokens: string[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    const { data: tickets } = (await response.json()) as { data: ExpoPushTicket[] };
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        staleTokens.push(batch[index].to);
      }
    });
  }

  // Prune dead tokens so they're never fetched or sent to again.
  if (staleTokens.length > 0) {
    const { error: pruneError } = await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .in('expo_push_token', staleTokens);
    if (pruneError) throw pruneError;
  }

  return new Response(`ok: notified ${messages.length - staleTokens.length}`, { status: 200 });
});
