const $=id=>document.getElementById(id);let image='',report='',busy=false,extraction={},imageReviewed=false,extractionModel=null,edited=new Set(),imageRevision=0;
const definitions=[['deviceModel','Device model',['Datascope CS300','Cardiosave','Other']],['pressureSource','Pressure source',['Direct arterial line','Fiber-optic','Other']],['augmentationAlarm','Augmentation alarm',['On','Off / muted']],['augmentationLevel','Augmentation level',['Max','Reduced']],['rhythm','Observed rhythm',['Regular','Irregular','AF confirmed clinically','Not assessable']],['timingSeen','Observed timing',['Looks correct','Early inflation','Late inflation','Early deflation','Late deflation','Not sure']],['balloonWaveform','Balloon / IAB pressure waveform',['Normal plateau','Low / damped','Helium loss','Blood in tubing','Not assessable']],['heartRate','Heart rate (bpm)'],['systolic','Systolic pressure (mmHg)'],['diastolic','Diastolic pressure (mmHg)'],['map','Measured MAP (mmHg)'],['augmentedPressure','Augmented diastolic pressure (mmHg)'],['assistRatio','Assist ratio',['1:1','1:2','1:3']],['balloonVolume','Balloon volume (mL)'],['inflationTiming','Inflation setting (%)'],['deflationTiming','Deflation setting (%)'],['heliumPressure','Helium pressure (psi)'],['mode','Operating mode',['AutoPilot','Auto','Semi-Auto','Manual']],['trigger','Trigger source',['ECG','Pressure','Pacer','Internal']],['unassistedSystolic','Unassisted systolic (mmHg)'],['assistedSystolic','Assisted systolic (mmHg)'],['unassistedEDP','Unassisted end-diastolic (mmHg)'],['assistedEDP','Assisted end-diastolic (mmHg)'],['lactate','Lactate (mmol/L)'],['urineOutput','Urine output (mL/hour)'],['inflationObservation','Inflation observation',['At notch','Before notch','After notch','Not assessable']],['deflationObservation','Deflation observation',['Before ejection','Premature loss of diastolic support','Persists into ejection','Not assessable']]];
function show(id){document.querySelectorAll('article').forEach(x=>x.hidden=x.id!==id);document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x.dataset.tab===id);x.setAttribute('aria-current',x.dataset.tab===id?'page':'false')})}document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>show(x.dataset.tab));
for(const [id,title,options]of definitions){const label=document.createElement('label');label.textContent=title;const input=document.createElement(options?'select':'input');input.id='p-'+id;if(options){const blank=new Option('Not recorded','');input.add(blank);options.forEach(x=>input.add(new Option(x,x)))}else{input.type='number';input.min='0';input.max=id.includes('Timing')?'100':'1000';input.step='any'}label.append(input);$('fields').append(label);input.oninput=()=>{edited.add(id);const field=extraction[id];if(field?.flagged){field.confirmed=false;refreshConfidence(id)}metrics()};const detail=document.createElement('small');detail.id='confidence-'+id;label.append(detail);}
function params(){return Object.fromEntries(definitions.map(([id])=>[id,$('p-'+id).value]))}function metrics(){const p=params();const parts=[];if(p.systolic!==''&&p.diastolic!=='')parts.push('Pulse pressure: '+(Number(p.systolic)-Number(p.diastolic)).toFixed(1)+' mmHg');if(p.augmentedPressure!==''&&p.systolic!=='')parts.push('Augmented minus recorded systolic: '+(Number(p.augmentedPressure)-Number(p.systolic)).toFixed(1)+' mmHg');$('metrics').textContent=parts.join(' · ')}
$('file').onchange=async()=>{const revision=++imageRevision;image='';resetImageReview();$('preview').hidden=true;const file=$('file').files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){$('status').textContent='Choose a JPG, PNG or WebP under 20 MB.';return}try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();if(revision!==imageRevision)return;image=c.toDataURL('image/jpeg',.82);if(image.length>3800000)throw Error('Image remains too large. Try a smaller screenshot.');$('preview').src=image;$('preview').hidden=false;$('status').textContent='Image ready. Check that monitor values remain readable.'}catch(e){if(revision!==imageRevision)return;image='';$('status').textContent=e.message||'Could not read image.'}};
for(const [name, initial] of [['Left',0],['Top',0],['Width',100],['Height',100]]){
 const label=document.createElement('label'), input=document.createElement('input');
 label.textContent=name+' (%)';input.type='number';input.min=0;input.max=100;input.value=initial;input.id='rect-'+name;
 label.append(input);$('redaction-fields').append(label);
}
async function redact(crop){
 if(!image||busy)return;
 const original=image;
 const [left,top,width,height]=['Left','Top','Width','Height'].map(name=>$('rect-'+name).valueAsNumber);
 if(![left,top,width,height].every(Number.isFinite)||left<0||top<0||width<=0||height<=0||left+width>100||top+height>100){notify('Enter a rectangle within the preview.');return}
 try {
  const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(original.split(',')[1]),char=>char.charCodeAt(0))],{type:'image/jpeg'}));
  const x=Math.floor(bitmap.width*left/100),y=Math.floor(bitmap.height*top/100);
  const w=Math.ceil(bitmap.width*(left+width)/100)-x,h=Math.ceil(bitmap.height*(top+height)/100)-y;
  const canvas=document.createElement('canvas');canvas.width=crop?w:bitmap.width;canvas.height=crop?h:bitmap.height;
  const context=canvas.getContext('2d');
  if(crop)context.drawImage(bitmap,x,y,w,h,0,0,w,h);
  else {context.drawImage(bitmap,0,0);context.fillRect(x,y,w,h)}
  bitmap.close();
  if(original!==image||busy)return;
  image=canvas.toDataURL('image/jpeg',.85);imageRevision++;resetImageReview();$('preview').src=image;
  notify('Image updated locally. Review the preview before upload.');
 } catch {notify('The image could not be edited.')}
}
$('crop').onclick=()=>redact(true);$('mask').onclick=()=>redact(false);
function notify(message){$('status').textContent=message;$('status').scrollIntoView({behavior:'smooth',block:'center'});}
function resetImageReview(){
 for(const [id] of definitions){
  if(extraction[id]?.applied&&!edited.has(id))$('p-'+id).value='';
  $('confidence-'+id).replaceChildren();
  $('confidence-'+id).classList.remove('flagged-reading');
 }
 extraction={};extractionModel=null;imageReviewed=false;metrics();
}

