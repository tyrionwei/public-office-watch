import {createHash} from 'node:crypto';
export const OFFICIAL_PROFILE_VERSION='official-profile-v1';
export const profileFields=new Set(['birth_date','education','experience']);
export function officialHost(url){
 try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&(/(^|\.)gov\.tw$/i.test(u.hostname)||u.hostname==='academicians.sinica.edu.tw');}catch{return false;}
}
export function datePrecision(value){
 const v=String(value??'').trim();
 if(/^\d{4}$/.test(v)&&Number(v)>1800&&Number(v)<2200)return 'year';
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v))return 'month';
 if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const d=new Date(v+'T00:00:00Z');if(Number.isFinite(+d)&&d.toISOString().slice(0,10)===v)return 'day';}
 return null;
}
export function profileBinding(claim){
 return createHash('md5').update([claim.person_id,claim.claim_type,claim.claim_value??claim.claim_json?.value??'',claim.source_url??''].join('|')).digest('hex');
}
export function acceptedOfficialProfileClaim(claim){
 if(!profileFields.has(claim.claim_type))return true;
 const p=claim.claim_json?.officialProfilePolicy;
 return (claim.claim_type!=='birth_date'||datePrecision(claim.claim_value??claim.claim_json?.value)===p?.datePrecision)&&officialHost(claim.source_url)&&p?.version===OFFICIAL_PROFILE_VERSION&&p.eligible===true&&p.identityVerified===true&&p.contentVerified===true&&p.binding===profileBinding(claim);
}
export function preserveProfilePolicy(row,old){
 if(!profileFields.has(row.claim_type))return row;
 if(old&&acceptedOfficialProfileClaim(old)&&profileBinding(row)===profileBinding(old)) return {...row,review_status:old.review_status,visibility:old.visibility,is_public:old.is_public,claim_json:{...row.claim_json,officialProfilePolicy:old.claim_json.officialProfilePolicy}};
 // Import payloads cannot attest their own identity or content review.
 return {...row,review_status:officialHost(row.source_url)?'pending':'archived',visibility:'private',is_public:false,
  claim_json:{...row.claim_json,officialProfilePolicy:{version:OFFICIAL_PROFILE_VERSION,eligible:false,reason:officialHost(row.source_url)?'official_evidence_pending':'source_policy_disabled',notAnErrorFinding:true}}};
}
// This is a migration review of existing verified evidence, not an auto-approval classifier.
export function reviewExistingOfficialClaim(c,{canonical=new Map(),candidates=new Map(),sources=new Map(),people=new Map(),provenance=new Map()}={}){
 const j=c.claim_json??{},value=String(c.claim_value??j.value??'').trim();
 const canon=id=>canonical.get(id)??id;
 const no=reason=>({eligible:false,reason});
 if(!officialHost(c.source_url))return no('source_policy_disabled');
 if(c.review_status!=='verified')return no('existing_review_not_verified');
 if(!value || (j.value!=null && String(j.value).trim()!==value))return no('source_content_mismatch');
 const manual=['verified','approved'].includes(j.manualReview?.status);
 if(j.publicationGate?.status&&j.publicationGate.status!=='passed')return no('official_content_review_pending');
 if(j.identityMatch?.status && j.identityMatch.status!=='matched')return no('identity_pending');
 let method=null;
 const proof=provenance.get(c.claim_key);
 const archivedExact=proof && proof.personId===c.person_id && proof.claimType===c.claim_type && proof.claimValue===value && proof.sourceUrl===c.source_url;
 const cid=c.candidate_id??j.candidateId, candidate=candidates.get(cid);
 const candidateBound=candidate&&canon(candidate.person_id)===canon(c.person_id);
 const document= j.sourceDocument??{};
 if(candidateBound && ((manual&&(document.sha256||j.manualReview.evidenceFile)) ||
    (j.publicationGate?.status==='passed' && /^[a-f0-9]{64}$/.test(document.sha256??'')) ||
    j.reviewAudit?.version==='manual-semantic-review-20260827-v1'))method='reviewed_official_candidate_document';
 if(!method && archivedExact && manual && (j.manualReview.reason||j.manualReview.method||j.manualReview.note) &&
   (j.personName||j.identityMapping?.personName||j.officialExternalId||candidateBound))method='existing_manual_official_review';
 if(!method && archivedExact && j.identityMatch?.status==='matched' && j.officialExternalId && j.sourcePersonKey
    && /(?:official_candidate_json|official_profile|council_profile|government_profile|unique_name_profile)_match$/.test(j.identityMatch.method??'')
    && (j.identityMatch.reasons??[]).some(r=>/name matched/.test(r))
    && (j.identityMatch.reasons??[]).some(r=>/district (?:ordinal )?matched|race title matched/.test(r))
    && (j.identityMatch.reasons??[]).some(r=>/position matched|role matched|position hint matched|candidate number matched/.test(r))
    && j.value!=null)method='reviewed_structured_official_profile';
 // Retain reviewed CEC structured dates only when the source's ROC value and
 // recorded election/candidate context independently support the adopted value.
 if(!method && c.claim_type==='birth_date' && j.sourceId==='cec-2024-candidate-json'
   && /^https:\/\/2024\.cec\.gov\.tw\/data\/json\/cand\//.test(c.source_url)
   && j.identityMatch?.status==='matched' && j.identityMatch.method==='official_candidate_json_match'
   && ['name matched','candidate number matched','race title matched','election matched'].every(r=>(j.identityMatch.reasons??[]).includes(r))
   && /^[0-9]{7}$/.test(j.rawBirth??'')){
   const raw=String(j.rawBirth),date=[Number(raw.slice(0,3))+1911,raw.slice(3,5),raw.slice(5,7)].join('-');
   if(date===value && j.personName && j.raceTitle && j.candidateNo && j.electionName)method='reviewed_cec_structured_date';
 }
 const source=sources.get(c.source_person_id);
 if(!method && source && source.source_person_key===j.sourcePersonKey && officialHost(source.source_url)){
   const payload={...source.source_payload,...j.sourcePayload};
   const fieldValues=c.claim_type==='birth_date'?[source.birth_date,source.birth_date_text,payload.birthDate,payload.birthText]:
      c.claim_type==='education'?[payload.education,payload.degree]:[payload.experience];
   const exact=fieldValues.some(v=>v!=null&&String(v).trim()===value);
   const rawDate=c.claim_type==='birth_date'&&fieldValues.some(v=>{
     const m=String(v??'').match(/^民國\s*(\d{1,3})年\s*(\d{1,2})月\s*(\d{1,2})日?$/);
     return m && [Number(m[1])+1911,m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-')===value;
   });
   const name=people.get(c.person_id)?.name;
   const sameName=name && String(name).replace(/\s+/g,'')===String(source.raw_name).replace(/\s+/g,'');
   if((exact||rawDate) && sameName && source.raw_name && source.external_person_id &&
      !/unresolved|needs_identity_check/.test(JSON.stringify(payload)))method='reviewed_official_source_field';
 }
 if(!method)return no('official_identity_or_content_evidence_missing');
 const precision=c.claim_type==='birth_date'?datePrecision(value):null;
 if(c.claim_type==='birth_date'&&!precision)return no('official_date_precision_invalid');
 return {version:OFFICIAL_PROFILE_VERSION,eligible:true,identityVerified:true,contentVerified:true,binding:profileBinding(c),datePrecision:precision,evidenceMethod:method,archivedEvidence:archivedExact?{path:proof.path,sha256:proof.sha256}:undefined,sourceUrl:c.source_url,reviewBasis:'existing verified official claim and field-specific identity/content evidence'};
}
