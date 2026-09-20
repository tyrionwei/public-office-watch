BEGIN;

-- Bounded base58 format check, without any chain or wallet access.
CREATE FUNCTION public.support_base58_size(value text) RETURNS integer
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '' AS $$
DECLARE alphabet text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  n numeric := 0; size integer := 0; i integer;
BEGIN
  IF value !~ '^[1-9A-HJ-NP-Za-km-z]{1,88}$' THEN RETURN NULL; END IF;
  FOR i IN 1..length(value) LOOP n := n*58 + strpos(alphabet,substr(value,i,1))-1; END LOOP;
  WHILE n>0 LOOP size := size+1; n := trunc(n/256); END LOOP;
  RETURN size + length(value)-length(ltrim(value,'1'));
END;
$$;
REVOKE ALL ON FUNCTION public.support_base58_size(text) FROM PUBLIC,anon,authenticated,service_role;

-- Private support messages, never payment records or public feedback.
CREATE TABLE public.crypto_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'crypto_support' CHECK (source = 'crypto_support'),
  network_id text NOT NULL CHECK (length(network_id) BETWEEN 1 AND 64),
  network_type text NOT NULL CHECK (network_type IN ('evm','tron','solana')),
  currency text NOT NULL CHECK (currency = 'USDT'),
  receiving_address text NOT NULL,
  reference text NOT NULL CHECK (length(reference) BETWEEN 1 AND 256),
  nickname text CHECK (length(nickname) BETWEEN 1 AND 50),
  message text CHECK (length(message) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crypto_support_messages_created_idx ON public.crypto_support_messages(created_at DESC, id DESC);
ALTER TABLE public.crypto_support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crypto_support_messages FROM PUBLIC, anon, authenticated, service_role;

-- Only the server's body-bound proof can submit. No auth account, user ID,
-- chain lookup, or service-role credential is required by the public site.
CREATE FUNCTION public.submit_crypto_support(
  p_request_id uuid, p_network_id text, p_network_type text, p_currency text,
  p_receiving_address text, p_reference text, p_nickname text, p_message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  headers jsonb := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  ts text; signature text; secret text; body_hash text; expected text;
  saved public.crypto_support_messages%ROWTYPE;
BEGIN
  ts := headers->>'x-support-timestamp'; signature := headers->>'x-support-signature';
  IF ts IS NULL OR ts !~ '^[0-9]{10}$' OR signature IS NULL OR signature !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SUPPORT_PROXY_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF abs(extract(epoch FROM clock_timestamp())::bigint-ts::bigint)>60 THEN
    RAISE EXCEPTION 'SUPPORT_PROXY_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets
    WHERE name='participation_proxy_hmac_key' ORDER BY created_at DESC LIMIT 1;
  IF secret IS NULL THEN RAISE EXCEPTION 'SUPPORT_PROXY_REQUIRED' USING ERRCODE='42501'; END IF;
  body_hash := public.participation_proxy_body_sha256(ARRAY[p_request_id::text,p_network_id,p_network_type,p_currency,p_receiving_address,p_reference,p_nickname,p_message]);
  expected := encode(extensions.hmac('crypto-support'||E'\n'||ts||E'\n'||body_hash,secret,'sha256'),'hex');
  IF signature IS DISTINCT FROM expected THEN RAISE EXCEPTION 'SUPPORT_PROXY_REQUIRED' USING ERRCODE='42501'; END IF;
  -- The trusted Worker chooses network/currency/address from the single reviewed
  -- config; clients cannot sign arbitrary snapshots. Recheck basic format here.
  IF p_request_id IS NULL OR p_network_id IS NULL OR length(p_network_id) NOT BETWEEN 1 AND 64
    OR p_currency IS DISTINCT FROM 'USDT' OR p_network_type IS NULL OR p_network_type NOT IN ('evm','tron','solana')
    OR p_reference IS NULL OR length(p_reference) NOT BETWEEN 1 AND 256
    OR p_receiving_address IS NULL OR length(p_nickname)>50 OR length(p_message)>2000 THEN
    RAISE EXCEPTION 'SUPPORT_INVALID';
  END IF;
  IF p_network_type='evm' THEN
    IF p_receiving_address !~ '^0x[0-9a-fA-F]{40}$' OR p_receiving_address ~ '^0x0{40}$'
      OR (p_reference !~ '^0x[0-9a-fA-F]{40}$' AND p_reference !~ '^0x[0-9a-fA-F]{64}$')
      OR p_reference ~ '^0x0{40}$' OR lower(p_reference)=lower(p_receiving_address) THEN RAISE EXCEPTION 'SUPPORT_INVALID'; END IF;
  ELSIF p_network_type='tron' THEN
    IF p_receiving_address !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
      OR (p_reference !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND p_reference !~ '^[0-9a-fA-F]{64}$')
      OR p_reference=p_receiving_address THEN RAISE EXCEPTION 'SUPPORT_INVALID'; END IF;
  ELSE
    IF public.support_base58_size(p_receiving_address) IS DISTINCT FROM 32
      OR coalesce(public.support_base58_size(p_reference),0) NOT IN (32,64)
      OR p_reference=p_receiving_address THEN RAISE EXCEPTION 'SUPPORT_INVALID'; END IF;
  END IF;
  -- Serialize only the submission identifier. The same address/TxID may be used
  -- by any number of new messages. Never return another message's contents.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  SELECT * INTO saved FROM public.crypto_support_messages WHERE request_id=p_request_id;
  IF FOUND THEN
    IF ROW(saved.network_id,saved.network_type,saved.currency,saved.receiving_address,saved.reference,saved.nickname,saved.message)
      IS DISTINCT FROM ROW(p_network_id,p_network_type,p_currency,p_receiving_address,p_reference,p_nickname,p_message) THEN
      RAISE EXCEPTION 'SUPPORT_REQUEST_CONFLICT';
    END IF;
    RETURN jsonb_build_object('id',saved.id);
  END IF;
  INSERT INTO public.crypto_support_messages(request_id,network_id,network_type,currency,receiving_address,reference,nickname,message)
  VALUES(p_request_id,p_network_id,p_network_type,p_currency,p_receiving_address,p_reference,p_nickname,p_message) RETURNING * INTO saved;
  RETURN jsonb_build_object('id',saved.id);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_crypto_support(uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_crypto_support(uuid,text,text,text,text,text,text,text) TO anon;

CREATE FUNCTION public.admin_crypto_support(p_admin_user_id uuid, p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE page integer; total bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_admin_user_id
    AND coalesce(is_anonymous,false)=false AND raw_app_meta_data->'chat_admin'='true'::jsonb) THEN
    RAISE EXCEPTION 'FEEDBACK_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO total FROM public.crypto_support_messages;
  page := greatest(1,least(coalesce(p_page,1),greatest(1,ceil(total/20.0)::integer)));
  RETURN jsonb_build_object('page',page,'page_size',20,'total',total,'items',(
    SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC),'[]'::jsonb) FROM (
      SELECT id,source,network_id,currency,receiving_address,reference,nickname,message,created_at
      FROM public.crypto_support_messages ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET (page-1)*20
    ) s));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_crypto_support(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_crypto_support(uuid,integer) TO service_role;
COMMENT ON TABLE public.crypto_support_messages IS 'Private support messages; unverified transaction references. created_at is submission time, not transfer time.';
NOTIFY pgrst, 'reload schema';
COMMIT;
