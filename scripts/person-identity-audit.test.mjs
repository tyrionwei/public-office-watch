import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAudit,renderAudit} from './build-person-identity-audit.mjs';
import {correctionSql} from './apply-person-identity-audit-local.mjs';
import {verifiedAutoMergePair} from './apply-person-merge-decisions.mjs';
import {profileBinding} from './lib/official-profile-policy.mjs';
const stableClaim=(person_id,claim_value,review={})=>({id:`ext-${person_id}-${claim_value}`,person_id,claim_type:'external_id',claim_value,review_status:'verified',
 claim_json:{stablePersonIdReview:{status:'verified',independentEvidence:true,evidenceUrl:'https://www.wikidata.org/wiki/Q123',...review}}});
const birthClaim=(person_id,value)=>{
 const row={id:`birth-${person_id}-${value}`,person_id,claim_type:'birth_date',claim_value:value,review_status:'verified',source_url:'https://web.cec.gov.tw/profile',claim_json:{}};
 row.claim_json={officialProfilePolicy:{version:'official-profile-v1',eligible:true,identityVerified:true,contentVerified:true,datePrecision:value.length===4?'year':value.length===7?'month':'day',binding:profileBinding(row)}};
 return row;
};
const fixture=()=>({
 people:[{id:'a',name:'同名',gender:'male'},{id:'b',name:'同名',gender:'male'},{id:'old',name:'同名',gender:'male'}],
 canonical:[{person_id:'a',canonical_person_id:'a'},{person_id:'b',canonical_person_id:'b'},{person_id:'old',canonical_person_id:'a'}],
 candidates:[{id:'c',person_id:'a',candidate_name:'同名',year:2026,race_type:'city_councilor',race_title:'2026區'},{id:'h',person_id:'old',year:2018,race_title:'歷史區'},{id:'n',person_id:null,candidate_name:'同名',year:2026,race_type:'village_chief'}],
 claims:[],queue:[],decisions:[],matches:[],sources:[]
});
test('範圍保留歷史 raw ID，name-only 不建立連結',()=>{
 const d=fixture(),before=JSON.stringify(d),a=buildAudit(d);
 assert.equal(a.scope.currentNameOnly,1);assert.equal(a.scope.relatedCandidates,2);
 assert.equal(a.rows[0].category,'證據不足');assert(a.rows[0].impact.candidates.some(c=>c.personId==='old'));
 assert.equal(JSON.stringify(d),before);
});
test('同名性別生日只有強比對線索',()=>{
 const d=fixture();d.claims=['a','b'].map(person_id=>birthClaim(person_id,'1980-02-01'));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});
test('共享來源紀錄碼不等於穩定人物 ID',()=>{
 const d=fixture();d.claims=['a','b'].map(person_id=>stableClaim(person_id,'cec-historical:123'));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});
test('共享 verified QID 才可合併；多生日／QID 衝突阻擋',()=>{
 const d=fixture();d.claims=['a','b'].map(person_id=>stableClaim(person_id,'wikidata:Q123'));
 assert.equal(buildAudit(d).rows[0].category,'可合併');
 d.claims.push(stableClaim('b','wikidata:Q456'));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});
test('未驗證外部 ID 不提升級別',()=>{
 const d=fixture();d.claims=['a','b'].map(person_id=>({id:person_id,person_id,claim_type:'external_id',claim_value:'wikidata:Q123',review_status:'pending'}));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});
