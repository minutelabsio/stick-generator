---
status: planned
created: 2026-09-23
updated: 2026-10-02
summary: "Target design for v2. One Worker with Hono API and SPA, D1 for records, R2 for images, Access for auth, batch invite-link intake."
---

# v2 architecture

Requirements baseline: [v1-functionality.md](./v1-functionality.md#what-v2-must-preserve-the-requirements-baseline).

## Goals

- **Small, obvious codebase.** Every file earns its place. No template leftovers.
- **Designers are self-sufficient.** Manage assets and palettes, run a batch end to end,
  export results, with no operator in the loop.
- **Getting follower data in takes no manual work.** Followers submit directly through
  an expiring invite link shared by each batch. There is no Google Form, script, CSV
  wrangling, or R2 upload by hand. See [v2-public-intake.md](./v2-public-intake.md).
- **Safe by default.** The team app sits behind Access, and the only public surface is the
  write-once batch intake. Per-row writes, no lost work, and PII kept private.

## Non-goals

- Follower accounts, or any follower-facing feature beyond the single intake page.
- Server-side rendering of figures. The browser canvas already does this well, and
  Workers have no canvas.
- Print-colour (CMYK) conversion in the app. It stays an offline step. See Phase 6.

## Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Hosting | **One Cloudflare Worker** with [static assets](https://developers.cloudflare.com/workers/static-assets/). SPA fallback, `run_worker_first: ["/api/*"]` | One deployable, one URL, one set of bindings. Replaces Pages + Functions |
| Build | Vite + `@cloudflare/vite-plugin` | Local dev runs the real Worker runtime (miniflare) with local D1/R2 |
| API | **Hono** + **zod** validation | Tiny router with typed bindings. Validators double as API documentation |
| Records | **D1** (SQLite) with numbered SQL migrations | Row-level updates end the whole-group KV rewrite. Queryable progress. Real IDs |
| Images | **R2**, always streamed through the Worker | Buckets stay private. Access control happens in one place |
| Auth | **Cloudflare Access** (existing Zero Trust setup) in front of the Worker. The Worker verifies the `Cf-Access-Jwt-Assertion` JWT. Bypass only for `/join` and `/api/public/*` | Internal team tool: SSO with no user tables. The verified email gives attribution |
| Public intake | Expiring, rotatable batch codes + **Turnstile** + **Workers Rate Limiting** binding + a hard cap per batch | Spam and abuse controls. See [v2-public-intake.md](./v2-public-intake.md#spam-and-abuse-controls) |
| Frontend | Vue 3 + Pinia + PrimeVue (unstyled or themed) *or* Svelte 5 (see open question Q1) | Needs a data table, file upload, colour picker, toasts, and dialogs out of the box |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` for API. Plain Vitest for the renderer's pure logic | Test what can lose data or leak it. Skip the mundane |
| CI/CD | GitHub Actions: lint + typecheck + test on every push. `main` → staging, `v*` tag → production | Repeatable deploys. No `deploy.sh` |
| Package manager | **pnpm** (team standard). Lockfile committed, install scripts allowed only for esbuild and workerd | |
| Observability | `[observability.logs] enabled = true` | Free Workers Logs, and `wrangler tail` works |

Environments: `dev` (local miniflare, seeded), `staging`, `production`. Each has its own
D1 database and R2 buckets. **Mock data comes from a local seed script, never from
hostname sniffing.**

## Repository layout

```
api/                  Worker entry (Hono app), routes/, services/, middleware/
  index.ts
  middleware/access.ts    verifies Access JWT, sets c.var.user
  routes/{groups,entries,assets,palettes,files}.ts
  routes/public.ts        the ONLY router mounted without Access (write-once, batch-code scoped)
shared/               Code imported by both api/ and src/
  figure.ts           FigureConfig zod schema + version migrations
  layers.ts           declarative layer stack (the render order)
src/                  SPA
  lib/render.ts       pure compositor: (config, resolvedAssets, ctx) => void
  views/{Batches,BatchSettings,Queue,Editor,Assets}.vue
join/                 Separate lightweight Vite entry for the public intake page
migrations/           0001_init.sql, …
scripts/              seed-dev.sql, import-v1-assets.ts, migrate-v1.ts
docs/planning/
```

## Data model (D1)

> Channels add a `channels` table and a `channel_id` on `groups`, `assets`, and
> `palettes`, and drop the fixed slot and palette lists. See
> [v2-channels-and-rigs.md](./v2-channels-and-rigs.md#data-model).

```sql
CREATE TABLE groups (
  id          TEXT PRIMARY KEY,           -- uuid
  slug        TEXT NOT NULL UNIQUE,       -- url/R2-safe, derived from name
  name        TEXT NOT NULL,
  source      TEXT NOT NULL,              -- 'intake' | 'manual' | 'v1'
  questions   TEXT,                       -- JSON question list; `highlight` marks what designers see first
  -- + batch intake settings (join_code, window, cap, allowlist, consent, contact): see v2-public-intake.md
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE entries (
  id            TEXT PRIMARY KEY,         -- uuid (v1 ids are kept on migration)
  group_id      TEXT NOT NULL REFERENCES groups(id),
  name          TEXT,
  email         TEXT,
  answers       TEXT NOT NULL DEFAULT '{}',  -- JSON keyed by question id, verbatim
  likeness_key  TEXT,                     -- R2 key, null if no photo yet
  status        TEXT NOT NULL DEFAULT 'new',  -- new | in_progress | done | skipped
  -- + submitted_at, consent_*, duplicate_of, submit_ip_hash: see v2-public-intake.md
  figure        TEXT,                     -- JSON FigureConfig (asset IDs, never URLs)
  version       INTEGER NOT NULL DEFAULT 0,   -- optimistic concurrency
  render_key    TEXT,                     -- R2 key of last saved PNG
  rendered_at   TEXT,
  render_stale  INTEGER NOT NULL DEFAULT 0, -- 1 when a used asset changed after render
  updated_by    TEXT,                     -- Access email
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_entries_group_status ON entries (group_id, status);

CREATE TABLE assets (
  id          TEXT PRIMARY KEY,           -- uuid
  slot        TEXT NOT NULL,              -- body|head|hair|hat|mustache|beard|longbeard|glasses|accessory
  label       TEXT NOT NULL,              -- designer-facing name
  parts       TEXT NOT NULL,              -- JSON: { line, mask?, backLine?, backMask? } → R2 keys
  thumb_key   TEXT,                       -- pre-cropped picker thumbnail
  sort        INTEGER NOT NULL DEFAULT 0,
  revision    INTEGER NOT NULL DEFAULT 1, -- bumped on replace; used for cache-busting + staleness
  archived_at TEXT,                       -- hidden from pickers, still renders old figures
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- batch_allowlist table: see v2-public-intake.md

CREATE TABLE palettes (
  id      TEXT PRIMARY KEY,               -- 'skin' | 'hair' | 'hat' | 'glasses'
  colors  TEXT NOT NULL                   -- JSON array of hex strings, in display order
);
```

Notes:
- **Assets are never hard-deleted** while a figure references them. Archiving hides them
  from pickers. Old figures still render.
- **Replacing** an asset part bumps `revision` and marks `render_stale = 1` on entries
  whose `figure` references it. This is one `UPDATE … WHERE figure LIKE '%"<id>"%'`, or a
  `json_each` query. Designers then see "N renders out of date" and can re-render in bulk.
- `answers` is keyed by question id. If a group's questions are edited later, old
  answers stay readable because unknown keys are shown under "Other answers".

## FigureConfig (shared, versioned)

```ts
// shared/figure.ts
const FigureConfig = z.object({
  v: z.literal(2),
  body: Id.nullable(),
  head: Id.nullable(),                 // v1 always used the first head; v2 makes it pickable
  skin: Color.nullable(),
  hair: z.object({ asset: Id.nullable(), color: Color.nullable() }),
  hat: z.object({ asset: Id.nullable(), color: Color.nullable() }),
  facialHair: z.object({
    mustache: Id.nullable(), beard: Id.nullable(), longbeard: Id.nullable(),
    color: Color.nullable(),
  }),
  glasses: z.object({ asset: Id.nullable(), frame: Color.nullable(), lens: Color.nullable() }),
  accessory: Id.nullable(),
})
```

The API validates it on write. `migrate-v1.ts` converts v1 `stickProps` (URLs) into this
shape by resolving each URL to an imported asset ID.

## Renderer

The render order is **data**, not code. It lives in one shared module:

> Phase 0.5 goes further: slots, layers, colour roles (formerly colour channels), and
> the canvas become a per-channel rig. See [v2-channels-and-rigs.md](./v2-channels-and-rigs.md#the-rig).

```ts
// shared/layers.ts: back to front, same order as v1
export const LAYERS: Layer[] = [
  { slot: 'hat',       part: 'backMask', tint: 'hat.color' },
  { slot: 'hat',       part: 'backLine' },
  { slot: 'hair',      part: 'backMask', tint: 'hair.color' },
  { slot: 'hair',      part: 'backLine' },
  { slot: 'body',      part: 'line' },
  { slot: 'head',      part: 'mask',     tint: 'skin' },
  { slot: 'beard',     part: 'line',     tint: 'facialHair.color' },   // line recoloured
  { slot: 'mustache',  part: 'line',     tint: 'facialHair.color' },   // line recoloured
  { slot: 'head',      part: 'line' },
  { slot: 'hair',      part: 'mask',     tint: 'hair.color' },
  { slot: 'hair',      part: 'line' },
  { slot: 'glasses',   part: 'mask',     tint: 'glasses.lens' },
  { slot: 'glasses',   part: 'line',     tint: 'glasses.frame' },      // line recoloured
  { slot: 'accessory', part: 'line' },
  { slot: 'longbeard', part: 'mask',     tint: 'facialHair.color' },
  { slot: 'longbeard', part: 'line' },
  { slot: 'hat',       part: 'mask',     tint: 'hat.color' },
  { slot: 'hat',       part: 'line' },
]
```

- `render(ctx, config, resolveImage)` walks `LAYERS`. A tinted layer is drawn with
  `source-in` on a reusable scratch canvas, the same technique as v1. Only one scratch
  canvas is used, not twelve.
- The canvas size (710×943) is a single constant, and uploads are validated against it.
- The same function drives the live editor, "Save", and **bulk re-render** of stale
  entries. Bulk re-render is a browser loop over the queue that uploads each PNG.
- Unit tests cover the pure parts: layer selection, tint resolution, and config
  migration. Pixel output is checked with one Playwright screenshot test against a
  golden PNG.

## R2 layout

Keep the two existing buckets so v1 data can be migrated in place.

| Bucket | Key | Written by |
|--------|-----|------------|
| `stick-figures-assets` | `v2/assets/<assetId>/<part>-r<revision>.png` | asset upload |
| | `v2/assets/<assetId>/thumb-r<revision>.png` | asset upload (thumbnail cropped in browser, once) |
| `stick-figures` | `v2/likeness/<entryId>-<random>.jpg` | public submit / team upload |
| | `v2/renders/<groupSlug>/<entryId>.png` | save / re-render |
| | `v2/exports/<groupSlug>-<timestamp>.zip` | optional, see Phase 5 |

Revisioned asset keys make responses immutable (`Cache-Control: public, max-age=31536000,
immutable` is safe behind Access). Likeness photos and renders are `private, no-cache`.

> If anything downstream already reads `images/<group>/<id>.png` from v1, keep writing
> there too, or keep that prefix (open question Q3).

## API surface (team routes, all behind Access)

The public routes (`/api/public/*`) are listed in [v2-public-intake.md](./v2-public-intake.md#api).

| Method + path | Purpose |
|---------------|---------|
| `GET /me` | Current user (email) from the Access JWT |
| `GET /groups` · `POST /groups` · `PATCH /groups/:id` | List (with status counts), create, rename/archive, questions and intake settings |
| `GET /groups/:id/entries?status=&q=` | Queue for a group |
| `POST /groups/:id/entries` | Manual entry (e.g. someone emailed a photo) |
| `POST /groups/:id/rotate-code` · `PUT /groups/:id/allowlist` · `POST /entries/:id/resolve-duplicate` | Batch intake management |
| `GET /entries/:id` · `PATCH /entries/:id` | Read, save `figure`/`status` with `If-Match: <version>` → 409 on conflict |
| `PUT /entries/:id/render` | Upload PNG, set `render_key`, clear `render_stale` |
| `PUT /entries/:id/likeness` | Replace or attach a photo |
| `GET /files/*` | Streams an R2 object. The key must belong to a known row (no raw bucket browsing) |
| `GET /assets` · `POST /assets` · `PATCH /assets/:id` · `PUT /assets/:id/parts/:part` | Asset library CRUD. Archive, not delete |
| `GET /palettes` · `PUT /palettes/:id` | Palette editing |
| `GET /groups/:id/export.zip` | Streams a zip of the group's renders |

Error responses say *why* ("photo is 12 MB, limit is 8 MB", "someone else saved this
entry, reload to see their changes"). Unexpected failures return a generic message and
log the details server-side.

## Auth

- A Cloudflare Access application covers the whole hostname, with a policy for team
  members' emails or IdP group.
- Middleware verifies `Cf-Access-Jwt-Assertion` against the team's JWKS
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`) and the application's AUD.
  It rejects requests that lack it. This is defence in depth in case the Worker is ever
  reachable via `workers.dev` or a misconfigured route. `workers_dev = false`.
- The existing Zero Trust Access application is reused. One **bypass** policy covers
  only `/join` and `/api/public/*`. The public router is mounted separately, and every
  other route requires the JWT. A test enumerates the routes to prove it.
- Local dev bypasses the check with an env var that exists only in the `dev` config.

## Follower intake

Each batch shares one expiring invite link or code. Followers submit through it, and
the submission lands directly in D1 and R2. The full design, including the spam and abuse controls, is in
[v2-public-intake.md](./v2-public-intake.md).

## Open questions

| # | Question | Default if unanswered |
|---|----------|-----------------------|
| Q1 | Frontend framework: Vue 3 + PrimeVue (richer component kit, less custom UI) or Svelte 5 (continuity with v1 code)? | Vue 3 + PrimeVue |
| Q2 | ~~Is Cloudflare Access available?~~ Yes. v1 already sits behind Zero Trust. Reuse that Access application and policy for v2 | Resolved |
| Q3 | Does anything outside this tool read `images/<group>/<id>.png` from R2? | Assume no. Migrate v1 renders to the v2 prefix |
| Q4 | ~~Google Form ownership~~ Superseded. Intake moves to invite links. See the open questions in [v2-public-intake.md](./v2-public-intake.md#open-questions) | Resolved |
| Q5 | How long should follower photos and emails be kept after a batch is done? (The consent text needs this answer) | Offer "purge photos" per archived group |
| Q6 | Typical batch size? (dozens vs. thousands changes whether export zips stream in the Worker or build in the browser) | Up to a few hundred. Stream the zip in the Worker |
| Q7 | Should the mug mockup move into the app (browser canvas preview, no CMYK) or stay a script? | Stay a script. Move the template into the repo |
