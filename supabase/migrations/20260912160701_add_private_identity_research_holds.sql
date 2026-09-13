-- Private, reversible research deferral. Does not remove people or change publication.
CREATE TABLE public.person_identity_research_holds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.people(id),
 reason text NOT NULL CHECK (length(trim(reason)) > 0),
 resume_condition text NOT NULL CHECK (length(trim(resume_condition)) > 0),
 evidence_json jsonb NOT NULL CHECK (jsonb_typeof(evidence_json) = 'object'),
 batch_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz,
 release_reason text,
 CONSTRAINT identity_hold_release_requires_reason CHECK ((released_at IS NULL AND release_reason IS NULL) OR
        (released_at IS NOT NULL AND release_reason IS NOT NULL AND length(trim(release_reason)) > 0))
);
CREATE UNIQUE INDEX person_identity_research_holds_active ON public.person_identity_research_holds(person_id) WHERE released_at IS NULL;
ALTER TABLE public.person_identity_research_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_identity_research_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.person_identity_research_holds TO service_role;
CREATE VIEW public.active_identity_research_holds WITH (security_invoker=true) AS
SELECT h.*, m.canonical_person_id FROM public.person_identity_research_holds h
JOIN public.person_canonical_map m ON m.person_id=h.person_id WHERE h.released_at IS NULL;
REVOKE ALL ON public.active_identity_research_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.active_identity_research_holds TO service_role;
NOTIFY pgrst, 'reload schema';
