@AGENTS.md

## Claude-specific

- **Load the `coding-preferences` skill** before writing or reviewing code in `api/`,
  `shared/`, `src/`, or `scripts/`.
- Use the `workers-best-practices` and `wrangler` skills when touching `api/` or
  `wrangler.jsonc`, and the `cloudflare` skill for D1, R2, Access, or Turnstile questions.
- Use context7 for current library docs (Hono, Vue, PrimeVue, zod, jose, wrangler)
  rather than relying on memory. Several of these moved major versions recently.
