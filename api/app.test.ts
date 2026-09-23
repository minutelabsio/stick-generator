import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const response = await createApp().request('/api/health', {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
