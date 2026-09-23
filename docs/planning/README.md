# Planning docs

Planning for the stick-figure generator rewrite ("v2").

| Doc | Status | What it covers |
|-----|--------|----------------|
| [v1-functionality.md](./v1-functionality.md) | reference | What the current site actually does, its data layout, and its known problems |
| [v2-architecture.md](./v2-architecture.md) | planned | Target stack, data model, storage layout, auth, renderer design |
| [v2-public-intake.md](./v2-public-intake.md) | planned | Follower intake via one expiring invite link per batch, with the spam and abuse controls |
| [v2-phased-plan.md](./v2-phased-plan.md) | partial | The build, broken into shippable phases with exit criteria |

Read them in that order. The v1 doc is the requirements baseline. Anything v2 drops or
changes on purpose is marked as a deliberate change, not an oversight.

## Frontmatter convention

Every plan starts with YAML frontmatter so the set can be scanned quickly:

```yaml
---
status: planned        # implemented | partial | planned | research | reference | backlog
created: 2026-09-23    # YYYY-MM-DD, first added
updated: 2026-09-23    # YYYY-MM-DD, last meaningful edit
summary: "One line, no colons."
---
```

Flip `status` and bump `updated` as phases ship.
