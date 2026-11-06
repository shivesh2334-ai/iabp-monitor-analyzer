import { evaluate, ruleset } from '../knowledge/evaluate.js';
import { extractMonitor, extractionModels } from '../lib/extraction.js';
import { randomUUID } from 'node:crypto';
import { RequestError, validateRequest, checkAccess, reserveRequest } from '../lib/api-security.js';
import { knowledge } from "../knowledge/iabp.js";
const keys=['heartRate','systolic','diastolic','map','augmentedPressure','assistRatio','balloonVolume','inflationTiming','deflationTiming','heliumPressure','mode','trigger','unassistedSystolic','assistedSystolic','unassistedEDP','assistedEDP','lactate','urineOutput','inflationObservation','deflationObservation','clinicalContext','deviceModel','pressureSource','augmentationAlarm','augmentationLevel','rhythm','timingSeen','balloonWaveform'];
export default async function handler(req,res){
 const requestId = randomUUID();
 const started = Date.now();
 let status = 200;
 let model;
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Request-ID', requestId);
 try {
 if(req.method!=='POST') {
   res.setHeader('Allow', 'POST');
   throw new RequestError(405, 'Use POST.');
 }
 checkAccess(req);
 const {parameters, image, action} = validateRequest(req, keys);
 const models = image ? extractionModels() : null;
 const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
 if (image && !apiKey) throw new RequestError(503, 'Analysis temporarily unavailable.');
 await reserveRequest(req);
 const clean = Object.fromEntries(keys.map(key => [key, String(parameters[key] ?? '')]));
 let extraction;
 if (image) {
   const [meta, data] = image.split(',');
   const imageBlock = {type:'image', source:{type:'base64', media_type:meta.slice(5,-7), data}};
   model = models.primary;
   extraction = await extractMonitor(apiKey, imageBlock, keys, models, process.env.IABP_CROSS_CHECK === '1');
   model = extraction.model;
   if (action === 'extract') return res.json(extraction);
 }
 // Image reads stay separate until a clinician submits verified parameters.
 const findings = evaluate(clean);
 const active = findings.filter(f => f.status === 'finding').sort((a,b) =>
   Number(b.severity === 'urgent') - Number(a.severity === 'urgent'));
 const lines = active.slice(0, 3).map(f => '- ' + f.message + ' [' + f.id + '; ' + f.source.chunk + ', p./section ' + f.source.page + ']');
 const report = 'Analysis: ' + (extraction ? 'Image readings are pending clinician review. ' : '') +
   findings.filter(f => f.status === 'not assessable').length + ' checks not assessable.' +
   '\n\nSuggested setting changes:\n' + (lines.join('\n') || '- No flagged pattern in the assessable checks.');
 const footer = 'Rules ' + ruleset.version + ' · Guideline corpus ' + knowledge.version;
 return res.json({report: report + '\n\n' + footer, summary: report, footer, findings, extraction, provider: extraction ? 'anthropic' : 'deterministic',
   model, rulesVersion: ruleset.version, guidelineVersion: knowledge.version, sources: knowledge.sources});
 } catch (error) {
   status = error instanceof RequestError ? error.status : error.name === 'TimeoutError' ? 504 : 503;
   return res.status(status).json({error: error instanceof RequestError ? error.message : 'Analysis temporarily unavailable. Try later.'});
 } finally {
   console.info(JSON.stringify({requestId, model, latency: Date.now() - started, status, rulesVersion: ruleset.version, guidelineVersion: knowledge.version}));
 }
}
