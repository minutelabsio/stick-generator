import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Only the `test` environment in wrangler.jsonc is safe to run tests against.
// Default it here so running `vitest` directly behaves the same as `pnpm run test`.
process.env.CLOUDFLARE_ENV ??= 'test'

const ALIASES = {
  '@': path.join(import.meta.dirname, 'src'),
  '@shared': path.join(import.meta.dirname, 'shared'),
}

export default defineConfig({
  test: {
    projects: [
      {
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
          name: 'worker',
          include: ['api/**/*.test.ts', 'shared/**/*.test.ts'],
          setupFiles: ['./test/setup.ts'],
        },
      },
      // The SPA's pure logic (figure edits, layer resolution) needs no Workers runtime or DOM.
      {
        resolve: { alias: ALIASES },
        test: {
          name: 'spa',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
