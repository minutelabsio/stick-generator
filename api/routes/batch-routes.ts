import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { UpdateBatchRequest } from '../../shared/api-types'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createBatchService } from '../services/batch-service'
import { createExportService } from '../services/export-service'

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
  .get('/:batchId/export.csv', async (c) => {
    const exported = requireFound(await createExportService(c.env.DB).batchResponses(c.req.param('batchId')), BATCH_NOT_FOUND)
    return c.body(exported.csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exported.fileName}"`,
      // Holds subscribers' details, so no copy should linger in a cache.
      'Cache-Control': 'no-store',
    })
  })
