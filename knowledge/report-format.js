// Keep reports concise without cutting a clinical sentence or dropping its qualifier.
export const wordCount=text=>String(text).trim().split(/\s+/).filter(Boolean).length;
const headings=['Settings','Readings','Problems','Suggested actions','Limitations'];
export function formatReport(text){
 const clean=String(text).replace(/\*\*/g,'').trim();
 const present=headings.every((h,i)=>{const pos=clean.indexOf(h+':');return pos>=0&&(i===0||pos>clean.indexOf(headings[i-1]+':'));});
 if(present && wordCount(clean)<=100)return clean;
 // A complete conservative fallback is safer than truncating clinical advice mid-sentence.
 return 'Settings: Confirm device, mode, trigger and support ratio at bedside.\n\nReadings: Verify entered or extracted values against the monitor.\n\nProblems: The generated interpretation could not meet the concise report requirements reliably.\n\nSuggested actions: Request bedside review of ECG quality, arterial waveform, inflation/deflation timing, perfusion and alarms. Escalate acute deterioration immediately. Use device instructions and the treating team for setting changes.\n\nLimitations: No reliable patient-specific conclusion is available from this response. Retry analysis or obtain a clearer waveform.';
}