function refreshConfidence(id){
 const detail=$('confidence-'+id),field=extraction[id];
 detail.replaceChildren();
 detail.classList.toggle('flagged-reading',field.flagged&&!field.confirmed);
 detail.textContent=field.value===null?'Unavailable':Math.round(field.confidence*100)+'% model confidence';
 if(!field.flagged)return;
 const verify=document.createElement('button');
 verify.type='button';verify.textContent=field.confirmed?'Confirmed':'Confirm current value or blank';
 verify.disabled=field.confirmed;
 verify.onclick=()=>{field.confirmed=true;refreshConfidence(id)};
 detail.append(' · '+field.note+' ',verify);
}

async function run(action,withImage){
 if(busy)return;
 if(withImage&&!image){notify('Upload a monitor image first.');return}
 if(action==='analyze'&&withImage&&!imageReviewed)return run('extract',true);
 if(action==='analyze'&&Object.values(extraction).some(field=>field.flagged&&!field.confirmed)){
  show('parameters');notify('Confirm the flagged readings before generating a report.');return;
 }
 const revision=imageRevision;
 const parameters=params();
 const recorded=definitions.filter(([id,,options])=>parameters[id]!==''&&
  (options?options.includes(parameters[id]):Number.isFinite(Number(parameters[id]))))
  .map(([id,label])=>label+' · '+parameters[id]);
 const buttons=[...document.querySelectorAll('button')].filter(button=>!button.disabled);
 busy=true;buttons.forEach(button=>button.disabled=true);
 $('file').disabled=true;
 notify(action==='extract'?'Extracting values…':'Evaluating entered values…');
 try{
  const response=await fetch('/api/analyze',{method:'POST',
   headers:{'Content-Type':'application/json',...($('access-code').value?{'X-IABP-Access-Code':$('access-code').value}:{})},
   body:JSON.stringify({parameters,image:action==='extract'?image:undefined,action})});
  let data;
  try{data=await response.json()}catch{throw Error(response.status===413?'Image too large. Try a smaller screenshot.':'The server returned an unexpected response.')}
  if(!response.ok)throw Error(data.error||'Request failed.');
  if(action==='extract'){
   if(revision!==imageRevision)return;
   extraction=data.fields;extractionModel=data.model;imageReviewed=true;
   for(const [id] of definitions){
    const input=$('p-'+id),value=data.parameters[id];
    if(value&&(!input.value||input.value===value||confirm('Replace existing '+id+' with extracted value '+value+'?'))){
     if(input.tagName==='SELECT'&&![...input.options].some(option=>option.value===value))input.add(new Option(value,value));
     input.value=value;extraction[id].applied=true;edited.delete(id);
    }else if(input.value){edited.add(id)}
    refreshConfidence(id);
   }
   metrics();show('parameters');notify('Values extracted. Verify each value against the image.');
  }else{
   const userEdited=definitions.filter(([id])=>edited.has(id)).map(([,label])=>label);
   const lowConfidence=definitions.filter(([id])=>extraction[id]?.flagged).map(([,label])=>label);
   const provenance=[
    'UTC timestamp: '+new Date().toISOString(),
    'Extraction model: '+(extractionModel||'none'),
    data.footer,
    'Clinician-entered or edited fields: '+(userEdited.join(', ')||'none'),
    'Flagged extraction fields: '+(lowConfidence.join(', ')||'none')
   ];
   const active=data.findings.filter(finding=>finding.status==='finding');
   const findings=[...active.filter(f=>f.severity==='urgent'),...active.filter(f=>f.severity!=='urgent')];
   const remaining=data.findings.filter(finding=>finding.status==='not assessable');
   report=['IABP bedside review','Decision support only. Verify at bedside. This app does not control the pump.',
    ...findings.map(f=>'- '+findingText(f)),
    remaining.length?'Not assessable: '+remaining.map(f=>f.id).join(', '):'',
    ...recorded.map(value=>'- '+value),
    ...provenance].filter(Boolean).join('\n');
   renderReport(findings,remaining,recorded,provenance);
   show('report');notify('Report generated. Verify readings and findings at the bedside.');
  }
 }catch(error){notify(error.message||'Unable to complete analysis.')}
 finally{
  busy=false;$('file').disabled=false;buttons.forEach(button=>button.disabled=false);
  $('download').disabled=!report;
 }
}

