import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport,wordCount} from '../knowledge/report-format.js';
test('three sections preserve data and classify only supported references',()=>{
 const r=buildReport({heartRate:'77',map:'64',mapTarget:'65',augmentedPressure:'111',inflationTiming:'0'});
 assert.ok(r.report.startsWith('1. Parameters observed'));
 assert.ok(r.report.includes('2. Within range and out of range parameters'));
 assert.ok(r.report.includes('3. Opinion based on observation'));
 assert.equal(r.sections.observed.find(r=>r.key==='heartRate').status,'Within reference');
 assert.equal(r.sections.observed.find(r=>r.key==='map').status,'Below supplied target');
 assert.equal(r.sections.observed.find(r=>r.key==='augmentedPressure').status,'Not classifiable');
 assert.equal(r.sections.observed.find(r=>r.key==='inflationTiming').value,'0');
});
test('missing MAP target is not silently assumed, adult reference boundaries are inclusive',()=>{
 for(const value of ['60','100'])assert.equal(buildReport({heartRate:value}).sections.observed[0].status,'Within reference');
 for(const value of ['59','101'])assert.equal(buildReport({heartRate:value}).sections.observed[0].status,'Outside reference');
 assert.equal(buildReport({map:'64'}).sections.observed[0].status,'Not classifiable');
 assert.equal(buildReport({}).sections.observed.length,0);
});
test('complete opinions survive beyond old 100 word restriction and real whitespace is counted',()=>{
 const opinion='detail '.repeat(110)+'Final observation.';assert.ok(buildReport({},opinion).report.includes('Final observation.'));
 assert.equal(wordCount('one two\nthree'),3);
});
