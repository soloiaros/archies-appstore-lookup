# AGENTS.md

Read this before editing anything in this repo. It governs how you write code here, not what the product does.

## Project

App-lookup tool, natural-language query over App Store apps. Forked in structure from a YC-company indexer;
retargeted data domain, same interaction shape. Next.js/TypeScript. See `BUILD_STEPS.md` for build sequencing —
that file is the plan; this file is the constraints you follow while executing it.

## Non-negotiable invariants

Violating these is a bug regardless of what the task asked for.

- **No inferred revenue/download/MAU value ships without its derivation method in the same object.** If you're
  writing code that produces a number for one of these fields, it must carry a `tier` and, if `estimated`, a
  `method` string. Never return a bare number for these fields.
- **Every DB field has a provenance tier: `verified` | `estimated` | `unavailable`.** Adding a column without
  one is incomplete work, not a follow-up.
- **Jev (`lib/jev/`) is query-time only, read-only, discovery-branch only.** It never receives raw scrape output,
  never writes to the index, and is never called from the factual or comparative router branches. If you find
  yourself importing `lib/jev` outside `lib/router`'s discovery path, stop and reconsider.
- **No HTML scraping of App Store pages, ever.** Metadata comes from iTunes Lookup API only. If a task seems to
  require scraping a page, the correct move is to check whether Lookup API already covers it — it almost always
  does.
- **Batch scraper (`scripts/scrape-seed.ts`) and momentum poller (`scripts/poll-momentum.ts`) share schedule
  infrastructure.** Don't introduce a second, separate scheduling mechanism for one of them.

## File structure — what goes where

```
app/            Routes only. Discovery queries render the physics-pile view; factual/comparative render
                direct answer cards. These are different components — don't unify them to save a file.
components/     Every answer-rendering component takes a provenance tier prop and renders it visibly.
                A component that hides the tier is a bug, not a style choice.
data/           Seed lists, tag taxonomy, snapshot dumps. Generated/fetched data, not hand-authored logic.
hooks/          Client query state, staleness-triggered refetch, router state.
lib/scrape/     RSS aggregator, batched Lookup client, dedup-by-trackId. No LLM calls in this directory.
lib/pipeline/   Offline jobs only: embed, OCR, tag pass, momentum computation. Nothing here runs at
                query time — if a function in this directory is being called from a request handler,
                that's misplaced.
lib/router/     Query classification: factual / discovery / comparative. Heuristics first, LLM fallback
                only for what heuristics miss.
lib/jev/        Scoring only. See invariants above.
lib/provenance/ Tier assignment and staleness-threshold logic. This is the only place tier-decision logic
                should live — don't inline tier logic elsewhere.
models/         Schema/ORM. Static-metadata tables and time-series tables are separate. Never flatten a
                time series into an overwrite-per-poll row.
scripts/        Entry points cron/CI actually invoke. Every script here must be idempotent — re-running
                it twice with no new upstream data must not change output.
native/         Empty by default. Do not add a native/platform-specific dependency without confirming no
                cross-platform option exists first — the prior version of this project had a hard
                platform requirement here for a reason that doesn't apply to this fork.
```

## Conventions

- TypeScript throughout. No `any` on data flowing into or out of `models/`.
- All scheduled scripts (`scripts/*.ts`) must be safe to re-run: idempotent upserts keyed on `trackId`,
  never blind inserts.
- iTunes Lookup calls: batch to ≤200 IDs, implement retry+backoff in the client itself, not at call sites.
- A 404 on re-fetch of a previously-indexed app means delisted, not an error — flag the record, don't throw.
- LLM calls (tag pass, router fallback, Jev scoring) are the only cost-bearing operations in this codebase.
  Any new code path that adds an LLM call should be flagged in the PR description, not silently introduced.
- Test LLM-touching pipeline changes (tag pass especially) against a small subset before wiring to the full
  catalog run.

## Session conventions

These apply to every agent session in this repo, not just the one that introduced them. Derived from
standing instruction, not inferred from code style — do not relax any of these based on what existing
code looks like if existing code predates this file.

### Design: plain first

- No styling, theming, visual polish, animation, or the physics-pile interaction work until core
  functionality — scrape → index → router → Jev → factual answer, end to end — is working.
- Default/unstyled HTML and basic components are the correct state during this phase, not a placeholder
  to improve preemptively.
- Do not add design-system dependencies, custom CSS beyond layout necessity, or motion/animation code
  before that gate passes. If a task looks like it wants visual polish and core functionality isn't
  fully working yet, do the plain version and flag the polish as deferred rather than doing both.

### Commits: Angular convention, undetailed

- Format: `type(scope): subject` — types `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- Scope is the directory touched (`scrape`, `router`, `jev`, `models`, `scripts`, etc.).
- Subject line only. No body. No bullet list of what changed. One line, technical, minimal — resist the
  urge to explain the commit; the diff explains itself.

### Code comments: sparse, one to three words

- Default to no comment.
- When one is warranted — non-obvious "why," not "what" — keep it to one to three words, technical
  English, not a full sentence.
- Do not restate what a line does. Do not leave comments explaining standard language/framework behavior.

### Formatting: verbose line breaks

- Prefer generous whitespace between logical blocks over dense packing, in code and in committed files.
- Applies broadly, not just to the files this session touches — match it when editing adjacent code too.

## Before you open a PR

- If you touched `models/`, confirm every new/changed field has a provenance tier.
- If you touched `lib/router/`, confirm the change doesn't cause a comparative or factual query to reach
  `lib/jev/`.
- If you touched a `scripts/` entry point, confirm it's still idempotent (run it twice, diff the result).
- If you added a scrape source, confirm it's Lookup-API-based, not HTML-scraped.

## What this file is not

This is not the build plan (`BUILD_STEPS.md`) and not the product rationale. If you're deciding *whether*
to build something, that decision was already made elsewhere — this file only governs *how* to build it
correctly once you're doing so.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
