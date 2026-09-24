# App Store Indexor

Describe an app, or name one, and the matching icons come up, each with how likely it is. The catalog is the US App Store charts: metadata, ratings, and chart ranks from Apple's public feeds, tagged with what is actually known.

Every shown field is `verified`, `estimated`, or `unavailable`. Downloads, revenue, and MAU stay empty unless a cited source or a recorded method is attached. A missing number is shown as unavailable. It is not filled with a guess.

The interaction shape comes from [aayans-yc-indexor](https://github.com/Aayan-DEV/aayans-yc-indexor) (MIT). This tree runs as an ordinary Node website. It does not use that project's Core ML binary. See [NOTICE](NOTICE) for what the license does and does not cover.

## Run

Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Put an [OpenRouter](https://openrouter.ai/docs/guides/community/jev) API key in `.env.local` as `OPENROUTER_API_KEY`. `TYPE_SAFE_KEY` is read if that variable is unset. The key is sent as a bearer token to `https://openrouter.ai/api/v1/systemone` with model `jev-latest`. Without a key the page still loads and a discovery query still retrieves finalists, but nothing is scored and no percentage is invented.

`.env.local` is gitignored.

The first server start loads the text embedding models. Later searches reuse them.

## What a query does

A query is classified before anything is retrieved.

| Shape | When | What you get |
| --- | --- | --- |
| Factual | A short name, or a question that starts like "what" or "rating" | One app's stored fields, each with a provenance tier. No language model. |
| Comparative | Words like "vs", "compare", "faster", "growing" | A list sorted by stored momentum. Momentum stays unavailable until two daily rating snapshots exist. |
| Discovery | Anything else ("minimalist habit tracker", "green owl icon") | Icons that Jev scores at 30% or above, with that percentage beside each one. |

Discovery does not send the whole catalog to Jev.

1. The server holds every app's description vector, icon vector, colors, and any letters read off the icon in memory.
2. The query is embedded locally. The closest apps by description (bge-small), by icon (SigLIP2), by name, by tags, and by words are merged into one shortlist of at most 120.
3. That shortlist is one Jev request. Jev returns a probability per app. Apps under 30% stay off the pile.
4. If the best probability is under 65%, one extra request can add apps that share tags with the first hits.

Color text is included in the Jev payload when the query names a color. Letters read off the icon are included when the query is about writing on the icon.

A factual lookup of a stale record refreshes that one app through the iTunes Lookup API. A name that is not in the catalog can be indexed the same way, one app at a time. Chart data is never scraped from App Store HTML.

## Build the catalog

The committed tree does not contain `data/catalog.sqlite`. You build it locally. The scripts are idempotent: running one twice with no new upstream data does not insert duplicates.

```bash
npm run scrape:seed
npm run embed:pass
npm run poll:momentum
```

`scrape:seed` reads the US top charts (overall and per category, free, paid, and grossing), deduplicates track ids, and batch-looks them up. Overall top-grossing uses a legacy iTunes RSS feed because the Marketing Tools URL for that chart returns 404. The endpoint, the reason, and the field-shape parity are in [NOTES.md](NOTES.md).

`embed:pass` writes description embeddings, SigLIP2 icon embeddings, a pixel color summary, and Tesseract text from each icon. An icon is skipped only when both the source hash and the model id already match, so changing the model re-embeds it. Re-running with no changes is a no-op.

`poll:momentum` runs the same refresh and appends that day's rating and chart rows. Momentum needs two of those days. One snapshot stays unavailable.

`tag:pass` does not call an API. Tags for a 50-app subset live in `data/tags/` and were assigned offline against `data/tags/tags.json`. The tag channel is thin outside that subset.

Check retrieval without the website:

```bash
npm run validate:index
npm run test:jev
npm run typecheck
```

`validate:index` writes `data/validation/index-check.json` with top hits and the embed and Jev timings. It spends OpenRouter credit.

## Schedule

One daily job runs `npm run poll:momentum`. It is the same command in [`.github/workflows/daily.yml`](.github/workflows/daily.yml) (03:15 UTC) and in [`schedule/crontab`](schedule/crontab) (06:15 local). The GitHub runner keeps its sqlite copy in the Actions cache. That file is not the catalog on your machine.

## Layout

```
app/            Routes. Discovery, factual, and comparative render separately.
components/     The search scene. Provenance stays visible on every answer.
lib/scrape/     RSS aggregation and the batched Lookup client. No model calls.
lib/pipeline/   Offline embed, color, and icon OCR.
lib/retrieve/   The in-memory shortlist.
lib/router/     Factual, comparative, and discovery. Only discovery calls Jev.
lib/jev/        The OpenRouter scoring client. Read-only. Query time only.
lib/provenance/ Tier and staleness rules.
models/         sqlite schema. Static metadata and time series are separate tables.
scripts/        Idempotent entry points for seed, poll, embed, and checks.
data/           Taxonomy, tags, and validation queries. The sqlite catalog is gitignored.
```

`AGENTS.md` is the constraint file for people changing the code. `NOTES.md` is the feed and momentum detail that does not belong in this page.

## License

Source code is [MIT](LICENSE). Copyright (c) 2026 soloiaros.

The project is derived from Aayan Ali's MIT-licensed [aayans-yc-indexor](https://github.com/Aayan-DEV/aayans-yc-indexor). Upstream copyright stays with that code. Apple's catalog data, the embedding weights, Tesseract, and Jev are not covered by this license. Read [NOTICE](NOTICE) before you redistribute a built database or a model cache.
