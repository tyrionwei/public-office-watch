const dangerousRelationPrivileges = new Set([
  'ALL',
  'ALL PRIVILEGES',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
  'MAINTAIN',
]);

const nonRelationObject = /^(?:FUNCTION|PROCEDURE|ROUTINE|SEQUENCE|SCHEMA|DATABASE|TYPE|DOMAIN|FOREIGN DATA WRAPPER|FOREIGN SERVER|LARGE OBJECT|ALL FUNCTIONS|ALL SEQUENCES)\b/iu;

export function findDangerousBrowserRelationGrants(sql) {
  const statements = sql
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/--.*$/gmu, '')
    .match(/\bGRANT\b[\s\S]*?;/giu) ?? [];
  const findings = [];

  for (const statement of statements) {
    const normalized = statement.replace(/\s+/gu, ' ').trim();
    const match = normalized.match(/^GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+(.+?);$/iu);
    if (!match) continue;

    const [, privilegeList, objectClause, roleList] = match;
    const privileges = privilegeList
      .split(',')
      .map((privilege) => privilege.trim().toUpperCase());
    const browserRoles = roleList.match(/\b(?:PUBLIC|anon|authenticated)\b/giu) ?? [];

    if (
      browserRoles.length === 0
      || !privileges.some((privilege) => dangerousRelationPrivileges.has(privilege))
      || nonRelationObject.test(objectClause.trim())
    ) continue;

    findings.push({
      statement: normalized,
      privileges,
      roles: browserRoles,
    });
  }

  return findings;
}
