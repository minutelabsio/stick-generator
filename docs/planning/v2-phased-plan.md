---
status: partial
created: 2026-09-23
updated: 2026-10-06
summary: "Phased build plan for v2, from scaffold to cutover, with exit criteria per phase."
---

# v2 phased plan

Design: [v2-architecture.md](./v2-architecture.md), [v2-public-intake.md](./v2-public-intake.md),
and [v2-channels-and-rigs.md](./v2-channels-and-rigs.md).
Baseline: [v1-functionality.md](./v1-functionality.md).

Each phase ends in something deployable to staging and usable by a designer. v1 keeps
running untouched until Phase 4. v2 runs as a new Worker on its own hostname with its
own D1. It **reads** the existing R2 buckets under a new `v2/` prefix and never writes
to v1 keys.

```
P0 Groundwork ─► P0.5 Rig as data ─► P0.6 Channels ─► P1 Batch intake ─► P2 Assets ─► P3 Editor
                                                                         └─ designers can start testing here ─┘
             ─► P4 Migrate + cutover ─► P5 Workflow polish ─► P6 Hardening & output
```

---

## Prototype (2026-09-23)

A playable prototype runs locally (see the README's "Trying the prototype"). It
covers the core loop so the design can be explored before the phases below are
built properly: batches with a join link, the follower join page, and the editor
with save and download. It deliberately skips or simplifies the following, which
the phases still need to do:

- **Editor (P3):** no optimistic-concurrency check on save, no undo/redo, no
  draft autosave. The head is pickable, but only one head is seeded.
- **FigureConfig:** stored flat (`assets` per slot, `colors` per channel), not the
  nested shape sketched in the architecture doc. The flat shape proved simpler for
  the UI, so update the doc if it sticks.
- **Assets (P2):** loaded by a dev seed script. There is no Assets screen,
  upload, or palette editing yet.
- **Intake (P1):** no Turnstile, rate limits, submission cap, allowlist,
  duplicate flagging, code rotation, extend/close, or photo cropping. The join page
  is a route in the team SPA, not a separate lightweight entry.
- **UI library:** PrimeVue is pinned to 4.5 (MIT). 5.x needs a commercial
  PrimeUI licence key.

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
      workflow (`refresh` → staging until cutover, `v*` → production) is gated on `DEPLOY_ENABLED`.
- [x] `SETUP.md`, `README.md`, and `CLAUDE.md`. Turnstile setup is deferred to Phase 1.
- [ ] **Provision staging (needs account access):** create the D1 database and buckets,
      fill in the IDs and Access vars in `wrangler.jsonc`, add the hostname to the Zero
      Trust app, add the deploy secrets, and set `DEPLOY_ENABLED`. See SETUP.md.

**Exit:** staging URL sits behind Access and shows "Hello, <email>". The CI pipeline is green.

---

## Phase 0.5: Figure rig as data

**Goal:** the drawing structure (slots, layers, colour roles, palettes, canvas) is data
passed through the code, not constants imported by it. **Nothing a designer or follower
sees changes.** Design: [v2-channels-and-rigs.md](./v2-channels-and-rigs.md#the-rig).

- [x] Rename "colour channel" to **colour role** (`COLOR_CHANNELS` to `COLOR_ROLES`,
      `SlotDefinition.colorChannels` to `colorRoles`, `Layer.tint` to `colorRole`). A
      `refactor` commit on its own. Stored figure JSON keeps its keys.
- [x] Before changing behaviour, a test in `shared/` pins today's slots, layer order,
      colour roles, and palettes, so the rig can be checked against them.
- [x] `Rig` zod schema in `shared/`, with today's constants expressed as `STICK_RIG`.
      The parity test now checks `STICK_RIG`.
- [x] Editor behaviour keyed to named slots moves into rig fields: random fill chance,
      default colours, facial hair following hair, starting choices, and slot rail groups.
- [x] The renderer, thumbnails, figure edits, slot rail, and editor take a rig instead
      of importing constants.
- [x] `GET /library` returns the rig (always `STICK_RIG` for now), and the SPA draws with it.
- [x] `FigureConfig` keys become plain strings. `PATCH /entries/:id` checks slots and
      colour roles against the rig, with a test that an unknown slot is rejected.

Done 2026-10-02 on the `figure-rig` branch. The rig is `shared/rig.ts`, and the stick
figure is `shared/stick-rig.ts`.

**Exit:** `pnpm run check` is green and nothing in `api/` or `src/` names a specific
slot or colour role. A fixed figure renders identically before and after (compare the PNGs),
and randomise, the slot rail, and colour defaults behave as before. Met: canvas PNGs of
two fixed figures were byte-identical before and after, and tests pin the editor rules,
draw order, and structure.

---

## Phase 0.6: Channels

**Goal:** each channel has its own batches, subscribers, assets, palettes, and rig, and
admins switch between channels. No access control: every admin sees every channel.
Design: [v2-channels-and-rigs.md](./v2-channels-and-rigs.md#channels).

- [x] Schema: `channels` table (with `rig` JSON and `rig_revision`), `channel_id` on
      `groups`, `assets`, and `palettes`, palettes keyed by `(channel_id, id)`. Drop
      the fixed slot and palette CHECKs. Fold into `0001` if nothing is deployed yet,
      otherwise add a migration.
- [x] Seed two channels in dev, each with its own palettes and assets.
- [x] API: `GET /channels`, channel-scoped batch list and create, channel-scoped
      library (assets, palettes, rig), and `channelId` on entry detail.
- [x] `PATCH /entries/:id` rejects assets from another channel, checked in one query.
- [x] SPA: channel switcher (remembers the last channel), batch list under
      `/c/:channelSlug`, new batches created in the current channel.
- [x] Join page shows the channel's name.
- [x] Channels page (`/channels`) that creates a channel from a name and address.
      Every channel gets a copy of the stick rig. Editing rigs stays in the backlog.
- [x] Tests: batch lists don't leak across channels, a figure that mixes channels is
      rejected, and two channels can each have a `hair` palette.

**Exit:** with two seeded channels, a designer switches channels and sees only that
channel's batches and assets. An entry in one channel cannot be saved with another
channel's asset.

Done 2026-10-05 on the `feature-channels` branch. Met: in dev, switching between
*Original* and *Sketchbook* changes the batch list, swatches, and assets, and tests
cover the leak, mixed-figure, and shared-palette-id cases. Saving also refuses an
asset used in a slot it wasn't made for, since the same query checks that for free.
A new channel starts with no palettes or assets. Phase 2's screens fill those in.

---

## Phase 1: Batch invites and public intake

Moved ahead of assets and the editor on 2026-10-05, because subscriber intake is needed
soon. It depends on batches and channels, not on either of them.

**Goal:** each batch of subscribers gets one expiring link. Followers submit their own
answers and photo through it. Nobody touches a CSV of responses, Drive, or R2 by hand.
Full design: [v2-public-intake.md](./v2-public-intake.md).

- [ ] Resolve Q5 (retention), which the default consent text depends on. Questions
      are configured per channel, so they don't block this phase.
- [x] Intake settings per channel, stored as one JSON document: instructions,
      questions, thank-you message, consent text, and contact email. Question types are
      text, email, select (optionally with "Other"), radio, and image. Each has a
      permanent id.
- [x] Each entry keeps a copy of the questions it was asked beside its answers, so
      editing the form never breaks or misreports old entries.
- [x] Answers checked on the server against the channel's form with rules shared with
      the join page. Image answers get the same size and magic-byte checks as the photo.
- [x] Intake form page per channel: the settings above, with an ordered questions
      editor (not a form builder).
- [ ] Batches screen: create, rename, archive, and progress per batch. Done except
      archive.
- [x] Batch settings: rename, a manual open/closed switch (new batches start closed),
      a required close date that is a hard stop, and an optional submission limit.
- [ ] Optional allowlist upload.
- [x] Share panel: link and code with copy buttons, live status ("41 / 60, closes Fri"),
      plus Rotate code. The switch and the close date replace Extend and Close now.
- [x] Public router (`/api/public/*`), mounted apart from the team routes:
      `GET batch` and `POST submission`. It is write-once, enforces the switch, the close
      date, and the limit (one conditional insert), and returns the same response for a wrong code as
      for a closed batch, apart from the closed batch's contact email.
- [ ] Abuse controls: Turnstile always on, per-IP rate limits (loose for code checks,
      tight for submits), and a salted IP hash on each entry.
- [x] Size limits checked before the body is read, magic-byte checks on every image,
      and security headers (CSP, no framing, no referrer, nosniff) on every page via
      `public/_headers` and on API responses.
- [x] Repeat submissions with the same email are allowed (answering for a friend or
      partner) and are not flagged.
- [ ] Bulk "skip selected" for clearing junk.
- [ ] Zero Trust: add a bypass policy for `/join` and `/api/public/*` only. Add a route
      enumeration test proving every other route needs the Access JWT.
- [ ] Join page (a separate lightweight entry, mobile-first). The code comes from the
      URL fragment or is typed in, and is stripped from the address bar. Name + email,
      the channel's questions, photo picker with crop and downscale plus JPEG re-encode
      (strips EXIF), consent. Done so far: the channel's questions by type, instructions,
      thank-you message, "Send another", and the full state. Still to do: a separate
      entry and photo crop. Clear states for open, closed, full, and submitted.
      Closed, full, and error states all name the contact email. Shows the channel's
      instructions above the form and its thank-you message after submitting.
- [ ] Manual entry with photo upload from the team side, for late subscribers who email in.
- [x] CSV export of a batch's responses (`GET /batches/:id/export.csv`): a column per
      question ever asked, image file names as storage paths, and formula-safe cells.
- [ ] Tests: those listed in [v2-public-intake.md](./v2-public-intake.md#tests-critical-paths-only).

**Exit:** a staging batch is opened and three testers submit from their phones, and the
entries show up in the queue. A second submit with the same email adds a second entry. After
switching the batch off and after "Rotate code", the old link shows the closed message. A route scan
confirms that nothing outside `/join` and `/api/public/*` answers without Access.

---

## Phase 2: Asset library

**Goal:** designers manage every layer asset and palette in the UI, with no filename rules.

Everything in this phase is per channel: assets, palettes, and the import target.

- [x] Slot definitions, render order, and FigureConfig zod. Done in `shared/figure.ts`
      for the prototype, and turned into the rig in Phase 0.5.
- [ ] Asset API: list, create, patch (label, sort, archive), `PUT` part upload. Validate
      PNG, 710×943, has alpha, and a size cap.
- [ ] **Assets screen**: grid per slot. "New asset" dialog with named drop targets for
      *line art*, *colour mask*, *back line*, and *back mask*. The slot definition
      decides which targets appear (`slot.parts` in the rig). Show a live tinted preview before saving.
      Replace part, archive/restore, and drag to reorder.
- [ ] Thumbnails: when uploading, crop to the bounding box in the browser once and
      upload `thumb-r<n>.png`. Pickers never crop at runtime.
- [ ] Palettes screen: edit the swatch lists for skin, hair, hat, and glasses, then save.
- [ ] `scripts/import-v1-assets.ts`: walks R2 `assets/<Category>/` and applies the v1
      naming rules (`mask` prefix, `b` suffix, per-slot prefixes) **once**. It creates
      asset rows in the original channel and copies objects to `v2/assets/…`. Seeds that
      channel's palettes from the v1 arrays.
- [ ] Tests: asset upload validation. The importer's filename parsing, including the
      `b`-in-name case that v1 gets wrong.

**Exit:** every v1 asset shows in the v2 library with correct masks and back layers. A
designer can add a new hat with a back layer without being told any naming convention.

---

## Phase 3: Editor

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

## Phase 4: v1 migration and cutover

**Goal:** all historical work lives in v2, and v1 is retired.

- [ ] `scripts/migrate-v1.ts` (idempotent and re-runnable), for each KV group key:
      - create a group with `source = 'v1'` in the original channel, and build its
        `questions` from the CSV headers
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
- [ ] Merge `refresh` into `main` and switch the staging trigger in `deploy.yml` back
      to `main`.
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

## Backlog

- [ ] **Admin-editable rigs:** admins add slots and place their layers in the draw
      order, per channel. Not scheduled. The rules it must follow are in
      [v2-channels-and-rigs.md](./v2-channels-and-rigs.md#later-admin-editable-rigs-backlog).

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
| Rendering drifts between v1 and v2 (layer order, tint behaviour) | Golden-image test. Phase 3 exit compares against v1 renders |
| v1 `stickProps` URLs that no longer resolve | The migration dry run lists them. The figure falls back to `null` for that slot and is flagged |
| The public endpoint gets abused (spam, floods, oversized uploads) | Layered controls in [v2-public-intake.md](./v2-public-intake.md#spam-and-abuse-controls). Nothing can be edited or read through the public API |
| An Access bypass typo exposes team routes | The app checks the JWT itself on every non-public route. A route enumeration test runs in CI |
| A batch link leaks (forwarded, posted publicly) | Open switch, close date, limit, Turnstile, write-once API, one-click rotate, optional allowlist, bulk skip |
| Someone submits using another subscriber's email | Repeats are allowed by design, so a designer skips a bad one. Bulk skip, the optional allowlist, and an optional email ownership check in Phase 6 |
| Followers miss the window | Designed for: the closed page names the contact email, and the team adds a manual entry or moves the close date and switches the batch back on |
| Photo PII leakage | Access on all team routes, private R2, EXIF stripped in the browser, photo never served back publicly, purge on archive |
| Large zips hitting Worker CPU/memory limits | Stream the zip (no buffering). Fall back to building the zip in the browser if Q6 says batches are large |
