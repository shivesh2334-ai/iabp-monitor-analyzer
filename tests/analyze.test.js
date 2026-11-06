import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import {retrieve} from '../knowledge/iabp.js';
const invoke=async(body,method='POST')=>{const result={};const res={setHeader(){},status(n){result.status=n;return this},json(data){result.data=data;return this}};await handler({body,method,headers:{'content-type':'application/json'}},res);return result;};
test('knowledge retrieval resolves clinical topics',()=>{assert.equal(retrieve('early inflation dicrotic notch',1)[0].id,'inflation');assert.ok(retrieve('modern evidence').some(x=>x.id==='modern-evidence'));});
test('analysis evaluates submitted values without calling a model',async t=>{
  process.env.ANTHROPIC_API_KEY='test-only';
  const model=t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected model call')});
  const r=await invoke({parameters:{assistedSystolic:'90',unassistedSystolic:'89'}});
  assert.equal(model.mock.callCount(),0);
  assert.match(r.data.report,/ASSISTED-SBP/);
  assert.ok(r.data.findings.some(f=>f.status==='not assessable'));
});
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
test('provider failure remains explicit',async()=>{const original=global.fetch;global.fetch=async()=>({ok:false,status:429});try{assert.equal((await invoke({action:'extract',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='})).status,429);}finally{global.fetch=original;}});

test('malformed extraction falls back once and never returns guessed readings',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({content:[{type:'text',text:'malformed'}]})}));
  const r=await invoke({action:'extract',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='});
  assert.equal(r.status,502);
  assert.equal(mock.mock.callCount(),2);
  assert.equal(r.data.fields,undefined);
});

test('manual reports remain available without hosted quota storage', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected network request'); });
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const r = await invoke({parameters:{map:'65'}});
    assert.equal(r.data.provider,'deterministic');
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test('bedside report preserves measured values and separates displayed from unassisted pressure', async () => {
  const r = await invoke({ parameters: {
    heartRate: '94', systolic: '106', diastolic: '42', map: '80',
    augmentedPressure: '115', trigger: 'ECG', balloonWaveform: 'Blood in tubing'
  } });
  assert.match(r.data.report, /Heart rate 94 bpm/);
  assert.match(r.data.report, /Augmentation minus displayed systolic: 9 mmHg/);
  assert.match(r.data.report, /comparison needs both explicitly labelled values/);
  assert.match(r.data.report, /BLOOD-TUBING/);
  assert.match(r.data.report, /Timing review depends on the dicrotic notch/);
  assert.equal(r.data.sections.length, 3);
});
