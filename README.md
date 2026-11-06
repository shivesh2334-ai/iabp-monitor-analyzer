# IABP Monitor Analyzer

Clinician-facing decision support for intra-aortic balloon pump monitor review. Verify readings and findings at the bedside. The application does not control the pump or issue treatment orders.

## Architecture

Vercel serves the static frontend with no build step. The Node endpoint in `api/analyze.js` uses Claude only for monitor transcription. The browser re-encodes images and offers local crop and opaque masking before upload. Clinicians review extracted values before the deterministic evaluator compares submitted values against `knowledge/rules.json`. The knowledge and learning views use local source chunks. The Streamlit implementation lives in `archive/`.

The JSON API accepts `action`, `parameters` and an optional JPEG, PNG or WebP data URL. Use `extract` to get structured readings. With `analyze`, findings come from submitted parameters. If the API caller also supplies an image, extracted values are returned separately for review.

## Configuration

Copy `.env.example` for local use. Set secrets in Vercel for hosted use.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Server-only Claude credential for image extraction |
| `IABP_EXTRACTION_MODEL` | Primary model, defaults to Sonnet 5.5 |
| `IABP_EXTRACTION_FALLBACK_MODEL` | Second model for malformed or uncertain extraction, defaults to Opus 5.5 |
| `IABP_CROSS_CHECK` | Set to 1 for an independent second read |
| `IABP_ACCESS_CODE` | Optional shared code, sent in the `X-IABP-Access-Code` header |
| `IABP_IP_PER_MINUTE` | Fixed-window per-IP request quota, default 10 |
| `IABP_DAILY_CAP` | UTC global daily request cap, default 200 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required hosted quota store credentials. Existing `KV_REST_API_URL` and `KV_REST_API_TOKEN` names are also accepted. |

Configure the hosted quota store before rollout. Missing or unavailable Redis configuration causes the hosted API to fail closed. In-memory quotas are for local use. Quotas count incoming requests. Each extraction can make two reads, with one transient retry per read. Redis quota keys contain hashed IP identifiers and time windows. Application logs contain request ID, model, latency, status and version metadata. Images sent for extraction leave the browser for Vercel and Anthropic. Use de-identified images and confirm redaction before sending. Shared access codes provide a basic access gate and are unsuitable as individual clinician accounts.

JSON bodies are limited to 4.4 MB, which restricts base64 image payloads to roughly 3.3 MB before other fields. The decoded limit is 5 MB. Image validation checks canonical base64 and matching format signatures. Models are chosen server-side from an allowlist.

## Verification and limitations

Run `npm run lint`, `npm run check` and `npm test`. Run `npm run eval` with a configured Anthropic key to evaluate the two synthetic fixtures. Each real evaluation makes billable provider requests. Synthetic fixtures and mocks do not establish clinical accuracy. Model confidence is self-reported. Device-specific rules marked `TODO_VERIFY` need current manufacturer references and clinical review before activation. The guideline lookup returns lexical matches to reviewed passages and does not synthesize answers. Report wording is deterministic and uses no Haiku call.

A future TypeScript migration can start by specifying the shared request, extraction and finding contracts using JSDoc and checking JavaScript in CI. Next, migrate server modules in isolation and verify Vercel preview behavior. Migrate the browser only after approval of any build or delivery change. This update keeps JavaScript.

See [CHANGELOG.md](CHANGELOG.md).