test('既有 rejected 包含歷史別名時不重提，決策保留',()=>{
 const d=fixture();d.decisions=[{id:'decision',duplicate_person_id:'old',canonical_person_id:'b',status:'rejected',reason:'different people'}];
 d.queue=[{duplicate_person_id:'a',canonical_person_id:'b',reason:'same ID',confidence_level:'A'}];
 const a=buildAudit(d);assert.equal(a.rows.filter(r=>r.kind==='person_pair').length,0);
 assert.equal(a.counts['確定不同人'].existing,1);
});
test('生日衝突保留全部證據；HTML 跳脫來源資料',()=>{
 const d=fixture();d.people[0].name='<script>alert(1)</script>';
 d.claims=['1980-01-01','1981-01-01'].map(claim_value=>birthClaim('a',claim_value));
 const a=buildAudit(d),r=a.rows.find(r=>r.key==='a');assert.equal(r.evidence.length,2);
 const html=renderAudit(a);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
});
test('修正預設回滾、僅姓名；拒絕非 full-local 決策',()=>{
 const p={schemaVersion:1,environment:'full-local',type:'candidate_name_correction',before:{id:'00000000-0000-0000-0000-000000000001',person_id:'p',candidate_name:'bad',source_url:'official'},afterName:'姓名',reason:'source checked',source:{sha256:'hash',url:'official'}};
 const sql=correctionSql(p);assert(sql.endsWith('rollback;\n'));assert(sql.includes('candidate baseline drift'));
 assert(sql.includes("set candidate_name='姓名'"));assert(!sql.includes('set person_id'));
 assert(correctionSql(p,true).endsWith('commit;\n'));assert(correctionSql(p,false,true).includes("set candidate_name='bad'"));
 assert.throws(()=>correctionSql({...p,environment:'production'}));
});

test('JSON-only 生日衝突也阻擋共享 QID 合併',()=>{
 const d=fixture();d.claims=['a','b'].flatMap((person_id,i)=>[
  stableClaim(person_id,'wikidata:Q123'),
  (()=>{const row=birthClaim(person_id,i?'1981-01-01':'1980-01-01');row.claim_json.value=row.claim_value;row.claim_value=null;return row;})()
 ]);
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});
test('獨立司法線索和候選關聯都列出影響',()=>{
 const d=fixture();d.sideLinks=[{table:'legal_record_leads',links:[{id:'lead',matched_person_id:'old',source_url:'official'}]},{table:'candidate_lifecycle_events',links:[{id:'event',candidate_id:'c'}]}];
 assert.equal(buildAudit(d).rows[0].impact.otherLinks.length,2);
});

test('A 級需要獨立穩定人物 ID 審核，來源紀錄鍵與舊 QID 提示不算',()=>{
 const d=fixture();
 d.claims=['a','b'].map(id=>stableClaim(id,'wikidata:Q123',{independentEvidence:false}));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
 d.claims=['a','b'].map(id=>stableClaim(id,'wikidata:Q123',{evidenceUrl:'   '}));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
 d.claims=['a','b'].map(id=>stableClaim(id,'cec-historical:123'));
 assert.equal(buildAudit(d).rows[0].category,'證據不足');
});

test('官方生日部分精度與完整日期前綴相容；第三方生日不形成衝突',()=>{
 const d=fixture();d.claims=[stableClaim('a','wikidata:Q123'),stableClaim('b','wikidata:Q123'),
   birthClaim('a','1980'),birthClaim('b','1980-02-01')];
 assert.equal(buildAudit(d).rows[0].category,'可合併');
 d.claims.push({id:'third',person_id:'a',claim_type:'birth_date',claim_value:'1991-01-01',review_status:'verified',source_url:'https://votetw.com/person'});
 assert.equal(buildAudit(d).rows[0].category,'可合併');
 d.claims.push(birthClaim('a','1981-02-01'));
 assert.equal(buildAudit(d).rows[0].category,'疑似誤綁');
});

test('套用工具重驗配對兩側的來源 claim，拒絕記錄鍵與未獨立審核 QID',()=>{
 const item={duplicate_person_id:'a',canonical_person_id:'b',confidence_level:'A',evidence_json:{externalId:'wikidata:Q123'}};
 const claims=new Map([['a',[stableClaim('a','wikidata:Q123')]],['b',[stableClaim('b','wikidata:Q123')]]]);
 assert.equal(verifiedAutoMergePair(item,claims),true);
 assert.equal(verifiedAutoMergePair({...item,evidence_json:{externalId:'cec-historical:123'}},claims),false);
 claims.set('b',[stableClaim('b','wikidata:Q123',{independentEvidence:false})]);
 assert.equal(verifiedAutoMergePair(item,claims),false);
 claims.set('b',[stableClaim('b','wikidata:Q123'),birthClaim('b','1981-01-01')]);
 claims.set('a',[stableClaim('a','wikidata:Q123'),birthClaim('a','1980-01-01')]);
 assert.equal(verifiedAutoMergePair(item,claims),false);
});
