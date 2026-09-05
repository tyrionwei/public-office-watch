import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupePollingPlaces, matchPollingPlaces, pollingPlaceMapUrl, validNeighborhood } from '../src/lib/pollingPlace.ts';
import { createPublishedReadAdapter, type PublishedSchemaClient } from '../src/lib/publishedReadAdapter.ts';
import type { PollingPlace } from '../src/types/pollingPlace.ts';
const place = { id:'a', station_no:'0001', village_code:'65000280003', station_name:'老梅市民活動中心',
 address:'新北市石門區老梅路43號', coverage_kind:'neighborhoods', raw_neighborhoods:'1至4鄰', neighborhoods:[1,2,3,4] } as PollingPlace;
test('selects exactly one station only with sufficient official coverage', () => {
 const places=[place,{...place,id:'b',station_no:'0002',neighborhoods:[5,6]}];
 assert.equal(matchPollingPlaces(places).exact,false);
 assert.equal(matchPollingPlaces(places,5).places[0].id,'b');
 assert.equal(matchPollingPlaces(places,99).exact,false);
 assert.equal(matchPollingPlaces([...places,{...place,id:'c',coverage_kind:'ambiguous',neighborhoods:[]}],5).exact,false);
 assert.equal(matchPollingPlaces([place,{...place,id:'c'}],2).exact,false);
 assert.equal(matchPollingPlaces([{...place,coverage_kind:'whole_village',neighborhoods:[]}]).exact,true);
});
test('neighborhoods remain optional and invalid stored values are discarded', () => {
 for(const value of [undefined,null,'5',0,-1,1.5,1000]) assert.equal(validNeighborhood(value),undefined);
 assert.equal(validNeighborhood(5),5);
 assert.equal(new URL(pollingPlaceMapUrl(place)).searchParams.get('query'),'老梅市民活動中心 新北市石門區老梅路43號');
});
test('same polling venue is shown once with station numbers and neighborhoods merged', () => {
 const duplicate={...place,id:'b',station_no:'0002',neighborhoods:[5,6],raw_neighborhoods:'5、6鄰'};
 const [merged]=dedupePollingPlaces([{...place,raw_neighborhoods:'1至4鄰'},duplicate]);
 assert.equal(dedupePollingPlaces([{...place},duplicate]).length,1);
 assert.equal(merged.station_no,'0001、0002');
 assert.deepEqual(merged.neighborhoods,[1,2,3,4,5,6]);
 assert.equal(merged.raw_neighborhoods,'1–6鄰');
 assert.equal(matchPollingPlaces([merged],6).exact,true);
 const [range]=dedupePollingPlaces([
  {...place,station_no:'0001',neighborhoods:[1]},
  {...place,id:'b',station_no:'0002',neighborhoods:[2]},
  {...place,id:'c',station_no:'0003',neighborhoods:[3]},
  {...place,id:'d',station_no:'0004',neighborhoods:[4]},
 ]);
 assert.equal(range.station_no,'0001–0004');
});

test('ambiguous polling venues preserve each station-specific official condition', () => {
 const [merged]=dedupePollingPlaces([
  {...place,station_no:'0073',neighborhoods:[1,2,3,4,5],raw_neighborhoods:'1-5'},
  {...place,id:'b',station_no:'0074',coverage_kind:'ambiguous',neighborhoods:[],raw_neighborhoods:'6-8\n(8\u9130\u4e0d\u542b\u9015\u9077\u6236\u53e3)'},
  {...place,id:'c',station_no:'0075',coverage_kind:'ambiguous',neighborhoods:[],raw_neighborhoods:'8-10\n(8\u9130\u50c5\u542b\u9015\u9077\u6236\u53e3)'},
 ]);
 assert.equal(merged.station_no,'0073\u20130075');
 assert.equal(merged.coverage_kind,'ambiguous');
 assert.deepEqual(merged.neighborhoods,[1,2,3,4,5]);
 assert.equal(
  merged.raw_neighborhoods,
  '0073\uFF1A1-5\n0074\uFF1A6-8\n(8\u9130\u4e0d\u542b\u9015\u9077\u6236\u53e3)\n0075\uFF1A8-10\n(8\u9130\u50c5\u542b\u9015\u9077\u6236\u53e3)',
 );
 assert.equal(matchPollingPlaces([merged],5).exact,false);
});

test('polling RPC sends only event and village; oversized responses fail closed', async () => {
 const calls: unknown[]=[];
 let rows: unknown[]=[place];
 const client={schema(name:string){assert.equal(name,'published');return {rpc(method:string,args:unknown){
   calls.push({method,args});return Promise.resolve({data:rows,error:null,count:null});
 }}}} as unknown as PublishedSchemaClient;
 const adapter=createPublishedReadAdapter(client);
 await adapter.loadPollingPlaces('2026-local-general-election-day','65000280003');
 assert.deepEqual(calls,[{method:'polling_places_for_village',args:{p_event_key:'2026-local-general-election-day',p_village_code:'65000280003'}}]);
 rows=Array(101).fill(place);
 await assert.rejects(adapter.loadPollingPlaces('2026-local-general-election-day','65000280003'),/100-row/);
 rows=Array(51).fill({});
 await assert.rejects(adapter.loadCandidateLifecycle('08c553b1-617b-4c32-aef1-a26560edde7d'),/50-row/);
});
