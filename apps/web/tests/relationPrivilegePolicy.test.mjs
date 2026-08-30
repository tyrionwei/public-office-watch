import assert from 'node:assert/strict';
import test from 'node:test';

import { findDangerousBrowserRelationGrants } from '../scripts/relation-privilege-policy.mjs';

test('finds dangerous relation privileges granted to browser roles', () => {
  const findings = findDangerousBrowserRelationGrants(`
    GRANT TRUNCATE, REFERENCES ON TABLE public.people TO anon;
    GRANT TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA published TO authenticated;
    GRANT ALL PRIVILEGES ON public.parties TO PUBLIC;
  `);

  assert.equal(findings.length, 3);
  assert.deepEqual(findings[0].privileges, ['TRUNCATE', 'REFERENCES']);
  assert.deepEqual(findings[0].roles, ['anon']);
  assert.deepEqual(findings[1].privileges, ['TRIGGER', 'MAINTAIN']);
  assert.deepEqual(findings[1].roles, ['authenticated']);
  assert.deepEqual(findings[2].privileges, ['ALL PRIVILEGES']);
  assert.deepEqual(findings[2].roles, ['PUBLIC']);
});

test('ignores safe relation grants and non-relation objects', () => {
  const findings = findDangerousBrowserRelationGrants(`
    GRANT SELECT ON TABLE published.people TO anon, authenticated;
    GRANT MAINTAIN ON TABLE internal.snapshot TO service_role;
    GRANT ALL ON FUNCTION published.search_public_records(text) TO authenticated;
    GRANT ALL ON SEQUENCE public.example_id_seq TO authenticated;
  `);

  assert.deepEqual(findings, []);
});

test('ignores grants inside SQL comments', () => {
  const findings = findDangerousBrowserRelationGrants(`
    -- GRANT ALL ON TABLE public.people TO anon;
    /*
      GRANT MAINTAIN ON TABLE published.people TO authenticated;
    */
    GRANT SELECT ON TABLE published.people TO anon;
  `);

  assert.deepEqual(findings, []);
});
