import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestAccessKeys } from '../../test/access-tokens'
import { createApp } from '../app'

const DEPLOYED_URL = 'https://stick.example.com/api/me'
const LOCAL_URL = 'http://localhost/api/me'

let testKeys: Awaited<ReturnType<typeof createTestAccessKeys>>
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  testKeys = await createTestAccessKeys()
  app = createApp({ resolveAccessKeys: testKeys.resolveKeys })
})

const withToken = (token: string) => ({ headers: { 'Cf-Access-Jwt-Assertion': token } })

describe('Access auth', () => {
  it('accepts a valid token and exposes the user email', async () => {
    const token = await testKeys.sign({ email: 'ada@example.com' })
    const response = await app.request(DEPLOYED_URL, withToken(token), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: 'ada@example.com' })
  })

  it('rejects a request without a token', async () => {
    const response = await app.request(DEPLOYED_URL, {}, env)

    expect(response.status).toBe(401)
  })

  it.each([
    ['wrong audience', { audience: 'some-other-app' }],
    ['wrong issuer', { issuer: 'https://evil.cloudflareaccess.com' }],
    ['expired', { expiresIn: '-1m' }],
  ])('rejects a token with the %s', async (_label, overrides) => {
    const token = await testKeys.sign(overrides)
    const response = await app.request(DEPLOYED_URL, withToken(token), env)

    expect(response.status).toBe(401)
  })

  it('rejects a token signed by a different key', async () => {
    const otherKeys = await createTestAccessKeys()
    const token = await otherKeys.sign()
    const response = await app.request(DEPLOYED_URL, withToken(token), env)

    expect(response.status).toBe(401)
  })

  describe('dev bypass', () => {
    const envWithBypass = { ...env, ACCESS_DEV_BYPASS_EMAIL: 'dev@example.com' }

    it('signs in as the bypass user on localhost', async () => {
      const response = await app.request(LOCAL_URL, {}, envWithBypass)

      expect(await response.json()).toEqual({ email: 'dev@example.com' })
    })

    it('is ignored on any other hostname', async () => {
      const response = await app.request(DEPLOYED_URL, {}, envWithBypass)

      expect(response.status).toBe(401)
    })
  })
})
