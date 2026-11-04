import assert from 'node:assert/strict';
import test from 'node:test';
import {createSeoCatalog} from '../scripts/generate-seo-catalog.mjs';
import {enrichSeoPages} from '../scripts/seo-public-summary.mjs';
import {injectDocumentMetadata,documentResponseStatus} from '../worker/sites-static.js';
const html='<html><head></head><body><div id="root"></div></body></html>';
test('public summaries escape content and allow only existing public internal targets',()=>{
 const c=createSeoCatalog({people:[{person_id:'p',name:'Name',position:'鄉長',updated_at:'2026-01-01'}],races:[{race_id:'r',title:'村長選舉',voting_date:'2018-11-24'}],publicDetails:{version:1,people:[{source:'published.person_profiles_for',person_id:'p',updated_at:'2026-10-20T00:00:00Z',candidates:[{race_id:'r',race_title:'<img onerror=alert(1)>',election_year:2018}]}],races:[{source:'published.race_page_for',race_id:'r',candidates:[{name:'<script>x</script>',person_id:'private',vote_count:984,vote_rate:100}]}]}});
 const person=injectDocumentMetadata(html,'https://pow4vote.org/people/p',c);
 assert.ok(person.includes('/elections/races/r')); assert.ok(person.includes('&lt;img'));assert.ok(!person.includes('<img onerror'));
 const race=injectDocumentMetadata(html,'https://pow4vote.org/elections/races/r',c);
 assert.ok(race.includes('2018年村長選舉'));assert.ok(race.includes('984票'));assert.ok(race.includes('&lt;script&gt;'));assert.ok(!race.includes('href="/people/private"'));
 assert.equal(c.pages.find(p=>p.group==='people').lastModified,'2026-10-20T00:00:00.000Z');
 assert.equal(documentResponseStatus('/people/not-public',c),404);
});
test('incomplete profile date is omitted, not rewritten to build date; all pages retained',()=>{
 const c=createSeoCatalog({people:[{person_id:'p',name:'A',updated_at:'2026-01-01'}]},'2030-01-01');assert.equal(c.pages.length,1);assert.equal(c.pages[0].lastModified,undefined);
});
test('mixed and unknown history retained; only structured checked village scope excluded from sitemap',()=>{
 const fact={public_candidate_race_types:['village_chief'],public_history_checked:true,office_history_complete:true,known_higher_office:false};
 const c=createSeoCatalog({people:['a','b','c','new'].map(person_id=>({person_id,name:person_id})),personSitemapScope:[{person_id:'a',...fact},{person_id:'b',...fact,public_candidate_race_types:['village_chief','city_councilor']},{person_id:'c',...fact,known_higher_office:null}]});
 assert.deepEqual(c.pages.filter(p=>p.sitemapEligible===false).map(p=>p.path),['/people/a']);assert.equal(documentResponseStatus('/people/a',c),200);assert.equal(c.pages.length,4);
});
test('scope/detail inputs cannot manufacture a private page and reject duplicate identities',()=>{
 assert.deepEqual(enrichSeoPages([],{publicDetails:{version:1,people:[{source:'published.person_profiles_for',person_id:'private',candidates:[]}],races:[]}}),[]);
 assert.throws(()=>enrichSeoPages([],{publicDetails:{version:1,people:[{source:'wrong',person_id:'p',candidates:[]}],races:[]}}));
 assert.throws(()=>createSeoCatalog({people:[],personSitemapScope:[{person_id:'p'},{person_id:'p'}]}));
});
test('candidate-only village evidence is not complete office history',()=>{
 const c=createSeoCatalog({people:[{person_id:'p',name:'A'}],personSitemapScope:[{person_id:'p',public_history_checked:true,known_higher_office:false,public_candidate_race_types:['village_chief']}]});
 assert.notEqual(c.pages[0].sitemapEligible,false);
});
