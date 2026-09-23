import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { createLibraryService } from '../services/library-service'

export const libraryRoutes = new Hono<AppEnv>()
  .get('/', async c => c.json(await createLibraryService(c.env.DB).get()))
