import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { CreateBatchRequest, CreateChannelRequest } from '../../shared/api-types'
import { STICK_RIG } from '../../shared/stick-rig'
import type { AppEnv } from '../app'
import { requireFound } from '../http-errors'
import { createBatchService } from '../services/batch-service'
import { createChannelService } from '../services/channel-service'
import { createLibraryService } from '../services/library-service'

// Only what needs a channel to exist lives under it: listing and creating. A batch or
// entry is addressed by its own id once it exists, and its response names its channel.

const CHANNEL_NOT_FOUND = 'That channel does not exist. Pick another from the channel menu.'

const requireChannel = async (c: Context<AppEnv>, channelId: string) =>
  requireFound(await createChannelService(c.env.DB).get(channelId), CHANNEL_NOT_FOUND)

export const channelRoutes = new Hono<AppEnv>()
  .get('/', async c => c.json(await createChannelService(c.env.DB).list()))
  // Every channel draws with the stick rig until rigs can be edited (see the backlog).
  .post('/', zValidator('json', CreateChannelRequest), async (c) => {
    return c.json(await createChannelService(c.env.DB).create({ ...c.req.valid('json'), rig: STICK_RIG }), 201)
  })
  .get('/:channelId/batches', async (c) => {
    const channel = await requireChannel(c, c.req.param('channelId'))
    return c.json(await createBatchService(c.env.DB).list(channel.id))
  })
  .post('/:channelId/batches', zValidator('json', CreateBatchRequest), async (c) => {
    const channel = await requireChannel(c, c.req.param('channelId'))
    return c.json(await createBatchService(c.env.DB).create(channel.id, c.req.valid('json')), 201)
  })
  .get('/:channelId/library', async (c) => {
    const channel = await requireChannel(c, c.req.param('channelId'))
    return c.json(await createLibraryService({ db: c.env.DB, channel }).get())
  })
