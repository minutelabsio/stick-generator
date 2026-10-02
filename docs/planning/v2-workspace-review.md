---
status: planned
created: 2026-10-02
updated: 2026-10-02
summary: "Accepted workspace redesign improvements, grouped by size of change."
---

# Workspace redesign: accepted improvements

Items accepted from the review of the batch list, batch page, editor, and join page,
grouped by how involved they are. Rejected and undecided items were removed. Within a
group, order is a suggestion, not a commitment.

Based on [v2-workspace-design.md](./v2-workspace-design.md). The running app was not
inspected during the review, so layout details need a check in a browser.

## Small: a few lines, one file

- [ ] Batch list rows use a real `RouterLink` (middle-click, new tab, keyboard), not only a row click.
- [ ] Batch page name cell is a real `RouterLink`. Today only the row click navigates.
- [ ] Show ⌘↵ in a tooltip on the Done button.
- [ ] `beforeunload` guard for closing the tab with unsaved changes.
- [ ] Stronger unsaved indicator than the small dot on Save.
- [ ] Confirm before Randomise replaces a figure. Drop this if undo lands first.

## Medium: one screen, no new API

- [ ] **Start / Continue** button in the batch page header that opens the first new or in-progress entry.
- [ ] Status filter chips (New, In progress, Done, Skipped) with counts. Use the PrimeVue DataTable's built-in filtering.
- [ ] Search by name or email.
- [ ] Editor ←/→ and "Done, next entry" follow the batch page's active filter and sort, passed in the query string. Builds on the two items above.
- [ ] Put status on one save model. Today the select saves status immediately but leaves figure edits unsaved.
- [ ] Zoom or loupe on the reference photo.
- [ ] Undo and redo (⌘Z). Preview-on-hover makes accidental commits more likely.

## Large: API, schema, or new flows

- [ ] **Concurrency check on save**, using the existing `entries.version` column.
  - The client sends the version it loaded, and the update becomes `WHERE id = ? AND version = ?`. A mismatch returns 409.
  - The editor then says "Saved by another session at TIME" and offers Reload or Overwrite. No user names, since identity stays with Cloudflare Access.
  - Save the figure before uploading the render, so a rejected save can't leave the losing edit's PNG behind.
- [ ] **Batch menu** on the batch page: extend, close early, rotate link, edit name and questions.
- [ ] **Add and edit an entry manually** from the batch page, for photos emailed in. Needs photo upload from the team side (also in Phase 3 of the phased plan).
- [ ] **Bulk export** from the batch page: a zip of done PNGs and a CSV of names and emails.
