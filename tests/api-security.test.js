import test from 'node:test';
import assert from 'node:assert/strict';
import { anthropicMessage, checkAccess, configuredModel, reserveRequest, validateRequest } from '../lib/api-security.js';

const json = body => ({ headers: { 'content-type': 'application/json' }, body });
const check = body => validateRequest(json(body), ['map']);

test('request schema rejects invalid JSON, nested values, injected configuration and non-images', () => {
  for (const body of ['{', { parameters: { map: {} } }, { model: 'other' },
    { image: 'data:image/png;base64,AAAA' }, { image: 'data:image/gif;base64,AAAA' }]) {
    assert.throws(() => check(body), { status: 400 });
  }
  assert.throws(() => validateRequest({}, []), { status: 415 });
  assert.throws(() => check({ image: 'a'.repeat(4_400_001) }), { status: 413 });
  assert.equal(check({ parameters: { map: 80 } }).parameters.map, 80);
  assert.throws(() => configuredModel('other'));
});

test('shared access code is optional and checked server-side when configured', () => {
  checkAccess({});
  process.env.IABP_ACCESS_CODE = 'test-only';
  try {
    assert.throws(() => checkAccess({}), { status: 401 });
    checkAccess({ headers: { 'x-iabp-access-code': 'test-only' } });
  } finally {
    delete process.env.IABP_ACCESS_CODE;
  }
});

test('local IP and global caps apply independently', async () => {
  process.env.IABP_IP_PER_MINUTE = '1';
  process.env.IABP_DAILY_CAP = '2';
  const client = remoteAddress => ({ socket: { remoteAddress } });
  try {
    await reserveRequest(client('192.0.2.1'));
    await assert.rejects(reserveRequest(client('192.0.2.1')), { status: 429 });
    await reserveRequest(client('192.0.2.2'));
    await assert.rejects(reserveRequest(client('192.0.2.3')), { status: 429 });
  } finally {
    delete process.env.IABP_IP_PER_MINUTE;
    delete process.env.IABP_DAILY_CAP;
  }
});

test('Anthropic retries transient errors once and propagates timeout', async t => {
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => ++attempts === 1 ?
    new Response(null, { status: 503 }) : Response.json({ content: [] }));
  assert.deepEqual(await anthropicMessage('test', {}, { backoff: 0 }), { content: [] });
  assert.equal(attempts, 2);
  globalThis.fetch.mock.mockImplementation(async (_url, { signal }) => {
    await new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Error('deadline was not enforced')), 100);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    });
  });
  await assert.rejects(anthropicMessage('test', {}, { timeout: 5 }), { name: 'TimeoutError' });
});
