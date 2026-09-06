BEGIN;
CREATE TABLE public.registration_name_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_claim_id UUID NOT NULL UNIQUE,
  candidate_external_id TEXT NOT NULL UNIQUE,
  race_id UUID NOT NULL REFERENCES public.races(id),
  display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0),
  party TEXT,
  registered_on DATE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://web[.]cec[.]gov[.]tw/'),
  source_hash TEXT NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX registration_name_roster_race_idx ON public.registration_name_roster(race_id);
ALTER TABLE public.registration_name_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_name_roster FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_name_roster TO service_role, admin_role;
CREATE POLICY registration_name_roster_admin ON public.registration_name_roster
  TO admin_role USING (TRUE) WITH CHECK (TRUE);
COMMENT ON TABLE public.registration_name_roster IS
  'Reviewed official registration facts only. No person identity is created or inferred. source_claim_id is private audit provenance, not a public identity.';
CREATE FUNCTION published.registration_names_for(p_race_ids UUID[])
RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'candidate_id', n.id, 'person_id', '', 'person_name', n.display_name,
    'person_party', NULL, 'person_position', NULL,
    'race_id', r.race_id, 'race_title', r.title,
    'election_id', r.election_id, 'election_name', r.election_name,
    'election_year', e.year, 'region_id', r.region_id, 'region_name', r.region_name,
    'party', n.party, 'candidate_no', NULL,
    'registration_status', 'registered', 'candidacy_status', 'registered',
    'election_result', 'pending', 'status_updated_at', n.reviewed_at,
    'candidate_updated_at', n.reviewed_at,
    'vote_count', NULL, 'vote_rate', NULL, 'is_elected', NULL,
    'is_incumbent', NULL, 'office_at_election', NULL,
    'source_name', n.source_name, 'source_url', n.source_url,
    'primary_photo_url', NULL, 'primary_photo_thumbnail_url', NULL,
    'photo_attribution', NULL, 'photo_license_type', NULL,
    'gender', 'unknown', 'age_group', NULL
  )
  FROM public.registration_name_roster n
  JOIN published.races r ON r.race_id = n.race_id
  JOIN published.elections e ON e.election_id = r.election_id AND e.year = 2026
  WHERE n.is_public AND n.race_id = ANY(p_race_ids)
    AND cardinality(p_race_ids) BETWEEN 1 AND 128
    -- After identity review, the published candidate replaces this text-only row.
    AND NOT EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN published.candidates visible ON visible.candidate_id = c.id
      WHERE c.external_id = n.candidate_external_id
    )
  ORDER BY n.race_id, n.display_name, n.id
  LIMIT 2001;
$function$;
REVOKE ALL ON FUNCTION published.registration_names_for(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION published.registration_names_for(UUID[]) TO anon, authenticated, service_role, admin_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
