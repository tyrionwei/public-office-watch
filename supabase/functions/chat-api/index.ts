import { createClient } from 'npm:@supabase/supabase-js@2.105.4';

import {
  encryptIp,
  generatePublicCode,
  getChatCorsHeaders,
  getTrustedClientIp,
  hmacSha256Hex,
  isChatOriginAllowed,
  parseAllowedChatOrigins,
  sha256Hex,
  validateDisplayName,
  validateMessageBody,
  validateReplyId,
} from '../_shared/chat.ts';

function requireEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing server secret: ${name}`);
  }
  return value;
}

function databaseErrorCode(error: { message?: string } | null) {
  const knownCodes = [
    'CHAT_DISABLED',
    'CHAT_PROFILE_REQUIRED',
    'CHAT_BANNED',
    'CHAT_MUTED',
    'CHAT_COOLDOWN',
    'CHAT_DUPLICATE',
    'CHAT_REPLY_UNAVAILABLE',
    'CHAT_INVALID_BODY',
    'CHAT_TERMS_REQUIRED',
    'CHAT_NAME_COOLDOWN',
  ];
  return knownCodes.find((code) => error?.message?.includes(code));
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = parseAllowedChatOrigins(Deno.env.get('CHAT_ALLOWED_ORIGINS'));
  const corsHeaders = getChatCorsHeaders(requestOrigin, allowedOrigins);
  const jsonResponse = (status: number, payload: unknown, extraHeaders: HeadersInit = {}) => (
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...corsHeaders,
        ...extraHeaders,
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  );

  if (!isChatOriginAllowed(requestOrigin, allowedOrigins)) {
    return jsonResponse(403, { error: 'CHAT_ORIGIN_NOT_ALLOWED' });
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const supabaseUrl = requireEnvironment('SUPABASE_URL');
    const anonKey = requireEnvironment('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'CHAT_UNAUTHENTICATED' });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();

    if (authError || !authData.user || authData.user.is_anonymous !== true) {
      return jsonResponse(401, { error: 'CHAT_UNAUTHENTICATED' });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || typeof payload.action !== 'string') {
      return jsonResponse(400, { error: 'CHAT_INVALID_REQUEST' });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (payload.action === 'get-profile') {
      const { data, error } = await serviceClient
        .from('chat_profiles')
        .select([
          'public_code',
          'current_display_name',
          'terms_version',
          'terms_accepted_at',
          'display_name_updated_at',
          'status',
          'muted_until',
        ].join(','))
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (error) {
        console.error('chat profile load failed', error.code);
        return jsonResponse(500, { error: 'CHAT_SERVER_ERROR' });
      }

      return jsonResponse(200, { profile: data });
    }

    if (payload.action === 'set-profile') {
      const displayName = validateDisplayName(payload.displayName);
      if (!displayName.ok) {
        return jsonResponse(400, { error: displayName.code });
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await serviceClient
          .rpc('upsert_chat_profile', {
            p_user_id: authData.user.id,
            p_display_name: displayName.value,
            p_public_code: generatePublicCode(),
            p_accept_terms: payload.acceptTerms === true,
          })
          .single();

        if (!error) {
          const { data: moderation } = await serviceClient
            .from('chat_profiles')
            .select('status,muted_until')
            .eq('user_id', authData.user.id)
            .single();
          return jsonResponse(200, {
            profile: {
              ...data,
              status: moderation?.status ?? 'active',
              muted_until: moderation?.muted_until ?? null,
            },
          });
        }

        if (error.message.includes('CHAT_TERMS_REQUIRED')) {
          return jsonResponse(428, { error: 'CHAT_TERMS_REQUIRED' });
        }

        if (error.message.includes('CHAT_NAME_COOLDOWN')) {
          return jsonResponse(429, { error: 'CHAT_NAME_COOLDOWN' });
        }

        if (error.code !== '23505') {
          console.error('chat profile update failed', error.code);
          return jsonResponse(500, { error: 'CHAT_SERVER_ERROR' });
        }
      }

      return jsonResponse(503, { error: 'CHAT_CODE_ALLOCATION_FAILED' });
    }

    if (payload.action === 'send-message') {
      const body = validateMessageBody(payload.body);
      if (!body.ok) {
        return jsonResponse(400, { error: body.code });
      }

      const replyToMessageId = validateReplyId(payload.replyToMessageId);
      if (replyToMessageId === undefined) {
        return jsonResponse(400, { error: 'CHAT_INVALID_REPLY' });
      }

      const clientIp = getTrustedClientIp(request.headers);
      if (!clientIp) {
        return jsonResponse(503, { error: 'CHAT_CLIENT_IP_UNAVAILABLE' });
      }

      const hmacKey = requireEnvironment('CHAT_IP_HMAC_KEY');
      const encryptionKey = requireEnvironment('CHAT_IP_ENCRYPTION_KEY');
      const keyVersion = Number.parseInt(
        requireEnvironment('CHAT_IP_ENCRYPTION_KEY_VERSION'),
        10,
      );
      if (!Number.isInteger(keyVersion) || keyVersion < 1) {
        throw new Error('CHAT_IP_ENCRYPTION_KEY_VERSION must be a positive integer');
      }

      const userAgent = request.headers.get('user-agent');
      const [ipHmac, ipCiphertext, userAgentHash] = await Promise.all([
        hmacSha256Hex(clientIp, hmacKey),
        encryptIp(clientIp, encryptionKey),
        userAgent ? sha256Hex(userAgent) : Promise.resolve(null),
      ]);
      const { data, error } = await serviceClient
        .rpc('create_chat_message', {
          p_user_id: authData.user.id,
          p_body: body.value,
          p_reply_to_message_id: replyToMessageId,
          p_ip_hmac: ipHmac,
          p_ip_ciphertext: ipCiphertext,
          p_encryption_key_version: keyVersion,
          p_request_id: crypto.randomUUID(),
          p_user_agent_hash: userAgentHash,
        })
        .single();

      if (!error) {
        return jsonResponse(201, { message: data });
      }

      const errorCode = databaseErrorCode(error);
      if (errorCode === 'CHAT_DISABLED') {
        return jsonResponse(503, { error: errorCode });
      }
      if (errorCode === 'CHAT_COOLDOWN') {
        return jsonResponse(
          429,
          { error: errorCode, retryAfterSeconds: 8 },
          { 'Retry-After': '8' },
        );
      }
      if (errorCode === 'CHAT_TERMS_REQUIRED') {
        return jsonResponse(428, { error: errorCode });
      }
      if (errorCode === 'CHAT_MUTED') {
        const { data: restrictedProfile } = await serviceClient
          .from('chat_profiles')
          .select('muted_until')
          .eq('user_id', authData.user.id)
          .maybeSingle();
        return jsonResponse(403, {
          error: errorCode,
          mutedUntil: restrictedProfile?.muted_until ?? null,
        });
      }
      if (errorCode === 'CHAT_BANNED') {
        return jsonResponse(403, { error: errorCode });
      }
      if (errorCode) {
        return jsonResponse(400, { error: errorCode });
      }

      console.error('chat message insert failed', error.code);
      return jsonResponse(500, { error: 'CHAT_SERVER_ERROR' });
    }

    return jsonResponse(400, { error: 'CHAT_UNKNOWN_ACTION' });
  } catch (error) {
    console.error('chat API failed', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse(500, { error: 'CHAT_SERVER_ERROR' });
  }
});
