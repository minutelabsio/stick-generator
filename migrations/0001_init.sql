-- v2 initial schema. See docs/planning/v2-architecture.md and v2-public-intake.md.
-- Timestamps are ISO 8601 text (UTC). JSON columns are validated with json_valid().

-- A channel owns its batches, assets, and palettes, and draws its figures with its own
-- rig (shared/rig.ts), stored whole as JSON because it is small and always read whole.
CREATE TABLE channels (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  rig          TEXT NOT NULL CHECK (json_valid(rig)),
  rig_revision INTEGER NOT NULL DEFAULT 1 CHECK (rig_revision >= 1),
  -- IntakeSettings (shared/intake.ts): instructions, questions, thank-you message,
  -- consent text, and contact email. Every batch in the channel asks these.
  intake       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(intake) AND json_type(intake) = 'object'),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at  TEXT
);

-- A group is one batch of followers.
CREATE TABLE groups (
  id              TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL REFERENCES channels(id),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('intake', 'manual', 'v1')),
  -- NULL join_code means intake is disabled (manual-only batch).
  join_code       TEXT UNIQUE,
  opens_at        TEXT,
  closes_at       TEXT,
  max_submissions INTEGER CHECK (max_submissions IS NULL OR max_submissions > 0),
  allowlist_on    INTEGER NOT NULL DEFAULT 0 CHECK (allowlist_on IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at     TEXT,
  -- An open batch must have a window that closes after it opens.
  CHECK (join_code IS NULL OR (opens_at IS NOT NULL AND closes_at IS NOT NULL)),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);
CREATE INDEX idx_groups_channel ON groups (channel_id, created_at);

CREATE TABLE entries (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL REFERENCES groups(id),
  name            TEXT,
  email           TEXT,
  -- [{ question, value }]: each answer beside a copy of the question as it was asked,
  -- so changing the channel's form never changes what an old entry shows.
  answers         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(answers) AND json_type(answers) = 'array'),
  likeness_key    TEXT,
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'in_progress', 'done', 'skipped')),
  figure          TEXT CHECK (figure IS NULL OR json_valid(figure)),
  -- Optimistic concurrency: writers send the version they read and get a 409 on mismatch.
  version         INTEGER NOT NULL DEFAULT 0,
  render_key      TEXT,
  rendered_at     TEXT,
  render_stale    INTEGER NOT NULL DEFAULT 0 CHECK (render_stale IN (0, 1)),
  submitted_at    TEXT,
  consent_at      TEXT,
  -- The exact consent text agreed to.
  consent_text    TEXT,
  submit_ip_hash  TEXT,
  updated_by      TEXT,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_entries_group_status ON entries (group_id, status);
CREATE INDEX idx_entries_group_email ON entries (group_id, lower(email));

CREATE TABLE batch_allowlist (
  group_id TEXT NOT NULL REFERENCES groups(id),
  -- Stored normalised (trimmed, lower-cased) so lookups are exact matches.
  email    TEXT NOT NULL CHECK (email = lower(trim(email))),
  name     TEXT,
  PRIMARY KEY (group_id, email)
);

-- Which slots exist is per-channel data in the rig, which a CHECK cannot read, so the
-- services check slots against the rig instead.
CREATE TABLE assets (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL REFERENCES channels(id),
  slot        TEXT NOT NULL,
  label       TEXT NOT NULL,
  -- { line, mask?, backLine?, backMask? } → R2 keys
  parts       TEXT NOT NULL CHECK (json_valid(parts) AND json_extract(parts, '$.line') IS NOT NULL),
  thumb_key   TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  revision    INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  -- Archived assets are hidden from pickers but still render existing figures.
  archived_at TEXT,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_assets_channel_slot ON assets (channel_id, slot, sort);

-- Palette ids come from the channel's rig, so two channels can each have a "hair" palette.
CREATE TABLE palettes (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  id         TEXT NOT NULL,
  colors     TEXT NOT NULL CHECK (json_valid(colors) AND json_type(colors) = 'array'),
  PRIMARY KEY (channel_id, id)
);
