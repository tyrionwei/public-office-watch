BEGIN;

CREATE TABLE IF NOT EXISTS public.party_name_aliases (
    alias_name TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    official_party_number INT,
    source_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(alias_name) <> ''),
    CHECK (BTRIM(canonical_name) <> '')
);

COMMENT ON TABLE public.party_name_aliases IS
    'Exact aliases used to normalize party display names while raw source records remain unchanged.';

ALTER TABLE public.party_name_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.party_name_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_name_aliases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_name_aliases TO admin_role;

INSERT INTO public.party_name_aliases (
    alias_name,
    canonical_name,
    official_party_number,
    source_url,
    notes
)
VALUES
    ('台灣民眾黨', '台灣民眾黨', 350, 'https://party.moi.gov.tw/', 'Traditional character source variant'),
    ('臺灣民眾黨', '台灣民眾黨', 350, 'https://party.moi.gov.tw/', 'Traditional character source variant'),
    ('台灣基進', '台灣基進', 303, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=362&sms=13073', 'Current Ministry of the Interior name'),
    ('臺灣基進', '台灣基進', 303, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=362&sms=13073', 'Traditional character source variant'),
    ('基進黨', '台灣基進', 303, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=362&sms=13073', 'Historical or shortened source name'),
    ('台灣綠黨', '台灣綠黨', 79, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=138&sms=13073', 'Current Ministry of the Interior name'),
    ('臺灣綠黨', '台灣綠黨', 79, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=138&sms=13073', 'Traditional character source variant'),
    ('綠黨', '台灣綠黨', 79, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=138&sms=13073', 'Historical or shortened source name'),
    ('台聯黨', '台聯黨', 95, 'https://party.moi.gov.tw/PartyMain.aspx?PageSize=100&gs=P01&n=16100&page=1&sms=13073', 'Current Ministry of the Interior name'),
    ('台灣團結聯盟', '台聯黨', 95, 'https://party.moi.gov.tw/PartyMain.aspx?PageSize=100&gs=P01&n=16100&page=1&sms=13073', 'Former full name'),
    ('臺灣團結聯盟', '台聯黨', 95, 'https://party.moi.gov.tw/PartyMain.aspx?PageSize=100&gs=P01&n=16100&page=1&sms=13073', 'Former full name variant'),
    ('台灣照生黨', '台灣照生黨', 211, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=270&sms=13073', 'Current Ministry of the Interior name'),
    ('臺灣照生黨', '台灣照生黨', 211, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=270&sms=13073', 'Traditional character source variant'),
    ('台灣革命黨', '台灣照生黨', 211, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=270&sms=13073', 'Former name'),
    ('臺灣革命黨', '台灣照生黨', 211, 'https://party.moi.gov.tw/PartyMainContent.aspx?n=16100&s=270&sms=13073', 'Former name variant'),
    ('社會民主黨', '社會民主黨', NULL, NULL, 'Canonical display name'),
    ('台灣社會民主黨', '社會民主黨', NULL, NULL, 'Source name variant'),
    ('臺灣社會民主黨', '社會民主黨', NULL, NULL, 'Source name variant'),
    ('無黨籍', '無黨籍', NULL, NULL, 'Canonical unaffiliated label'),
    ('無', '無黨籍', NULL, NULL, 'Abbreviated unaffiliated label'),
    ('無黨', '無黨籍', NULL, NULL, 'Abbreviated unaffiliated label'),
    ('無政黨', '無黨籍', NULL, NULL, 'Source unaffiliated label'),
    ('無黨籍及未經政黨推薦', '無黨籍', NULL, NULL, 'CEC unaffiliated label'),
    ('無黨籍及未經政黨推薦候選人', '無黨籍', NULL, NULL, 'CEC unaffiliated candidate label')
ON CONFLICT (alias_name) DO UPDATE
SET
    canonical_name = EXCLUDED.canonical_name,
    official_party_number = EXCLUDED.official_party_number,
    source_url = EXCLUDED.source_url,
    notes = EXCLUDED.notes,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.canonical_party_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_name TEXT;
    v_canonical_name TEXT;
BEGIN
    v_name := NULLIF(BTRIM(p_name), '');
    IF v_name IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT alias.canonical_name
    INTO v_canonical_name
    FROM public.party_name_aliases alias
    WHERE alias.alias_name = v_name;

    RETURN COALESCE(v_canonical_name, v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_party_key(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT LOWER(
        REGEXP_REPLACE(
            REPLACE(public.canonical_party_name(p_name), '臺', '台'),
            '[[:space:]]+',
            '',
            'g'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.canonical_party_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.canonical_party_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_party_name(TEXT) TO anon, authenticated, service_role, admin_role;
GRANT EXECUTE ON FUNCTION public.canonical_party_key(TEXT) TO anon, authenticated, service_role, admin_role;

CREATE TEMP TABLE _party_normalization_before ON COMMIT DROP AS
SELECT
    (SELECT COUNT(*) FROM public.parties) AS party_count,
    (SELECT COUNT(*) FROM public.people) AS people_count,
    (SELECT COUNT(*) FROM public.candidates) AS candidate_count;

CREATE TEMP TABLE _party_merge_targets (
    canonical_name TEXT PRIMARY KEY,
    target_id UUID NOT NULL,
    short_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _party_merge_targets (canonical_name, target_id, short_name)
SELECT mapping.canonical_name, party.id, mapping.short_name
FROM (
    VALUES
        ('台灣基進', 'tsp', '基進'),
        ('台灣綠黨', 'green-party', '綠黨'),
        ('台聯黨', 'tsu', '台聯'),
        ('台灣照生黨', 'f21738bd5a', '照生黨')
) AS mapping(canonical_name, target_slug, short_name)
JOIN public.parties party ON party.slug = mapping.target_slug;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM _party_merge_targets) <> 4 THEN
        RAISE EXCEPTION 'Expected four canonical party target rows before normalization';
    END IF;
END;
$$;

CREATE TEMP TABLE _party_merge_duplicates ON COMMIT DROP AS
SELECT party.id, target.target_id, party.name
FROM public.parties party
JOIN _party_merge_targets target
  ON public.canonical_party_name(party.name) = target.canonical_name
WHERE party.id <> target.target_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _party_merge_duplicates duplicate
        JOIN public.party_finance_summaries finance ON finance.party_id = duplicate.id
    ) OR EXISTS (
        SELECT 1
        FROM _party_merge_duplicates duplicate
        JOIN public.party_company_contribution_summaries contribution ON contribution.party_id = duplicate.id
    ) THEN
        RAISE EXCEPTION 'A duplicate party has finance references; review before merging';
    END IF;
END;
$$;

DELETE FROM public.parties party
USING _party_merge_duplicates duplicate
WHERE party.id = duplicate.id;

UPDATE public.parties party
SET
    name = target.canonical_name,
    short_name = target.short_name,
    updated_at = NOW()
FROM _party_merge_targets target
WHERE party.id = target.target_id
  AND (party.name, party.short_name) IS DISTINCT FROM (target.canonical_name, target.short_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parties_name ON public.parties(name);

UPDATE public.people
SET party = public.canonical_party_name(party), updated_at = NOW()
WHERE party IS DISTINCT FROM public.canonical_party_name(party);

UPDATE public.candidates
SET party = public.canonical_party_name(party), updated_at = NOW()
WHERE party IS DISTINCT FROM public.canonical_party_name(party);

UPDATE public.source_people
SET normalized_party = public.canonical_party_name(COALESCE(NULLIF(BTRIM(party), ''), normalized_party)),
    updated_at = NOW()
WHERE normalized_party IS DISTINCT FROM public.canonical_party_name(COALESCE(NULLIF(BTRIM(party), ''), normalized_party));

UPDATE public.person_party_affiliations
SET normalized_party = public.canonical_party_name(party_name), updated_at = NOW()
WHERE normalized_party IS DISTINCT FROM public.canonical_party_name(party_name);

UPDATE public.person_party_events
SET normalized_party = public.canonical_party_name(party_name), updated_at = NOW()
WHERE normalized_party IS DISTINCT FROM public.canonical_party_name(party_name);

CREATE OR REPLACE FUNCTION public.normalize_party_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.party := public.canonical_party_name(NEW.party);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_party_registry_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.name := public.canonical_party_name(NEW.name);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_source_party_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.normalized_party := public.canonical_party_name(
        COALESCE(NULLIF(BTRIM(NEW.party), ''), NEW.normalized_party)
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_party_affiliation_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.normalized_party := public.canonical_party_name(NEW.party_name);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_parties_name ON public.parties;
CREATE TRIGGER normalize_parties_name
BEFORE INSERT OR UPDATE OF name ON public.parties
FOR EACH ROW EXECUTE FUNCTION public.normalize_party_registry_name();

DROP TRIGGER IF EXISTS normalize_people_party ON public.people;
CREATE TRIGGER normalize_people_party
BEFORE INSERT OR UPDATE OF party ON public.people
FOR EACH ROW EXECUTE FUNCTION public.normalize_party_column();

DROP TRIGGER IF EXISTS normalize_candidates_party ON public.candidates;
CREATE TRIGGER normalize_candidates_party
BEFORE INSERT OR UPDATE OF party ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.normalize_party_column();

DROP TRIGGER IF EXISTS normalize_source_people_party ON public.source_people;
CREATE TRIGGER normalize_source_people_party
BEFORE INSERT OR UPDATE OF party, normalized_party ON public.source_people
FOR EACH ROW EXECUTE FUNCTION public.normalize_source_party_column();

DROP TRIGGER IF EXISTS normalize_person_party_affiliations_party ON public.person_party_affiliations;
CREATE TRIGGER normalize_person_party_affiliations_party
BEFORE INSERT OR UPDATE OF party_name, normalized_party ON public.person_party_affiliations
FOR EACH ROW EXECUTE FUNCTION public.normalize_party_affiliation_column();

DROP TRIGGER IF EXISTS normalize_person_party_events_party ON public.person_party_events;
CREATE TRIGGER normalize_person_party_events_party
BEFORE INSERT OR UPDATE OF party_name, normalized_party ON public.person_party_events
FOR EACH ROW EXECUTE FUNCTION public.normalize_party_affiliation_column();

CREATE OR REPLACE VIEW public.public_person_party_affiliations AS
SELECT
    affiliation.id AS affiliation_id,
    affiliation.affiliation_key,
    affiliation.person_id,
    person.name AS person_name,
    affiliation.source_claim_key,
    public.canonical_party_name(affiliation.party_name) AS party_name,
    affiliation.role_context,
    affiliation.role_title,
    affiliation.organization_unit,
    affiliation.display_order,
    affiliation.observed_year,
    affiliation.observed_date,
    affiliation.start_date,
    affiliation.end_date,
    affiliation.is_current,
    affiliation.confidence_level,
    affiliation.source_name,
    affiliation.source_url,
    affiliation.updated_at,
    affiliation.role_tier
FROM public.person_party_affiliations affiliation
JOIN public.people person ON person.id = affiliation.person_id AND person.is_public = TRUE
WHERE affiliation.is_public = TRUE
  AND affiliation.review_status = 'verified';

CREATE OR REPLACE VIEW public.public_person_party_events AS
SELECT
    event.id AS event_id,
    event.event_key,
    event.person_id,
    person.name AS person_name,
    public.canonical_party_name(event.party_name) AS party_name,
    event.event_type,
    event.event_date,
    event.end_date,
    event.summary,
    event.confidence_level,
    event.source_name,
    event.source_url,
    event.updated_at
FROM public.person_party_events event
JOIN public.people person ON person.id = event.person_id AND person.is_public = TRUE
WHERE event.is_public = TRUE
  AND event.review_status = 'verified';

CREATE OR REPLACE VIEW public.public_party_officers AS
SELECT
    affiliation.id AS affiliation_id,
    affiliation.person_id,
    person.name AS person_name,
    party.id AS party_id,
    party.name AS party_name,
    affiliation.role_title,
    affiliation.organization_unit,
    affiliation.display_order,
    affiliation.start_date,
    affiliation.observed_date,
    profile.current_office_label,
    profile.primary_photo_thumbnail_url,
    affiliation.source_name,
    affiliation.source_url,
    affiliation.updated_at,
    affiliation.role_tier
FROM public.person_party_affiliations affiliation
JOIN public.people person ON person.id = affiliation.person_id AND person.is_public = TRUE
JOIN public.parties party
  ON party.is_public = TRUE
 AND public.canonical_party_key(party.name) = public.canonical_party_key(affiliation.normalized_party)
LEFT JOIN public.public_people_list_cached profile ON profile.person_id = affiliation.person_id
WHERE affiliation.role_context = 'party_officer'
  AND affiliation.is_current = TRUE
  AND affiliation.is_public = TRUE
  AND affiliation.review_status = 'verified';

CREATE OR REPLACE VIEW published.parties WITH (security_barrier = true) AS
SELECT
    source.*,
    public.canonical_party_key(source.name) AS normalized_name
FROM public.public_parties source;

CREATE OR REPLACE VIEW published.person_party_affiliations WITH (security_barrier = true) AS
SELECT
    source.*,
    public.canonical_party_key(source.party_name) AS normalized_party
FROM public.public_person_party_affiliations source;

CREATE OR REPLACE VIEW published.person_party_events WITH (security_barrier = true) AS
SELECT * FROM public.public_person_party_events;

SELECT public.refresh_public_people_list_cached();
SELECT published.promote(NULL);

DO $$
DECLARE
    before_counts RECORD;
    removed_party_count BIGINT;
BEGIN
    SELECT * INTO before_counts FROM _party_normalization_before;
    SELECT COUNT(*) INTO removed_party_count FROM _party_merge_duplicates;

    IF (SELECT COUNT(*) FROM public.parties) <> before_counts.party_count - removed_party_count THEN
        RAISE EXCEPTION 'Party row count changed unexpectedly during normalization';
    END IF;

    IF (SELECT COUNT(*) FROM public.people) <> before_counts.people_count THEN
        RAISE EXCEPTION 'People row count changed during party normalization';
    END IF;

    IF (SELECT COUNT(*) FROM public.candidates) <> before_counts.candidate_count THEN
        RAISE EXCEPTION 'Candidate row count changed during party normalization';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.people
        WHERE party IN ('基進黨', '綠黨', '台灣團結聯盟', '臺灣團結聯盟', '台灣革命黨', '臺灣革命黨')
    ) OR EXISTS (
        SELECT 1 FROM public.candidates
        WHERE party IN ('基進黨', '綠黨', '台灣團結聯盟', '臺灣團結聯盟', '台灣革命黨', '臺灣革命黨')
    ) THEN
        RAISE EXCEPTION 'Non-canonical party aliases remain in public person or candidate data';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.parties
        GROUP BY public.canonical_party_name(name)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Multiple party registry rows still resolve to the same canonical name';
    END IF;
END;
$$;

COMMIT;
