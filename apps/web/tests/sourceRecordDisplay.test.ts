import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceDisplay,filterSourceDisplay,sourceHttpUrl} from '../src/lib/sourceRecordDisplay.ts';
const row={id:'a'.repeat(64),claim:{claimValue:'原文',claimType:'education',personId:null,reviewStatus:'verified'},references:[{file:'a.json',pointer:'/claims/1',fileSha256:'b'.repeat(64),originalClaimSha256:'a'.repeat(64),originalReview:'verified',period:{status:'unknown'}}],applyAllowed:false,importAllowed:false,publicationApproved:false,displayScope:'private_source_record_not_person_fact'};
test('preserves all original references and unknown identities',()=>{const rows=parseSourceDisplay(JSON.stringify({displayRecords:[row]}));assert.deepEqual(rows,[row]);assert.equal(filterSourceDisplay(rows,'原文',true).length,1);});
test('rejects duplicate IDs, fake IDs and approval-enabled input',()=>{for(const data of [[row,row],[{...row,id:'fake-claim'}],[{...row,applyAllowed:true}]]) assert.throws(()=>parseSourceDisplay(JSON.stringify({displayRecords:data})));});
test('rejects mismatched original content references',()=>assert.throws(()=>parseSourceDisplay(JSON.stringify({displayRecords:[{...row,references:[{...row.references[0],originalClaimSha256:'c'.repeat(64)}]}]}))));
test('unsafe URLs are never linked',()=>{assert.equal(sourceHttpUrl('javascript:alert(1)'),null);assert.equal(sourceHttpUrl('file:///secret'),null);assert.equal(sourceHttpUrl('https://example.gov.tw/'),'https://example.gov.tw/');});
