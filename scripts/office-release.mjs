import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createLocalReviewClient } from './lib/local-review-target.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const roles = {
 president: ['president', 0, '總統', false], vice_president: ['vice_president', 1, '副總統', false],
 legislator: ['legislator', 2, '立法委員', false], legislative_district: ['legislator', 2, '立法委員', false], indigenous: ['legislator', 2, '立法委員', false], party_list_legislator: ['legislator', 2, '立法委員', false],
 local_chief: ['local_chief', 3, '首長', false], municipality_mayor: ['local_chief', 3, '市長', false], county_mayor: ['local_chief', 3, '縣市長', false],
 city_councilor: ['councilor', 5, '市議員', false], county_councilor: ['councilor', 5, '縣議員', false], councilor_district: ['councilor', 5, '議員', false],
 township_mayor: ['local_chief', 3, '鄉鎮市長', true], township_representative: ['other', 8, '鄉鎮市民代表', true], township_representative_district: ['other', 8, '鄉鎮市民代表', true], village_chief: ['other', 8, '村里長', true],
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const fallback = { position: null, district: null, current_office_label: null, list_role: 'other', list_status: 'other', list_is_grassroots: false, list_status_order: 3, list_role_order: 8 };
function termDraft(t) {
  if (!roles[t.race_type] || !t.family || !validDate(t.starts_on) || !validDate(t.ends_on) || t.ends_on <= t.starts_on || t.unknown_end || (t.ended_on && (!validDate(t.ended_on) || t.ended_on < t.starts_on || t.ended_on > t.ends_on))) throw Error('任期／例外離任日期尚待確認');
  if (!/^https:\/\//.test(t.source_url ?? '') || !t.source_version) throw Error('缺少可核對的來源或版本');
  if (t.race_type === 'president' && (!['president','vice_president'].includes(t.office_role) || !/^https:\/\//.test(t.role_source_url ?? ''))) throw Error('總統聯名選舉須逐次確認正副職務與來源，不能從選舉類別猜測');
  const [role, order, title, grassroots] = roles[t.race_type === 'president' ? t.office_role : t.race_type];
  // Prefer the actual race title for geographically specific offices; never infer party or profile facts.
  const label = ['president','vice_president','legislator'].includes(role) ? title : t.title?.replace(/選舉$/, '') || `${t.region_name ?? ''}${title}`;
  const current = { ...fallback, position: label, district: t.region_name ?? null, current_office_label: label, list_role: role, list_status: 'current', list_is_grassroots: grassroots, list_status_order: 0, list_role_order: order };
  return { candidateId: t.candidate_id, raceId: t.race_id, family: t.family, startsOn: t.starts_on, endsOn: t.ends_on, endedOn: t.ended_on ?? null, sourceUrl: t.source_url, sourceVersion: t.source_version, reason: '依參選與任期來源推導，經本發布包人工核准' + (t.role_source_url ? `；職務佐證：${t.role_source_url}` : ''), current, former: { ...current, current_office_label: null, list_status: 'former', list_status_order: 2 } };
}
export function snapshotOn(person, date) {
  const active = person.terms.filter(t => t.startsOn <= date && date < (t.endedOn ?? t.endsOn)).sort((a,b) => a.current.list_role_order-b.current.list_role_order || b.startsOn.localeCompare(a.startsOn) || a.candidateId.localeCompare(b.candidateId));
  const ended = person.terms.filter(t => date >= (t.endedOn ?? t.endsOn)).sort((a,b) => (b.endedOn ?? b.endsOn).localeCompare(a.endedOn ?? a.endsOn) || a.former.list_role_order-b.former.list_role_order || a.candidateId.localeCompare(b.candidateId));
  return active[0]?.current ?? ended[0]?.former ?? person.fallback;
}
export function makeDraft(source, baseline, asOf) {
  if (!source.complete || !['president','legislator','local'].includes(source.family) || baseline.schemaVersion !== 1 || !Number.isSafeInteger(baseline.officeRevision) || baseline.officeRevision < 0 || !validDate(asOf)) throw Error('Incomplete source, baseline or as-of date');
  const targets = new Map(baseline.people.map(p => [p.personId,p]));
  if (targets.size !== baseline.people.length || baseline.people.some(p=>!p.fingerprint || !p.personId)) throw Error('Invalid or duplicate baseline person');
  const people = []; const blocked = []; const seen = new Set();
  for (const person of source.people) {
    if (seen.has(person.person_id)) throw Error('Duplicate source person'); seen.add(person.person_id);
    const target = targets.get(person.person_id);
    if (!target) { blocked.push({ personId: person.person_id, reason: '不在目標已公開人物基準中；须先循人物發布流程' }); continue; }
    try {
      if (target.officeStatus === 'current' && ['agency_head','local_deputy','party_officer'].includes(target.officeRole)) throw Error('同時具有任命職務，須補上明確任期後再納入');
      if (target.officeStatus === 'current' && target.officeRole === 'legislator' && /院長|副院長/.test(target.officeSnapshot?.current_office_label ?? '')) throw Error('兼任院長／副院長，須補上該職務明確任期後再納入');
      const terms = person.terms.map(termDraft);
      if (!terms.length || terms.length > 100 || new Set(terms.map(t=>t.candidateId)).size !== terms.length) throw Error('Invalid or duplicate candidate terms');
      people.push({ personId: person.person_id, expectedFingerprint: target.fingerprint, fallback: target.officeStatus === 'candidate' && target.officeSnapshot ? { ...target.officeSnapshot, current_office_label: null } : { ...fallback }, terms });
    } catch (error) { blocked.push({ personId: person.person_id, reason: error.message }); }
  }
  const draft = { schemaVersion: 1, family: source.family, asOf, expectedReleaseId: baseline.releaseId, expectedOfficeRevision: baseline.officeRevision, sourceHash: digest(source), baselineHash: digest(baseline), people, blocked, preview: people.map(p=>({personId:p.personId,before:targets.get(p.personId).officeSnapshot,after:snapshotOn(p,asOf),changed:Object.keys(fallback).some(k=>targets.get(p.personId).officeSnapshot?.[k]!==snapshotOn(p,asOf)[k])})) };
  return { ...draft, draftHash: digest(draft) };
}
export function buildRelease(draft, review) {
  const { draftHash, ...content } = draft;
  if (!Number.isSafeInteger(draft.expectedOfficeRevision) || draft.expectedOfficeRevision < 0 || draft.expectedOfficeRevision >= 2147483647 || !validDate(draft.asOf)) throw Error('Invalid release revision or date');
  if (digest(content) !== draftHash || review.draftHash !== draftHash || !review.reviewedBy?.trim() || !review.reason?.trim() || !Array.isArray(review.approvedPersonIds) || !review.approvedPersonIds.length) throw Error('An explicit review of the exact draft is required');
  const approved = new Set(review.approvedPersonIds);
  const people = draft.people.filter(p=>approved.has(p.personId));
  if (people.length !== approved.size || people.length !== review.approvedPersonIds.length || people.length > 500) throw Error('Review must select 1–500 unique, unblocked draft people');
  const payload = { schemaVersion: 1, packageId: randomUUID(), asOf: draft.asOf, expectedReleaseId: draft.expectedReleaseId, expectedOfficeRevision: draft.expectedOfficeRevision, reviewedBy: review.reviewedBy.trim(), reason: review.reason.trim(), people };
  const quote = text => `'${text.replaceAll("'", "''")}'`;
  return { payload, sql: `BEGIN;\nSELECT public.apply_reviewed_office_release(${quote(JSON.stringify(payload))}::jsonb);\nCOMMIT;\n`, rollback: `BEGIN;\nSELECT public.rollback_reviewed_office_release('${payload.packageId}'::uuid,${payload.expectedOfficeRevision+1},'Rollback reviewed office release');\nCOMMIT;\n` };
}
function read(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600}); }
function localClient() {
  const env = Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{ const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; }));
  const url = new URL(env.SUPABASE_URL); if(url.port!=='54321')throw Error('Only full-local API port 54321 is allowed');
  return createLocalReviewClient({supabaseUrl:url.href,serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY});
}
async function rpc(client,name,input) { return client.requestJson(client.urlFor('rpc/'+name),{method:'POST',body:JSON.stringify(input)}); }
export async function main(argv) {
  const [command,...args]=argv;const options={};for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw Error('Use --option value');options[args[i].slice(2)]=args[i+1];}
  if(!options.output)throw Error('--output is required');
  if(command==='source') {
    if(!['president','legislator','local'].includes(options.family))throw Error('--family required');
    const client=localClient();let after=null;const people=[];const seen=new Set();
    do {const batch=await rpc(client,'office_release_source',{p_family:options.family,p_after:after,p_limit:200});for(const person of batch.people){if(seen.has(person.person_id))throw Error('Duplicate page');seen.add(person.person_id);people.push(person);}if(!batch.count)break;if(!batch.next||batch.next===after)throw Error('Invalid pagination');after=batch.next;write(options.output,{complete:false,family:options.family,people});}while(true);
    write(options.output,{complete:true,family:options.family,people});console.log(`Local source export complete: ${people.length} people`);
  } else if(command==='baseline-local') {
    const source=read(options.source);const client=localClient();let baseline=null;
    for(let i=0;i<source.people.length;i+=200){const b=await rpc(client,'office_release_baseline',{p_ids:source.people.slice(i,i+200).map(p=>p.person_id)});if(!baseline)baseline=b;else{if(b.releaseId!==baseline.releaseId||b.officeRevision!==baseline.officeRevision)throw Error('Baseline changed');baseline.people.push(...b.people);}}
    if(!baseline)throw Error('Empty source');write(options.output,baseline);
  } else if(command==='draft') {const d=makeDraft(read(options.source),read(options.baseline),options['as-of']);write(options.output,d);console.log(`Draft: ${d.people.length} eligible, ${d.blocked.length} blocked; no approval or publication performed`);}
  else if(command==='build') {const r=buildRelease(read(options.draft),read(options.review));write(options.output,r.payload);fs.writeFileSync(options.output+'.sql',r.sql,{mode:0o600});fs.writeFileSync(options.output+'.rollback.sql',r.rollback,{mode:0o600});console.log('Office-only SQL package built; nothing applied');}
  else throw Error('Commands: source, baseline-local, draft, build. Production baseline must be supplied as a separately authorized read-only export; this tool never connects to production.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
