import { createHash, timingSafeEqual } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const bodyLimit = 4_400_000;
const imageLimit = 5_000_000;
const signatures = {
  jpeg: bytes => bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
  png: bytes => bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  webp: bytes => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
};

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const record = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

export function validateRequest(req, keys) {
  const type = req.headers?.['content-type'];
  if (type?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Send application/json.');
  }
  if (Number(req.headers['content-length']) > bodyLimit) throw new RequestError(413, 'Request is too large.');
  let body = req.body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > bodyLimit) throw new RequestError(413, 'Request is too large.');
    try { body = JSON.parse(body); } catch { throw new RequestError(400, 'Invalid JSON.'); }
  }
  if (!record(body) || Object.keys(body).some(key => !['action', 'parameters', 'image'].includes(key))) {
    throw new RequestError(400, 'Invalid request fields.');
  }
  if (Buffer.byteLength(JSON.stringify(body)) > bodyLimit) throw new RequestError(413, 'Request is too large.');
  const { action = 'analyze', parameters = {}, image } = body;
  if (!['analyze', 'extract'].includes(action) || !record(parameters) ||
      Object.entries(parameters).some(([key, value]) => !keys.includes(key) ||
        !(value === null || Number.isFinite(value) || (typeof value === 'string' && value.length <= 100)))) {
    throw new RequestError(400, 'Invalid action or parameters.');
  }
  if (image !== undefined) {
    const match = typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match) throw new RequestError(400, 'Use a base64 JPEG, PNG or WebP image.');
    const [, format, encoded] = match;
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > imageLimit) throw new RequestError(413, 'Decoded image is too large.');
    if (bytes.toString('base64') !== encoded || !signatures[format](bytes)) {
      throw new RequestError(400, 'Image data does not match its declared format.');
    }
  }
  if (action === 'extract' && !image) throw new RequestError(400, 'Upload an image first.');
  if (!image && !Object.values(parameters).some(value => value !== null && String(value).trim())) {
    throw new RequestError(400, 'Enter a value or upload an image.');
  }
  return { action, parameters, image };
}

const digest = value => createHash('sha256').update(value).digest();

export function checkAccess(req) {
  const expected = process.env.IABP_ACCESS_CODE;
  const provided = req.headers?.['x-iabp-access-code'];
  if (expected && (typeof provided !== 'string' || !timingSafeEqual(digest(expected), digest(provided)))) {
    throw new RequestError(401, 'A valid access code is required.');
  }
}

const counters = new Map();
const quotaScript = `
for i = 1, 2 do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i = 1, 2 do
  if redis.call('INCR', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], ARGV[i + 2]) end
end
return 1`;

export async function reserveRequest(req) {
  const now = Date.now();
  const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const ip = production ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  const identifier = digest(typeof ip === 'string' ? ip : 'unknown').toString('hex');
  const keys = ['iabp:{quota}:minute:' + Math.floor(now / 60000) + ':' + identifier,
    'iabp:{quota}:day:' + new Date(now).toISOString().slice(0, 10)];
  const limits = [Number(process.env.IABP_IP_PER_MINUTE ?? 10), Number(process.env.IABP_DAILY_CAP ?? 200)];
  if (limits.some(value => !Number.isSafeInteger(value) || value < 1)) throw Error('Quota configuration');
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  let allowed;
  if (url && token) {
    const response = await fetch(url, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(['EVAL', quotaScript, 2, ...keys, ...limits, 60, 86400]),
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw Error('Quota service unavailable');
    const { result } = await response.json();
    if (result !== 0 && result !== 1) throw Error('Quota service unavailable');
    allowed = result === 1;
  } else {
    if (production || url || token) throw Error('Quota configuration');
    for (const [key, counter] of counters) if (counter.expires <= now) counters.delete(key);
    const entries = keys.map((key, index) => counters.get(key) ?? {
      count: 0, expires: (Math.floor(now / [60000, 86400000][index]) + 1) * [60000, 86400000][index]
    });
    allowed = entries.every((entry, index) => entry.count < limits[index]);
    if (allowed) entries.forEach((entry, index) => {
      entry.count++;
      counters.set(keys[index], entry);
    });
  }
  if (!allowed) throw new RequestError(429, 'Request limit reached. Try later.');
}

export function configuredModel(value = 'claude-haiku-5-5') {
  if (!['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'].includes(value)) {
    throw Error('Model configuration');
  }
  return value;
}

export async function anthropicMessage(apiKey, payload, { timeout = 24000, backoff = 350 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout)
    });
    if (response.ok) return response.json();
    await response.body?.cancel();
    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await delay(backoff);
      continue;
    }
    throw new RequestError(response.status === 429 ? 429 : 502, 'Analysis temporarily unavailable. Try later.');
  }
}
