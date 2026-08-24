import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDownloadUrl,
  parseCandidateFinanceCsv,
  rocDateToIso,
  sourceScopes,
} from './fetch-cy-candidate-finance.mjs';

const moneyHeaders = [
  '個人捐贈收入',
  '營利事業捐贈收入',
  '政黨捐贈收入',
  '人民團體捐贈收入',
  '匿名捐贈收入',
  '其他收入',
  '收入小計',
  '累計超過三萬元之收入總額',
  '金錢收入總額',
  '非金錢收入總額',
  '人事費用支出',
  '宣傳支出',
  '租用宣傳車輛支出',
  '租用競選辦事處支出',
  '集會支出',
  '交通旅運支出',
  '雜支支出',
  '返還捐贈支出',
  '繳庫支出',
  '公共關係費用支出',
  '支出小計',
  '累計超過三萬元之支出總額',
  '金錢支出總額',
  '非金錢支出總額',
  '結算日金融機構帳戶存款餘額',
  '餘額',
  '收支結存內金錢餘額',
  '金錢以外之財產',
];

test('builds only the reviewed Control Yuan download scope', () => {
  const url = new URL(buildDownloadUrl(sourceScopes.find((scope) => scope.area === '臺北市')));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'ardata.cy.gov.tw');
  assert.equal(url.searchParams.get('ElectionArea'), '臺北市');
  assert.equal(url.searchParams.get('ElectionName'), '111年直轄市市長選舉');
  assert.equal(url.searchParams.get('DownloadType'), '3');
});

test('parses only candidate aggregate totals and drops identifying transaction fields', () => {
  const headers = [
    '序號',
    '擬參選人',
    '選舉名稱',
    '申報序號',
    ...moneyHeaders,
    '捐贈者／支出對象',
    '身分證／統一編號',
    '地址',
    '聯絡電話',
    '會計師姓名',
    '結算日期',
    '申報日期',
    '更正日期',
  ];
  const values = [
    '1',
    '蔣萬安',
    '111年臺北市市長選舉',
    '首次申報',
    ...moneyHeaders.map((_, index) => String(index === 20 ? 96761100 : index === 25 ? -124731 : index + 1)),
    '不應輸出的人名',
    'A123456789',
    '不應輸出的地址',
    '0900000000',
    '不應輸出的會計師',
    '1111230',
    '1120224',
    '1120310',
  ];
  const [record] = parseCandidateFinanceCsv(
    headers.join(',') + '\n' + values.join(',') + '\n',
    { area: '臺北市', electionSearchName: '111年直轄市市長選舉' },
  );

  assert.equal(record.candidateName, '蔣萬安');
  assert.equal(record.electionName, '111年臺北市市長選舉');
  assert.equal(record.amounts.expenditureTotal, 96761100);
  assert.equal(record.amounts.balance, -124731);
  assert.equal(record.settlementDate, '2022-12-30');
  assert.equal(record.filingDate, '2023-02-24');
  assert.equal(record.correctionDate, '2023-03-10');
  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /不應輸出|A123456789|0900000000/u);
});

test('rejects malformed money and ROC dates', () => {
  assert.throws(() => rocDateToIso('2022-12-30'), /Invalid ROC date/u);
  assert.throws(() => rocDateToIso('1110231'), /Invalid ROC date/u);
  const headers = ['擬參選人', '選舉名稱', '申報序號', ...moneyHeaders, '結算日期', '申報日期', '更正日期'];
  const values = ['測試人', '111年臺北市市長選舉', '首次申報', ...moneyHeaders.map(() => '0'), '', '', ''];
  values[3] = 'not-money';
  assert.throws(
    () => parseCandidateFinanceCsv(headers.join(',') + '\n' + values.join(',') + '\n', {
      area: '臺北市',
      electionSearchName: '111年直轄市市長選舉',
    }),
    /Invalid money value/u,
  );
});
