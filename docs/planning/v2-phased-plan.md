---
status: partial
created: 2026-09-23
updated: 2026-09-23
summary: "Phased build plan for v2, from scaffold to cutover, with exit criteria per phase."
---

# v2 phased plan

Design: [v2-architecture.md](./v2-architecture.md) and [v2-public-intake.md](./v2-public-intake.md).
Baseline: [v1-functionality.md](./v1-functionality.md).

Each phase ends in something deployable to staging and usable by a designer. v1 keeps
running untouched until Phase 4. v2 runs as a new Worker on its own hostname with its
own D1. It **reads** the existing R2 buckets under a new `v2/` prefix and never writes
to v1 keys.

```
P0 Groundwork ─► P1 Assets ─► P2 Editor ─► P3 Batch intake ─► P4 Migrate + cutover ─► P5 Workflow polish ─► P6 Hardening & output
                     └──────────── designers can start testing here ────────────┘
```

---

## Phase 0: Groundwork

**Goal:** an empty but real v2 that deploys, authenticates, and has a schema.

- [x] Q1 (framework): went with the default, Vue 3 + PrimeVue + Pinia.
- [x] Scaffold a fresh project on this branch. The v1 code is removed. v1 layer PNGs are
      kept as dev seed data in `seed/stick-assets/`, and the mug script and ICC profile
      in `scripts/mugs/`.
- [x] The master PSD is no longer in the tree or deployed. It remains in `main`'s
      history. Where it should live long-term (Git LFS or design drive) is still open.
- [x] `wrangler.jsonc`: `main = api/index.ts`, static assets with SPA fallback,
      `run_worker_first = ["/api/*"]`, `workers_dev = false`, observability logs, and
      `dev` / `test` / `staging` / `production` envs each with their own D1 + R2 bindings.
- [x] Hono app with Access JWT verification (dev bypass needs the dev var *and*
      localhost) and `GET /api/me`. A route-guard test fails on any unlisted public route.
- [x] `migrations/0001_init.sql` holds all tables from the architecture and intake docs,
      with CHECK constraints. `scripts/seed-dev.sql` holds palettes plus a demo batch.
      `dev:init` applies both locally.
- [x] Tooling: pnpm, ESLint encoding the coding preferences (`--max-warnings 0`),
      `vue-tsc --build` across app/worker/test projects, and Vitest in the Workers runtime.
- [x] GitHub Actions: CI (lint, typecheck, test, build) on every push. The deploy
      workflow (`main` → staging, `v*` → production) is gated on `DEPLOY_ENABLED`.
- [x] `SETUP.md`, `README.md`, and `CLAUDE.md`. Turnstile setup is deferred to Phase 3.
- [ ] **Provision staging (needs account access):** create the D1 database and buckets,
      fill in the IDs and Access vars in `wrangler.jsonc`, add the hostname to the Zero
      Trust app, add the deploy secrets, and set `DEPLOY_ENABLED`. See SETUP.md.

**Exit:** staging URL sits behind Access and shows "Hello, <email>". The CI pipeline is green.

---

## Phase 1: Asset library

**Goal:** designers manage every layer asset and palette in the UI, with no filename rules.

- [ ] `shared/layers.ts` (slot definitions + render order) and `shared/figure.ts` (FigureConfig zod).
- [ ] Asset API: list, create, patch (label, sort, archive), `PUT` part upload. Validate
      PNG, 710×943, has alpha, and a size cap.
- [ ] **Assets screen**: grid per slot. "New asset" dialog with named drop targets for
      *line art*, *colour mask*, *back line*, and *back mask*. The slot definition
      decides which targets appear. Show a live tinted preview before saving.
      Replace part, archive/restore, and drag to reorder.
- [ ] Thumbnails: when uploading, crop to the bounding box in the browser once and
      upload `thumb-r<n>.png`. Pickers never crop at runtime.
- [ ] Palettes screen: edit the swatch lists for skin, hair, hat, and glasses, then save.
- [ ] `scripts/import-v1-assets.ts`: walks R2 `assets/<Category>/` and applies the v1
      naming rules (`mask` prefix, `b` suffix, per-slot prefixes) **once**. It creates
      asset rows and copies objects to `v2/assets/…`. Seeds palettes from the v1 arrays.
- [ ] Tests: asset upload validation. The importer's filename parsing, including the
      `b`-in-name case that v1 gets wrong.

**Exit:** every v1 asset shows in the v2 library with correct masks and back layers. A
designer can add a new hat with a back layer without being told any naming convention.

---

## Phase 2: Editor

**Goal:** feature parity with v1's figure building, fixing v1's known bugs.

