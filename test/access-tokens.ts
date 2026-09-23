import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { AccessKeyResolver } from '../api/middleware/access-auth'

// Mirrors the test environment's vars in wrangler.jsonc.
export const TEST_TEAM_DOMAIN = 'test.cloudflareaccess.com'
export const TEST_AUDIENCE = 'test-audience'

const SIGNING_ALGORITHM = 'RS256'
const KEY_ID = 'test-key'

interface SignOptions {
  email?: string
  audience?: string
  issuer?: string
  expiresIn?: string
}

export async function createTestAccessKeys() {
  const { privateKey, publicKey } = await generateKeyPair(SIGNING_ALGORITHM)
  const publicJwk = { ...await exportJWK(publicKey), kid: KEY_ID, alg: SIGNING_ALGORITHM }
  const keySet = createLocalJWKSet({ keys: [publicJwk] })
  const resolveKeys: AccessKeyResolver = () => keySet

  const sign = ({
    email = 'designer@example.com',
    audience = TEST_AUDIENCE,
    issuer = `https://${TEST_TEAM_DOMAIN}`,
    expiresIn = '5m',
  }: SignOptions = {}) => new SignJWT({ email })
    .setProtectedHeader({ alg: SIGNING_ALGORITHM, kid: KEY_ID })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey)

  return { resolveKeys, sign }
}
