# App Store Indexor

Describe an app, or name one, and get the matches plus what is actually known: metadata, growth, chart history.

Every shown field is `verified`, `estimated`, or `unavailable`. Downloads, revenue, and MAU stay empty unless a cited source or a recorded method is attached.

This tree is a scaffold. Scheduled jobs exit until their phase is wired. See `AGENTS.md` for the build order.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Node 20.9 or newer.

## Jobs

```bash
npm run scrape:seed
npm run poll:momentum
npm run tag:pass
npm run embed:pass
```

`NOTES.md` holds feed limits and the momentum rules that are not in `AGENTS.md`.