- [ ] `src/lib/render.ts`, driven by `LAYERS`. It uses one scratch canvas for tinting.
- [ ] **Editor layout** that works on a laptop screen:
      - left: the follower's photo (zoom/pan) and the answers to questions flagged `highlight`
      - centre: canvas, scaled to fit
      - right: slot tabs or accordion. Each has an asset picker (thumbnails, "none" option)
        and a colour row (palette swatches plus a custom picker) where the slot is tintable.
- [ ] Head picker, since v1 hard-coded the first head.
- [ ] Defaults: random body and skin. Hair and hat default to the first palette colour
      when an asset is first picked. Facial hair follows hair colour until set on its own.
      A **Randomise** button fills every unset slot.
- [ ] Undo/redo (in-memory history of FigureConfig).
- [ ] **Save**: render the PNG, `PUT /entries/:id/render`, then `PATCH /entries/:id` with
      `If-Match: version`. A 409 shows "changed by <who> at <when>, reload or overwrite".
- [ ] Unsaved-changes guard when switching entries. This replaces v1's silent reset.
- [ ] Local draft autosave (per entry, browser storage) so a closed tab loses nothing.
- [ ] Download PNG.
- [ ] Tests: FigureConfig validation and version conflict (API). One golden-image
      Playwright test of a fixed config.

**Exit:** a designer reproduces three existing v1 figures in v2, and the PNGs match
visually.

---

## Phase 3: Batch invites and public intake

**Goal:** each batch of subscribers gets one expiring link. Followers submit their own
answers and photo through it. Nobody touches a CSV of responses, Drive, or R2 by hand.
Full design: [v2-public-intake.md](./v2-public-intake.md).

- [ ] Resolve Q5 (retention), which the consent text depends on. The questions
      themselves are TBD and are configured per batch, so they don't block this phase.
- [ ] Batches screen: create, rename, archive, and progress per batch.
- [ ] Batch settings: window (`opens_at`/`closes_at`), submission cap, contact email,
      consent text, questions editor (an ordered list, not a form builder), and an
      optional allowlist upload.
- [ ] Share panel: link and code with copy buttons, live status ("41 / 60, closes Fri"),
      plus Extend, Close now, and Rotate code.
- [ ] Public router (`/api/public/*`), mounted apart from the team routes:
      `GET batch` and `POST submission`. It is write-once, enforces the window and the
      cap (one conditional insert), and returns the same response for a wrong code as
      for a closed batch.
- [ ] Abuse controls: Turnstile always on, per-IP rate limits (loose for code checks,
      tight for submits), size limits checked before the body is read, magic-byte
      checks on photos, a salted IP hash on each entry, and security headers on `/join`.
- [ ] Duplicate handling: flag entries whose email already exists in the batch.
      Resolve view (keep newer, keep older, keep both). Bulk "skip selected" for
      clearing junk.
- [ ] Zero Trust: add a bypass policy for `/join` and `/api/public/*` only. Add a route
      enumeration test proving every other route needs the Access JWT.
- [ ] Join page (a separate lightweight entry, mobile-first). The code comes from the
      URL fragment or is typed in, and is stripped from the address bar. Name + email,
      batch questions, photo picker with crop and downscale plus JPEG re-encode (strips
      EXIF), consent. Clear states for open, not yet open, closed, full, and submitted.
      Closed, full, and error states all name the contact email.
