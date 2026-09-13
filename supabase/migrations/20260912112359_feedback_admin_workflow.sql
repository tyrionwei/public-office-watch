-- Feedback decisions and work progress are private; public participation remains proxy guarded.
ALTER TABLE public.person_feedback_submissions
  ADD COLUMN decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','accepted','rejected')),
  ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high')),
  ADD COLUMN work_status text NOT NULL DEFAULT 'pending' CHECK (work_status IN ('pending','in_progress','completed')),
  ADD COLUMN management_summary text NOT NULL DEFAULT '' CHECK (length(management_summary) <= 500),
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  ADD COLUMN content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  ADD COLUMN previous_decision text,
  ADD COLUMN waiting_since timestamptz NOT NULL DEFAULT now();

-- Legacy "published" did not prove the underlying data was fixed. Migrate conservatively.
UPDATE public.person_feedback_submissions SET
  decision = CASE WHEN review_status = 'rejected' THEN 'rejected' WHEN review_status IN ('verified','published') THEN 'accepted' ELSE 'pending' END,
  waiting_since = created_at;
ALTER TABLE public.person_feedback_submissions ADD CONSTRAINT feedback_management_state
  CHECK (decision = 'accepted' OR (priority = 'normal' AND work_status = 'pending'));
CREATE INDEX idx_feedback_management_queue ON public.person_feedback_submissions
  (decision, priority, (work_status = 'completed'), waiting_since, id);

CREATE TABLE public.person_feedback_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feedback_id uuid NOT NULL REFERENCES public.person_feedback_submissions(id),
  event text NOT NULL CHECK (event IN ('baseline','submitted','resubmitted','duplicate','managed')),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  before_state jsonb,
  after_state jsonb NOT NULL,
  request_id uuid UNIQUE,
  request_payload jsonb
);
CREATE INDEX idx_feedback_history_record ON public.person_feedback_history(feedback_id, id DESC);
ALTER TABLE public.person_feedback_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_feedback_history FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.person_feedback_history_id_seq FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.feedback_admin_snapshot(s public.person_feedback_submissions)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id',s.id,'person_id',s.person_id,'feedback_kind',s.feedback_kind,'section_key',s.section_key,
    'problem_type',s.problem_type,'message',s.message,'evidence_url',s.evidence_url,
    'decision',s.decision,'priority',s.priority,'work_status',s.work_status,
    'management_summary',s.management_summary,'review_note',s.review_note,
    'reviewed_by',s.reviewed_by,'reviewed_at',s.reviewed_at,'revision',s.revision,
    'content_version',s.content_version,'previous_decision',s.previous_decision,
    'submission_count',s.submission_count,'created_at',s.created_at,'updated_at',s.updated_at,
    'waiting_since',s.waiting_since
  );
$$;
REVOKE ALL ON FUNCTION public.feedback_admin_snapshot(public.person_feedback_submissions) FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO public.person_feedback_history(feedback_id,event,after_state)
  SELECT id,'baseline',public.feedback_admin_snapshot(s) FROM public.person_feedback_submissions s;

CREATE FUNCTION public.feedback_submission_versions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE kind text; changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    kind := 'submitted';
  ELSIF NEW.submission_count > OLD.submission_count THEN
    changed := ROW(NEW.problem_type,NEW.message,NEW.evidence_url) IS DISTINCT FROM ROW(OLD.problem_type,OLD.message,OLD.evidence_url);
    NEW.revision := OLD.revision + 1;
    IF changed THEN
      kind := 'resubmitted';
      NEW.content_version := OLD.content_version + 1;
      NEW.previous_decision := CASE WHEN OLD.decision <> 'pending' THEN OLD.decision ELSE OLD.previous_decision END;
      NEW.decision := 'pending'; NEW.priority := 'normal'; NEW.work_status := 'pending';
      NEW.waiting_since := now(); NEW.review_status := 'received';
    ELSE
      kind := 'duplicate';
      NEW.review_status := OLD.review_status;
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  -- AFTER INSERT is needed for the FK; resubmission changes are made BEFORE UPDATE.
  INSERT INTO public.person_feedback_history(feedback_id,event,before_state,after_state)
    VALUES(NEW.id,kind,CASE WHEN TG_OP = 'UPDATE' THEN public.feedback_admin_snapshot(OLD) END,public.feedback_admin_snapshot(NEW));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_submission_versions() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER feedback_insert_history AFTER INSERT ON public.person_feedback_submissions
