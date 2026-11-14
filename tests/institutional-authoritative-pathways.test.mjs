import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAuthoritativePathways} from '../lib/institutionalAuthoritativePathways.mjs';
function fixture({owner='student-1',status='completed',completedAt='2026-11-14T12:00:00Z',matches=true,careers=true}={}) {
 const data={
  assessment_attempts:[{id:'attempt-1',user_id:owner,status,completed_at:completedAt}],
  major_matches:matches?[{attempt_id:'attempt-1',user_id:owner,major_id:2,rank:1,match_score:93,majors:{name:'Biology',career_cluster:'Science'}}]:[],
  major_occupations:careers?[{major_id:2,relevance_weight:1,occupations:{name:'Biologist',soc_code:'19-1029',median_salary:80000,salary_year:2025,outlook_percent:4}}]:[]
 };
 return {from(table){return {select(){return {async eq(column,value){return {data:data[table].filter(r=>r[column]===value),error:null}}}}}}};
}
const load=(db,studentUserId='student-1')=>loadAuthoritativePathways({db,attemptId:'attempt-1',studentUserId});
test('returns only sourced major and career results',async()=>{
 const r=await load(fixture());
 assert.match(r.recommendedMajors,/Biology/);
 assert.match(r.careerOptions,/Biologist/);
 assert.equal(r.sourceCompletedAt,'2026-11-14T12:00:00Z');
 assert.equal('careerClusters' in r,false);
});
test('rejects wrong owner before reading recommendations',async()=>{
 const queried=[],base=fixture();
 const db={from(table){queried.push(table);return base.from(table)}};
 await assert.rejects(load(db,'other'));
 assert.deepEqual(queried,['assessment_attempts']);
});
test('rejects unfinished assessment',async()=>assert.rejects(load(fixture({status:'in_progress'}))));
test('rejects completed assessment without completion timestamp',async()=>assert.rejects(load(fixture({completedAt:null}))));
test('rejects missing major matches',async()=>assert.rejects(load(fixture({matches:false}))));
test('rejects missing career mappings',async()=>assert.rejects(load(fixture({careers:false}))));
test('rejects matches owned by a different student',async()=>{
 const base=fixture();
 const db={from(table){if(table==='major_matches')return {select(){return {async eq(){return {data:[{user_id:'other',major_id:2,rank:1,match_score:93,majors:{name:'Biology'}}],error:null}}}}};return base.from(table)}};
 await assert.rejects(load(db));
});
