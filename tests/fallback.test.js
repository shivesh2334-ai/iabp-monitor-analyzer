import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import {localAnalysis} from '../knowledge/fallback.js';
import {wordCount} from '../knowledge/report-format.js';
async function call(body){let status=200,data;await handler({method:'POST',body},{setHeader(){},status(n){status=n;return this},json(d){data=d}});return {status,data};}
test('local mode needs no credentials or network and preserves measured MAP',async()=>{
 const fetch=global.fetch,key=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;global.fetch=()=>{throw Error('unexpected network')};
 try{const r=await call({parameters:{map:'64'},analysisMode:'local'});assert.equal(r.status,200);assert.equal(r.data.provider,'local');assert.ok(r.data.sections.observed.some(r=>r.key==='map'&&r.value==='64'));assert.ok(!r.data.report.includes('111'));assert.ok(r.data.retrieved.every(c=>r.data.sources.some(s=>s.id===c.source)));}
 finally{global.fetch=fetch;if(key===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=key;}
});
test('missing credentials automatically fall back; image-only and extraction require manual entry',async()=>{
 const key=process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_API_KEY;
 try{const image='data:image/png;base64,AAAA';assert.equal((await call({parameters:{heartRate:'77'}})).data.fallbackReason,'llm-not-configured');for(const action of ['analyze','extract']){const r=await call({image,action});assert.equal(r.data.requiresManualEntry,true);assert.equal(r.data.parameters,undefined);assert.equal(r.data.report,undefined);}assert.equal((await call({parameters:[]})).status,400);assert.equal((await call({image:'bad'})).status,400);}
 finally{if(key===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=key;}
});
test('timeout and empty LLM output use local report without claiming image interpretation',async()=>{
 const fetch=global.fetch,key=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='test';
 try{for(const result of ['throw','empty']){global.fetch=async()=>{if(result==='throw')throw Error('timeout');return {ok:true,json:async()=>({content:[]})}};const r=await call({parameters:{map:'64'},image:'data:image/png;base64,AAAA'});assert.equal(r.status,200);assert.equal(r.data.imageInterpreted,false);assert.match(r.data.report,/Image not interpreted/);}}
 finally{global.fetch=fetch;if(key===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=key;}
});
test('urgent observation prioritised; timing percentages never diagnose timing',()=>{
 const r=localAnalysis({balloonWaveform:'Blood in tubing',inflationTiming:'0',deflationTiming:'0',map:'64'},{imageIgnored:true});assert.match(r.report,/immediate bedside escalation/);assert.ok(r.retrieved.some(c=>c.id==='complications'));assert.ok(r.report.includes('3. Opinion based on observation'));assert.ok(!r.report.includes('early inflation'));
 const unknown=localAnalysis({map:'<script>',heartRate:'NaN'});assert.ok(unknown.sections.observed.every(r=>r.status==='Not classifiable'));
});
