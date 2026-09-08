#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const dir=resolve('tmp/platform-quality-audit-20260907');
function read(name){return JSON.parse(readFileSync(resolve(dir,name),'utf8'));}
function query(sql){const r=spawnSync('docker',['exec','-i','supabase_db_public-office-watch','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{encoding:'utf8',input:sql,maxBuffer:64*1024*1024});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout.trim();}
const scanAll=read('scan.json'),followup=read('followup-results.json');
const scanById=new Map(scanAll.map(x=>[x.id,x])),followupById=new Map(followup.map(x=>[x.id,x]));
const current=JSON.parse(query(`
SELECT coalesce(jsonb_agg(jsonb_build_object(
'id',claim.id,'personId',claim.person_id,'candidateId',claim.candidate_id,'year',election.year,'race',race.title,'reviewStatus',claim.claim_json#>>'{contentSplit,reviewStatus}',
'classification',claim.claim_json#>>'{platformQualityAudit,classification}','repair',claim.claim_json#>>'{platformQualityAudit,repair}','claimValue',claim.claim_value,
'itemsCount',coalesce(jsonb_array_length(claim.claim_json->'items'),0),'sourceName',claim.source_name,'sourceUrl',claim.source_url
) ORDER BY claim.id),'[]'::jsonb)::text
FROM public.person_claims claim
LEFT JOIN public.candidates candidate ON candidate.id=claim.candidate_id
LEFT JOIN public.races race ON race.id=candidate.race_id
LEFT JOIN public.elections election ON election.id=race.election_id
WHERE claim.claim_type='platform' AND (
 claim.claim_json#>>'{contentSplit,reviewStatus}'='needs_review'
 OR claim.claim_json#>>'{platformQualityAudit,classification}' IN ('verified_repair','verified_short_platform')
);`));
const deferredIds=new Set();
function severity(audit,row){
 if(deferredIds.has(row.id))return 'deferred';
 if(audit?.decision==='排除本次標記')return 'pending_other_issue_specific_suspicion_excluded';
 if(row.repair==='recovered_missing_item_from_stored_source')return 'high_omission_repaired_awaiting_visual';
 if(row.classification==='confirmed_spacing_issue')return 'low_spacing_repaired_awaiting_visual';
 const category=audit?.category??'';
 const reason=(audit?.decisionReason??'')+' '+(audit?.flags??[]).map(x=>x.code).join(' ');
 if(/越界|多欄讀序|放到|別人|他人|錯置/.test(category+' '+reason))return 'critical_wrong_person_or_boundary';
 if(/原文承諾未進入條目|整段|缺漏|截斷/.test(category+' '+reason))return 'high_omission';
 if(/亂碼|編碼|辨識異常|OCR 錯字/.test(category+' '+reason))return 'high_garbled';
 if(row.classification==='requires_source_or_rule_review')return 'high_source_or_rule_review';
 return 'medium_split_or_structure';
}
function base(row){
 const scan=scanById.get(row.id)??{},audit=followupById.get(row.id)??{};
 return {
  id:row.id,name:scan.name??audit.name??null,kind:scan.kind??audit.kind??'person',
  personId:row.personId??scan.personId??null,candidateId:row.candidateId??null,
  election:{year:row.year??scan.year??audit.year??null,race:row.race??scan.race??audit.race??null},
  source:{name:row.sourceName??scan.sourceName??audit.sourceName??null,url:row.sourceUrl??scan.sourceUrl??audit.sourceUrl??null,document:scan.sourceDocument??audit.sourceDocument??null},
  originalAudit:{decision:audit.decision??null,category:audit.category??null,reason:audit.decisionReason??null,flags:(scan.flags??audit.flags??[]).map(x=>x.code)},
  current:{reviewStatus:row.reviewStatus,classification:row.classification,repair:row.repair,itemsCount:row.itemsCount},
  severity:severity(audit,row)
 };
}
const records=current.map(row=>base(row));
const repaired=records.filter(x=>['verified_repair','verified_short_platform'].includes(x.current.classification));
const deferred=records.filter(x=>deferredIds.has(x.id)).map(x=>({...x,deferredReason:'Explicitly deferred by user; do not infer correctness.'}));
const pending=records.filter(x=>x.current.reviewStatus==='needs_review'&&!deferredIds.has(x.id)).sort((a,b)=>{
 const order=['critical_wrong_person_or_boundary','high_omission','high_garbled','high_source_or_rule_review','high_omission_repaired_awaiting_visual','medium_split_or_structure','pending_other_issue_specific_suspicion_excluded','low_spacing_repaired_awaiting_visual'];
 return order.indexOf(a.severity)-order.indexOf(b.severity)||String(a.name).localeCompare(String(b.name),'zh-Hant');
});
const excluded=followup.filter(x=>x.decision==='排除本次標記').map(x=>({
 id:x.id,name:x.name,kind:x.kind,personId:x.personId??null,candidateId:scanById.get(x.id)?.candidateId??null,
 election:{year:x.year,race:x.race},source:{name:x.sourceName,url:x.sourceUrl,document:x.sourceDocument},
 excludedSuspicion:{category:x.category,reason:x.decisionReason},
 verificationBoundary:'Only the specific flagged suspicion was excluded; the full platform text was not comprehensively verified.'
}));
const countsBySeverity=Object.fromEntries([...new Set(pending.map(x=>x.severity))].map(k=>[k,pending.filter(x=>x.severity===k).length]));
const output={version:1,generatedAt:new Date().toISOString(),scope:'full-local Supabase plus immutable 2026-09-07 audit artifacts; no production read or write',snapshotBaseline:{flaggedTotal:458,person:452,party:6,note:'Historical audit snapshot only; not a current remainder.'},currentWorkQueue:{repaired:repaired.length,pending:pending.length,deferred:deferred.length,withheldTotal:pending.length+deferred.length,pendingBySeverity:countsBySeverity},excludedBoundary:{count:excluded.length,note:'排除 only resolves the recorded suspicion. It is not a full-text correctness approval.'},repaired,pending,deferred,excludedSpecificSuspicion:excluded};
writeFileSync(resolve(dir,'current-review-checklist.json'),JSON.stringify(output,null,2)+'\n');

const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ');
function row(x){const doc=x.source.document,src=x.source.url?`[來源](${x.source.url})`:(x.source.name??'—'),local=doc?.file?`[PDF/截圖](../../${doc.file})`:'—';return `| ${esc(x.name)} | ${esc(x.election.year)}／${esc(x.election.race)} | ${esc(x.personId)}／${esc(x.candidateId)} | ${esc(x.severity)} | ${src}；${local} | ${esc(x.originalAudit.decision)}／${esc(x.originalAudit.category)} |`;}
const md=[`# 政見品質核對清單（現況）`,`\n產生時間：${output.generatedAt}`,`\n- 修正完成：${repaired.length}` ,`- 待核對：${pending.length}`,`- 暫緩：${deferred.length}`,`- 目前仍 withheld：${pending.length+deferred.length}`,`- 原 458 筆只是歷史稽核快照（人物 452、政黨 6），不是現在剩餘量。`,`- 原先「排除本次標記」共 ${excluded.length} 筆，只代表特定疑點排除；未逐字核對的全文不得標為正確。`,`\n## 待核對（依嚴重度）\n`,`| 人物 | 選舉 | person／candidate | 優先類別 | 來源 | 原始判定 |\n|---|---|---|---|---|---|`,...pending.map(row),`\n## 暫緩\n`,...deferred.map(x=>`- ${x.name}（${x.id}）：${x.deferredReason} 來源：${x.source.url??'—'}`),`\n## 修正完成\n`,`| 人物 | 選舉 | person／candidate | 狀態 | 來源 | 原始判定 |\n|---|---|---|---|---|---|`,...repaired.map(row),`\n## 特定疑點已排除（非全文確認）\n`,`完整 138 筆逐筆來源與人物／選舉對應保存在 current-review-checklist.json 的 excludedSpecificSuspicion。此區不可解讀為全文正確。`];
writeFileSync(resolve(dir,'current-review-checklist.md'),md.join('\n')+'\n');
console.log(JSON.stringify(output.currentWorkQueue,null,2));
console.log(`excludedSpecificSuspicion=${excluded.length}`);
