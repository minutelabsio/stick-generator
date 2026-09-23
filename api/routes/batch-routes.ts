import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { CreateBatchRequest } from '../../shared/api-types'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createBatchService } from '../services/batch-service'

export const batchRoutes = new Hono<AppEnv>()
  .get('/', async c => c.json(await createBatchService(c.env.DB).list()))
  .get('/:batchId', async (c) => {
    const batch = await createBatchService(c.env.DB).get(c.req.param('batchId'))
    return c.json(requireFound(batch, 'That batch does not exist. It may have been removed.'))
  })
  .post('/', zValidator('json', CreateBatchRequest), async (c) => {
    return c.json(await createBatchService(c.env.DB).create(c.req.valid('json')), 201)
  })
