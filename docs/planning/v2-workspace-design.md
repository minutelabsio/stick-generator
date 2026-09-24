---
status: planned
created: 2026-09-24
updated: 2026-09-24
summary: "Visual and interaction design for the designer workspace (batch list, batch page, figure editor)."
---

# v2 workspace design

Covers the designer-facing screens: the batch list, the batch page, and the figure
editor. The public join page is out of scope here.

**The job:** a designer compares a follower's photo with the figure, spots what's
different, changes one layer or tint, and repeats. Everything else serves moving
through a batch.

## Direction: a proofing room

Designers judge skin, hair, and clothing tints for print. The interface stays neutral
so the figure is the only colour on screen. The vocabulary comes from print
production (neutral grey board, white proof sheet, crop marks, process cyan) rather
than from doodling.

A hand-drawn "sketchbook" look (paper texture, marker font, playful colour) was
considered and rejected: it fights the figures and skews colour judgement.

### Colour

| Token | Hex | Role |
|---|---|---|
| Board | `#E4E5E7` | App background. A true neutral grey, so it doesn't shift how tints look |
| Glaze | `#FFFFFF` | Proof sheet, asset tiles, table surface. The mug's white |
| Graphite | `#2A2C2F` | Text and selection rings |
| Rule | `#C6C8CC` | Dividers and input borders |
| Pencil | `#6A6D72` | Secondary text |
| Process cyan | `#0088C7` | Primary actions, focus ring, links. Nothing else uses it |
| Unsaved | `#C8246A` | The unsaved-changes dot only |

- Status is text plus a glyph (○ new, ◐ in progress, ● done) in graphite, not
  colour-coded tags.
- Light mode only, on purpose: tints are judged against white ceramic.

### Type

- **Atkinson Hyperlegible Next** for everything. Names and emails get copied and must
  be spelled right, and this face separates I/l/1 and O/0. Scale 12 / 14 / 16 / 21 / 28.
  Weights 400 body, 600 labels, 700 the entry name. Tabular figures for counts and dates.
- **Atkinson Hyperlegible Mono** only for the join link, the one string that gets copied
  and shared.

### Principles

- The figure owns the colour. Chrome is grey, white, and graphite, plus one cyan.
- Selection is shown with a hue-free ring (2px graphite with a white gap), so it never
  reads as a colour choice next to a swatch.
- Swatches are square chips that show their hex on hover and focus.
- Keyboard first, with a visible cyan focus ring.
- Almost no motion: only the save confirmation.
- No site-wide title bar. Every page's top row holds that page's title and actions.

## Screens

### Batch list

A header row with "Batches" on the left and "New batch" on the right. Batches are a
ledger, not a card grid. Each row shows the name, close date, entry count, and a bar
split by status.

```
Batches                                                    [New batch]
Autumn 2026 supporters     Closes 12 Oct   23 entries   Open
████████████▒▒▒▒░░░░░░░    14 done, 4 in progress, 5 new
```

### Batch page

A `‹ Batches` link above the batch name. The join link sits in one quiet strip with
Copy link. The entries table follows.

### Figure editor

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ‹ Autumn 2026   Alex Kim   ‹ 4 of 23 ›   ◐ In progress ▾  ⋯  Save •  [Done, next entry] │
├ reference ─────┬ proof ──────────────────┬ slots ───┬ picker ────────────────┤
│ ┌────────────┐ │   ┘                └    │ ▢ Body   │ Beard                  │
│ │   photo    │ │                         │ ▢ Head   │ Facial hair colour     │  pinned
│ │  (proof    │ │       figure            │ ▢ Hair   │ ■ ■ ■ ■ ■ ■ ■  ＋      │
│ │   height)  │ │                         │ ◌ Hat    │ [/ filter beards] 214  │
│ └────────────┘ │                         │──────────│ Recent ▢ ▢ ▢ ▢ ▢ ▢     │
│ email          │                         │ ◌ Must.  ├────────────────────────┤
│ answers        │   ┐                ┌    │▸▢ Beard  │ ▢ ▢ ▢ ▢ ▢              │  scrolls
│                │                         │ ◌ Long   │ ▢ ▢ ▢ ▢ ▢  (virtual)   │
│                │                         │──────────│ …                      │
│                │                         │ ◌ Glass. │                        │
│                │                         │ ◌ Acc.   │                        │
└────────────────┴─────────────────────────┴──────────┴────────────────────────┘
```

**Header row: meta controls, at the top.** Left is *who*: back to the batch, the
follower's name (the page title), and ‹ 4 of 23 › (←/→). Right is *what to do*, from
quietest to strongest: status select, ⋯ menu (Download PNG, Randomise), Save with the
unsaved dot (⌘S), and one cyan **Done, next entry** (⌘↵) that saves, marks done, and
opens the next entry.

**Reference column.** The photo at the same height as the proof, so the two compare
side by side, then email and answers.

**Proof.** The figure on a white sheet with corner crop marks. A new entry with an empty
figure shows *Start from random* and *Start blank* on the sheet.

**Slot rail.** The nine slots, each with a thumbnail of its current asset (dashed when
empty). One slot is open at a time. Keys 1–9 jump. Dividers group head items, facial
hair, and add-ons. Mustache, Beard, and Long beard stay separate because they combine.

**Picker.** Only the grid scrolls. Pinned above it, in order:
1. The slot's tint swatches. The tint is usually obvious from the photo before the
   shape is, and grid thumbnails are drawn in the chosen tint.
2. A filter on asset labels (`/` to focus) with a match count.
3. Recent: the last 8 assets used in this slot, per designer (browser storage).

The grid is virtualised so hundreds of assets stay fast.

**Preview before commit.** Hovering or arrow-keying onto a tile or swatch draws it on
the proof without committing. Click or Enter commits. Esc restores what was there.

Shortcuts are listed in a `?` popover, not written on screen.

## Not in scope

- Clicking the figure to open a slot (considered and dropped).
- "Used in this batch" suggestions. They need entry figures in the batch response.
- Asset tags or categories. They need a schema change, and filtering on labels plus
  Recent should be enough.
- Dark mode.

## Progress

- [ ] Tokens, fonts, and a PrimeVue preset (neutral surfaces, cyan primary).
- [ ] Remove the site title bar. Page header rows on the batch list and batch page.
- [ ] Batch list as a ledger with a status bar. Status shown as glyph plus text.
- [ ] Editor layout: header row with meta controls, reference column, proof sheet.
- [ ] Done, next entry, and keyboard shortcuts (←/→, ⌘S, ⌘↵, `?`).
- [ ] Slot rail and picker with pinned tint, filter, and Recent.
- [ ] Virtualised asset grid with tint-drawn thumbnails.
- [ ] Preview on hover and keyboard, commit on click or Enter, Esc to restore.
- [ ] Empty-figure start choice on the proof.
