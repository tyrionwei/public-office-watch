import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGcisUrl,
  buildMigrationSql,
  parseBusinessRegistryProfile,
  parseCompanyRegistryProfile,
  toMigrationRow,
} from './build-company-registry-enrichment.mjs';

test('company registry parser keeps directors in source order and removes duplicates', () => {
  const profile = parseCompanyRegistryProfile(
    [{ Responsible_Name: '陳俊聖' }],
    [
      { Person_Position_Name: '董事長', Person_Name: '陳俊聖' },
      { Person_Position_Name: '董事', Person_Name: '施振榮' },
      { Person_Position_Name: '董事', Person_Name: '施振榮' },
      { Person_Position_Name: '監察人', Person_Name: '不應顯示' },
    ],
  );

  assert.deepEqual(profile, {
    registrationType: 'company',
    representativeName: '陳俊聖',
    directorNames: ['陳俊聖', '施振榮'],
  });
});

test('business registry parser exposes the responsible person without directors', () => {
  assert.deepEqual(parseBusinessRegistryProfile([{ Responsible_Name: '陳世昌' }]), {
    registrationType: 'business',
    representativeName: '陳世昌',
    directorNames: [],
  });
});

test('database company rows keep their unified business number in generated migration rows', () => {
  assert.deepEqual(
    toMigrationRow(
      { unified_business_no: '20828393', name: '測試公司' },
      {
        registrationType: 'company',
        representativeName: '測試人',
        directorNames: ['董事甲'],
      },
    ),
    {
      unifiedBusinessNo: '20828393',
      companyName: '測試公司',
      registrationType: 'company',
      representativeName: '測試人',
      directorNames: ['董事甲'],
    },
  );
});

test('GCIS URL and generated SQL preserve the official lookup contract', () => {
  const url = buildGcisUrl('dataset-id', 'Business_Accounting_NO eq 20828393');
  assert.equal(url.searchParams.get('$format'), 'json');
  assert.equal(url.searchParams.get('$filter'), 'Business_Accounting_NO eq 20828393');

  const sql = buildMigrationSql([
    {
      unifiedBusinessNo: '20828393',
      representativeName: "測試'人",
      directorNames: ['董事甲', '董事乙'],
    },
  ], '2026-07-29T00:00:00.000Z');

  assert.match(sql, /測試''人/);
  assert.match(sql, /ARRAY\['董事甲', '董事乙'\]::TEXT\[\]/);
  assert.match(sql, /WHERE company\.unified_business_no = registry\.unified_business_no/);
});
