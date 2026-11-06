import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import {retrieve} from '../knowledge/iabp.js';
const invoke=async(body,method='POST')=>{const result={};const res={setHeader(){},status(n){result.status=n;return this},json(data){result.data=data;return this}};await handler({body,method,headers:{'content-type':'application/json'}},res);return result;};
test('knowledge retrieval resolves clinical topics',()=>{assert.equal(retrieve('early inflation dicrotic notch',1)[0].id,'inflation');assert.ok(retrieve('modern evidence').some(x=>x.id==='modern-evidence'));});
test('analysis preserves optional values and injects referenced knowledge',async()=>{process.env.ANTHROPIC_API_KEY='test-only';let payload;const original=global.fetch;global.fetch=async(u,opts)=>{payload=JSON.parse(opts.body);return {ok:true,json:async()=>({content:[{type:'text',text:'Analysis: Lactate supplied; waveform unavailable.\nSuggested setting changes:\n- Verify at bedside.'}]})}};try{const r=await invoke({parameters:{lactate:'3.4'}});assert.ok(r.data.report.startsWith('Analysis:')); assert.ok(r.data.report.split(/\s+/).length<=100);assert.ok(payload.system.includes('modern-evidence'));assert.ok(payload.system.includes('1 physiology'));assert.ok(payload.messages[0].content[0].text.includes('3.4'));assert.equal(r.data.sources.length,3);assert.ok(r.data.retrieved.length>0);}finally{global.fetch=original;}});
test('empty input and extraction without image are rejected',async()=>{assert.equal((await invoke({parameters:{}})).status,400);assert.equal((await invoke({action:'extract'})).status,400);assert.equal((await invoke({},'GET')).status,405);});
test('extraction validates forced tool output and preserves absent values',async t=>{
  t.mock.method(globalThis,'fetch',async (_url,opts)=>{
    const payload=JSON.parse(opts.body);
    const keys=payload.tools[0].input_schema.required;
    const input=Object.fromEntries(keys.map(key=>[key,{value:null,unit:null,confidence:0,legible:false,note:''}]));
    input.heartRate={value:80,unit:'bpm',confidence:0.99,legible:true,note:''};
    return {ok:true,json:async()=>({content:[{type:'tool_use',name:'record_monitor',input}]})};
  });
  const r=await invoke({action:'extract',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='});
  assert.equal(r.data.parameters.heartRate,'80');
  assert.equal(r.data.fields.lactate.value,null);
  assert.equal(r.data.model,'claude-opus-5-5');
});
test('provider failure remains explicit',async()=>{const original=global.fetch;global.fetch=async()=>({ok:false,status:429});try{assert.equal((await invoke({parameters:{map:'65'}})).status,429);}finally{global.fetch=original;}});
