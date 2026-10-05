# Setup

## Prerequisites

- **Node 24** (see `.node-version`) and **pnpm** (version pinned in `package.json`
  `packageManager`). In the Roastery sandbox both come from mise.
- A Cloudflare account with access to the `stick-generator` resources, only needed for
  remote commands and deploys. Local dev needs no account.

## Local development

```sh
pnpm install
pnpm run dev:init     # apply migrations to the local D1 and seed two demo channels
pnpm run dev
```

- Local D1 and R2 live in `.wrangler/state/` (gitignored). To start over, delete that
  directory and run `pnpm run dev:init` again. The seed is idempotent.
- **Sign-in locally:** the `dev` environment sets `ACCESS_DEV_BYPASS_EMAIL`, so every
  request to `localhost` is treated as that user. The bypass only works when the var is
  set *and* the hostname is local. Deployed Workers never honour it.
- `pnpm run wrangler:types` regenerates `worker-configuration.d.ts` (gitignored) from the
  **production** environment. `dev`, `build`, and `typecheck` run it for you.
- pnpm only runs install scripts for `esbuild` and `workerd` (see `pnpm-workspace.yaml`).
  If a new dependency needs one, add it there on purpose.

### Worktrees

A fresh worktree has no `node_modules` and an empty local D1. Run `pnpm install` inside
it (pnpm hardlinks from its store, so this is cheap), then `pnpm run dev:init`. Don't
symlink `node_modules` from another checkout.

## Tests

`pnpm run test` runs the API tests inside the real Workers runtime using the `test`
environment from `wrangler.jsonc`. Migrations are applied before the tests run.

- `compatibility_date` must not be newer than the date the bundled workerd in
  `@cloudflare/vitest-pool-workers` supports. If tests fail to start with "requires
  compatibility date …", that is the cause.
- Access tokens in tests are signed with a throwaway key (`test/access-tokens.ts`).

## Environments

| Env | Where | D1 | R2 buckets | Access |
|-----|-------|----|------------|--------|
| `dev` | local only | local | local | bypassed on localhost |
| `test` | local only (vitest) | local | local | test-signed tokens |
| `staging` | Cloudflare | `stick-generator-staging` | `stick-figures-staging`, `stick-figures-assets-staging` | Zero Trust |
| `production` | Cloudflare | `stick-generator-production` | the existing v1 buckets `stick-figures`, `stick-figures-assets` (v2 writes only under `v2/`) | Zero Trust |

## Provisioning Cloudflare resources (one-time, per environment)

Not done yet. The staging and production entries in `wrangler.jsonc` hold `TODO`
placeholders.

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create stick-generator-staging      # copy database_id into wrangler.jsonc
pnpm exec wrangler r2 bucket create stick-figures-staging
pnpm exec wrangler r2 bucket create stick-figures-assets-staging
pnpm exec wrangler d1 create stick-generator-production   # prod buckets already exist from v1
pnpm run db:migrate:staging
```

### Zero Trust Access

v1 is already behind a Zero Trust Access application. For each v2 hostname:

1. Add the hostname to the Access application, or create one with the same team policy.
2. Copy the application's **AUD tag** into `ACCESS_AUD` and the team domain
   (`<team>.cloudflareaccess.com`) into `ACCESS_TEAM_DOMAIN` for that environment in
   `wrangler.jsonc`. Neither value is secret.
3. *(Phase 1, not yet)* Add a **Bypass** policy for exactly `/join` and `/api/public/*`.
   Nothing else may be bypassed. The Worker verifies the Access JWT on every other
   route, and a test enforces that.

## Enabling deploys

`.github/workflows/deploy.yml` deploys `main` to staging and `v*` tags to production,
but only when the repo variable `DEPLOY_ENABLED` is `true`. Before turning it on:

1. Finish provisioning (above) for the target environment.
2. Add repo secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token needs
   **Workers Scripts: Edit**, **D1: Edit**, and **Workers R2 Storage: Edit**, because
   `wrangler deploy` validates every binding.
3. Set the repo variable `DEPLOY_ENABLED=true`.

To deploy by hand, build with the environment selected. The Vite plugin bakes it into
the output:

```sh
CLOUDFLARE_ENV=staging pnpm run build
pnpm exec wrangler d1 migrations apply DB --env staging --remote
pnpm exec wrangler deploy
```
