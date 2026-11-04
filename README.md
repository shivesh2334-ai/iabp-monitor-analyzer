# IABP Monitor Analyzer

Vercel-ready web adaptation of shivesh2334-ai/IABP-C. Original source is preserved under `original/`; the original repository is unchanged.

## Features

Responsive four-tab workspace, monitor image preview/compression, AI parameter extraction, editable manual parameters, derived pressure metrics, comprehensive AI reports, Markdown download, printing, session reset and bedside checklists.

## Deploy

Import this repository into Vercel. Framework: Other. Root: repository root. No install/build command or output directory is required. The frontend is static HTML/CSS/JavaScript; `api/analyze.js` is a Node.js serverless function.

Each user supplies an Anthropic API key in the app. No shared server key is configured. Keys, images, parameters and reports are not written to application storage. Requests transmit image and parameter data to Anthropic via the Vercel function. Use de-identified images. Provider/platform retention policies still apply. Optional `ANTHROPIC_MODEL` overrides the source application's model (`claude-sonnet-4-20250514`).

## Changes from Streamlit

Streamlit needs a persistent server and is replaced with a static frontend and request-based API. Original file picker advertised PDF but attempted to decode it as a raster image; the web app explicitly accepts JPEG/PNG/WebP. Export a PDF page to an image first. Original unsafe fixed timing percentages and pump-off trial instructions are replaced with bedside waveform assessment and manufacturer/local protocols. No automatic clinical device changes occur.

## Verification

`npm run check` checks JavaScript syntax. API validation and mocked-provider flow checks cover method rejection, missing keys, missing image, invalid uploads, extraction and report responses. Live paid AI analysis requires a valid user API key and has not been verified. This application has not undergone clinical validation.

## Additional free-tier provider

Select Google Gemini in the application and enter a Google AI Studio API key. Gemini 3.5 Flash-Lite supports image analysis, parameter extraction and text reports. Requests use the official Google generateContent API directly from the Vercel Node function; no extra runtime dependency is required. Optional Vercel environment variable `GEMINI_MODEL` overrides the default model. API keys remain request-scoped and are never committed, logged or persisted by this application.

Free usage depends on Google's project eligibility and quotas. The app cannot determine billing status; a billed project can incur charges. Quota errors do not trigger automatic paid-provider fallback. Google states free-tier content is used to improve products: use only de-identified or synthetic inputs. The provider selector clears the previous key, and reports identify the provider/model used. No Gemini key is provisioned by this update. Live inference requires the user's own key.

References checked 4 November 2026: https://aistudio.google.com/docs/pricing and https://aistudio.google.com/docs/models/gemini-3.5-flash-lite

## Vercel server-side Gemini key

Set sensitive environment variable `GEMINI_API_KEY` for Production and redeploy. A blank Gemini key field uses this server-side key; an entered key overrides it for that request. The server key is never returned to the browser. Anthropic still requires a supplied key. This public endpoint can consume the configured key quota: apply provider quota/budget limits appropriate to your deployment.