$('full').onclick=()=>run('analyze',true);$('extract').onclick=()=>run('extract',true);$('form').onsubmit=e=>{e.preventDefault();run('analyze',false)};$('regen').onclick=()=>run('analyze',false);$('print').onclick=()=>window.print();$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([report],{type:'text/markdown'}));const a=document.createElement('a');a.href=url;a.download='iabp-analysis.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('clear').onclick=()=>{if(confirm('Clear this session, including image, report and checklist?'))location.reload()};
const groups={'Initial setup':['Confirm AC power, battery backup and helium supply.','Verify ECG signal, trigger source, arterial line and transducer zero.','Confirm catheter position and balloon size using device instructions and local protocol.','Verify prescribed assist ratio and assess inflation/deflation against waveforms.'],'Hemodynamics & hourly monitoring':['Review BP, measured MAP, rhythm and waveform quality.','Assess bilateral limb pulses, temperature, colour, capillary refill and motor/sensory function.','Assess urine output, lactate trend and other perfusion indicators.','Check insertion site, dressing, tubing, alarms and all connections.'],'Critical alerts':['Blood in helium tubing: suspected balloon rupture; urgently follow manufacturer emergency protocol and notify the treating team.','New limb ischemia, sudden deterioration or equipment failure: urgent bedside escalation.','Review suspected early inflation or late deflation with a trained IABP clinician.','Avoid prolonged balloon inactivity; follow the manufacturer’s instructions.'],'Timing review':['Inflation should align with aortic valve closure/dicrotic notch.','Deflation should precede systolic ejection; compare assisted and unassisted waveforms when appropriate.','Do not judge timing from console percentages alone.'],'Weaning review':['Treating team confirms hemodynamic stability, recovery and perfusion.','Review vasoactive support, ischemia, rhythm and relevant cardiac assessment.','Use the team’s device-specific reduction and removal protocol.','Monitor for deterioration during any change; escalate promptly.'],'Troubleshooting & documentation':['Poor augmentation: assess timing, rhythm, position, helium supply and catheter/tubing integrity.','Poor triggering: assess signal quality, lead selection and device-specific trigger options.','Document settings, vitals, waveform findings, vascular assessment, alarms and interventions.','Assess contraindications and complications with the treating team before IABP decisions.']};for(const [title,items]of Object.entries(groups)){const d=document.createElement('details');const s=document.createElement('summary');s.textContent=title;d.append(s);for(const text of items){const l=document.createElement('label');const c=document.createElement('input');c.type='checkbox';l.append(c,document.createTextNode(text));d.append(l)}$('checklists').append(d)}

