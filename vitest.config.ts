import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Only the `test` environment in wrangler.jsonc is safe to run tests against.
// Default it here so running `vitest` directly behaves the same as `bun run test`.
process.env.CLOUDFLARE_ENV ??= 'test'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        },
      },
    })),
  ],
  test: {
    include: ['api/**/*.test.ts', 'shared/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
})
