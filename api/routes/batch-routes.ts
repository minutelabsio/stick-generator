import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { UpdateBatchRequest } from '../../shared/api-types'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createBatchService } from '../services/batch-service'

const BATCH_NOT_FOUND = 'That batch does not exist. It may have been removed.'

export const batchRoutes = new Hono<AppEnv>()
  .get('/:batchId', async (c) => {
    const batch = await createBatchService(c.env.DB).get(c.req.param('batchId'))
    return c.json(requireFound(batch, BATCH_NOT_FOUND))
  })
  .patch('/:batchId', zValidator('json', UpdateBatchRequest), async (c) => {
    const batch = await createBatchService(c.env.DB).update(c.req.param('batchId'), c.req.valid('json'))
    return c.json(requireFound(batch, BATCH_NOT_FOUND))
  })
  .post('/:batchId/rotate-code', async (c) => {
    const batch = await createBatchService(c.env.DB).rotateCode(c.req.param('batchId'))
    return c.json(requireFound(batch, BATCH_NOT_FOUND))
  })
