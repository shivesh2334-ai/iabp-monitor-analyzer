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
