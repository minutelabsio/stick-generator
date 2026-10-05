import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createBatchService } from '../services/batch-service'

export const batchRoutes = new Hono<AppEnv>()
  .get('/:batchId', async (c) => {
    const batch = await createBatchService(c.env.DB).get(c.req.param('batchId'))
    return c.json(requireFound(batch, 'That batch does not exist. It may have been removed.'))
  })
