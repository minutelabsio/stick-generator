import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export const httpError = (status: ContentfulStatusCode, message: string) =>
  new HTTPException(status, { res: Response.json({ error: message }, { status }) })

export function requireFound<T>(value: T | null, message: string): T {
  if (value === null) throw httpError(404, message)
  return value
}
