# Stick Generator

Internal tool for turning follower submissions into stick-figure portraits.
Followers submit a photo and a few answers through a batch invite link. Designers
compose a matching figure from layered assets and save a flat PNG to R2.

This is **v2**, a rewrite of the original SvelteKit / Pages app. For the plan and
status, start at [docs/planning/](./docs/planning/README.md).

## Stack

One Cloudflare Worker serves both the Vue 3 SPA (static assets) and a Hono API under
`/api`. Records live in D1, images in R2, and Cloudflare Access (Zero Trust) handles
sign-in.

## Quick start

```sh
pnpm install
pnpm run dev:init   # local D1: apply migrations and seed demo data
pnpm run dev        # http://localhost:5173, signed in as the dev bypass user
```

See [SETUP.md](./SETUP.md) for prerequisites, environments, and provisioning.

## Commands

| Command | Does |
|---------|------|
| `pnpm run dev` | Vite + the Worker runtime locally, with local D1/R2 |
| `pnpm run check` | Lint, typecheck, and tests. CI runs the same |
| `pnpm run test` | API tests inside the Workers runtime (vitest-pool-workers) |
| `pnpm run build` | Typecheck and build SPA + Worker into `dist/` |
| `pnpm run lint:fix` | Auto-fix lint and formatting |

## Layout

```
api/          Worker: Hono app, middleware, routes, services
shared/       Code used by both the Worker and the SPA (schemas, constants)
src/          Vue SPA
migrations/   D1 migrations (numbered, additive)
scripts/      Dev seed, one-off scripts, mug mockup pipeline
seed/         v1 layer PNGs used as local dev data
test/         Test helpers and setup
docs/         Planning docs
```
