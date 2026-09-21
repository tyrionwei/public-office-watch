-- Run ONLY on an approved disposable database with the support migration applied,
-- existing participation_proxy_body_sha256(), pgcrypto, auth.users, and a synthetic
-- Vault participation_proxy_hmac_key. Not a production smoke. Everything rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_support(ok boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT: %',msg; END IF; END; $$;
CREATE FUNCTION pg_temp.sign_support(rid uuid, network text, kind text, address text, ref text, nick text, msg text, age_seconds integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE secret text; ts text; hash text;
BEGIN
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='participation_proxy_hmac_key' ORDER BY created_at DESC LIMIT 1;
 IF secret IS NULL THEN RAISE EXCEPTION 'Synthetic Vault proof key prerequisite missing'; END IF;
 ts := (extract(epoch FROM clock_timestamp())::bigint-age_seconds)::text;
 hash := public.participation_proxy_body_sha256(ARRAY[rid::text,network,kind,'USDT',address,ref,nick,msg]);
 PERFORM set_config('request.headers',jsonb_build_object('x-support-timestamp',ts,'x-support-signature',encode(extensions.hmac('crypto-support'||E'\n'||ts||E'\n'||hash,secret,'sha256'),'hex'))::text,true);
END; $$;
DO $$
DECLARE
 rid uuid := gen_random_uuid(); rid2 uuid := gen_random_uuid(); first_id text; result jsonb;
 address text := '0x'||repeat('a',40); ref text := '0x'||repeat('b',64);
 admin_id uuid := gen_random_uuid(); normal_id uuid := gen_random_uuid(); anon_id uuid := gen_random_uuid();
 baseline bigint; role_name text; op text;
BEGIN
 SELECT count(*) INTO baseline FROM public.crypto_support_messages;
 PERFORM pg_temp.assert_support(public.support_base58_size(repeat('2',44))=32,'Solana address bytes');
 PERFORM pg_temp.assert_support(public.support_base58_size(repeat('3',87))=64,'Solana signature bytes');
 PERFORM pg_temp.assert_support(public.support_base58_size(repeat('z',44))=33,'Solana oversized address rejected');
 PERFORM pg_temp.assert_support(public.support_base58_size('0OIl') IS NULL,'base58 alphabet enforced');
 PERFORM pg_temp.assert_support(NOT has_function_privilege('anon','public.support_base58_size(text)','EXECUTE'),'helper private');
 PERFORM pg_temp.assert_support((SELECT relrowsecurity FROM pg_class WHERE oid='public.crypto_support_messages'::regclass),'RLS enabled');
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   FOREACH op IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
     PERFORM pg_temp.assert_support(NOT has_table_privilege(role_name,'public.crypto_support_messages',op),role_name||' direct '||op||' denied');
   END LOOP;
 END LOOP;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   PERFORM pg_temp.assert_support(NOT has_function_privilege(role_name,'public.admin_crypto_support(uuid,integer)','EXECUTE'),'admin RPC private');
   EXECUTE 'SET LOCAL ROLE '||quote_ident(role_name);
   BEGIN PERFORM * FROM public.crypto_support_messages; RAISE EXCEPTION 'direct read unexpectedly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN INSERT INTO public.crypto_support_messages(request_id,network_id,network_type,currency,receiving_address,reference) VALUES(rid,'bsc','evm','USDT',address,ref); RAISE EXCEPTION 'direct write unexpectedly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN UPDATE public.crypto_support_messages SET nickname='forged'; RAISE EXCEPTION 'direct update unexpectedly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN DELETE FROM public.crypto_support_messages; RAISE EXCEPTION 'direct delete unexpectedly allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   EXECUTE 'RESET ROLE';
 END LOOP;
 PERFORM set_config('request.headers','{}',true);
 SET LOCAL ROLE anon;
 BEGIN PERFORM public.submit_crypto_support(rid,'bsc','evm','USDT',address,ref,NULL,NULL); RAISE EXCEPTION 'unsigned call allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM pg_temp.sign_support(rid,'bsc','evm',address,ref,NULL,NULL);
 SET LOCAL ROLE anon;
 result := public.submit_crypto_support(rid,'bsc','evm','USDT',address,ref,NULL,NULL);
 first_id := result->>'id';
 result := public.submit_crypto_support(rid,'bsc','evm','USDT',address,ref,NULL,NULL);
 RESET ROLE;
 PERFORM pg_temp.assert_support(first_id IS NOT NULL AND first_id=result->>'id','replay returns same saved ID');
 PERFORM pg_temp.assert_support((SELECT count(*)=baseline+1 FROM public.crypto_support_messages),'retry stores once');
 PERFORM pg_temp.assert_support((SELECT nickname IS NULL AND message IS NULL AND source='crypto_support' FROM public.crypto_support_messages WHERE request_id=rid),'optional nulls and server source');
 -- Same reference with a fresh ID is allowed, even without nickname or feedback.
 PERFORM pg_temp.sign_support(rid2,'bsc','evm',address,ref,NULL,NULL);
 SET LOCAL ROLE anon;
 PERFORM public.submit_crypto_support(rid2,'bsc','evm','USDT',address,ref,NULL,NULL);
 RESET ROLE;
 PERFORM pg_temp.assert_support((SELECT count(*)=baseline+2 FROM public.crypto_support_messages),'same reference new message allowed');
 -- Altered body cannot reuse the old signature.
 SET LOCAL ROLE anon;
 BEGIN PERFORM public.submit_crypto_support(rid2,'bsc','evm','USDT','0x'||repeat('c',40),ref,NULL,NULL); RAISE EXCEPTION 'forged snapshot allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 -- Correctly signed conflicting request does not overwrite an earlier message.
 PERFORM pg_temp.sign_support(rid,'bsc','evm',address,ref,'changed',NULL);
 BEGIN PERFORM public.submit_crypto_support(rid,'bsc','evm','USDT',address,ref,'changed',NULL); RAISE EXCEPTION 'conflicting retry allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SUPPORT_REQUEST_CONFLICT' THEN RAISE; END IF; END;
 rid2 := gen_random_uuid();
 PERFORM pg_temp.sign_support(rid2,'bsc','evm',address,ref,NULL,NULL,120);
 BEGIN PERFORM public.submit_crypto_support(rid2,'bsc','evm','USDT',address,ref,NULL,NULL); RAISE EXCEPTION 'expired proof allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- Receiver pasted as reference is rejected even when signed.
 PERFORM pg_temp.sign_support(rid,'bsc','evm',address,address,NULL,NULL);
 BEGIN PERFORM public.submit_crypto_support(rid,'bsc','evm','USDT',address,address,NULL,NULL); RAISE EXCEPTION 'receiver reference allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SUPPORT_INVALID' THEN RAISE; END IF; END;
 INSERT INTO auth.users(id,raw_app_meta_data,is_anonymous) VALUES(admin_id,'{"chat_admin":true}',false),(normal_id,'{}',false),(anon_id,'{"chat_admin":true}',true);
 FOREACH rid2 IN ARRAY ARRAY[normal_id,anon_id] LOOP
   BEGIN PERFORM public.admin_crypto_support(rid2,1); RAISE EXCEPTION 'nonadmin allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 SET LOCAL ROLE service_role;
 result := public.admin_crypto_support(admin_id,1);
 RESET ROLE;
 PERFORM pg_temp.assert_support((result->>'total')::bigint=baseline+2,'admin sees message count');
 PERFORM pg_temp.assert_support((result->'items')::text LIKE '%'||ref||'%','admin can see full reference');
 PERFORM pg_temp.assert_support(NOT EXISTS(SELECT 1 FROM information_schema.view_table_usage WHERE view_schema='published' AND table_name='crypto_support_messages'),'no published view joins support messages');
 -- Solana receives a fresh ID and preserves base58 reference case without chain access.
 rid2 := gen_random_uuid();
 PERFORM pg_temp.sign_support(rid2,'solana','solana',repeat('2',44),repeat('3',87),NULL,NULL);
 SET LOCAL ROLE anon;
 result := public.submit_crypto_support(rid2,'solana','solana','USDT',repeat('2',44),repeat('3',87),NULL,NULL);
 RESET ROLE;
 PERFORM pg_temp.assert_support(result->>'id' IS NOT NULL,'Solana signature accepted');
 PERFORM pg_temp.sign_support(rid2,'solana','solana',repeat('2',44),repeat('z',88),NULL,NULL);
 BEGIN PERFORM public.submit_crypto_support(rid2,'solana','solana','USDT',repeat('2',44),repeat('z',88),NULL,NULL); RAISE EXCEPTION 'oversized signature allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SUPPORT_INVALID' THEN RAISE; END IF; END;
END;
$$;
ROLLBACK;
