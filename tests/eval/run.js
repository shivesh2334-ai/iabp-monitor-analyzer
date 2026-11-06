import { readdir, readFile } from 'node:fs/promises';
import handler from '../../api/analyze.js';

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('Skipped live extraction evaluation: ANTHROPIC_API_KEY is unset.');
  process.exit(0);
}

const fixtures = new URL('./fixtures/', import.meta.url);
const accuracy = {};
const confusion = [];
for (const file of (await readdir(fixtures)).filter(name => name.endsWith('.json')).sort()) {
  const expected = JSON.parse(await readFile(new URL(file, fixtures), 'utf8'));
  const png = await readFile(new URL(file.replace(/\.json$/, '.png'), fixtures));
  let result;
  const response = { setHeader() {}, status() { return this; }, json(data) { result = data; } };
  await handler({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-iabp-access-code': process.env.IABP_ACCESS_CODE },
    body: { action: 'extract', image: 'data:image/png;base64,' + png.toString('base64') }
  }, response);
  if (!result?.fields) throw Error('Extraction evaluation could not complete for ' + file);
  for (const [field, value] of Object.entries(expected)) {
    const actual = result.fields[field]?.value;
    const score = accuracy[field] ??= { correct: 0, total: 0 };
    score.total++;
    if (actual === value) score.correct++;
    else confusion.push({ fixture: file, field, expected: value, actual });
  }
}
console.log(JSON.stringify({ accuracy, confusion }, null, 2));
if (confusion.length) process.exitCode = 1;
