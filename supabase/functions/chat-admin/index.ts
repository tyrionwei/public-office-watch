import { createClient } from 'npm:@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const moderationReasons = new Set([
  'bot',
  'spam',
  'external_link',
  'advertising',
  'rate_limit_evasion',
  'illegal_or_legal_notice',
]);

const securityHoldReasons = new Set([
  'legal_investigation',
  'major_security_incident',
]);

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

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function adminError(error: { message?: string; code?: string } | null) {
  const knownCodes = [
    'CHAT_ADMIN_FORBIDDEN',
    'CHAT_ADMIN_INVALID_REASON',
    'CHAT_ADMIN_INVALID_MUTE',
    'CHAT_ADMIN_MESSAGE_NOT_FOUND',
    'CHAT_ADMIN_MESSAGE_HELD',
    'CHAT_ADMIN_TARGET_BANNED',
    'CHAT_ADMIN_INVALID_HOLD_REASON',
    'CHAT_ADMIN_SECURITY_LOG_NOT_FOUND',
  ];
  return knownCodes.find((code) => error?.message?.includes(code));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' });

  try {
    const supabaseUrl = requireEnvironment('SUPABASE_URL');
    const anonKey = requireEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'CHAT_ADMIN_UNAUTHENTICATED' });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const adminUser = authData.user;

    if (authError || !adminUser || adminUser.is_anonymous === true) {
      return jsonResponse(401, { error: 'CHAT_ADMIN_UNAUTHENTICATED' });
    }
    if (adminUser.app_metadata?.chat_admin !== true) {
      return jsonResponse(403, { error: 'CHAT_ADMIN_FORBIDDEN' });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || typeof payload.action !== 'string') {
      return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REQUEST' });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (payload.action === 'dashboard') {
      const [
        settingsResult,
        messagesResult,
        actionsResult,
        visibleCountResult,
        removedCountResult,
        mutedCountResult,
        securityCountResult,
        securityHoldCountResult,
      ] = await Promise.all([
        serviceClient
          .from('chat_settings')
          .select('is_enabled,updated_at,terms_version')
          .eq('id', 1)
          .single(),
        serviceClient
          .from('chat_messages')
          .select([
            'id',
            'user_id',
            'display_name_snapshot',
            'public_code_snapshot',
            'body',
            'moderation_status',
            'removed_at',
            'removal_reason',
            'created_at',
          ].join(','))
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(50),
        serviceClient
          .from('chat_moderation_actions')
          .select('id,action_type,message_id,target_user_id,reason,muted_until,created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        serviceClient.from('chat_messages').select('id', { count: 'exact', head: true }).eq('moderation_status', 'visible'),
        serviceClient.from('chat_messages').select('id', { count: 'exact', head: true }).eq('moderation_status', 'removed'),
        serviceClient.from('chat_profiles').select('user_id', { count: 'exact', head: true }).eq('status', 'muted'),
        serviceClient.from('chat_message_security_logs').select('message_id', { count: 'exact', head: true }),
        serviceClient.from('chat_message_security_logs').select('message_id', { count: 'exact', head: true }).not('legal_hold_until', 'is', null),
      ]);

      const readError = settingsResult.error
        ?? messagesResult.error
        ?? actionsResult.error
        ?? visibleCountResult.error
        ?? removedCountResult.error
        ?? mutedCountResult.error
        ?? securityCountResult.error
        ?? securityHoldCountResult.error;
      if (readError) {
        console.error('chat admin dashboard failed', readError.code);
        return jsonResponse(500, { error: 'CHAT_ADMIN_SERVER_ERROR' });
      }

      const userIds = new Set<string>();
      for (const message of messagesResult.data ?? []) userIds.add(message.user_id);
      for (const action of actionsResult.data ?? []) {
        if (action.target_user_id) userIds.add(action.target_user_id);
      }

      const profilesResult = userIds.size > 0
        ? await serviceClient
          .from('chat_profiles')
          .select('user_id,public_code,status,muted_until')
          .in('user_id', Array.from(userIds))
        : { data: [], error: null };

      const messageIds = (messagesResult.data ?? []).map((message) => message.id);
      const securityResult = messageIds.length > 0
        ? await serviceClient
          .from('chat_message_security_logs')
          .select('message_id,expires_at,legal_hold_until')
          .in('message_id', messageIds)
        : { data: [], error: null };

      if (profilesResult.error || securityResult.error) {
        console.error('chat admin private status failed', profilesResult.error?.code ?? securityResult.error?.code);
        return jsonResponse(500, { error: 'CHAT_ADMIN_SERVER_ERROR' });
      }

      const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.user_id, profile]));
      const securityLogs = new Map((securityResult.data ?? []).map((log) => [log.message_id, log]));
      return jsonResponse(200, {
        adminEmail: adminUser.email ?? null,
        status: settingsResult.data,
        counts: {
          visibleMessages: visibleCountResult.count ?? 0,
          removedMessages: removedCountResult.count ?? 0,
          mutedProfiles: mutedCountResult.count ?? 0,
          securityLogs: securityCountResult.count ?? 0,
          heldSecurityLogs: securityHoldCountResult.count ?? 0,
        },
        messages: (messagesResult.data ?? []).map((message) => {
          const profile = profiles.get(message.user_id);
          const securityLog = securityLogs.get(message.id);
          return {
            id: message.id,
            displayName: message.display_name_snapshot,
            publicCode: message.public_code_snapshot,
            body: message.body,
            moderationStatus: message.moderation_status,
            removalReason: message.removal_reason,
            removedAt: message.removed_at,
            profileStatus: profile?.status ?? 'unknown',
            mutedUntil: profile?.muted_until ?? null,
            securityLogPresent: Boolean(securityLog),
            securityExpiresAt: securityLog?.expires_at ?? null,
            securityHoldActive: securityLog?.legal_hold_until != null,
            createdAt: message.created_at,
          };
        }),
        actions: (actionsResult.data ?? []).map((action) => ({
          id: action.id,
          actionType: action.action_type,
          messageId: action.message_id,
          targetPublicCode: action.target_user_id
            ? profiles.get(action.target_user_id)?.public_code ?? null
            : null,
          reason: action.reason,
          mutedUntil: action.muted_until,
          createdAt: action.created_at,
        })),
      });
    }

    if (payload.action === 'set-enabled') {
      if (typeof payload.enabled !== 'boolean') {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REQUEST' });
      }
      const { data, error } = await serviceClient.rpc('admin_set_chat_enabled', {
        p_admin_user_id: adminUser.id,
        p_enabled: payload.enabled,
      }).single();
      if (error) {
        const code = adminError(error);
        return jsonResponse(code === 'CHAT_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'CHAT_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { status: data });
    }

    if (payload.action === 'set-message-visibility') {
      if (!isUuid(payload.messageId) || typeof payload.visible !== 'boolean') {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REQUEST' });
      }
      const reason = payload.visible ? 'operator_correction' : payload.reason;
      if (typeof reason !== 'string' || (!payload.visible && !moderationReasons.has(reason))) {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REASON' });
      }
      const { data, error } = await serviceClient.rpc('admin_set_chat_message_visibility', {
        p_admin_user_id: adminUser.id,
        p_message_id: payload.messageId,
        p_visible: payload.visible,
        p_reason: reason,
      }).single();
      if (error) {
        const code = adminError(error);
        return jsonResponse(code === 'CHAT_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'CHAT_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { message: data });
    }

    if (payload.action === 'set-mute') {
      if (!isUuid(payload.messageId) || typeof payload.muted !== 'boolean') {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REQUEST' });
      }
      const durationMinutes = payload.muted ? payload.durationMinutes : null;
      const reason = payload.muted ? payload.reason : 'operator_correction';
      if (
        (payload.muted && durationMinutes !== 60 && durationMinutes !== 1440)
        || typeof reason !== 'string'
        || (payload.muted && !moderationReasons.has(reason))
      ) {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_MUTE' });
      }
      const { data, error } = await serviceClient.rpc('admin_set_chat_profile_mute', {
        p_admin_user_id: adminUser.id,
        p_message_id: payload.messageId,
        p_muted: payload.muted,
        p_duration_minutes: durationMinutes,
        p_reason: reason,
      }).single();
      if (error) {
        const code = adminError(error);
        return jsonResponse(code === 'CHAT_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'CHAT_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { profile: data });
    }

    if (payload.action === 'set-security-hold') {
      if (!isUuid(payload.messageId) || typeof payload.held !== 'boolean') {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_REQUEST' });
      }
      const reason = payload.held ? payload.reason : 'hold_released';
      if (typeof reason !== 'string' || (payload.held && !securityHoldReasons.has(reason))) {
        return jsonResponse(400, { error: 'CHAT_ADMIN_INVALID_HOLD_REASON' });
      }
      const { data, error } = await serviceClient.rpc('admin_set_chat_security_hold', {
        p_admin_user_id: adminUser.id,
        p_message_id: payload.messageId,
        p_held: payload.held,
        p_reason: reason,
      }).single();
      if (error) {
        const code = adminError(error);
        return jsonResponse(code === 'CHAT_ADMIN_FORBIDDEN' ? 403 : 400, { error: code ?? 'CHAT_ADMIN_SERVER_ERROR' });
      }
      return jsonResponse(200, { security: data });
    }

    return jsonResponse(400, { error: 'CHAT_ADMIN_UNKNOWN_ACTION' });
  } catch (error) {
    console.error('chat admin API failed', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse(500, { error: 'CHAT_ADMIN_SERVER_ERROR' });
  }
