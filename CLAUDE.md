# Agent guide

Stick Generator v2: an internal tool behind Cloudflare Zero Trust. Planning lives in
`docs/planning/` (start with its README). Setup and environments are in `SETUP.md`.

## Before writing code

- **Load the `coding-preferences` skill** (`.claude/skills/coding-preferences/`) before
  writing or reviewing code. The lint config enforces most of it. The rest is judgement.
- Use context7 for current library docs (Hono, Vue, PrimeVue, zod, wrangler).
- Use the `workers-best-practices` and `wrangler` skills when touching `api/` or
  `wrangler.jsonc`.

## Commands

- `pnpm run check`: lint + typecheck + tests. Run it before every commit.
- `pnpm run dev:init` then `pnpm run dev` for local work.
- pnpm is the package manager. Don't use npm, yarn, or bun.

## Conventions

- **Thin handlers, fat services.** Routes validate with zod and call a service created
  by a factory that takes its dependencies (e.g. `createEntryService(env.DB)`).
- **Public vs. team routes.** Everything under `/api` requires Access, except routes
  registered before the Access middleware in `api/app.ts`. Adding one means adding it to
  `UNAUTHENTICATED_ROUTES` in `api/app.test.ts` deliberately.
- **Shared contracts** (API response schemas, figure config, layer order) live in
  `shared/` and are imported by both sides.
- **Migrations are additive.** Never edit a shipped migration. Add a new numbered file.
- **Error messages say why** and what the user can do next. Unexpected errors return a
  generic "Server error" and log details with `logger` (never `console`).
- **Tests** cover what can lose data or leak it: auth, validation, concurrency,
  constraints. Skip mundane tests.
- Commit in small, focused steps with messages that explain why.

## Layout

See `README.md`. Files are kebab-case, including Vue components.
