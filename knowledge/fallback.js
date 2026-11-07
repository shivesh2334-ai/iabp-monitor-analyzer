import {knowledge,retrieve} from './iabp.js';
// Retrieval plus deterministic templates: no image interpretation or generative model.
export function localAnalysis(parameters,{reason='manual',imageIgnored=false}={}){
 const p=parameters||{};
 const numeric=k=>{const s=String(p[k]??'').trim();if(!/^\d+(\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)&&n>0&&n<=1000?n:null;};
 const findings=[];const topics=['response','position','deflation'];
 for(const [k,label,unit] of [['heartRate','HR','/min'],['map','measured MAP','mmHg'],['augmentedPressure','augmentation','mmHg']]){const n=numeric(k);if(n!==null)findings.push(`${label} ${n} ${unit}`);}
 const assisted=numeric('assistedSystolic'),unassisted=numeric('unassistedSystolic');
 if(assisted!==null&&unassisted!==null)findings.push(`assisted-minus-unassisted systolic ${(assisted-unassisted).toFixed(1)} mmHg`);
 if(p.inflationObservation||p.deflationObservation||p.timingSeen)topics.push('inflation','deflation','device-timing');
 const urgent=p.balloonWaveform==='Blood in tubing';
 if(urgent)topics.unshift('complications');
 if(p.augmentationAlarm==='Off / muted')topics.push('complications');
 const ranked=retrieve(Object.values(p).join(' '),3);
 const ids=[...new Set([...topics,...ranked.map(c=>c.id)])].slice(0,7);
 const chunks=ids.map(id=>knowledge.chunks.find(c=>c.id===id)).filter(Boolean);
 const opening=findings.length?`Entered values: ${findings.join('; ')}.`:'No valid numeric measurements supplied; review entered observations manually.';
 const report=`Analysis: ${urgent?'Reported blood in helium tubing requires immediate bedside escalation. ':''}${opening} Timing and organ perfusion remain unconfirmed. ${imageIgnored?'Image not interpreted. ':''}[response]\n\nSuggested setting changes:\n- ${urgent?'Follow the device emergency protocol immediately. [complications]':'Verify pressure labels, signal and catheter position. [position]'}\n- Review inflation/deflation on live waveforms; do not change settings from numbers alone. [deflation]`;
 return {report,provider:'local',model:null,analysisMode:'retrieval-rules',fallbackReason:reason,requiresManualEntry:false,imageInterpreted:false,retrieved:chunks,sources:knowledge.sources,knowledgeReviewed:knowledge.reviewed,notice:'Local knowledge retrieval and rule-based report; no LLM or image extraction used. Verify all entered values.'};
}
