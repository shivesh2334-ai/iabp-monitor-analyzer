import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReport,wordCount} from '../knowledge/report-format.js';
test('preserves attachment summary and setting-change bullets',()=>{const text='Analysis: HR 94, augmentation 115. Timing uncertain.\n\nSuggested setting changes:\n- Verify ECG and arterial waveform.';assert.equal(formatReport(text),text);});
test('overlong or malformed output stays complete and within 100 words',()=>{for(const text of ['Analysis: '+('word '.repeat(110)),'unstructured answer','Analysis: Fine. Suggested setting changes:']){const result=formatReport(text);assert.ok(wordCount(result)<=100);assert.ok(result.includes('Suggested setting changes:\n-'));assert.ok(result.endsWith('evidence.'));}});
