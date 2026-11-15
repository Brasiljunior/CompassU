import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompleteAssessmentResponses } from '../lib/institutionalCompleteResponses.mjs';

test('formats every question and answer in question order', () => {
 const questions=[
  {id:'q2',question_number:2,question_text:'Second question?'},
  {id:'q1',question_number:1,question_text:'First question?'},
 ];
 const responses=[
  {question_id:'q2',response_value:{value:4}},
  {question_id:'q1',response_value:{value:2}},
 ];
 const text=formatCompleteAssessmentResponses({questions,responses});
 assert.ok(text.indexOf('Question 1:')<text.indexOf('Question 2:'));
 assert.match(text,/Response: \{"value":2\}/);
 assert.match(text,/Response: \{"value":4\}/);
});
test('refuses incomplete or duplicate response sets',()=>{
 const questions=[
  {id:'q1',question_number:1,question_text:'First?'},
  {id:'q2',question_number:2,question_text:'Second?'},
 ];
 assert.throws(()=>formatCompleteAssessmentResponses({questions,
  responses:[{question_id:'q1',response_value:{value:1}}]}),/Incomplete/);
 assert.throws(()=>formatCompleteAssessmentResponses({questions,
  responses:[{question_id:'q1',response_value:{value:1}},
   {question_id:'q1',response_value:{value:2}}]}),/duplicate/);
});
test('refuses missing response content',()=>{
 assert.throws(()=>formatCompleteAssessmentResponses({
  questions:[{id:'q1',question_number:1,question_text:'First?'}],
  responses:[{question_id:'q1',response_value:{}}],
 }),/Missing assessment response/);
});
