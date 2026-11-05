import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReport,wordCount} from '../knowledge/report-format.js';
test('preserves a concise five-section report',()=>{const text='Settings: ECG, 1:1.\nReadings: HR 94.\nProblems: Timing uncertain.\nSuggested actions: Verify waveform.\nLimitations: Single image.';assert.equal(formatReport(text),text);});
test('overlong or malformed output receives a complete safe report under 100 words',()=>{for(const text of ['Settings: '+('word '.repeat(110)),'unstructured answer']){const result=formatReport(text);assert.ok(wordCount(result)<=100);assert.ok(result.includes('Suggested actions:'));assert.ok(result.endsWith('waveform.'));}});
