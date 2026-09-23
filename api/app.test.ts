import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createTestAccessKeys } from '../test/access-tokens'
import { createApp } from './app'

// Every route not listed here must require Access. Adding a public route means
// adding it here on purpose, so an unguarded route can't slip in unnoticed.
const UNAUTHENTICATED_ROUTES = new Set([
  'GET /api/health',
  'GET /api/public/batch',
  'POST /api/public/submission',
])

const DEPLOYED_ORIGIN = 'https://stick.example.com'

describe('GET /api/health', () => {
  it('responds ok without sign-in', async () => {
    const response = await createApp().request(`${DEPLOYED_ORIGIN}/api/health`, {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('route guard', () => {
  it('requires Access on every route except the allowed public ones', async () => {
    const { resolveKeys } = await createTestAccessKeys()
    const app = createApp({ resolveAccessKeys: resolveKeys })
    const guardedRoutes = app.routes
      .filter(route => route.method !== 'ALL')
      .map(route => ({ method: route.method, path: route.path.replaceAll(/:\w+/g, 'x') }))
      .filter(route => !UNAUTHENTICATED_ROUTES.has(`${route.method} ${route.path}`))

    expect(guardedRoutes.length).toBeGreaterThan(0)
    for (const route of guardedRoutes) {
      const response = await app.request(`${DEPLOYED_ORIGIN}${route.path}`, { method: route.method }, env)
      expect(response.status, `${route.method} ${route.path}`).toBe(401)
    }
  })
})
