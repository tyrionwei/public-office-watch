BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE
    public.national_office_assignments,
    public.parties,
    public.party_company_contribution_summaries,
    public.party_finance_summaries
FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    unsafe_relation RECORD;
BEGIN
    SELECT
        namespace.nspname AS schema_name,
        relation.relname AS relation_name,
        browser_role.role_name,
        dangerous_privilege.privilege_name
    INTO unsafe_relation
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    CROSS JOIN (
        VALUES ('anon'), ('authenticated')
    ) AS browser_role(role_name)
    CROSS JOIN (
        VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) AS dangerous_privilege(privilege_name)
    WHERE namespace.nspname IN ('public', 'published')
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND pg_catalog.has_table_privilege(
          browser_role.role_name,
          relation.oid,
          dangerous_privilege.privilege_name
      )
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Browser role % retains % on %.%',
            unsafe_relation.role_name,
            unsafe_relation.privilege_name,
            unsafe_relation.schema_name,
            unsafe_relation.relation_name;
    END IF;
END;
$$;

COMMIT;
