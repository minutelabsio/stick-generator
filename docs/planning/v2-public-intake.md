---
status: planned
created: 2026-09-23
updated: 2026-10-05
summary: "Follower intake via one expiring invite link per batch, replacing Google Forms. Includes the spam and abuse controls."
---

# v2 public intake (batch invite links)

This replaces the Google Form, the Apps Script hook, and the CSV + photo import.
Followers submit their answers and photo directly into v2 through an invite link that
expires.

Architecture context: [v2-architecture.md](./v2-architecture.md). Build phase:
[Phase 1](./v2-phased-plan.md#phase-1-batch-invites-and-public-intake).

## Decisions so far

- **Invite only.** There is no open or public sign-up.
- **One link per batch.** Every subscriber in a batch gets the same link or code.
  A batch is a v2 group.
- **Open by hand, hard close by date.** A batch takes submissions only while the team
  has switched it on *and* its close date hasn't passed. New batches start switched
  off, so nobody submits to a half-set-up batch. The close date is required and is a
  hard stop: reopening after it needs a later date. Anyone who missed it emails the
  team, and the team adds them by hand.
- **Questions belong to the channel**, not the batch: each channel asks its own
  subscribers its own questions, and every batch in it uses the channel's current
  form. Admins edit them without a deploy. Name, email, the likeness photo, and consent
  are built in and always asked.
- **Questions can change at any time**, including after people have answered. Each
  entry keeps a copy of the questions it was asked (see [Questions](#questions)).
- **The same email can submit more than once**, e.g. to answer for a friend or a
  partner. Each submission is its own entry.

## Flow

```
Team                                        Subscriber
────                                        ──────────
1. Create batch. Set close date, expected size,
   optional email allowlist (questions come
   from the channel)
2. Copy the batch link
3. Send it in one email / post to
   subscribers via the usual channel ──────────► 4. Opens https://<host>/join#<code>
                                                    (or goes to /join and types the code)
                                                 5. Enters name + email, answers questions,
                                                    picks and crops a photo, ticks consent
                                                 6. Submits and sees "Got it!"
7. Entries appear in the batch queue as "new"
8. Batch closes at the set time ─────────────► Late visitors see: "This batch has closed.
                                                    Email <contact> if you missed it."
9. Late emails → team adds a manual entry
   (or briefly reopens the batch)
```

## What a shared link changes

A per-person link proves who is submitting. A shared link does not. Once it is sent, it
is effectively **semi-public until it closes**: it can be forwarded, screenshotted, or
posted somewhere. The design accepts that, and relies on these instead:

1. **A short window.** The link only works while the batch is switched on and before
   `closes_at`.
2. **Human-scale caps.** A batch can have an optional submission limit, set just above
   its expected size. Submissions stop once it is reached.
3. **Bot friction.** Turnstile and rate limits apply to every submit.
4. **Rotation.** If the link leaks, the team rotates the code. The old link dies at once,
   and the new one goes out to subscribers.
5. **Nothing overwrites anything.** A submission can only *create* an entry. It can
   never edit or read an existing one, so a stranger holding the link can add junk but
   cannot touch real subscribers' data.
6. **Optional allowlist** (see below). Only emails on the subscriber list are accepted.

Because of point 5, followers **cannot edit a submission** once sent. If they need a
change, they email the team, the same as for late entries. This keeps the public side
write-once and removes a whole class of "who is allowed to edit this" problems.

## The batch code

- 12 characters from an unambiguous alphabet (no `0/O/1/I/L`), shown grouped as
  `XXXX-XXXX-XXXX`, which is about 58 bits. Guessing is hopeless behind the rate limit,
  and a person can still type it.
- The link is `https://<host>/join#<code>`. The fragment keeps the code out of server
  logs and `Referer` headers. Email link scanners that pre-open the link do nothing,
  because **no GET request ever changes state**. The join page strips the fragment from
  the address bar, then sends the code in a header. `/join` without a code shows a
  "type your code" box.
- The code is stored in plain text, because the team needs to copy the link again at
  any time and it is already shared with many people. Its protection is expiry and
  rotation, not secrecy at rest.
- **Rotate** creates a new code and invalidates the old one immediately. Entries
  already submitted are unaffected.

## Questions

Set per channel on its **Intake form** page: an ordered list, not a form builder.

| Type | Follower sees | Settings |
|------|---------------|----------|
| `text` | One line, or a box when `multiline` | `maxLength` (≤ 2000, default 500) |
| `email` | An email field | none |
| `select` | A drop-down | `options` (1–50), `allowOther`: adds "Other…" with a text box |
| `radio` | Radio buttons | `options` (1–50) |
| `image` | A photo picker | none. At most 3 per form, 5 MB each |

Every question also has a permanent `id` (made when it is added, never edited), a
`label`, optional `help`, `required`, and `highlight` (show the answer beside the
editor's canvas). A form has at most 20 questions.

**Robust to change.** An entry stores each answer together with a copy of the
question as it was asked (label, type, options). Old entries always show what the
person was actually asked, whatever happens to the form later: a question can be
reworded, have its options changed, or be removed without breaking or misreporting
them. Because ids never change, a reworded question is still the same question.
`highlight` is the exception: it is a display choice, so the editor takes it from the
channel's current form when the question still exists, and from the copy otherwise.

A follower who loaded the form before an admin changed it submits against the current
form. Answers to removed questions are dropped. A newly required question that is
missing gets "This form was updated while you were filling it in. Reload the page
to see what changed."

## Channel intake settings

Stored together as one JSON document on the channel (`channels.intake`), validated by
one zod schema, `IntakeSettings` in `shared/`. Like the rig, it is small and always read
and saved whole.

| Setting | Purpose | Default |
|---------|---------|---------|
| `instructions` | Shown at the top of the join form: what the figure is for and what to send. Plain text, line breaks kept, ≤ 2000 characters | none |
| `questions` | See [Questions](#questions) | empty |
| `thankYouMessage` | Shown after a successful submit. Plain text, line breaks kept, ≤ 1000 characters | "Got it, thanks! We'll draw your stick figure soon." |
| `consentText` | Shown next to the required checkbox. Each entry keeps the text it agreed to | default text (needs Q5 answered) |
| `contactEmail` | Shown in the closed, full, and error messages | none |

## Batch settings (on the group)

| Setting | Purpose | Default |
|---------|---------|---------|
| `name` | Shown to the team and at the top of the join page. Can be renamed | required |
| `is_open` | The manual switch. Submissions are taken only while it is on | off |
| `closes_at` | Required hard stop. Must be in the future when set, and switching on a batch whose date has passed asks for a later date first | +14 days |
| `max_submissions` | Optional limit. The page shows "This batch is full" once it is reached. Clearing it removes the limit | none |
| `allowlist` (on/off) + uploaded `name,email` list | Only accept emails on the list | off |

What the join page shows follows from these, checked in this order:

| State | When |
|-------|------|
| `closed` | switched off, or `closes_at` has passed |
| `full` | a limit is set and that many entries have been submitted |
| `open` | otherwise |

The limit counts every entry submitted through the link, skipped ones included, so
clearing out junk doesn't reopen room for more of it. Raise the limit to make room.

## Email allowlist (optional, per batch)

If the team has the subscriber list for a batch, it can turn this on:

- Upload or paste `name,email`. Emails are normalised (trimmed, lower-cased).
- A submission whose email is not on the list is rejected with a neutral message:
  "We couldn't match that email to this batch. Use the email your invitation was sent to,
  or contact <contact>."
- The list also gives a **"not yet submitted"** view, so the team can chase people
  before the window closes.
- Limitation: it checks that the email is *on the list*, not that the person *owns* it.
  Someone holding the link and knowing a subscriber's email could submit as them.
  Proving ownership would need an emailed confirmation code. That is listed as an
  optional later step, not planned by default.

## Repeat submissions

One person may submit several times with the same email, for example for a friend or
a partner. That is allowed.

- Each submission always creates a **new entry**. Nothing is merged or overwritten.
- Entries are not flagged as duplicates. A designer who spots a true repeat marks it
  `skipped`, and the bulk clean-up (#14) handles junk.
- The batch cap (#2) is the ceiling on how many entries one leaked link can add.

## Spam and abuse controls

| # | Control | Stops | Where |
|---|---------|-------|-------|
| 1 | **Open switch and close date** (`is_open`, `closes_at`), enforced on the server | the link staying useful after the batch | submit handler |
| 2 | **Hard submission cap** per batch | a leaked link being used to flood the batch | submit handler: one conditional `INSERT … SELECT … WHERE (count) < cap` statement, because D1 has no interactive transactions |
| 3 | **Rotate code** | a known leak. The old link dies immediately | team UI |
| 4 | **Write-once public API**. It only creates entries and takes no entry, group, or R2 key parameters. The batch comes from the code | reading or editing anyone else's submission. IDOR-style bugs | public router |
| 5 | **Cloudflare Turnstile** on every submit, verified server-side (`siteverify`, checking `hostname` and `action`). Always on, because the link is shared | scripted or bulk submissions | submit handler |
| 6 | **Per-IP rate limits** on `/api/public/*` (Workers Rate Limiting binding): a loose limit for code checks, a tight one for submits (e.g. 5 / 60 s). Wrong codes count too | code guessing and floods | middleware |
| 7 | **Optional email allowlist** | people outside the subscriber list | submit handler |
| 8 | **Answers checked against the channel's form** with the same zod rules on both sides: types, max lengths, options from the list only, "Other" only where allowed. Control characters are stripped and text is NFC-normalised | malformed or oversized answers, invented options | submit handler (shared rules) |
| 9 | **Hard size limits**: each image ≤ 5 MB after client processing. The whole request is rejected from `Content-Length` before the body is read | storage and cost abuse | submit handler |
| 10 | **Image type check by magic bytes** (JPEG/PNG/WebP only), for the photo and every image answer. Stored under a server-chosen key and served to the team with the stored `Content-Type` and `X-Content-Type-Options: nosniff`. Uploaded file names are ignored | disguised files and content-sniffing tricks | submit handler + `/api/files` |
| 11 | **Strict isolation from the team app**: Zero Trust bypass for *only* `/join` and `/api/public/*`. Every other route still requires the Access JWT, with a test that enumerates routes to prove it | a misconfigured bypass exposing team endpoints | Access + Hono |
| 12 | **Page hardening**: `Referrer-Policy: no-referrer`, a tight CSP (self + `challenges.cloudflare.com`), `X-Frame-Options: DENY`, no third-party scripts | code leakage, clickjacking, and injected scripts | join page responses |
| 13 | **Answers, question labels, and options are plain text only**, rendered as text in the team UI and on the join page, never as HTML (`vue/no-v-html` fails lint) | stored XSS aimed at designers or followers | team UI + join page |
| 14 | **Bulk clean-up**: select entries in the queue by submit time and mark them `skipped` | clearing out a burst of junk after a leak | team UI |

Notes:

- **#2 and #6.** The Workers rate limiter is per-location and approximate, so it works as
  a flood guard, not an exact quota. The batch cap (#2) is the real ceiling, and it is
  exact because it is checked in D1.
- **#11** matters most. A path-based bypass policy can be mistyped. That is why the app
  checks the Access JWT itself on every non-public route, and why a test enforces it.
- **Abuse visibility.** Each entry records the submit time and a salted hash of the
  client IP (`submit_ip_hash`), so a burst from one source is easy to spot and clear
  with #14. The hash is dropped when photos are purged.

## Photo handling (in the follower's browser)

1. `<input type="file" accept="image/*">`, which also opens the camera on mobile.
   iOS delivers HEIC photos as JPEG through this input.
2. Decode with `createImageBitmap`. On failure, show "We couldn't read that image. Try a
   JPEG or PNG."
3. A simple crop step (drag or zoom a portrait frame around the face) gives designers a
   consistent framing.
4. Downscale to at most 1600 px on the long edge, then **re-encode to JPEG via canvas**.
   This strips all EXIF data, including GPS location. The server still enforces #9 and
   #10, because clients can't be trusted.
5. The photo is uploaded with the submit. The server never sends photos back to the
   public side.

Image answers go through steps 1, 2, 4, and 5. Only the likeness photo is cropped.

## Consent and privacy

- A required checkbox with the channel's consent text: what the photo is used for, who
  sees it, and how long it's kept.
- Each entry stores `consent_at` and the exact `consent_text` it agreed to.
- "Purge photos" on archived batches deletes likeness objects and IP hashes, and clears
  the allowlist. How long to keep things is open question Q5.

## Data model

Changes to [v2-architecture.md](./v2-architecture.md#data-model-d1). They fold into
`0001_init.sql`.

```sql
-- channels: intake settings
--   intake           TEXT NOT NULL        -- JSON IntakeSettings, see Channel intake settings

-- groups (= batches): intake settings
--   join_code        TEXT UNIQUE          -- current code; NULL = intake disabled (manual-only batch)
--   is_open          INTEGER NOT NULL DEFAULT 0
--   closes_at        TEXT                 -- required whenever join_code is set
--   max_submissions  INTEGER              -- NULL = no limit
--   allowlist_on     INTEGER NOT NULL DEFAULT 0

-- entries: submission metadata
--   answers          TEXT NOT NULL        -- JSON [{ question: <copy as asked>, value }]
--   status           new | in_progress | done | skipped
--   submitted_at     TEXT                 -- NULL for manual / v1 entries
--   consent_at       TEXT
--   consent_text     TEXT                 -- the text agreed to
--   submit_ip_hash   TEXT

CREATE TABLE batch_allowlist (
  group_id  TEXT NOT NULL REFERENCES groups(id),
  email     TEXT NOT NULL,                 -- normalised
  name      TEXT,
  PRIMARY KEY (group_id, email)
);

CREATE INDEX idx_entries_group_email ON entries (group_id, lower(email));
```

Image answers are stored in R2 at `v2/answers/<entryId>/<questionId>-<random>.<ext>`,
and the answer holds that key.

The v1 migration turns each old CSV column into a `text` question copy on each entry's
answers, so old entries display the same way as new ones.

## API

Public (Zero Trust bypass, code in the `X-Join-Code` header):

| Method + path | Purpose |
|---------------|---------|
| `GET /api/public/batch` | Validates the code. Returns `{ channelName, batchName, state: open\|closed\|full, closesAt, instructions, questions, thankYouMessage, consentText, contactEmail }`. A wrong code returns the same response as `closed`, except that a real closed batch names its contact email. That lets someone tell a once-real code from a made-up one, which is accepted: a closed code can submit nothing, and the email is meant for subscribers. The channel and batch names stay hidden |
| `POST /api/public/submission` | Multipart: `name`, `email`, `answers` (JSON, keyed by question id), `photo`, one `image:<questionId>` file per image answer, `consent`, `turnstileToken`. Creates one entry. Returns `{ ok: true }` |

Team (Access):

| Method + path | Purpose |
|---------------|---------|
| `GET` · `PUT /api/channels/:id/intake` | The channel's instructions, questions, thank-you message, consent text, and contact email |
| `PATCH /api/batches/:id` | Batch settings: name, open switch, close date, limit (and later the allowlist toggle) |
| `POST /api/batches/:id/rotate-code` | New code. The old one is invalid immediately |
| `GET /api/batches/:id/export.csv` | Every entry's responses: a column per question ever asked (current form first, matched by id), image file names as storage paths below `v2/`, and cells starting with `= + - @` prefixed with `'` so they can't run as formulas |
| `PUT /api/batches/:id/allowlist` · `GET …/allowlist?status=pending` | Replace the list. See who hasn't submitted |

## Team UI

- **Channel → Intake form**: instructions, the questions editor (an ordered list, not a
  form builder), thank-you message, consent text, and contact email.
- **Batch → Intake**: rename, the open switch, close date, and limit, plus (later)
  allowlist upload and a **Preview** button that opens the join page in no-submit mode.
- **Batch → Share**: the link and the code, each with a copy button, a live status
  line ("Open · 41 / 60 submitted · closes Fri 3 Oct"), and **Rotate code**.
- **Queue**: multi-select to skip entries. With the allowlist on, a "Not yet
  submitted" list.

## The join page

- A **separate, lightweight Vite entry** (`join.html`) that doesn't ship the team app.
  It should load fast on mobile and has nothing to leak.
- It is mobile-first and fits on one screen: channel and batch name, name + email,
  photo + crop, the channel's questions, consent, submit.
- It has clear states for loading, open, closed, full, and submitted.
  Every closed, full, or error state names the contact email.

## Tests (critical paths only)

- Switch, date, and limit: submits while switched off or after `closes_at` are
  rejected. The limit holds under concurrent submits.
- Rotation: the old code fails immediately after rotating.
- Write-once: the public API has no path to read or modify an existing entry.
  A second submit with the same email creates a second entry and leaves the first alone.
- Answers: an option not in the list, "Other" where it isn't allowed, an over-long
  answer, and a missing required answer are each rejected. Answers to questions the
  form no longer has are dropped. Control characters are stripped.
- Changing a question after people answered leaves their entries showing what they
  were asked.
- Allowlist: when on, unlisted emails are rejected. When off, any email is accepted.
- Route guard: every non-public route returns 401/403 without an Access JWT.
- Upload: oversize requests are rejected before the body is read. Wrong magic bytes are
  rejected, for the photo and for image answers. A failed Turnstile check rejects the
  submit.

## Open questions

| # | Question | Default if unanswered |
|---|----------|-----------------------|
| I1 | ~~Subscriber list source~~ Only needed if the allowlist is used. Any `name,email` CSV works | Resolved |
| I2 | ~~Open sign-up?~~ No. Invite only | Resolved |
| I3 | ~~Default questions~~ None. Configured per channel | Resolved |
| I4 | Should the allowlist be on by default for new batches? | Off, turned on per batch when a list is available |
