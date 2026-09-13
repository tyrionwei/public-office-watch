import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionIdentityResearchTargets } from './lib/identity-research-holds.mjs';
test('hold affects only exact canonical ID, preserves namesakes and denominators', () => {
 const targets=[{personId:'a',name:'同名'},{personId:'b',name:'同名'}];
 const r=partitionIdentityResearchTargets(targets,[{person_id:'old',canonical_person_id:'a',reason:'證據不足',resume_condition:'公報補證'}]);
 assert.equal(r.totalCount,2);assert.deepEqual(r.eligible,[targets[1]]);
 assert.equal(r.deferred[0].personId,'a');assert.equal(targets.length,2);
});
test('released hold resumes research without erasing history', () => {
 assert.equal(partitionIdentityResearchTargets([{personId:'a'}],[{person_id:'a',released_at:'2026-09-13'}]).eligible.length,1);
});
test('malformed active holds fail closed', () => {
 assert.throws(()=>partitionIdentityResearchTargets([],[{person_id:'a',reason:'missing resume'}]),/Invalid/);
});
