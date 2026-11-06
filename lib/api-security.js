import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
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
const quotaPath = 'quota/iabp-v1.json';

// Both counters are reserved by one conditional write across all instances.
export async function reserveHostedQuota(store, identifier, limits, clock = Date.now) {
  const signal = AbortSignal.timeout(4000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = clock();
    const day = Math.floor(now / 86400000);
    const minute = Math.floor(now / 60000);
    const current = await store.read(signal);
    const previous = current?.value;
    if (previous && (!Number.isSafeInteger(previous.day) || !Number.isSafeInteger(previous.minute) ||
        !Number.isSafeInteger(previous.total) || previous.total < 0 ||
        !previous.ips || typeof previous.ips !== 'object' || Array.isArray(previous.ips) ||
        previous.day > day || previous.minute > minute)) throw Error('Invalid quota state');
    const total = previous?.day === day ? previous.total : 0;
    const ips = previous?.minute === minute ? previous.ips : {};
    const count = ips[identifier] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) throw Error('Invalid quota state');
    if (total >= limits[1] || count >= limits[0]) return false;
    if (await store.write({ day, minute, total: total + 1, ips: { ...ips, [identifier]: count + 1 } },
      current?.etag, signal)) return true;
    await delay(20 + Math.random() * 40, undefined, { signal });
  }
  throw Error('Quota contention');
}

async function blobQuota() {
  const { get, put, BlobPreconditionFailedError } = await import('@vercel/blob');
  const options = { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN };
  return {
    async read(abortSignal) {
      const result = await get(quotaPath, { ...options, useCache: false, abortSignal });
      if (!result) return null;
      if (result.statusCode !== 200 || !result.blob.etag) throw Error('Quota read failed');
      return { etag: result.blob.etag, value: await new Response(result.stream).json() };
    },
    async write(value, etag, abortSignal) {
      try {
        await put(quotaPath, JSON.stringify(value), {
          ...options, abortSignal, addRandomSuffix: false, allowOverwrite: Boolean(etag),
          ...(etag ? { ifMatch: etag } : {}), contentType: 'application/json'
        });
        return true;
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) return false;
        // Concurrent creation can fail closed. A later request will read the new blob.
        throw error;
      }
    }
  };
}

export async function reserveRequest(req) {
  const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const ip = production ? req.headers?.['x-vercel-forwarded-for'] : req.socket?.remoteAddress;
  const address = typeof ip === 'string' ? ip : 'unknown';
  const limits = [Number(process.env.IABP_IP_PER_MINUTE ?? 10), Number(process.env.IABP_DAILY_CAP ?? 200)];
  if (limits.some(value => !Number.isSafeInteger(value) || value < 1)) throw Error('Quota configuration');
  let allowed;
  if (production || process.env.BLOB_READ_WRITE_TOKEN) {
    const secret = process.env.IABP_QUOTA_HASH_KEY;
    if (!process.env.BLOB_READ_WRITE_TOKEN || !secret || secret.length < 32) throw Error('Quota configuration');
    const identifier = createHmac('sha256', secret).update(address).digest('hex');
    allowed = await reserveHostedQuota(await blobQuota(), identifier, limits);
  } else {
    const now = Date.now();
    const windows = [60000, 86400000];
    const keys = ['minute:' + Math.floor(now / windows[0]) + ':' + digest(address).toString('hex'),
      'day:' + Math.floor(now / windows[1])];
    for (const [key, counter] of counters) if (counter.expires <= now) counters.delete(key);
    const entries = keys.map((key, index) => counters.get(key) ?? {
      count: 0, expires: (Math.floor(now / windows[index]) + 1) * windows[index]
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
