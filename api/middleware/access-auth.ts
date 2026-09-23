import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTVerifyGetKey } from 'jose'

export interface AccessUser {
  email: string
}

export type AccessKeyResolver = (teamDomain: string) => JWTVerifyGetKey

interface AuthenticateOptions {
  env: Env
  requestUrl: string
  token: string | undefined
  resolveKeys: AccessKeyResolver
}

interface VerifyOptions {
  env: Env
  token: string
  resolveKeys: AccessKeyResolver
}

const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion'
const DEV_BYPASS_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

const unauthorized = (reason: string) => new HTTPException(401, {
  res: Response.json({ error: `Not signed in: ${reason}. Reload the page to sign in again.` }, { status: 401 }),
})

// Caches one JWKS per team domain for the life of the isolate, so keys are not
// refetched on every request. jose handles key rotation inside the set.
export function createRemoteAccessKeys(): AccessKeyResolver {
  const keySets = new Map<string, JWTVerifyGetKey>()
  return (teamDomain) => {
    const cached = keySets.get(teamDomain)
    if (cached) return cached
    const keySet = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
    keySets.set(teamDomain, keySet)
    return keySet
  }
}

export function createAccessAuth(resolveKeys: AccessKeyResolver) {
  return createMiddleware<{ Bindings: Env, Variables: { user: AccessUser } }>(async (c, next) => {
    const user = await authenticate({
      env: c.env,
      requestUrl: c.req.url,
      token: c.req.header(ACCESS_JWT_HEADER),
      resolveKeys,
    })
    c.set('user', user)
    await next()
  })
}

async function authenticate({ env, requestUrl, token, resolveKeys }: AuthenticateOptions): Promise<AccessUser> {
  const bypassEmail = devBypassEmail(env, requestUrl)
  if (bypassEmail) return { email: bypassEmail }
  if (!token) throw unauthorized('no Access token on the request')

  const payload = await verifyAccessToken({ token, env, resolveKeys })
  if (typeof payload.email !== 'string') throw unauthorized('the Access token has no email')
  return { email: payload.email }
}

// The bypass var only exists in the dev environment's config. Requiring a local
// hostname as well means a var set by mistake on a deployed Worker does nothing.
function devBypassEmail(env: Env, requestUrl: string) {
  if (!env.ACCESS_DEV_BYPASS_EMAIL) return null
  if (!DEV_BYPASS_HOSTNAMES.has(new URL(requestUrl).hostname)) return null
  return env.ACCESS_DEV_BYPASS_EMAIL
}

async function verifyAccessToken({ env, token, resolveKeys }: VerifyOptions) {
  try {
    const { payload } = await jwtVerify(token, resolveKeys(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    })
    return payload
  } catch {
    throw unauthorized('the Access token is invalid or expired')
  }
}
