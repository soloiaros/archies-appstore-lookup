# AGENTS.md

## What this is

Describe an app in natural language — or name one directly — and get back the apps that match, plus whatever's
actually known about them: metadata, growth signal, chart history. Same interaction model as the YC indexer this
is forked from, retargeted at the App Store, where the data is much less complete and much less honest by default.
This file exists to keep it honest anyway.

The single most important fact about this project: **Apple does not expose downloads, revenue, or MAU anywhere
free.** Every field in this system is tagged `verified`, `estimated`, or `unavailable`, and that tag is a schema
property, not something an agent decides at answer time. If you're adding a field, decide its tier before you
decide its source.

## Scaffold status

This repo is scaffolded end-to-end before any single phase is fully wired. The folders below exist with stub
files and typed interfaces even where the implementation isn't there yet — check for a `TODO(phase-n)` comment
before assuming something is unimplemented vs. just not yet run.

## Architecture, in one sentence

Batch scrape → structured index with provenance → query router → Jev (scoring only, read-only, query-time).
Jev never touches raw scraped data and never writes to the index. It scores pre-computed, pre-tagged records
against a query and returns calibrated probabilities — same job it does in the YC version, just over a different
catalog.

## Folders

```
app/            Next.js routes. Query UI (physics-pile discovery view + direct answer cards for
                factual/comparative queries — these are different interaction shapes, don't force
                one component to do both).
components/     Shared UI. Every answer-rendering component takes a provenance tier as a prop and
                renders it visibly — this is not optional styling, it's the trust mechanism.
data/           Seed lists, category taxonomy, tag set (App Store equivalent of YC's 337 tags),
                snapshot dumps from the batch pipeline.
hooks/          Client-side query state, staleness-triggered refetch, routing state.
lib/            Core logic, framework-agnostic:
  lib/scrape/      RSS chart aggregator, batched Lookup API client, dedup-by-trackId
  lib/pipeline/    Offline jobs: embed, OCR, LLM tag pass, momentum computation
  lib/router/      Query classifier: factual / discovery / comparative
  lib/jev/         Scoring prompt + parallel finalist scoring, structured JSON out
  lib/provenance/  Tier assignment, staleness thresholds, the one place `verified` vs
                   `estimated` vs `unavailable` logic lives
models/         DB schema / ORM models. See "Data model" below before adding a column.
native/         Reserved. Nothing in this fork requires a native binary the way MobileCLIP-on-CoreML
                did for the YC version — CLIP/bge run fine cross-platform here. Keep this folder only
                if a future signal needs it; don't add a hard platform requirement without a reason.
public/         Static assets.
scripts/        Entry points for scheduled jobs — these are what cron/CI actually calls:
  scripts/scrape-seed.ts       Phase 1: chart aggregation → dedup → batched lookup → upsert
  scripts/poll-momentum.ts     Daily: rating count + chart rank snapshot, delta computation
  scripts/tag-pass.ts          Periodic: batched LLM tagging, offline, not query-time
  scripts/embed-pass.ts        Change-triggered: re-embed only apps whose source text/images changed
```

## Data model — the three-tier split

Every app record splits into three groups. Don't add a field without deciding which group it's in first.

| Tier | Examples | Source | Refresh |
|---|---|---|---|
| `verified` | name, description, icon, category, price, current rating avg/count, version history | iTunes Lookup API | weekly (metadata) / daily (rating) |
| `verified` (sourced) | revenue, downloads, funding | manually attached, cited source only (10-K, founder interview, a named report) | never auto-refreshed |
| `estimated` | download range, momentum score | derived: rating-count velocity × heuristic ratio, chart-position delta | daily, alongside momentum poll |
| `unavailable` | anything with no source and no derivation | — | shown as unavailable, never filled with a guess |

Chart data only exists for apps that hit a top-100 list somewhere. An app with no chart history gets
`unavailable` on momentum-from-charts, not a zero and not an inferred rank.

## Pipeline phases (build order)

Build and validate 1–3 fully before touching 4–5. Querying a half-built index hides retrieval bugs behind
data gaps that look like bugs but aren't.

1. **Seed the catalog** — `scripts/scrape-seed.ts`. RSS Marketing Tools feed, overall + per-category
   top-free/paid/grossing, dedup by `trackId`, batched Lookup calls (≤200 IDs/call), idempotent upsert.
   Target: 1000+ unique apps, zero LLM cost.
2. **Schema with provenance baked in** — static metadata and time-series data live in separate tables;
   never flatten a time series into a row that gets overwritten on each poll.
3. **Derived signals** — bge-small on description, CLIP on icon + screenshots, OCR on screenshots,
   batched offline tag pass, momentum poller starts here (needs ≥2 snapshots to produce a delta).
4. **Query router** — classify into factual / discovery / comparative before retrieval fires. Comparative
   queries are a sort over stored momentum, not a semantic search — don't route them through Jev.
5. **Jev integration** — discovery path only: retrieve finalists (vector + tag filter) → one parallel Jev
   scoring call → calibrated probabilities. Factual path formats stored fields directly, no LLM. Comparative
   path is a DB sort, no LLM.
6. **Freshness handling** — factual-lookup hits past the staleness threshold trigger one live single-app
   Lookup call before answering, then write back. A search miss (app not in the seed set) triggers on-demand
   single-app indexing — same mechanism, different trigger, writes a new record instead of refreshing one.
7. **UI** — physics-pile for discovery, direct cards for factual/comparative, provenance tier always visible.
8. **Ops** — retry/backoff on Lookup calls specifically (it rate-limits under bursts), delisted-app handling
   (404 on re-fetch = flag, not crash), monitoring on the daily momentum poller — a silent failure there
   degrades the product's core differentiator without an obvious symptom.

## Hard constraints

- No revenue/download/MAU field is ever populated by inference presented as fact. Estimated fields carry
  their method in the same object as the number.
- Jev is never in the scrape/index path. It reads the index at query time and writes nothing back.
- The daily rating/chart poll and the batch scraper run on the same schedule infrastructure — don't build
  them as two unrelated systems; the poll *is* what produces the momentum data the batch alone can't.
- Don't scrape App Store web pages for metadata. iTunes Lookup API is official, structured, and batchable —
  there's no case here where HTML scraping is the better option.
- Category taxonomy from Apple is coarse (~20 top-level). The re-applied tag set (`data/tags/`) is what
  makes discovery-quality search possible, same role YC's re-applied 337 tags play in the original.

## Key differences from the YC indexer this is forked from

- No CoreML/native platform requirement — the embedding models used here run cross-platform, so `native/`
  stays empty unless a specific future signal needs it.
- The YC dataset is closed (6,241, done). This one isn't — the seed set is chart-appearance-bounded plus an
  explicit add-list, and unindexed apps get pulled in on-demand at query time rather than never appearing.
- YC queries are one shape (find companies like X). This system routes three shapes before retrieval even
  starts, because a comparative or factual query answered via Jev's discovery-scoring path would be both
  slower and worse than just reading the field.

## NOTES.md

Longer version of the momentum-heuristic derivation, the rating-count-to-download ratio assumptions by
category, and the RSS feed endpoint behavior (cap, per-category breadth, rate limits) goes here as the
pipeline gets built out — mirrors how the YC repo's NOTES.md holds the retrieval-pipeline detail that doesn't
belong in this file.
