---
status: reference
created: 2026-09-23
updated: 2026-09-23
summary: "Audit of the current (v1) stick generator. Core functionality, data layout, and known problems."
---

# v1: what the site actually does

v1 is a SvelteKit static SPA deployed to Cloudflare Pages, with Pages Functions under
`functions/api/`. It was built on the Fission "Webnative App Template". Almost all of
that template is dead weight: accounts, device linking, WNFS gallery, backup and
recovery. The whole product is three components:

- `src/components/stick-generator/Editor.svelte`: group picker, follower list, follower details
- `src/components/stick-generator/StickGen.svelte`: canvas compositor, option pickers, save/download
- `src/lib/stick-assets.ts` + `src/lib/canvas.js`: asset discovery, palettes, masking/compositing

Everything else in `src/` (auth, gallery, settings, nav, icons, webnative init) is unused.
`src/routes/+page.svelte` renders only `<Editor/>`, and `initialize()` is commented out.

## Core job, in one paragraph

Followers fill in a Google Form with a few answers (name, email, hair, a hobby or
favourite thing) and **upload a photo of themselves**. A designer opens each response,
looks at the photo, and assembles a matching stick figure from a library of
designer-drawn layers (body, head, hair, facial hair, glasses, hat, accessory), picking
colours for the tintable parts. The result is flattened to a transparent 710×943 PNG and
saved to R2. The finished PNGs are later composited onto merchandise (mugs) by an
offline ImageMagick script.

## Actors

| Actor | Does |
|-------|------|
| Follower | Fills in the Google Form. Never touches this site |
| Designer | Draws layer assets (in `MM Mugs 1 - Stick Figure Assets.psd`), uploads them, builds figures |
| Operator | Moves form data into R2 by hand, runs the mug script, deploys |

## Functional inventory

### 1. Groups (batches of followers)

- A group is one batch of form responses, e.g. one campaign or form export.
- `GET /api/responses` lists groups. It merges two sources: CSV objects under R2
  `responses/` and every key in the `STICK_FIGURE_DATA` KV namespace.
- On first open, a group's CSV is parsed (`csv-parse`), each row gets a fresh `uuidv4()`
  `id`, and the whole array is cached to KV under the group name. After that, **KV is the
  source of truth** and the CSV is ignored.
- "[New Group]" creates an empty group: it POSTs `[]` to KV.
- "Add Stick" adds a manual entry to the current group (Name + Email only).

### 2. Follower entries

- The sidebar lists entries by `Email Address`, with a ✅ prefix if `done` and 🖌️ if
  `stickProps` exists.
- Selecting an entry shows:
  - the **likeness photo** from `GET /api/likeness/<group>/<Filename>`, which reads R2
    `likeness/<group>/<Filename>`. `Filename` is a CSV column added by hand. It uses
    Google Forms' upload naming (`<original> - <Respondent Name>.png`), so the photos
    were evidently downloaded in bulk from the form's Drive folder and uploaded to R2.
  - a raw key/value dump of every CSV column. Keys containing `Hair`, `hobby` or `Name`
    are bolded because these are the answers that matter to the designer.
  - a `done?` checkbox.

### 3. Figure editor (the heart of the tool)

Fixed canvas: **710 × 943 px**, transparent background. Every asset is a full-canvas
PNG at that size, pre-positioned, so layers are drawn at (0,0) with no transforms.

**Slots and options**

| Slot | Asset files (R2 `assets/<Category>/`) | Colour | Notes |
|------|----------------------------------------|--------|-------|
| Body | `Bodies/body-NN.png` | none | Random body is chosen if unset |
| Head | `Heads/head-01.png` + `maskhead-01.png` | skin | **Always the first head**. There is no head picker |
| Skin | (via head mask) | skin palette (9) | |
| Hair | `Hairs/hair-NN.png` + `maskhair-NN.png`, optional back layer `hair-NNb.png` + mask | hair palette (44) | |
| Hat | `Hats/hat-NN.png` + `maskhat-NN.png`, optional back layer `…b.png` | hat palette (17) | |
| Mustache | `Facial Hairs/mustache-NN.png` | facial-hair colour | Line art itself is recoloured |
| Beard | `Facial Hairs/beard-NN.png` | facial-hair colour | Line art itself is recoloured |
| Long beard | `Facial Hairs/longbeard-NN.png` + `masklongbeard-NN.png` | facial-hair colour | Drawn above glasses and accessory |
| Glasses | `Glasses/glasses-NN.png` + `maskglasses-NN.png` | frames colour + lens colour | Line art is recoloured as frames. The mask is the lens fill. The original line art is *not* drawn |
| Accessory | `Accessories/accessory-NN.png` | none | |
| Custom image | (was WNFS) | none | Commented out. Movable layer index |

Every colour picker also offers a free-form "Custom" picker (`svelte-awesome-color-picker`).
Clicking a selected swatch or asset again deselects it.

**Mask/tint technique** (`drawColorMask`): draw the mask, then fill with the colour using
`globalCompositeOperation = 'source-in'`. A slot is either "fill" (tinted mask under
untinted line art) or "line" (line art itself tinted).

**Layer order, back to front** (`StickGen.svelte` `draw()`):

```
hat-back fill, hat-back line,
hair-back fill, hair-back line,
body,
head fill (skin), beard (tinted), mustache (tinted), head line,
hair-front fill, hair-front line,
glasses lens fill, glasses frames (tinted line),
accessory,
longbeard fill, longbeard line,
hat-front fill, hat-front line
```

