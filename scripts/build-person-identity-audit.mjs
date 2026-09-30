import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildDuplicateReport} from './report-duplicate-people.mjs';
import {birthDatesCompatible, reviewedOfficialBirthDate, verifiedStablePersonIdForClaim} from './report-duplicate-people.mjs';

// Offline only: input is a consistent private full-local snapshot, never a public-view sample.
const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').replaceAll('臺','台');
const pairKey = (a,b) => [a,b].sort().join('|');
const unique = xs => [...new Set(xs.filter(Boolean))];
const verified = c => c.review_status === 'verified';
export function buildAudit(data, year = 2026) {
  const people = new Map(data.people.map(p=>[p.id,p]));
  const canonical = new Map(data.canonical.map(p=>[p.person_id,p.canonical_person_id]));
  const canon = id => canonical.get(id) ?? id;
  const current = data.candidates.filter(c=>c.year===year);
  const focus = new Set(current.filter(c=>c.person_id).map(c=>canon(c.person_id)));
  const names = new Set([...focus].map(id=>norm(people.get(id)?.name)));
  const related = new Set(data.people.filter(p=>names.has(norm(p.name)) || focus.has(canon(p.id))).map(p=>canon(p.id)));
  // Include external-ID queue partners even when their names differ.
  for (const q of data.queue) if(focus.has(canon(q.duplicate_person_id)) || focus.has(canon(q.canonical_person_id))) {
    related.add(canon(q.duplicate_person_id)); related.add(canon(q.canonical_person_id));
  }
  const rawIds = new Set(data.people.filter(p=>related.has(canon(p.id))).map(p=>p.id));
  const candidates = data.candidates.filter(c=>rawIds.has(c.person_id));
  const claims = data.claims.filter(c=>rawIds.has(c.person_id));
  const groupedClaims = new Map(), groupedCandidates = new Map();
  for(const id of related){groupedClaims.set(id,[]);groupedCandidates.set(id,[]);}
  for(const c of claims) groupedClaims.get(canon(c.person_id)).push(c);
  for(const c of candidates) groupedCandidates.get(canon(c.person_id)).push(c);
  const stableClaims = claims.filter(verified).map(c=>({...c, sourceClaimPersonId:c.person_id,person_id:canon(c.person_id),
    // Council-local numeric IDs must retain their namespace.
    claim_value:c.claim_type==='external_id' && /^current-councilor-[^:]+$/.test(c.claim_value ?? '')
      ? c.claim_json?.sourcePersonKey ?? '' : c.claim_value}));
  const report = buildDuplicateReport(
    [...related].map(id=>({...people.get(id),person_id:id})),
    candidates.map(c=>({...c,person_id:canon(c.person_id),election_name:String(c.year),person_position:c.race_type,region_name:c.race_title})),
    stableClaims, data.decisions.filter(d=>d.status!=='verified').map(d=>({...d,duplicate_person_id:canon(d.duplicate_person_id),canonical_person_id:canon(d.canonical_person_id)})),
    {sampleLimit:Number.MAX_SAFE_INTEGER});
  const evidence = id => (groupedClaims.get(id) ?? []).filter(c=>['external_id','birth_date','gender'].includes(c.claim_type))
    .map(c=>({claimId:c.id,personId:c.person_id,type:c.claim_type,value:c.claim_value,status:c.review_status,sourcePersonId:c.source_person_id,sourceUrl:c.source_url}));
  const candidatePeople = new Map(data.candidates.map(c=>[c.id,canon(c.person_id)]));
  const linksByPerson = new Map();
  for(const table of data.sideLinks??[]) for(const link of table.links){
    for(const id of unique([canon(link.person_id??link.matched_person_id),candidatePeople.get(link.candidate_id)])){
      if(!linksByPerson.has(id))linksByPerson.set(id,[]);
      linksByPerson.get(id).push({table:table.table,...link});
    }
  }
  const impact = ids => {
    const cs=ids.flatMap(id=>groupedClaims.get(id)??[]);
    return {otherLinks:ids.flatMap(id=>linksByPerson.get(id)??[]),
      claimSources:cs.map(c=>({id:c.id,personId:c.person_id,candidateId:c.candidate_id,type:c.claim_type,sourceUrl:c.source_url,status:c.review_status,visibility:c.visibility})),
      claimsByType:Object.fromEntries(unique(cs.map(c=>c.claim_type)).map(t=>[t,cs.filter(c=>c.claim_type===t).map(c=>c.id)])),
      candidates:ids.flatMap(id=>groupedCandidates.get(id)??[]).map(c=>({id:c.id,personId:c.person_id,canonicalPersonId:canon(c.person_id),name:c.candidate_name,year:c.year,district:c.race_title,sourceUrl:c.source_url})),
      sourceMatches:data.matches.filter(m=>ids.includes(canon(m.person_id))).map(m=>({id:m.id,personId:m.person_id,sourcePersonId:m.source_person_id,status:m.match_status}))};
  };
  const terminalPairs=new Set(data.decisions.filter(d=>['verified','rejected','archived'].includes(d.status)).map(d=>pairKey(canon(d.duplicate_person_id),canon(d.canonical_person_id))));
  const rows=[],seen=new Set();
  function addPair(a,b,reasons,queue){
    a=canon(a);b=canon(b);
    if(a===b || !(focus.has(a)||focus.has(b)) || seen.has(pairKey(a,b)) || terminalPairs.has(pairKey(a,b))) return;
    seen.add(pairKey(a,b));
    const cs=[...(groupedClaims.get(a)??[]),...(groupedClaims.get(b)??[])].filter(verified);
    const births=unique(cs.map(reviewedOfficialBirthDate));
    const genders=unique([people.get(a)?.gender,people.get(b)?.gender].filter(g=>g!=='unknown'));
    // An official election record hash is not a stable person ID. Keep it for human review.
    const ext=id=>unique((groupedClaims.get(id)??[]).filter(c=>verified(c)&&c.claim_type==='external_id').map(c=>c.claim_value));
    const stableExt=id=>unique((groupedClaims.get(id)??[]).map(verifiedStablePersonIdForClaim));
    const shared=ext(a).filter(v=>ext(b).includes(v));
    const stable=stableExt(a).filter(v=>stableExt(b).includes(v));
    const qids=unique([...ext(a),...ext(b)].filter(v=>/^wikidata:Q\d+$/i.test(v)));
    const birthConflict=births.some((value,i)=>births.slice(i+1).some(other=>!birthDatesCompatible(value,other)));
    const blocked=birthConflict || genders.length>1 || qids.length>1;
    const category=stable.length && !blocked ? '可合併' : '證據不足';
    rows.push({key:pairKey(a,b),kind:'person_pair',category,names:[people.get(a)?.name,people.get(b)?.name],
      beforePersonIds:[a,b],afterPersonIds:[a,b],result:'待審',queueLevel:queue?.confidence_level??null,
      reasons:[...reasons,...(blocked?['存在生日、性別或 Wikidata ID 衝突，須核對原始來源']:[])],
      missing:category==='可合併'?[]:['經審核且穩定的人物外部識別碼，或人工逐人交叉身分證據',...(shared.length&&!stable.length?['共享的是來源紀錄鍵；不能僅據此自動合併']:[])],
      sharedExternalIds:shared,evidence:[...evidence(a),...evidence(b)],impact:impact([a,b])});
  }
  for(const group of report.groups) for(const p of group.pairSuggestions) addPair(p.leftPersonId,p.rightPersonId,p.reasons);
  for(const q of data.queue) addPair(q.duplicate_person_id,q.canonical_person_id,[q.reason],q);
  const handled=data.decisions.filter(d=>rawIds.has(d.duplicate_person_id)||rawIds.has(d.canonical_person_id));
  for(const d of handled.filter(d=>['verified','rejected','archived'].includes(d.status))) {
    if(!focus.has(canon(d.duplicate_person_id))&&!focus.has(canon(d.canonical_person_id)))continue;
    rows.push({key:d.id,kind:'existing_decision',category:d.status==='verified'?'可合併':d.status==='rejected'?'確定不同人':'證據不足',
      names:[people.get(d.duplicate_person_id)?.name,people.get(d.canonical_person_id)?.name],beforePersonIds:[d.duplicate_person_id,d.canonical_person_id],
      afterPersonIds:[canon(d.duplicate_person_id),canon(d.canonical_person_id)],result:'既有 '+d.status,
      reasons:[d.reason],missing:[],evidence:[d.evidence_json],impact:impact(unique([canon(d.duplicate_person_id),canon(d.canonical_person_id)]))});
  }
  const suspicious = new Map();
  const flag=(id,reason,candidate,claim)=>{
    if(!suspicious.has(id))suspicious.set(id,{key:id,kind:candidate?'candidate_link':'person_claim',category:'疑似誤綁',
      names:[candidate?.candidate_name,people.get(canon(candidate?.person_id??claim.person_id))?.name].filter(Boolean),
      beforePersonIds:[candidate?.person_id??claim.person_id],afterPersonIds:[candidate?.person_id??claim.person_id],
      candidateId:candidate?.id??claim.candidate_id,result:'待審',reasons:[],missing:['逐筆核對來源人物身分；不搬移不確定關聯'],evidence:[],impact:impact([canon(candidate?.person_id??claim.person_id)])});
    const row=suspicious.get(id);row.reasons.push(reason);row.evidence.push(candidate?{sourceUrl:candidate.source_url,year:candidate.year,district:candidate.race_title}:claim);
  };
  for(const c of candidates){
    if(!focus.has(canon(c.person_id)))continue;
    const person=people.get(canon(c.person_id));
    const alternatives=[person.name,...(Array.isArray(person.alias)?person.alias:[])].map(norm);
    if(c.candidate_name&&!alternatives.includes(norm(c.candidate_name))) {
      const normalizedDots=s=>norm(s).replace(/[．·‧﹒.]/g,'·');
      if(normalizedDots(c.candidate_name)!==normalizedDots(person.name))
        flag(c.id,'候選姓名與 canonical 人物姓名不同（含異體字／附名，尚非誤綁結論）',c);
    }
  }
  const allCandidates=new Map(data.candidates.map(c=>[c.id,c]));
  for(const c of claims) {
    const candidate=allCandidates.get(c.candidate_id);
    if(candidate && canon(candidate.person_id)!==canon(c.person_id) && (focus.has(canon(c.person_id))||focus.has(canon(candidate.person_id))))
      flag(c.id,'claim 的人物與其 candidate_id 人物不一致',null,c);
  }
  for(const id of focus){
    const cs=(groupedClaims.get(id)??[]).filter(c=>reviewedOfficialBirthDate(c));
    const dates=unique(cs.map(reviewedOfficialBirthDate));
    if(dates.some((value,i)=>dates.slice(i+1).some(other=>!birthDatesCompatible(value,other)))) {
      flag(id,'同一 canonical 人物有互不相容的官方生日',null,cs[0]); suspicious.get(id).evidence=cs;
    }
  }
  rows.unshift(...suspicious.values());
  const sourceIds = new Set([...claims.map(c=>c.source_person_id),...data.matches.filter(m=>rawIds.has(m.person_id)).map(m=>m.source_person_id)]);
  const categories=['疑似誤綁','可合併','確定不同人','證據不足'];
  return {generatedAt:new Date().toISOString(),year,scope:{snapshotCounts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),currentCandidates:current.length,currentLinkedPeople:focus.size,currentNameOnly:current.filter(c=>!c.person_id).length,relatedRawPeople:rawIds.size,relatedCandidates:candidates.length,relatedClaims:claims.length},
    counts:Object.fromEntries(categories.map(k=>[k,{new:rows.filter(r=>r.category===k&&r.kind!=='existing_decision').length,existing:rows.filter(r=>r.category===k&&r.kind==='existing_decision').length}])),
    limitations:['疑似誤綁採姓名、canonical 關聯及已驗證生日衝突篩選，不代表全部來源已逐字重審。','既有 rejected 決策沿用原結論，未重新做外部查證。','無連結基層姓名保留；未全面建立人物。','來源紀錄鍵與生日／性別配對只作人工線索，非穩定人物 ID。','本輪穩定人物 ID 白名單僅 Wikidata QID；其他官方人物 ID 仍待逐類審核。','獨立關聯表只盤點 ID、來源與狀態，未重新查證敏感內容。'],
    rows,existingDecisions:handled,
    relatedCandidates:candidates,relatedClaims:claims,relatedSourceMatches:data.matches.filter(m=>rawIds.has(m.person_id)),
    sources:data.sources.filter(s=>sourceIds.has(s.id))};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderAudit(audit){
 return '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>POW 人物身分盤點</title><style>body{font:16px system-ui;max-width:1200px;margin:2em auto;padding:1em}details{border:1px solid #bbb;padding:1em;margin:1em 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer}</style><h1>POW 2026 人物身分盤點（私人）</h1><p>每筆可展開核對 ID、年度選區、證據、影響及處理結果。計數單位為檢查項目／配對／既有決策，並非去重人數。</p><pre>'+escape(JSON.stringify({scope:audit.scope,counts:audit.counts,limitations:audit.limitations},null,2))+'</pre>'+audit.rows.map(r=>'<details><summary>'+escape(r.category+'｜'+r.names.join(' / ')+'｜'+r.result)+'</summary><pre>'+escape(JSON.stringify({...r,impact:{candidates:r.impact.candidates,claimCounts:Object.fromEntries(Object.entries(r.impact.claimsByType).map(([type,ids])=>[type,ids.length])),claimSources:unique((r.impact.claimSources??[]).map(c=>c.sourceUrl)),otherLinkedCounts:Object.fromEntries(unique((r.impact.otherLinks??[]).map(l=>l.table)).map(t=>[t,r.impact.otherLinks.filter(l=>l.table===t).length])),fullDetails:'audit.json: rows key='+r.key}},null,2))+'</pre></details>').join('')+'</html>';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,out,resultFile,linksFile]=process.argv.slice(2);
 if(!input||!out)throw new Error('Usage: node scripts/build-person-identity-audit.mjs PRIVATE_SNAPSHOT.json PRIVATE_OUTPUT_DIR [PRIVATE_RESULTS.json]');
 const bytes=fs.readFileSync(input);const data=JSON.parse(bytes);if(linksFile)data.sideLinks=JSON.parse(fs.readFileSync(linksFile));const audit=buildAudit(data);
 if(resultFile){
   const results=JSON.parse(fs.readFileSync(resultFile));
   for(const result of results){
     const row=audit.rows.find(r=>r.key===result.candidateId);
     if(!row || row.beforePersonIds[0]!==result.personId || row.names[0]!==result.beforeName || result.applied!==true) throw new Error('Result does not match snapshot');
     Object.assign(row,{result:'已本機修正候選姓名（人物連結不變）',beforeCandidateName:result.beforeName,afterCandidateName:result.afterName,missing:[],resolution:result});
   }
 }
 audit.snapshotSha256=createHash('sha256').update(bytes).digest('hex');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(audit,null,2)+'\n');
 fs.writeFileSync(path.join(out,'audit.html'),renderAudit(audit));
 console.log(JSON.stringify({scope:audit.scope,counts:audit.counts}));
}
