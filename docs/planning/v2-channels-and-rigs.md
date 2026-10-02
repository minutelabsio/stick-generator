---
status: planned
created: 2026-10-02
updated: 2026-10-02
summary: "Figure rig as data, then channels that each own their batches, assets, palettes, and rig."
---

# Channels and figure rigs

Several channels use the tool, each with its own art style and subscribers. Admins
need each channel's assets and subscribers kept apart so they can change on their own.
There is no access control between channels: an admin is an admin, and a channel is
only a way of organising work.

All channels draw figures the same way for now. Later, admins may add their own asset
categories, placed in the draw order. So the drawing structure becomes data first,
with no visible change, and channels are built on top of it.

Build phases: [Phase 0.5 and Phase 0.6](./v2-phased-plan.md#phase-05-figure-rig-as-data).

## Vocabulary

| Term | Meaning | Today in code |
|------|---------|---------------|
| **Channel** | The top-level grouping. Owns batches, assets, palettes, and a rig | New |
| **Rig** | How a channel's figures are drawn: canvas size, slots, colour roles, palettes, and layers | `shared/figure.ts` constants |
| **Slot** | A kind of asset a figure can have one of (hair, hat, glasses) | `SLOTS` |
| **Layer** | One step in the draw order: a slot's part, optionally painted with a colour role | `LAYERS` |
| **Colour role** | One colour choice on a figure (skin, hair, frame, lens). Several layers can share one | `COLOR_CHANNELS`, renamed in Phase 0.5 |
| **Palette** | A list of swatches that one or more colour roles pick from | `palettes` |

"Colour channel" is renamed to **colour role** so that "channel" means only the
top-level grouping. A colour role is not a palette: `hair` and `facialHair` are two
roles that both pick from the `hair` palette, so a figure can have brown hair and a
grey beard. "Colour role" also avoids a clash if slots are later called asset
categories.

## The rig

One zod schema in `shared/` describes a rig, and today's constants become one value
of it, `STICK_RIG`. Everything that reads `SLOTS`, `LAYERS`, `COLOR_CHANNELS`, or the
canvas constants receives a rig instead.

```ts
// Shape sketch. Field names settle during implementation.
interface Rig {
  canvas: { width: number, height: number }
  palettes: { id: string, label: string }[]
  colorRoles: {
    id: string
    label: string
    palette: string
    defaultColor?: string   // today's DEFAULT_COLORS
    followsRole?: string    // facial hair follows hair until set on its own
  }[]
  slots: {
    id: string
    label: string
    group: string           // the slot rail heading
    required: boolean
    parts: AssetPart[]      // which uploads the asset screen offers
    colorRoles: string[]
    randomFillChance: number
  }[]
  layers: { slot: string, part: AssetPart, colorRole?: string }[]  // back to front
}
```

Why the draw order is a list of layers and not a z-index per slot: one slot can sit at
several points in the stack. Hair and hat draw their back parts behind the body and
their front parts near the top.

Behaviour that is written as code against named slots today moves into rig fields:

| Today | Becomes |
|-------|---------|
| `RANDOM_FILL_CHANCE` in `figure-edits.ts` | `slot.randomFillChance` |
| `DEFAULT_COLORS` in `figure-edits.ts` | `colorRole.defaultColor` |
| `facialHair` copies `hair` in `randomFigure` and `fillMissingColors` | `colorRole.followsRole` |
| `initialFigure` picks the first body and head, and a random skin | Every required slot starts with its first asset, and its colour roles with a random swatch |
| `SLOT_GROUPS` in `slot-rail.vue` | `slot.group` |

The tinting model stays fixed: a line part painted with a colour role is recoloured,
and a painted mask part is a flat fill under the line art. A per-layer blend mode can
be added as an optional field later if a style needs it.

### Figures and validation

- `FigureConfig` keys become plain strings (`z.record(z.string(), …)`) instead of
  `z.enum(SLOT_IDS)`. Stored figure JSON does not change.
- The entry service validates a figure on write against the entry's rig: every slot
  and colour role must exist in it. Once channels exist, every asset must also belong
  to the entry's channel, checked in one query.
- The library response carries the rig, so the SPA draws with whatever the server
  says. Until channels exist, the server always returns `STICK_RIG`.

## Channels

### Data model

```sql
CREATE TABLE channels (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  rig          TEXT NOT NULL CHECK (json_valid(rig)),
  rig_revision INTEGER NOT NULL DEFAULT 1 CHECK (rig_revision >= 1),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at  TEXT
);
```

- `groups`, `assets`, and `palettes` each get `channel_id TEXT NOT NULL REFERENCES channels(id)`.
- `palettes` is keyed by `(channel_id, id)`, so each channel has its own swatches.
- `entries` and `batch_allowlist` are unchanged. They reach their channel through `group_id`.
- R2 keys are unchanged. Asset, likeness, and render keys already use unique IDs.
- The rig is one JSON document rather than tables. It is small, always read whole, and
  versioned whole.
- The `CHECK (slot IN (…))` on `assets` and `CHECK (id IN (…))` on `palettes` are
  dropped. The allowed values become per-channel data, which SQLite cannot check
  against JSON, so the services check them against the rig instead.

**Migration:** `0001_init.sql` has not shipped, because staging is not provisioned yet.
If that is still true when this lands, fold the change into `0001`. Dropping a CHECK
later means a table rebuild. Once anything is deployed, use a new numbered migration.

### API

| Method + path | Change |
|---------------|--------|
| `GET /channels` | New. Lists channels for the switcher |
| `GET /channels/:channelId/batches` · `POST /channels/:channelId/batches` | Replace `/batches` list and create. `GET /batches/:id` stays keyed by ID |
| `GET /channels/:channelId/library` | Replaces `/library`. Returns the channel's assets, palettes, and rig |
| `GET /entries/:id` | Adds `channelId`, so the editor knows which library to load |
| `PATCH /entries/:id` | Rejects slots, colour roles, or assets that are not in the entry's channel |
| Public intake | Unchanged routes. The join code leads to batch, then channel. The join page shows the channel's name |

### SPA

- A channel switcher in the header. The last channel used is remembered in `localStorage`.
- The batch list moves under `/c/:channelSlug`. Batch and entry pages stay keyed by ID
  and read the channel from their data.
- New batches are created in the current channel.
- Phase 1's Assets and Palettes screens are channel-scoped from the start.

## Later: admin-editable rigs (backlog)

Not scheduled. Phases 0.5 and 0.6 leave the rig as data, so this needs an editor and
the rules below, not another refactor.

- Slot and colour role IDs never change once used. Labels can be renamed.
- Slots are archived, never deleted, so old figures still render.
- Reordering layers is allowed. It bumps `rig_revision` and marks the channel's renders
  stale, using the Phase 5 re-render flow. The editor warns "this marks N renders out of date".
- A part or colour role can be removed only when no asset or figure uses it.
- New slots are always optional, so existing figures stay valid.
- Every save validates the whole rig: each layer names a real slot and part, each
  colour role names a real palette, and no `(slot, part)` pair appears twice.

The UI is a slot list plus an ordered layer list with drag to reorder.