$('guided-run').onclick=()=>run('analyze',false);
$('guided-image').onclick=()=>run('analyze',true);
$('guided-extract').onclick=()=>run('extract',true);
let kb;
async function loadKnowledge(){try{const response=await fetch('/knowledge/iabp.json');if(!response.ok)throw Error();kb=await response.json();renderKnowledge();renderLesson(0);}catch{$('knowledge-results').textContent='Knowledge could not load. Refresh to retry.';}}
function renderKnowledge(){if(!kb)return;const q=$('knowledge-query').value.toLowerCase();const host=$('knowledge-results');host.replaceChildren();for(const c of kb.chunks.filter(c=>(c.title+' '+c.text).toLowerCase().includes(q))){const d=document.createElement('details');const title=document.createElement('summary');title.textContent=c.title;const text=document.createElement('p');text.textContent=c.text;const source=document.createElement('a');const ref=kb.sources.find(s=>s.id===c.source);if(ref.url)source.href=ref.url;source.target='_blank';source.rel='noopener';source.textContent=ref.title+' · p./section '+c.pages;d.append(title,text,source);host.append(d);}}
$('knowledge-query').oninput=renderKnowledge;
const answers=['Inflate in diastole and deflate before ejection','Use current evidence and the treating team','Verify position and trigger quality','Compare inflation onset with the dicrotic notch','Inspect deflation relative to ejection','Assess organ perfusion as well as pressures','Escalate acute ischemia or suspected rupture','Use an individualized team weaning protocol'];
let completed=new Set();
function renderLesson(i){const c=kb.chunks[i];$('lesson-title').textContent=(i+1)+' / 8 — '+c.title;$('lesson-text').textContent=c.text;$('lesson-source').textContent=c.source+' · '+c.pages;$('lesson-progress').textContent=completed.size+' of 8 checks completed (session only)';const host=$('lesson-actions');host.replaceChildren();for(const [label,correct] of [[answers[i],true],['Decide solely from augmentation pressure',false]]){const b=document.createElement('button');b.textContent=label;b.className='secondary';b.onclick=()=>{if(correct)completed.add(i);$('lesson-feedback').textContent=correct?'Correct. '+c.text:'Review this step: a single pressure does not replace the clinical and waveform review.';$('lesson-progress').textContent=completed.size+' of 8 checks completed (session only)';};host.append(b);}const next=document.createElement('button');next.textContent=i===7?'Restart learning flow':'Next step';next.onclick=()=>{$('lesson-feedback').textContent='';renderLesson((i+1)%8);};host.append(next);}
loadKnowledge();

const findingText=f=>f.message+' ['+f.id+' · '+f.source.guideline+' · '+f.source.chunk+' · '+f.source.page+']';
function renderReport(findings,remaining,recorded,provenance){
 const host=$('output');host.replaceChildren();
 for(const finding of findings){
  const item=document.createElement('p');
  item.className=finding.severity==='urgent'?'urgent-finding':'finding';
  item.textContent=(finding.severity==='urgent'?'Urgent bedside concern · ':'')+findingText(finding);
  host.append(item);
 }
 const summary=document.createElement('p');
 summary.textContent=(findings.length?'':'No flagged pattern in the assessable checks. ')+remaining.length+' checks not assessable.';
 host.append(summary);
 if(remaining.length){
  const details=document.createElement('details'),title=document.createElement('summary');
  title.textContent='Checks not assessable';details.append(title);
  for(const finding of remaining){
   const line=document.createElement('p');line.textContent=finding.id+' · '+findingText(finding);details.append(line);
  }
  host.append(details);
 }
 if(recorded.length){
  const heading=document.createElement('h3'),list=document.createElement('ul');
  heading.textContent='Recorded readings and observations';
  for(const value of recorded){
   const item=document.createElement('li');item.textContent=value;list.append(item);
  }
  host.append(heading,list);
 }
 const footer=document.createElement('footer');footer.className='report-provenance';
 for(const entry of provenance){
  const line=document.createElement('p');line.textContent=entry;footer.append(line);
 }
 host.append(footer);
}

$('ask-guideline').onclick=()=>{
 const host=$('guideline-answer');host.replaceChildren();
 const question=$('guideline-question').value;
 const terms=[...new Set(question.toLowerCase().match(/[a-z]{3,}/g)||[])].filter(term=>!['what','how','which','where','when','the','does','should','with','are','and','can','for','from','tell','about','iabp','balloon','pump'].includes(term));
 const ranked=(kb?.chunks||[]).map(chunk=>({chunk,score:terms.filter(term=>(chunk.title+' '+chunk.text).toLowerCase().match(new RegExp('\\b'+term+'\\b'))).length}))
   .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
 if(!ranked.length){host.textContent=kb?'Not covered by the guideline.':'Knowledge could not load.';return}
 for(const {chunk} of ranked){
  const paragraph=document.createElement('p'),source=kb.sources.find(item=>item.id===chunk.source);
  paragraph.textContent=chunk.text+' ['+chunk.id+' · '+source.title+' · '+chunk.pages+']';
  host.append(paragraph);
 }
};
