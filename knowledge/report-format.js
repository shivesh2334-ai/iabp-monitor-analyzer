// Preserve complete clinical statements rather than truncating at word 100.
export const wordCount=text=>String(text).trim().split(/\s+/).filter(Boolean).length;
export function formatReport(text){
 const clean=String(text).replace(/\*\*/g,'').trim();
 const marker='Suggested setting changes:';
 if(clean.startsWith('Analysis:') && clean.indexOf(marker)>9 && /^\s*[-•]\s+\S/m.test(clean.split(marker)[1]||'') && wordCount(clean)<=100)return clean;
 return 'Analysis: A reliable concise patient-specific interpretation was not returned. Verify readings, settings, ECG and arterial waveform at bedside; timing and perfusion remain unconfirmed.\n\nSuggested setting changes:\n- Request trained bedside review of trigger quality, inflation/deflation, augmentation and alarms.\n- Escalate deterioration or blood in helium tubing immediately; follow the device emergency protocol.\n- Use the treating team and manufacturer instructions for adjustments; retry with clearer evidence.';
}