- [ ] Manual entry with photo upload from the team side, for late subscribers who email in.
- [ ] Tests: those listed in [v2-public-intake.md](./v2-public-intake.md#tests-critical-paths-only).

**Exit:** a staging batch is opened and three testers submit from their phones, and the
entries show up in the queue. A repeat submit is flagged as a duplicate. After
"Close now" and after "Rotate code", the old link shows the closed message. A route scan
confirms that nothing outside `/join` and `/api/public/*` answers without Access.

---

## Phase 4: v1 migration and cutover

**Goal:** all historical work lives in v2, and v1 is retired.

- [ ] `scripts/migrate-v1.ts` (idempotent and re-runnable), for each KV group key:
      - create a group with `source = 'v1'`, and build its `questions` from the CSV headers
      - create entries, **keeping the v1 `id`** so render filenames stay traceable
      - copy `likeness/<group>/<Filename>` to `v2/likeness/<entryId>.<ext>`
      - store the CSV row as `answers`
      - convert `stickProps` (asset URLs) to FigureConfig through the asset import map.
        Log any URL that cannot be resolved.
      - copy `images/<group>/<id>.png` to `v2/renders/<slug>/<id>.png`
      - map `done` to `status = 'done'`, and existing `stickProps` to `in_progress`
      - also pick up CSV-only groups under `responses/` that were never opened in v1
- [ ] Dry-run mode that prints counts and unresolved references. Run it against
      staging first.
- [ ] Spot-check: open ten migrated entries and confirm the editor reproduces the saved PNG.
- [ ] Cutover: point the production hostname at v2 and put v1 behind Access (read-only
      fallback) for a grace period.
- [ ] Decommission: delete the Pages project and KV namespace. v1 R2 prefixes stay
      until Q5 (retention) is answered.

**Exit:** designers use v2 only. Nothing depends on the v1 Pages project.

---

## Phase 5: Workflow and UX polish

**Goal:** a batch of 100 goes quickly and nothing gets lost.

- [ ] **Queue view**: table with status, name, thumbnail of the render, last edited by and
      when, and a "stale" badge. Filter by status, search by name or email, and show a
      progress bar per group.
- [ ] Keyboard: `J`/`K` for next/previous entry, `S` to save, `D` to mark done and go
      to the next entry, `Z`/`Shift+Z` for undo/redo.
- [ ] "Save & next" as the primary action. Mark done is an explicit status change that
      persists immediately, unlike v1's checkbox that needed a Save.
- [ ] Copy figure from another entry (a starting point for similar followers).
- [ ] **Stale renders**: when an asset is replaced, affected entries are flagged, and
      "Re-render N stale" runs through them in the browser with a progress bar.
- [ ] **Export**: `GET /groups/:id/export.zip` streams done renders, named
      `<name>-<id>.png`, plus a CSV manifest (name, email, file).
- [ ] Soft presence: show "<email> opened this 2 min ago" on the entry (from
      `updated_by`/`updated_at`). This is not real-time locking.
- [ ] Empty, loading, and error states across all screens. Errors explain why.

**Exit:** designers report the queue-to-done loop is faster than v1. The export zip
feeds the mug script directly.

---

## Phase 6: Hardening and output

**Goal:** optional hardening and reproducible print output. Every item here can ship
on its own.

- [ ] **Email ownership check** (optional; only if impersonation via a shared link
      becomes a real problem). The join page emails a 6-digit code before accepting a
      submission, using Cloudflare Email Service with a verified sending domain.
- [ ] Mug pipeline: commit `mug-template.jpg` and both ICC profiles (or record where they
      live). Make `create-mugs.sh` take the export zip as input. Document it in `SETUP.md`.
- [ ] Optional (Q7): an in-app mug mockup preview, which is just a browser canvas
      composite, sRGB only.
- [ ] "Purge photos" on archived groups (Q5). It deletes likeness objects, clears
      `likeness_key`, drops IP hashes, and clears the allowlist.

**Exit:** depends on which items are picked up. Each has its own acceptance check in its PR.

---

## Deliberately dropped from v1

| v1 feature | Why it goes |
|------------|-------------|
| Webnative accounts, WNFS gallery, device linking, backups | Template leftovers, unused |
| Custom-image layer (WNFS-backed, commented out) | Dead. If wanted, add it back as a normal "accessory"-style asset |
| Hostname-based mock mode | Replaced by the local seed plus the `dev` environment |
| Google Form intake (CSV export, Drive photos, hand-added `Filename` column) | Replaced by invite links and the public intake page. The v1 migration still reads the old CSVs once |
| Asset semantics from filenames | Replaced by the asset manifest in D1. The importer understands the old rules, once |
| Drag-onto-section upload in the editor | Replaced by the Assets screen |

## Risks

| Risk | Mitigation |
|------|------------|
| Rendering drifts between v1 and v2 (layer order, tint behaviour) | Golden-image test. Phase 2 exit compares against v1 renders |
| v1 `stickProps` URLs that no longer resolve | The migration dry run lists them. The figure falls back to `null` for that slot and is flagged |
| The public endpoint gets abused (spam, floods, oversized uploads) | Layered controls in [v2-public-intake.md](./v2-public-intake.md#spam-and-abuse-controls). Nothing can be edited or read through the public API |
| An Access bypass typo exposes team routes | The app checks the JWT itself on every non-public route. A route enumeration test runs in CI |
| A batch link leaks (forwarded, posted publicly) | Short window, hard cap, Turnstile, write-once API, one-click rotate, optional allowlist, bulk skip |
| Someone submits using another subscriber's email | Duplicate flagging with a resolve view. An optional email ownership check in Phase 6 |
| Followers miss the window | Designed for: the closed page names the contact email, and the team adds a manual entry or extends the batch |
| Photo PII leakage | Access on all team routes, private R2, EXIF stripped in the browser, photo never served back publicly, purge on archive |
| Large zips hitting Worker CPU/memory limits | Stream the zip (no buffering). Fall back to building the zip in the browser if Q6 says batches are large |
