import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { MeResponse } from '../shared/api-schemas'
import { logger } from './logger'
import { createAccessAuth, createRemoteAccessKeys } from './middleware/access-auth'
import type { AccessKeyResolver, AccessUser } from './middleware/access-auth'

export interface AppEnv {
  Bindings: Env
  Variables: { user: AccessUser }
}

interface AppOptions {
  resolveAccessKeys?: AccessKeyResolver
}

// Routes registered before the Access middleware are reachable without sign-in.
// Keep this list in sync with UNAUTHENTICATED_ROUTES in app.test.ts.
export function createApp({ resolveAccessKeys = createRemoteAccessKeys() }: AppOptions = {}) {
  const app = new Hono<AppEnv>().basePath('/api')

  app.onError(handleError)

  app.get('/health', c => c.json({ ok: true }))

  app.use('*', createAccessAuth(resolveAccessKeys))

  app.get('/me', c => c.json({ email: c.var.user.email } satisfies MeResponse))

  return app
}

function handleError(error: Error) {
  if (error instanceof HTTPException) return error.getResponse()
  logger.error('Unhandled API error', { error: error.message, stack: error.stack })
  return Response.json({ error: 'Server error. Please try again, or tell the team if it keeps happening.' }, { status: 500 })
}
