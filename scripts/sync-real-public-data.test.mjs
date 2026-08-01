import assert from 'node:assert/strict';
import {
  classifyHistoricalCecCandidateEntry,
  darkGuideFamilyReferenceNames,
  historicalCecAggregateResultKey,
  isHistoricalCecAggregateResultRow,
  isHistoricalCecNationalResult,
} from './sync-real-public-data.mjs';

const root = 'votedata/votedata/voteData';

assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/1998直轄市議員/區域/elcand.csv`),
  { year: 1998, kind: 'local-councilor-regional', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/1998直轄市議員/原住民/elcand.csv`),
  { year: 1998, kind: 'local-councilor-indigenous', districtLabel: '原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2002縣市議員/山原/elcand.csv`),
  { year: 2002, kind: 'local-councilor-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/20091205-縣市長縣市議員及鄉鎮長/平地議員/elcand.csv`),
  { year: 2009, kind: 'local-councilor-plain-indigenous', districtLabel: '平地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/20101127-五都市長議員及里長/區域議員/elcand.csv`),
  { year: 2010, kind: 'local-councilor-regional', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2014-103年地方公職人員選舉/直轄市山原議員/elcand.csv`),
  { year: 2014, kind: 'local-councilor-mountain-indigenous', districtLabel: '山地原住民', roleLabel: '議員' },
);
assert.deepEqual(
  classifyHistoricalCecCandidateEntry(`${root}/2018-107年地方公職人員選舉/縣市平原議員/elcand.csv`),
  { year: 2018, kind: 'local-councilor-plain-indigenous', districtLabel: '平地原住民', roleLabel: '議員' },
);
assert.equal(
  classifyHistoricalCecCandidateEntry(`${root}/1994台灣省議員/區域/elcand.csv`),
  null,
);

const regionalCouncilor = { kind: 'local-councilor-regional' };
const indigenousCouncilor = { kind: 'local-councilor-indigenous' };
const indigenousLegislator = { kind: 'legislator-plain-indigenous' };
const candidateRow = ['01', '001', '00', '000', '0000', '1'];
const regionalCandidateRow = ['01', '001', '01', '000', '0000', '1'];
const regionalResultRow = ['01', '001', '01', '000', '0000', '0000', '1'];
const indigenousResultRow = ['01', '001', '01', '000', '0000', '0', '1'];

assert.equal(isHistoricalCecAggregateResultRow(regionalResultRow), true);
assert.equal(isHistoricalCecAggregateResultRow(indigenousResultRow), true);
assert.equal(isHistoricalCecNationalResult(indigenousCouncilor), false);
assert.equal(isHistoricalCecNationalResult(indigenousLegislator), true);
assert.equal(
  historicalCecAggregateResultKey(candidateRow, indigenousCouncilor, candidateRow[5]),
  '01-001-1',
);
assert.equal(
  historicalCecAggregateResultKey(indigenousResultRow, indigenousCouncilor),
  '01-001-1',
);
assert.equal(
  historicalCecAggregateResultKey(regionalCandidateRow, regionalCouncilor, regionalCandidateRow[5]),
  historicalCecAggregateResultKey(regionalResultRow, regionalCouncilor),
);
assert.equal(
  historicalCecAggregateResultKey(regionalResultRow, regionalCouncilor),
  '01-001-01-1',
);
assert.equal(historicalCecAggregateResultKey(indigenousResultRow, indigenousLegislator), '1');

assert.deepEqual(
  darkGuideFamilyReferenceNames({
    found: [{ mentionedName: '王小明' }],
    ambiguousSameName: [{ mentionedName: '陳大華' }],
    notFound: [{ mentionedName: '王小明' }, { mentionedName: ' 林小美 ' }],
  }),
  ['王小明', '林小美', '陳大華'],
);

console.log('sync-real-public-data tests passed');
