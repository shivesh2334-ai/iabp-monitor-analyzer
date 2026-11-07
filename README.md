# IABP Monitor Analyzer

Vercel web adaptation of IABP-C. Original source is retained under original/.

## Configuration

Set ANTHROPIC_API_KEY as a sensitive Vercel Production environment variable, then redeploy. Optional ANTHROPIC_MODEL overrides the default Claude model. Credentials are read only on the server; no provider selector or key input is exposed in the browser. Request-supplied keys are ignored. Gemini is removed.

## Features

Image upload and compression, AI image analysis, parameter extraction, editable parameters, report generation and download, printing and safety checklists. Use de-identified data; image and parameter requests are sent to Anthropic.

## Deployment

Import into Vercel as Other, root directory, no build command. Static frontend plus Node.js API. Run npm run check for syntax validation.

Default model: `claude-haiku-5-5` for image analysis, extraction and parameter reports. `ANTHROPIC_MODEL` may override this on the server.


## LLM-independent knowledge analysis

The Parameters form has a Local knowledge analysis button. This retrieves curated passages from knowledge/iabp.json and assembles a deterministic report from entered measurements and observations; it is retrieval plus rules, not generative AI. No vector database, external service or API key is required for this mode. It does not read the image, diagnose waveform timing, prove adequate perfusion, or issue numeric pump adjustments.

The API also falls back automatically for missing Anthropic configuration, provider failure, timeout, empty or incomplete output. Responses identify analysisMode=retrieval-rules, provider=local, model=null, fallbackReason, imageInterpreted=false, full retrieved passages and source/page references. Unknown values remain unknown. Image-only requests return MANUAL_ENTRY_REQUIRED; extraction errors never populate fabricated values. Clinicians must verify and manually enter values before local analysis. Existing AI extraction and analysis remain available.

Explicit local request: POST /api/analyze with {"analysisMode":"local","parameters":{"map":"64"}}. Local requests do not call an LLM. Report downloads include the fallback disclosure and retrieved source passages. Knowledge review date remains 2026-11-05; this change adds no new clinical guidelines.

Validation: npm run check and npm test (11 tests, including credential-free routing, source integrity, provider failure, timeout, missing/invalid data, image-only refusal and urgent reported observations). These tests do not establish clinical accuracy.
