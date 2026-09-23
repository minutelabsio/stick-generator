import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Only the `test` environment in wrangler.jsonc is safe to run tests against.
// Default it here so running `vitest` directly behaves the same as `bun run test`.
process.env.CLOUDFLARE_ENV ??= 'test'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
  test: {
    include: ['api/**/*.test.ts', 'shared/**/*.test.ts'],
  },
})
