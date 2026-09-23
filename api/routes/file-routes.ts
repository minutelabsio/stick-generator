import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { FILE_BUCKETS, SERVABLE_KEY_PREFIX } from '../files'
import { httpError } from '../http-errors'

// Asset keys include a revision, so their content never changes. Photos and renders do.
const CACHE_CONTROL: Record<keyof typeof FILE_BUCKETS, string> = {
  assets: 'private, max-age=31536000, immutable',
  figures: 'private, no-cache',
}

const isBucketAlias = (alias: string): alias is keyof typeof FILE_BUCKETS => alias in FILE_BUCKETS

export const fileRoutes = new Hono<AppEnv>()
  .get('/:bucket/*', async (c) => {
    const alias = c.req.param('bucket')
    const key = decodeURIComponent(c.req.path.slice(`/api/files/${alias}/`.length))
    if (!isBucketAlias(alias) || !key.startsWith(SERVABLE_KEY_PREFIX)) throw httpError(404, 'File not found.')

    const object = await c.env[FILE_BUCKETS[alias]].get(key)
    if (!object) throw httpError(404, 'File not found.')

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'Cache-Control': CACHE_CONTROL[alias],
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
