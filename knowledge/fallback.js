import {buildReport} from './report-format.js';
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
 return {...buildReport(p,'',{imageInterpreted:false}),provider:'local',model:null,analysisMode:'retrieval-rules',fallbackReason:reason,requiresManualEntry:false,imageInterpreted:false,retrieved:chunks,sources:[...knowledge.sources,{id:'AHA',title:'AHA adult resting heart rate reference',url:'https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates'}],knowledgeReviewed:knowledge.reviewed,notice:'Local knowledge retrieval and rule-based report; no LLM or image extraction used. Verify all entered values.'};
}
