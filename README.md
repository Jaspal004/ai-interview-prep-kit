# AI Interview Prep Kit

This project turns a pasted job description plus company website into a structured, editable interview preparation kit. It includes a Next.js UI, Express API, shared generation pipeline, MongoDB persistence with local JSON fallback, optional LLM enhancement, and the mandatory batch entry point:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

## Stack

- Frontend: Next.js and Tailwind CSS
- Backend: Node.js and Express
- Persistence: MongoDB when `MONGODB_URI` is set, otherwise local JSON file in `data/db.json`
- LLM: Google Gemini via `GEMINI_API_KEY`, with deterministic fallback when no key is configured
- Generation: deterministic extraction, coverage, and scheduling with optional LLM prose/question enhancement
- Retrieval: built-in `fetch`, same-host crawl, link ranking, retries, robots.txt check

The app prefers MongoDB for deployed or multi-session use. The JSON fallback exists so the reviewer can still run the evaluator and local UI from a clean clone without provisioning any external service.

## Live Deployment

- Frontend: https://ai-interview-prep-kit-og6p-g12mtczdc-jaspal04.vercel.app/
- Backend health: https://ai-interview-prep-kit-tyfw.onrender.com/health

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:4000`

Run tests:

```bash
npm test
```

Run batch evaluation:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

## Environment

- `PORT`: Express API port.
- `SESSION_SECRET`: secret for signed sessions.
- `NEXT_PUBLIC_API_URL`: browser-facing API URL.
- `WEB_ORIGIN`: allowed CORS origin, defaults to `http://localhost:3000`.
- `ALLOW_PRIVATE_NETWORK_FETCH`: allows localhost/private company URLs for evaluation.
- `MAX_CRAWL_PAGES`: crawl budget per company.
- `FETCH_TIMEOUT_MS`: per-request timeout.
- `MONGODB_URI`: MongoDB connection string. If omitted, the app stores data in `data/db.json`.
- `MONGODB_DB`: MongoDB database name.
- `GEMINI_API_KEY`: optional Google Gemini API key for LLM enhancement.
- `GEMINI_MODEL`: Gemini model, defaults to `gemini-1.5-flash`.

## Architecture

The web app and batch command both call `src/pipeline/generateKit`. The pipeline is split into:

- `extract.js`: extracts role title, responsibilities, stable requirement IDs, requirement kind, and must/nice priority from the pasted JD.
- `research.js`: validates URLs, respects robots.txt where retrievable, crawls same-host links, ranks likely about/careers/hiring pages, skips failed sources, and records what was used.
- `generate.js`: creates company brief, category-specific questions, flashcards, and preserves manual or edited items during regeneration.
- `llm.js`: optionally improves brief/question/flashcard wording through Gemini while preserving requirement IDs and falling back on deterministic output if the provider fails.
- `coverage.js`: deterministically checks whether every must-have requirement is covered by question requirement IDs.
- `schedule.js`: deterministically allocates questions across exactly the requested number of days, placing must-have and harder material earlier.
- `validate.js`: validates Appendix A structure and cross-references before saving.

## Retrieval Sources

The crawler starts at the supplied company URL, follows relative links on the same host, and ranks links containing signals such as about, careers, jobs, hiring, interview, process, handbook, engineering, blog, culture, and values. Failed pages are recorded in `research_notes.skipped_sources` instead of failing the whole kit.

Public discussion is a best-effort lookup through accessible no-key sources: Hacker News Algolia and Reddit public search. Glassdoor and similar sources are not scraped because they generally require login, block automated access, or have restrictive terms. If public lookups fail or find nothing relevant, the kit records that honestly in `research_notes.public_discussion` and `research_notes.skipped_sources` rather than fabricating claims.

## Generation Sequence

The sequence is deliberate:

1. Extract role requirements from the pasted JD.
2. Crawl and clean company pages.
3. Generate questions per requirement and category.
4. Check coverage in code.
5. Generate follow-up questions for uncovered must-have requirements.
6. Re-check coverage, up to three passes.
7. Generate flashcards.
8. Optionally call Gemini to improve wording without changing IDs, requirements, coverage, or schedule arithmetic.
9. Allocate the schedule in code.
10. Validate the kit structure and references.

Three coverage passes are enough because each follow-up directly references a missing requirement ID. The cap prevents a bad input or provider failure from looping forever. The LLM is deliberately placed after deterministic coverage so it cannot decide whether must-have requirements are covered.

## Editing and Regeneration State

Questions and flashcards carry extra fields: `state` and `pinned`. Generated items start as `generated`. Inline edits mark an item `edited`, and manually added items are `manual` plus `pinned`. Section regeneration preserves edited, manual, and pinned items, then replaces only generated content for that section.

## Edge Cases

- Invalid or unreachable company URLs: the kit still uses JD-derived content when possible and records skipped sources.
- Missing hiring page: `research_notes.hiring_notes` says none was found.
- Thin job description: the extractor creates a thin kit from the few discoverable signals instead of inventing requirements.
- Invalid generated kit: validation fails before persistence.
- Rate limits and transient fetch/LLM failures: retrieval and Gemini calls retry with backoff, then fall back or record final failure.
- Duplicate submissions: allowed as separate kits so users can experiment.
- 1-day and 60-day schedules: clamped to the supported range and allocated exactly.

## Deployment

Deploy the API and frontend with the same environment variables as above. For a free-tier deployment, run the Express API as one service and Next.js as another, setting `NEXT_PUBLIC_API_URL` to the public API URL, `WEB_ORIGIN` to the frontend URL, and `MONGODB_URI` to a MongoDB Atlas free-tier connection string.

## Known Limitations

LLM enhancement is optional so the evaluator can still run without credentials. Public-discussion search is limited to accessible no-key sources and does not scrape login-gated sites. JSON persistence is a local fallback; use MongoDB for deployment.
