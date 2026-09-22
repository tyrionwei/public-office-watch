import { createClient } from 'npm:@supabase/supabase-js@2.105.4';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'FEEDBACK_METHOD' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !secret) return reply({ error: 'FEEDBACK_UNAVAILABLE' }, 503);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'FEEDBACK_AUTH' }, 401);
  try {
    const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user || user.is_anonymous) return reply({ error: 'FEEDBACK_AUTH' }, 401);
    if (user.app_metadata?.chat_admin !== true) return reply({ error: 'FEEDBACK_FORBIDDEN' }, 403);
    const raw = await req.text();
    if (raw.length > 16000) return reply({ error: 'FEEDBACK_INVALID' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'FEEDBACK_INVALID' }, 400); }
    if (!body || !['dashboard', 'detail', 'save', 'support-messages'].includes(body.action)) return reply({ error: 'FEEDBACK_INVALID' }, 400);
    const input = body.input ?? {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: 'FEEDBACK_INVALID' }, 400);
    const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.action === 'support-messages' && (Object.keys(input).some(key => key !== 'page') || input.page !== undefined && (!Number.isSafeInteger(input.page) || input.page < 1))) return reply({ error: 'FEEDBACK_INVALID' }, 400);
    const { data, error } = body.action === 'support-messages'
      ? await service.rpc('admin_crypto_support', { p_admin_user_id: user.id, p_page: input.page ?? 1 })
      : await service.rpc('admin_feedback', { p_admin_user_id: user.id, p_action: body.action, p_input: input });
    if (error) {
      const code = error.message;
      const status = code === 'FEEDBACK_FORBIDDEN' ? 403 : code === 'FEEDBACK_NOT_FOUND' ? 404
        : ['FEEDBACK_CONFLICT', 'FEEDBACK_REQUEST_CONFLICT'].includes(code) ? 409
          : ['FEEDBACK_INVALID', 'FEEDBACK_REASON_REQUIRED'].includes(code) || ['22P02', '22003'].includes(error.code) ? 400 : 500;
      return reply({ error: status === 500 ? 'FEEDBACK_SERVER_ERROR' : status === 400 && !code.startsWith('FEEDBACK_') ? 'FEEDBACK_INVALID' : code }, status);
    }
    return reply(data);
  } catch { return reply({ error: 'FEEDBACK_SERVER_ERROR' }, 500); }
});
