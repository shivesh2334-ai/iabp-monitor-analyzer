# IABP knowledge maintenance

The supplied IABP.pdf is Krishna and Zacharowski (2009), DOI 10.1093/bjaceaccp/mkn051. The curated chunks in iabp.json preserve its clinical topics and page/figure references. They are paraphrased knowledge, not the full PDF or a validated assessment algorithm. The eight-step workflow is an educational adaptation of the article structure.

Server-side lexical retrieval ranks these curated chunks, then supplies all ten for this small corpus to the model with source IDs and page references. This is local retrieval-augmented generation, with no vector service or added credentials. The UI can search and teach the same corpus without an LLM. Getinge device guidance and ESC evidence supplement the uploaded article. Manufacturer guidance must match the specific model and software. Review sources before extending clinical recommendations.

Historical shock indications and blanket anticoagulation advice are explicitly qualified. Evidence review date: 2026-11-05. This corpus does not automatically refresh from the web.

Run npm run check and npm test. API tests mock Anthropic and do not establish clinical accuracy or live credential/model availability. The existing ANTHROPIC_API_KEY and ANTHROPIC_MODEL configuration remains unchanged.


Local fallback: fallback.js retrieves cited chunks and renders deterministic findings from entered values, without an LLM. Image recognition is unavailable in this mode. API fallback metadata and the UI distinguish it from AI output.
