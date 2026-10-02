import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { UpdateEntryRequest } from '../../shared/api-types'
import { STICK_RIG } from '../../shared/stick-rig'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createEntryService } from '../services/entry-service'

const ENTRY_NOT_FOUND = 'That entry does not exist. It may have been removed.'

const entryService = (c: Context<AppEnv>) => createEntryService({ db: c.env.DB, figureBucket: c.env.FIGURE_BUCKET, rig: STICK_RIG })

export const entryRoutes = new Hono<AppEnv>()
  .get('/:entryId', async (c) => {
    return c.json(requireFound(await entryService(c).get(c.req.param('entryId')), ENTRY_NOT_FOUND))
  })
  .patch('/:entryId', zValidator('json', UpdateEntryRequest), async (c) => {
    const entry = await entryService(c).update(c.req.param('entryId'), c.req.valid('json'), c.var.user.email)
    return c.json(requireFound(entry, ENTRY_NOT_FOUND))
  })
  .put('/:entryId/render', async (c) => {
    const entry = await entryService(c).saveRender(c.req.param('entryId'), await c.req.arrayBuffer(), c.var.user.email)
    return c.json(requireFound(entry, ENTRY_NOT_FOUND))
  })
