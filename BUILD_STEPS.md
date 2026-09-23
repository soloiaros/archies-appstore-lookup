# BUILD_STEPS.md

Execution order for the scaffold in `AGENTS.md`. Sequential. Do not parallelize across steps unless noted.
Producers before consumers: scrape → poll/embed/tag → router → Jev → UI. Cheapest producer first.

## 1. `lib/scrape/` — seed pipeline

- Implement RSS chart aggregator: overall + per-category top-free/paid/grossing.
- Dedup in-memory by `trackId`. Verify ≥1000 unique IDs before proceeding.
- Implement batched Lookup client, ≤200 IDs/call. Retry+backoff at implementation time, not later.
- Run once manually. Inspect raw output for rate limits, null fields, shape mismatches.
- **Gate:** do not proceed to step 2 until raw output has been eyeballed.

## 2. `models/` — schema

- Derive schema from actual step-1 JSON, not from spec.
- Split static-metadata tables from time-series tables. No flattened overwrite-per-poll rows.
- Add provenance tier column (`verified` / `estimated` / `unavailable`) to every table now. Default `verified`.
  Do not defer — retrofitting touches every query.
- Implement `scripts/scrape-seed.ts` as idempotent upsert on `trackId`.
- **Gate:** run upsert twice consecutively. Zero duplicates required.

## 3. `scripts/poll-momentum.ts` — daily poller

- Snapshot rating count + chart rank, timestamped, append-only.
- Start this running now, in background, regardless of downstream progress. Needs ≥2 cycles for first delta.
- Attach monitoring/alerting immediately. Silent failure here degrades core product signal without symptom.
- **Do not sequence this after other steps.** Latency-critical due to 2-cycle minimum.

## 4. `lib/pipeline/` — embeddings + tags

- Implement independently, may parallelize internally: bge-small (description), CLIP (icon+screenshots),
  OCR (screenshots).
- LLM tag pass: test on 50-app subset first. Inspect tag distribution for degeneracy before full run.
  Cost-bearing step — do not fire at full catalog untested.
- `scripts/embed-pass.ts`: hash source content, skip unchanged. Idempotent and change-triggered from first
  implementation, not optimized later.

## 5. Index validation

- Manual vector-search queries against embedded index. Eyeball result plausibility.
- **Gate:** do not write router or Jev integration until this passes by inspection.

## 6. `lib/router/`

- Heuristic-first classifier (keyword/regex: "trend", "growing", "vs", "compare") for
  factual / discovery / comparative split.
- LLM fallback only for cases heuristics miss.
- Test against a written example-query set per branch before connecting to live retrieval.

## 7. `lib/jev/`

- Discovery branch only. No other branch calls this module.
- Retrieval (vector + tag filter) → finalist set → one parallel scoring call → structured JSON
  (probability per finalist).
- Test in isolation: fixed finalist set + fixed query list. Validate before connecting to live retrieval.
- **Constraint:** read-only. No raw scrape data access. No index writes.

## 8. Factual + comparative branches

- Factual: direct field read from stored record, formatted with provenance tier. No LLM call.
- Comparative: DB sort/filter over stored momentum score. No LLM call.
- Low complexity — schema and momentum work from steps 2–3 carries this.

## 9. `hooks/` + `app/` — UI

- Build last. Building earlier against unstable data/routing forces rework.
- Discovery → physics-pile view. Factual/comparative → direct answer cards.
- Provenance tier rendered visibly on every card. Non-optional.

## 10. `lib/provenance/` — freshness + on-demand indexing

- Staleness check on factual-lookup hits: age threshold → single-app live Lookup call → write-back → answer.
- Search-miss path: app not in seed set → single-app scrape+embed+tag → insert → answer. Same mechanism as
  refresh, different trigger (insert vs. update).
- Depends on router + populated index. Last by dependency, not by difficulty.

## Global constraints (apply at every step)

- No inferred revenue/download/MAU value presented without its derivation method attached in the same object.
- Jev never in scrape/index path. Query-time only, read-only.
- iTunes Lookup API only for metadata. No HTML scraping of App Store pages.
- Batch scraper and momentum poller share schedule infra — do not build as separate systems.