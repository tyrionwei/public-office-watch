begin;

-- Existing databases may already contain the reviewed release under duplicate
-- person IDs. Normalize both relationship endpoints without changing the
-- reviewed claim keys, evidence, or confidence levels.
update public.person_claims claim
set person_id = canonical_map.canonical_person_id,
    updated_at = now()
from public.person_canonical_map canonical_map
where claim.claim_key like 'research:tnl-dark-guide-family:%'
  and canonical_map.person_id = claim.person_id
  and claim.person_id is distinct from canonical_map.canonical_person_id;

update public.person_claims claim
set claim_json = jsonb_set(
        claim.claim_json,
        '{relativePersonId}',
        to_jsonb(canonical_map.canonical_person_id::text),
        false
    ),
    updated_at = now()
from public.person_canonical_map canonical_map
where claim.claim_key like 'research:tnl-dark-guide-family:%'
  and claim.claim_json->>'relativePersonId' = canonical_map.person_id::text
  and canonical_map.person_id is distinct from canonical_map.canonical_person_id;

-- The cited father, former Taichung councilor Hung Chin-fu, identifies this
-- record as the Taichung plain-indigenous councilor, not the Pingtung namesake.
update public.person_claims
set person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845',
    updated_at = now()
where claim_key = 'research:tnl-dark-guide-family:f442ee890eed3f95'
  and person_id is distinct from 'd87a57f2-becb-4be7-8272-3a1337ef3845';

do $$
begin
  if (select count(*) from public.person_claims where claim_key like 'research:tnl-dark-guide-family:%') <> 174 then
    raise exception 'TNL family claim count drift after canonical repair';
  end if;

  if not exists (
    select 1
    from public.person_claims
    where claim_key = 'research:tnl-dark-guide-family:450cdf0cdc813aa4'
      and person_id = '9d8e00d6-5386-4449-86e4-9c5c938c561a'
  ) then
    raise exception 'Sung Yu-chen family claim canonical repair failed';
  end if;

  if not exists (
    select 1
    from public.person_claims
    where claim_key = 'research:tnl-dark-guide-family:f442ee890eed3f95'
      and person_id = 'd87a57f2-becb-4be7-8272-3a1337ef3845'
  ) then
    raise exception 'Hung Chih-ming family claim identity repair failed';
  end if;

  if exists (
    select 1
    from public.person_claims claim
    join public.person_canonical_map canonical_map on canonical_map.person_id = claim.person_id
    where claim.claim_key like 'research:tnl-dark-guide-family:%'
      and claim.person_id is distinct from canonical_map.canonical_person_id
  ) then
    raise exception 'TNL family claim subject still uses a duplicate person ID';
  end if;

  if exists (
    select 1
    from public.person_claims claim
    join public.person_canonical_map canonical_map
      on canonical_map.person_id::text = claim.claim_json->>'relativePersonId'
    where claim.claim_key like 'research:tnl-dark-guide-family:%'
      and canonical_map.person_id is distinct from canonical_map.canonical_person_id
  ) then
    raise exception 'TNL family claim relative still uses a duplicate person ID';
  end if;

  if (
    select count(*)
    from public.public_person_claims public_claim
    join public.person_claims claim on claim.id = public_claim.claim_id
    where claim.claim_key like 'research:tnl-dark-guide-family:%'
  ) <> 174 then
    raise exception 'TNL family public claim count drift after canonical repair';
  end if;
end
$$;

commit;