**Defaults** (`withDefaults`): random body; first hat colour when a hat is picked; first
hair colour when hair is picked; facial-hair colour follows hair colour (or random).
Previously saved `stickProps` for the entry are restored.

**Actions**

- **Save**: uploads the canvas PNG to R2 `STICK_FIGURES` at `images/<group>/<id>.png`,
  then POSTs the entry, with `stickProps` merged in, to KV.
- **Download**: saves `stick-figure-<id>-<ISO timestamp>.png` locally.

### 4. Asset library

- Assets are discovered by **listing R2** (`GET /api/assets/<Category>`), then filtered
  by filename prefix (`hair`, `maskhair`, `beard`, `mustache`, …).
- Semantics live entirely in **filename conventions**:
  - `mask` prefix: the tint mask for the same-named asset
  - trailing `b` before the extension: the back layer of a front/back pair
  - the prefix decides the slot inside a category (Facial Hairs holds three slots)
- Upload is by **dragging files onto a slot's section** in the editor. That POSTs to
  `/api/assets/<Category>/<filename>` and silently overwrites any file with the same name.
- There is no delete, rename, reorder, or preview-before-publish.
- Picker thumbnails are made in the browser on every load. Each image is drawn to a
  canvas, then a full per-pixel scan finds the bounding box and crops it.
- Palettes are hard-coded arrays in `stick-assets.ts`.

### 5. Downstream: mug mockups

`create-mugs.sh` uses ImageMagick for each finished PNG. It converts to CMYK with
`USWebCoatedSWOP.icc` (plus an sRGB profile), resizes to 45%, and composites at
`+1728+310` onto `mug-template.jpg`, writing `mugs/MUG-<name>.jpg`. The sRGB profile and
the mug template are **not in the repo**.

## Storage layout (production)

| Store | Binding | Keys |
|-------|---------|------|
| R2 `stick-figures-assets` | `STICK_FIGURES_ASSETS` | `assets/<Category>/<file>.png` |
| R2 `stick-figures` | `STICK_FIGURES` | `responses/<group>` (CSV), `likeness/<group>/<Filename>`, `images/<group>/<id>.png` |
| KV `STICK_FIGURE_DATA` | `STICK_FIGURE_DATA` | `<group>` → JSON array of every entry in the group, including `stickProps` and `done` |

`stickProps` stores **absolute asset URLs** (`/api/assets/Hairs/hair-01.png`), not IDs.
Some are arrays for front/back pairs.

## Known problems

### Security and privacy
- Authentication is handled at the edge by Cloudflare Zero Trust (Access). This is not
  recorded in the repo. The app itself does no checks and never learns who is editing,
  so there is no "last edited by" attribution.
- Follower photos and emails are personal data with no retention policy.
- The designer's master PSD is in `static/`, so it ships publicly with the site.
- Mock mode is chosen by hostname (`!request.url.startsWith('https://stick')`), so any
  preview URL silently serves mock data.

### Data integrity
- **Whole-group read-modify-write in KV.** Every save rewrites the group's entire JSON
  array. Two designers saving in the same group can clobber each other, and KV is
  eventually consistent on top of that.
- Entry IDs are generated at CSV parse time. If the KV key is lost, re-parsing mints new
  IDs and orphans every saved render.
- The `done` checkbox mutates local state only. It persists only if the designer later
  presses Save.
- `stickProps` holds URLs, so renaming or re-categorising an asset breaks saved figures.
- Overwriting an asset changes the look of every figure that uses it, but their saved
  PNGs are not re-rendered.

### Bugs spotted during the audit
- Random skin default never works: `randomSelection(Assets.skinColor)` (should be `skinColors`).
- The Facial Hairs upload callback is `() => {() => refreshAssets(...)}`, which never calls refresh.
- `getLayerId` uses `[^/.b]+`, so a hair or hat name containing the letter `b` is cut
  short at its last `b` (`bob-01` → `-01`). Truncated IDs can collide and be merged into
  a bogus front/back pair. Any name that simply ends in `b` is treated as a back layer.
- Switching entries calls `reset()` and silently discards unsaved edits.
- The custom-image layer depends on WNFS and is dead.

### UX
- Fixed-pixel layout (710 px canvas + 620 px photo + 3-column grid) needs a very wide screen.
- The follower list shows email only. There is no search, filter, or progress count.
- Form answers are a raw key/value dump, not the few fields the designer needs.
- Uploading assets is a hidden affordance: you have to drag onto a section, and the
  only hint is a "Drop here" overlay.
- Getting a batch in needs manual R2 uploads of a CSV and a folder of photos, plus a
  hand-added `Filename` column.
- There is no undo, no keyboard navigation, and no bulk export of a finished group.

## What v2 must preserve (the requirements baseline)

1. Get follower responses (answers + photo) into named groups. Also create groups and
   entries by hand. (v2 changes *how*: batch invite links instead of Google Forms.)
2. Show the follower's photo and key answers next to the editor.
3. Compose a figure from slot-based layered assets with tintable fill/line parts, using
   the layer order above and curated palettes plus custom colours.
4. Designers manage the asset library themselves (upload, replace), with no deploy.
5. Save a flat transparent PNG per entry to R2, and keep the editable config for later.
6. Track per-entry progress (at least not started / in progress / done).
7. Download individual renders, and feed the renders into the mug/print pipeline.
