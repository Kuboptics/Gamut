// supabase/functions/delete-account/index.ts
//
// Permanently deletes the signed-in user's OWN account.
// Called by the app (while still logged in) via
// supabase.functions.invoke('delete-account').

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'missing authorization header' }, 401);
    const token = authHeader.replace('Bearer ', '');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'invalid or expired token' }, 401);
    }
    const userId = userData.user.id;

    const { error: storageError } = await admin.storage
      .from('thumbnails')
      .remove([`${userId}/0.jpg`, `${userId}/1.jpg`, `${userId}/2.jpg`]);
    if (storageError) {
      console.error('thumbnail cleanup failed for', userId, storageError.message);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: 'account deletion failed' }, 500);

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('delete-account error:', err);
    return json({ error: 'unexpected server error' }, 500);
  }
});
