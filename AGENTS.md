# Agent guide

Stick Generator v2 is an internal tool behind Cloudflare Zero Trust. Read these first,
and don't repeat what they say here:

- `docs/planning/`: what is being built and in what order. Start with its README.
- `SETUP.md`: environments, local dev, provisioning, and deploys.
- `.claude/skills/coding-preferences/SKILL.md`: code conventions. Most are enforced by
  the linter, and the rest need judgement. Read it before writing or reviewing code.

## Working style

### Commit early and often

History is part of the documentation here, so keep each step easy to follow.

- **One logical change per commit.** Scaffold, lint config, test harness, schema, and
  auth each got their own commit, not one "set up project" commit. If a message needs
  "and", it is probably two commits.
- **Verify before every commit:** `pnpm run check` (lint + typecheck + tests), and
  `pnpm run build` when config or dependencies changed. Never commit red.
- **Keep mechanical changes separate from logic changes.** Moves, renames, deletions,
  and dependency swaps each go in their own commit, so reviewers can skim them and
  bisect stays useful.
- **Write messages that explain why.** A conventional prefix (`feat`, `fix`, `chore`,
  `test`, `ci`, `build`, `docs`) plus a subject, and a body for anything non-obvious:
  the trade-off taken, the version pinned and why, the thing that looked wrong but isn't.
- **Commit docs with the change they describe.** When a plan item lands, tick it in
  `docs/planning/v2-phased-plan.md` and bump the frontmatter `updated` (and `status`
  when a whole phase finishes).

### Scope

- Build in phase order. Don't pull later-phase work forward without asking.
- If a decision in the planning docs is still an open question, use its stated default
  and say so. Don't invent a new answer silently.
- Don't reference other or private projects in code, comments, docs, or commit messages.

## Commands and verification loop

`pnpm run check` is the gate. To see the app running:

```sh
CLOUDFLARE_ENV=dev pnpm exec vite dev --port 5199 --strictPort > dev.log 2>&1 & DEV_PID=$!
for i in $(seq 1 30); do curl -sf localhost:5199/api/health >/dev/null && break; sleep 1; done
curl -s localhost:5199/api/me
kill $DEV_PID
```

Stop the server by PID, not with `pkill -f "vite dev …"`. In a one-shot shell the
shell's own command line contains that text, so `pkill` kills the shell too (exit 144)
and anything after it, such as a `git commit`, never runs.

## Gotchas learned the hard way

### Dependencies

- **Check peer ranges before accepting a new major.** A plain `pnpm add` can pull in
  majors the rest of the toolchain doesn't support yet. TypeScript is pinned to `~6.0`
  (typescript-eslint needs <6.1) and Vitest to `^4` (required by
  `@cloudflare/vitest-pool-workers`). To check:
  `jq .peerDependencies node_modules/<pkg>/package.json`.
- **Respect pnpm's minimum-release-age gate.** If pnpm wants to add
  `minimumReleaseAgeExclude` entries, don't keep them. Loosen the version range so it
  picks a mature release.
- **Install scripts** are allow-listed in `pnpm-workspace.yaml` (currently esbuild and
  workerd). Add to it deliberately, never with `--all`.

### Types

- `worker-configuration.d.ts` is generated from the **production** environment. That
  makes production's bindings the contract and keeps them non-optional.
  - Dev-only vars go in `api/env.d.ts`, on the global `Env`, as optional.
  - Test-only bindings (like `TEST_MIGRATIONS`) go in `test/env.d.ts`, on
    `Cloudflare.Env`. That is the type of `env` from `cloudflare:workers`, and it is
    **not** the same interface as the global `Env`.
- In the SPA, parse API responses with the zod schemas in `shared/api-schemas.ts`
  (`safeParse`). Don't hand-narrow `unknown`: TypeScript won't carry narrowing through
  aliased conditions. In handlers, tie responses to the same schema type with
  `satisfies`.

### Tests

- Build the app with `createApp({ ...injectedDeps })` and call
  `app.request(url, init, env)`, with `env` from `cloudflare:workers`. Inject
  dependencies (e.g. the Access key resolver) instead of mocking modules.
- Auth tests must use a **non-localhost** URL (e.g. `https://stick.example.com/...`).
  On localhost, the dev bypass takes over whenever its var is set.
- The route-guard test in `api/app.test.ts` checks every registered route. When you add
  a route it covers the route automatically. When you add a *public* route, it fails
  until you list it, and that is intended.
- After changing the ESLint config, prove the new rule fires: write a scratch file with
  deliberate violations, run `pnpm exec eslint <file>`, then delete it.

### Database

- D1 has no interactive transactions. For check-then-write logic (like the batch
  submission cap), use one conditional statement (`INSERT … SELECT … WHERE …`) or
  `DB.batch()`. Never read in one query and write in another.
- Prefer a CHECK constraint to runtime validation for invariants the data must never
  break. Add a test in `api/schema.test.ts` for each new one.

## Conventions not covered by the linter

- **Thin handlers, fat services.** Routes validate with zod and call a service created
  by a factory that takes its dependencies (e.g. `createEntryService(env.DB)`).
- **Shared contracts** (API schemas, figure config, layer order) live in `shared/` and
  are imported by both the Worker and the SPA.
- **Migrations are additive.** Never edit a shipped migration. Add a new numbered file.
- **Error messages say why** and what the user can do next. Unexpected errors return a
  generic "Server error" and log details through `logger`.
- **Tests** cover what can lose data or leak it: auth, validation, concurrency, and
  constraints. Skip mundane tests.
