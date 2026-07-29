// contact-submitter — Supabase Edge Function
//
// Relays a message from a signed-in map visitor to the person who
// submitted a hive, WITHOUT ever exposing the submitter's email address
// to the client. This is the deliberate design decided in chat 2026-07-29:
// the checker never sees the raw address, and no copy of it is ever
// written to the `hives` table — it's looked up live from auth.users via
// the service role key, which only this server-side function can use.
//
// Deploy (Supabase dashboard → Edge Functions → Create a new function,
// name it exactly "contact-submitter", paste this file's contents) or via
// CLI: `supabase functions deploy contact-submitter`.
//
// Required secret (Edge Functions → contact-submitter → Secrets, or
// `supabase secrets set RESEND_API_KEY=...`):
//   RESEND_API_KEY — same value already used as the SMTP password in
//   Supabase Authentication → SMTP Settings (Resend issues one API key
//   that doubles as the SMTP password). Reuse that exact value here.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY do NOT
// need to be set manually — Supabase injects those into every Edge
// Function automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { hive_id, message } = await req.json();

    if (!hive_id || !message || typeof message !== 'string' || !message.trim()) {
      return json({ error: 'Missing hive_id or message.' }, 400);
    }
    if (message.length > 2000) {
      return json({ error: 'Message is too long (2000 character limit).' }, 400);
    }

    // Identify the sender from their own auth token — functions.invoke()
    // on the client automatically forwards the signed-in user's JWT in the
    // Authorization header, same as any other authenticated Supabase call.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Sign in required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.error('RESEND_API_KEY secret is not set for this function.');
      return json({ error: 'Server not configured to send messages yet.' }, 500);
    }

    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: sender }, error: authErr } = await asUser.auth.getUser();
    if (authErr || !sender?.email) {
      return json({ error: 'Sign in required.' }, 401);
    }

    // Service-role client — only this function can use it; never sent to
    // the client, never logged, never stored on any row.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: hive, error: hiveErr } = await admin
      .from('hives')
      .select('id, name, allow_contact, submitted_by')
      .eq('id', hive_id)
      .single();

    if (hiveErr || !hive) return json({ error: 'Hive not found.' }, 404);
    if (!hive.allow_contact || !hive.submitted_by) {
      return json({ error: 'This hive is not open to contact.' }, 403);
    }
    if (hive.submitted_by === sender.id) {
      return json({ error: "You submitted this hive — no need to contact yourself." }, 400);
    }

    const { data: submitterData, error: submitterErr } =
      await admin.auth.admin.getUserById(hive.submitted_by);
    const submitterEmail = submitterData?.user?.email;
    if (submitterErr || !submitterEmail) {
      return json({ error: 'Could not find the submitter — they may have deleted their account.' }, 404);
    }

    const hiveName = hive.name || `Hive #${hive.id}`;
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SaveTheHives <noreply@savethehives.org>',
        to: submitterEmail,
        reply_to: sender.email,
        subject: `Someone has a message about "${hiveName}"`,
        text:
          `A SaveTheHives visitor (${sender.email}) sent you a message about the hive you logged, "${hiveName}" (#${hive.id}):\n\n` +
          `${message.trim()}\n\n` +
          `---\n` +
          `Reply directly to this email to respond — it goes straight to ${sender.email}, not through SaveTheHives.\n\n` +
          `You're receiving this because you checked "Let others contact me about this hive" when you submitted it. ` +
          `savethehives.org never shares your email address directly with other users.`,
      }),
    });

    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
      return json({ error: 'Failed to send — please try again.' }, 502);
    }

    return json({ success: true });
  } catch (e) {
    console.error('contact-submitter unexpected error:', e);
    return json({ error: 'Unexpected error.' }, 500);
  }
});
