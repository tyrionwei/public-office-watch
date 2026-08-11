import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
import { normalizePublicUpdateDraft, normalizePublicUpdateReview } from '../_shared/publicUpdateAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

function knownAdminError(error: { message?: string } | null) {
  const codes = [
    'PUBLIC_UPDATE_ADMIN_FORBIDDEN',
    'PUBLIC_UPDATE_ADMIN_INVALID_DRAFT',
    'PUBLIC_UPDATE_ADMIN_INVALID_REVIEW',
    'PUBLIC_UPDATE_ADMIN_NOT_FOUND',
    'PUBLIC_UPDATE_ADMIN_INVALID_STATE',
  ];
  return codes.find((code) => error?.message?.includes(code));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' });

  try {
    const supabaseUrl = requireEnvironment('SUPABASE_URL');
    const anonKey = requireEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(401, { error: 'PUBLIC_UPDATE_ADMIN_UNAUTHENTICATED' });

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const adminUser = authData.user;
    if (authError || !adminUser || adminUser.is_anonymous === true) {
      return jsonResponse(401, { error: 'PUBLIC_UPDATE_ADMIN_UNAUTHENTICATED' });
    }
    if (adminUser.app_metadata?.chat_admin !== true) {
      return jsonResponse(403, { error: 'PUBLIC_UPDATE_ADMIN_FORBIDDEN' });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || typeof payload.action !== 'string') return jsonResponse(400, { error: 'PUBLIC_UPDATE_ADMIN_INVALID_REQUEST' });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (payload.action === 'dashboard') {
      const [eventsResult, actionsResult] = await Promise.all([
        serviceClient
          .from('public_update_events')
          .select('update_id,update_type,title,summary,entity_type,entity_id,entity_href,source_name,source_url,occurred_at,published_at,review_status,visibility,is_public,review_note,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(100),
        serviceClient
          .from('public_update_event_actions')
          .select('action_id,update_id,action_type,reason,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (eventsResult.error || actionsResult.error) {
        console.error('public update admin dashboard failed', eventsResult.error?.code ?? actionsResult.error?.code);
        return jsonResponse(500, { error: 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, {
        adminEmail: adminUser.email ?? null,
        events: eventsResult.data ?? [],
        actions: actionsResult.data ?? [],
      });
    }

    if (payload.action === 'create-draft') {
      const draft = normalizePublicUpdateDraft(payload);
      if (!draft) return jsonResponse(400, { error: 'PUBLIC_UPDATE_ADMIN_INVALID_DRAFT' });
      const { data, error } = await serviceClient.rpc('admin_create_public_update_event', {
        p_admin_user_id: adminUser.id,
        p_update_type: draft.updateType,
        p_title: draft.title,
        p_summary: draft.summary,
        p_entity_type: draft.entityType,
        p_entity_id: draft.entityId,
        p_entity_href: draft.entityHref,
        p_source_name: draft.sourceName,
        p_source_url: draft.sourceUrl,
        p_occurred_at: draft.occurredAt,
      }).single();
      if (error) {
        const code = knownAdminError(error);
        return jsonResponse(code === 'PUBLIC_UPDATE_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { event: data });
    }

    if (payload.action === 'review') {
      const review = normalizePublicUpdateReview(payload);
      if (!review) return jsonResponse(400, { error: 'PUBLIC_UPDATE_ADMIN_INVALID_REVIEW' });
      const { data, error } = await serviceClient.rpc('admin_review_public_update_event', {
        p_admin_user_id: adminUser.id,
        p_update_id: review.updateId,
        p_action: review.action,
        p_reason: review.reason,
      }).single();
      if (error) {
        const code = knownAdminError(error);
        return jsonResponse(code === 'PUBLIC_UPDATE_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { event: data });
    }

    return jsonResponse(400, { error: 'PUBLIC_UPDATE_ADMIN_UNKNOWN_ACTION' });
  } catch (error) {
    console.error('public update admin API failed', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse(500, { error: 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR' });
  }
});
