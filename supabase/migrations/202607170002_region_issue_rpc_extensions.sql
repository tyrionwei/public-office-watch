ALTER FUNCTION get_region_issue_response(UUID, TEXT)
    SET search_path = public, extensions;

ALTER FUNCTION submit_region_issue_response(UUID, TEXT, UUID[])
    SET search_path = public, extensions;
