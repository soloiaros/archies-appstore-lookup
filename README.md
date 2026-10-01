# 10K / App Store Indexor

Natural-language lookup over App Store charts. Describe an app, name one, or ask for a look (“yellow bird icon”, “habit tracker with streaks”) and get matching titles with how likely each one is.

The interaction shape comes from [aayans-yc-indexor](https://github.com/Aayan-DEV/aayans-yc-indexor) (MIT), retargeted at Apple’s public chart and Lookup feeds. This tree is an ordinary Node / Next.js site. It does not ship that project’s Core ML binary. See [NOTICE](NOTICE) for what the license covers.

## Why this exists

App Store research usually means scrolling charts, guessing from screenshots, or paying for a third-party analytics dump. This project turns the public chart + Lookup surface into a local index you can ask in plain English.

- **Description and look.** Text embeddings (BGE) and icon embeddings (SigLIP2) shortlist by meaning and by appearance, not only by keyword.
- **Honest numbers.** Every shown field is `verified`, `estimated`, or `unavailable`. Downloads and MAU stay empty unless a cited source or a recorded method is attached. US store spend / day is estimated from top-grossing ranks with a named method (`us-grossing-power-v1`); everything else that cannot be justified stays unavailable.
- **Cheap scoring.** Discovery never sends the whole catalog to a model. A local shortlist (≤120) goes to Jev once; apps under 30% stay off the results.
- **Your catalog.** The committed tree has no `data/catalog.sqlite`. You build it. Expand the seed, change the country, or add titles on demand.

## How a query works

A query is classified before anything is retrieved.

| Shape | When | What you get |
| --- | --- | --- |
| Factual | A short name, or a question that starts like “what” or “rating” | One app’s stored fields, each with a provenance tier. No language model. |
| Comparative | Words like “vs”, “compare”, “faster”, “growing” | A list sorted by stored momentum. Momentum stays unavailable until two daily rating snapshots exist. |
| Discovery | Anything else (“minimalist habit tracker”, “green owl icon”) | Apps that Jev scores at 30% or above, with that percentage beside each one. |

Discovery path:

1. The server holds every app’s description vector, icon vector, colors, and any letters read off the icon in memory (or, on Cloudflare, in a warm Durable Object).
2. The query is embedded. Closest apps by description (bge-small), by icon (SigLIP2), by name, by tags, and by words are merged into one shortlist of at most 120.
3. That shortlist is one Jev request (`jev-latest` via OpenRouter). Apps under 30% stay off the pile / list.
4. If the best probability is under 65%, one extra request can add apps that share tags with the first hits.

Color text is included in the Jev payload when the query names a color. Letters read off the icon are included when the query is about writing on the icon.

A factual lookup of a stale record can refresh that one app through the iTunes Lookup API. A name that is not in the catalog can be indexed the same way, one app at a time. Chart data is never scraped from App Store HTML.

## Requirements

- Node.js 20.9 or newer
- An [OpenRouter](https://openrouter.ai) key if you want Jev scoring (optional for browsing and factual reads)
- Disk space for `data/catalog.sqlite` plus the first download of BGE / SigLIP / Tesseract assets

## Quick start

```bash
npm install
cp .env.example .env.local
npm run scrape:seed
npm run embed:pass
npm run poll:momentum
npm run atlas
npm run dev
```

Open http://localhost:3000.

In `.env.local`:

```bash
OPENROUTER_API_KEY=          # or TYPE_SAFE_KEY
ITUNES_COUNTRY=us            # chart + Lookup country
```

Without a key the site still loads. Discovery still retrieves finalists, but nothing is scored and no percentage is invented. `.env.local` is gitignored.

The first server start may load text embedding models. Later searches reuse them.

## Build and grow the catalog

Scripts are idempotent: run one twice with no new upstream data and you should not get duplicate rows.

| Command | Role |
| --- | --- |
| `npm run scrape:seed` | Read country charts (overall + per category: free, paid, grossing), dedupe `trackId`, batch Lookup (≤200 ids). |
| `npm run embed:pass` | Description embeddings, SigLIP2 icon embeddings, pixel color summary, Tesseract letters on the icon. Skips unchanged source hash + model id. |
| `npm run poll:momentum` | Refresh metadata and append that day’s rating / chart rows. Also writes `revenue_estimates` from grossing ranks. |
| `npm run estimate:revenue` | Backfill spend estimates without a full poll. |
| `npm run tag:pass` | Tag apps against `data/tags/tags.json` (cost-bearing if wired to an LLM; start on a small subset). |
| `npm run atlas` | Pack a sheet of icons for the desktop physics pile. |

### Chart feeds

Marketing Tools v2 serves overall charts only:

`https://rss.applemarketingtools.com/api/v2/{country}/apps/{top-free|top-paid|top-grossing}/{limit}/apps.json`

`limit` above 100 errors. A category path on that host returns 404. Overall `top-grossing` on Marketing Tools currently 404s, so overall grossing uses the legacy feed:

`https://itunes.apple.com/{country}/rss/topgrossingapplications/limit=100/json`

Per-category free / paid / grossing use the same legacy shape with `genre={genreId}`. Both parsers emit `{ trackId, rank }`. Lookup accepts at most 200 ids per call.

Game subgenres (7001–7019) and some catalog / sticker genres are outside the default top-level seed list. Extend the seed list under `data/` if you want them.

### Expand the pool of apps

1. **Broader charts** — change `ITUNES_COUNTRY`, add genres to the seed list, or raise chart limits where the feed allows, then re-run `scrape:seed` → `embed:pass` → `poll:momentum`.
2. **Known track ids** — upsert extra apps through the same Lookup client used by the seed script (batch ≤200, retry/backoff in the client). Re-run embed for new or changed icons / descriptions.
3. **On-demand miss** — a factual name that is not in the index can be Lookup’d, inserted, and answered one app at a time (same refresh path as staleness).
4. **Tags** — grow `data/tags/tags.json` and run `tag:pass` on a subset before a full pass. Tags feed the discovery shortlist and deepen step.
5. **Atlas** — after icon rows change, run `npm run atlas` so the desktop pile sheet matches the catalog.

A 404 on re-fetch of a previously indexed app means delisted: flag the record, do not treat it as a hard failure.

### Daily refresh

One job should run `npm run poll:momentum`. The repo ships [`.github/workflows/daily.yml`](.github/workflows/daily.yml) and [`schedule/crontab`](schedule/crontab). Momentum needs two daily rating snapshots before a velocity can be non-unavailable.

## Checks

```bash
npm run typecheck
npm run validate:index
npm run test:jev
npm run test:staleness
npm run test:revenue
```

`validate:index` writes `data/validation/index-check.json` and spends OpenRouter credit when Jev is called.

## Project layout

```
app/            Routes. Discovery, factual, and comparative render separately.
components/     Search UI, answer cards, desktop icon pile. Provenance stays visible.
lib/scrape/     RSS aggregation and the batched Lookup client. No model calls.
lib/pipeline/   Offline embed, color, OCR, revenue estimate.
lib/retrieve/   In-memory shortlist for local discovery.
lib/catalog/    Remote / D1 ranking path used when the catalog is not local sqlite.
lib/router/     Factual, comparative, discovery. Only discovery calls Jev.
lib/jev/        OpenRouter scoring client. Read-only. Query time only.
lib/provenance/ Tier and staleness rules.
models/         Schema. Static metadata and time series are separate tables.
scripts/        Idempotent entry points for seed, poll, embed, and checks.
data/           Taxonomy, tags, revenue curve, validation queries. sqlite is gitignored.
```

## Design constraints worth keeping

These are product rules, not style preferences:

- No inferred revenue / download / MAU value without its derivation method on the same object.
- Every DB field that is shown carries a provenance tier: `verified` | `estimated` | `unavailable`.
- Jev is query-time only, read-only, discovery-branch only. It never writes the index.
- Metadata from the iTunes Lookup API and RSS only. No HTML scraping of App Store pages.
- Scheduled scripts share one schedule story; do not invent a second cron system for poll vs seed.
- Offline pipeline work stays in `lib/pipeline/`. Do not call it from a request handler.

## Deploy notes

A Cloudflare Worker build exists (`npm run cf:build` + Wrangler). That path uses D1 for the catalog, Workers AI for BGE query embed, and a container for SigLIP when icon search is enabled. Local `npm run dev` against `data/catalog.sqlite` is the simplest way to reproduce the product. Treat cloud bindings and secrets as your own ops concern; do not commit them.

## License

Source code is [MIT](LICENSE). Copyright (c) 2026 soloiaros.

Derived from Aayan Ali’s MIT-licensed [aayans-yc-indexor](https://github.com/Aayan-DEV/aayans-yc-indexor). Upstream copyright stays with that code. Apple’s catalog data, embedding weights, Tesseract, and Jev are not covered by this license. Read [NOTICE](NOTICE) before you redistribute a built database, model cache, or hosted icons.
