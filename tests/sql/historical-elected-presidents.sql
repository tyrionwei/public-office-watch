\set ON_ERROR_STOP on
-- Synthetic isolated database only; not for an existing POW database.
CREATE TABLE public.fixture_people(person_id uuid PRIMARY KEY, list_position text NOT NULL, has_candidate_history boolean);
CREATE TABLE public.public_races(race_id text PRIMARY KEY, race_type text NOT NULL);
CREATE TABLE public.public_candidates(candidate_id uuid PRIMARY KEY, person_id uuid, person_position text, person_name text DEFAULT '蔡英文',
 race_id text, election_result text, is_elected boolean, election_year int);
INSERT INTO public.fixture_people VALUES
 ('5d623ab5-a2a2-4c40-a094-6b3712d648e5','',true),('00000000-0000-4000-8000-000000000001','',true),('00000000-0000-4000-8000-000000000002','',true),('00000000-0000-4000-8000-000000000003','立法委員',true),
 ('00000000-0000-4000-8000-000000000004','',false),('00000000-0000-4000-8000-000000000005','',true),('00000000-0000-4000-8000-000000000006','',true),('00000000-0000-4000-8000-000000000007','',true);
INSERT INTO public.public_races VALUES ('ticket','president'),('00000000-0000-4000-8000-000000000006','municipality_mayor');
INSERT INTO public.public_candidates(candidate_id,person_id,person_position,race_id,election_result,is_elected,election_year) VALUES
 ('ed53467b-6bb9-4bdf-b338-092f4b96b9ff','5d623ab5-a2a2-4c40-a094-6b3712d648e5','第13任總統候選人','ticket','elected',true,2016),
 ('1c9caa82-01a1-49be-9a9a-22f3764c6979','5d623ab5-a2a2-4c40-a094-6b3712d648e5','第13任總統候選人','ticket','elected',true,2020),
 ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000001','總統候選人','ticket','not_elected',false,2020),
 ('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000002','副總統候選人','ticket','elected',true,2020),
 ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000003','總統候選人','ticket','elected',true,2016),
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000005','總統副總統候選人','ticket','elected',true,2020),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000006','總統候選人','00000000-0000-4000-8000-000000000006','elected',true,2016),
 ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000007','總統候選人','ticket','pending',true,2020);
CREATE VIEW public.public_people_list AS
WITH classified AS (SELECT * FROM public.fixture_people), role_classified AS (
 SELECT classified.*, CASE WHEN classified.list_position LIKE '%立法委員%' THEN 'legislator'::text ELSE 'other'::text END AS list_role
 FROM classified
) SELECT person_id,list_role,CASE WHEN list_position<>'' THEN 'current' WHEN has_candidate_history THEN 'former' ELSE 'other' END AS list_status FROM role_classified;
CREATE MATERIALIZED VIEW public.public_people_list_cached AS SELECT * FROM public.public_people_list;
CREATE SCHEMA published;
CREATE MATERIALIZED VIEW published.people_directory AS SELECT * FROM public.public_people_list_cached;
CREATE FUNCTION public.refresh_public_people_list_cached() RETURNS void LANGUAGE plpgsql AS $$ BEGIN REFRESH MATERIALIZED VIEW public.public_people_list_cached; END $$;
\ir ../../supabase/migrations/20261001071919_classify_historical_elected_presidents.sql
DO $$ BEGIN
 IF (SELECT count(*) FROM published.people_directory WHERE list_role='president')<>1 THEN RAISE EXCEPTION 'president count'; END IF;
 IF NOT EXISTS(SELECT FROM published.people_directory WHERE person_id='5d623ab5-a2a2-4c40-a094-6b3712d648e5' AND list_role='president' AND list_status='former') THEN RAISE EXCEPTION 'former president omitted'; END IF;
 IF NOT EXISTS(SELECT FROM published.people_directory WHERE person_id='00000000-0000-4000-8000-000000000002' AND list_role='other' AND list_status='former') THEN RAISE EXCEPTION 'joint ticket vice misclassified'; END IF;
 IF NOT EXISTS(SELECT FROM published.people_directory WHERE person_id='00000000-0000-4000-8000-000000000003' AND list_role='legislator' AND list_status='current') THEN RAISE EXCEPTION 'current role changed'; END IF;
 IF (SELECT count(*) FROM published.people_directory WHERE person_id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007') AND list_role='other')<>5 THEN RAISE EXCEPTION 'unproven role promoted'; END IF;
END $$;
CREATE TEMP TABLE first_result AS SELECT * FROM published.people_directory;
\ir ../../supabase/migrations/20261001071919_classify_historical_elected_presidents.sql
DO $$ BEGIN
 IF EXISTS((SELECT * FROM first_result EXCEPT SELECT * FROM published.people_directory) UNION ALL (SELECT * FROM published.people_directory EXCEPT SELECT * FROM first_result)) THEN RAISE EXCEPTION 'repeat changed result'; END IF;
END $$;
SELECT 'PASS: elected history, former status, joint ticket, current precedence, rejection cases, cache and repeat';
