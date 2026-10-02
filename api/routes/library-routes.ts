import { Hono } from 'hono'
import { STICK_RIG } from '../../shared/stick-rig'
import type { AppEnv } from '../app'
import { createLibraryService } from '../services/library-service'

export const libraryRoutes = new Hono<AppEnv>()
  .get('/', async c => c.json(await createLibraryService({ db: c.env.DB, rig: STICK_RIG }).get()))