FOR EACH ROW EXECUTE FUNCTION public.feedback_submission_versions();
CREATE TRIGGER feedback_resubmit_history BEFORE UPDATE ON public.person_feedback_submissions
FOR EACH ROW EXECUTE FUNCTION public.feedback_submission_versions();

CREATE FUNCTION public.feedback_history_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN RAISE EXCEPTION 'Feedback history is immutable'; END; $$;
REVOKE ALL ON FUNCTION public.feedback_history_immutable() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER feedback_history_immutable BEFORE UPDATE OR DELETE ON public.person_feedback_history
FOR EACH ROW EXECUTE FUNCTION public.feedback_history_immutable();

CREATE FUNCTION public.admin_feedback(p_admin_user_id uuid, p_action text, p_input jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.person_feedback_submissions%ROWTYPE; before_row jsonb; result jsonb;
  old_request public.person_feedback_history%ROWTYPE;
  fid uuid; rid uuid; expected integer; d text; pr text; ws text; note text; summary text;
  page integer; per_page integer := 10; query text; kind text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_admin_user_id
    AND COALESCE(is_anonymous,false) = false AND raw_app_meta_data->'chat_admin' = 'true'::jsonb) THEN
    RAISE EXCEPTION 'FEEDBACK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'dashboard' THEN
    query := COALESCE(p_input->>'query',''); kind := COALESCE(p_input->>'kind','');
    IF length(query)>100 OR kind NOT IN ('','supplement_request','problem_report') THEN RAISE EXCEPTION 'FEEDBACK_INVALID'; END IF;
    WITH filtered AS MATERIALIZED (
      SELECT submission.*,p.name AS person_name,
        CASE WHEN submission.decision='accepted' THEN CASE WHEN submission.priority='high' THEN 'priority' ELSE 'normal' END ELSE submission.decision END AS bucket
      FROM public.person_feedback_submissions submission JOIN public.people p ON p.id=submission.person_id
      WHERE (kind='' OR submission.feedback_kind=kind)
        AND (query='' OR strpos(lower(concat_ws(' ',p.name,submission.message,submission.review_note,submission.management_summary)),lower(query))>0)
    ), groups AS (
      SELECT b.bucket,
        (SELECT count(*) FROM filtered f WHERE f.bucket=b.bucket) AS total,
        (SELECT count(*) FROM filtered f WHERE f.bucket=b.bucket AND f.work_status='completed') AS completed,
        (SELECT min(waiting_since) FROM filtered f WHERE f.bucket=b.bucket AND f.decision<>'rejected' AND f.work_status<>'completed') AS oldest_waiting_at,
        greatest(1,least(COALESCE((p_input->'pages'->>b.bucket)::integer,1),greatest(1,ceil((SELECT count(*) FROM filtered f WHERE f.bucket=b.bucket)/10.0)::integer))) AS page
      FROM (VALUES ('pending'),('priority'),('normal'),('rejected')) b(bucket)
    )
    SELECT jsonb_build_object('fetched_at',now(),'groups',jsonb_object_agg(g.bucket,jsonb_build_object(
      'total',g.total,'completed',g.completed,'unfinished',CASE WHEN g.bucket='rejected' THEN 0 ELSE g.total-g.completed END,
      'oldest_waiting_at',g.oldest_waiting_at,'page',g.page,'page_size',per_page,
      'items',(
        SELECT COALESCE(jsonb_agg(item ORDER BY done,waiting_since,id),'[]'::jsonb) FROM (
          SELECT public.feedback_admin_snapshot(submission) || jsonb_build_object('person_name',f.person_name) AS item,
            f.work_status='completed' AS done,f.waiting_since,f.id
          FROM filtered f JOIN public.person_feedback_submissions submission ON submission.id=f.id WHERE f.bucket=g.bucket
          ORDER BY f.work_status='completed',f.waiting_since,f.id LIMIT per_page OFFSET (g.page-1)*per_page
        ) page_items
      )))) INTO result FROM groups g;
    RETURN result;
  END IF;
  IF p_action NOT IN ('detail','save') OR p_action IS NULL THEN RAISE EXCEPTION 'FEEDBACK_INVALID'; END IF;
  fid := (p_input->>'id')::uuid;
  SELECT * INTO s FROM public.person_feedback_submissions WHERE id=fid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FEEDBACK_NOT_FOUND'; END IF;
  IF p_action='detail' THEN
    page := greatest(1,COALESCE((p_input->>'historyPage')::integer,1));
    RETURN jsonb_build_object('item',public.feedback_admin_snapshot(s) || jsonb_build_object('person_name',(SELECT name FROM public.people WHERE id=s.person_id)),
      'history_total',(SELECT count(*) FROM public.person_feedback_history WHERE feedback_id=fid),
      'history_page',page,'history',(SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id DESC),'[]'::jsonb) FROM (
        SELECT id,event,actor_id,created_at,before_state,after_state FROM public.person_feedback_history
        WHERE feedback_id=fid ORDER BY id DESC LIMIT 20 OFFSET (page-1)*20) h));
  END IF;
  rid := (p_input->>'requestId')::uuid; expected := (p_input->>'expectedRevision')::integer;
  d := p_input->>'decision'; pr := p_input->>'priority'; ws := p_input->>'workStatus';
  note := btrim(p_input->>'note'); summary := btrim(p_input->>'summary');
  IF rid IS NULL OR expected IS NULL OR d IS NULL OR pr IS NULL OR ws IS NULL OR note IS NULL OR summary IS NULL
    OR d NOT IN ('pending','accepted','rejected') OR pr NOT IN ('normal','high') OR ws NOT IN ('pending','in_progress','completed')
    OR length(note)>1000 OR length(summary)>500 OR (d<>'accepted' AND (pr<>'normal' OR ws<>'pending')) THEN RAISE EXCEPTION 'FEEDBACK_INVALID'; END IF;
  -- Request ID is global. Lock to serialize concurrent retries, including across different records.
  PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,0));
  SELECT * INTO old_request FROM public.person_feedback_history WHERE request_id=rid;
  IF FOUND THEN
    IF old_request.actor_id<>p_admin_user_id OR old_request.feedback_id<>fid OR old_request.request_payload<>p_input THEN RAISE EXCEPTION 'FEEDBACK_REQUEST_CONFLICT'; END IF;
    RETURN old_request.after_state || jsonb_build_object('person_name',(SELECT name FROM public.people WHERE id=s.person_id));
  END IF;
  IF expected<>s.revision THEN RAISE EXCEPTION 'FEEDBACK_CONFLICT'; END IF;
  IF (d='rejected' OR (s.decision<>'pending' AND d<>s.decision)
      OR ws='completed' OR (s.work_status='completed' AND ws<>'completed')) AND length(note)<2 THEN
    RAISE EXCEPTION 'FEEDBACK_REASON_REQUIRED';
  END IF;
  before_row := public.feedback_admin_snapshot(s);
  UPDATE public.person_feedback_submissions SET decision=d,priority=pr,work_status=ws,management_summary=summary,
    review_note=note,reviewed_by=p_admin_user_id::text,reviewed_at=now(),revision=revision+1,
    waiting_since=CASE WHEN (s.decision='rejected' OR s.work_status='completed') AND d<>'rejected' AND ws<>'completed' THEN now() ELSE waiting_since END,
    review_status=CASE WHEN d='rejected' THEN 'rejected' WHEN d='pending' THEN 'received' ELSE 'verified' END
  WHERE id=fid RETURNING * INTO s;
  INSERT INTO public.person_feedback_history(feedback_id,event,actor_id,before_state,after_state,request_id,request_payload)
    VALUES(fid,'managed',p_admin_user_id,before_row,public.feedback_admin_snapshot(s),rid,p_input);
  RETURN public.feedback_admin_snapshot(s) || jsonb_build_object('person_name',(SELECT name FROM public.people WHERE id=s.person_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_feedback(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_feedback(uuid,text,jsonb) TO service_role;
