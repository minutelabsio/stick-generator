import { Hono } from 'hono'
import type { Context } from 'hono'
import { JOIN_CODE_HEADER, MAX_PHOTO_BYTES, SubmissionFields } from '../../shared/api-types'
import type { AppEnv } from '../app'
import { httpError } from '../http-errors'
import { createIntakeService } from '../services/intake-service'

// Allows for the photo plus multipart overhead and the text fields.
const MAX_SUBMISSION_BYTES = MAX_PHOTO_BYTES + 64 * 1024

// Everything here is reachable WITHOUT Access. It may only read batch info by join
// code and create new entries; it must never read or change existing entries.

const intakeService = (c: Context<AppEnv>) => createIntakeService({ db: c.env.DB, figureBucket: c.env.FIGURE_BUCKET })

const requireJoinCode = (c: Context<AppEnv>) => {
  const joinCode = c.req.header(JOIN_CODE_HEADER)
  if (!joinCode) throw httpError(400, 'This link is missing its invite code. Check the link in your email.')
  return joinCode
}

export const publicRoutes = new Hono<AppEnv>()
  .get('/batch', async c => c.json(await intakeService(c).getBatch(requireJoinCode(c))))
  .post('/submission', async (c) => {
    const joinCode = requireJoinCode(c)
    if (Number(c.req.header('Content-Length') ?? 0) > MAX_SUBMISSION_BYTES) {
      throw httpError(413, 'That photo is too large. Please choose one under 5 MB.')
    }
    const form = await c.req.formData()
    const fields = SubmissionFields.safeParse(Object.fromEntries(form))
    if (!fields.success) throw httpError(400, fields.error.issues[0]?.message ?? 'Please check the form and try again.')
    const photo = form.get('photo')
    if (!(photo instanceof File)) throw httpError(400, 'Please add a photo of yourself.')
    await intakeService(c).submit({ joinCode, ...fields.data, photo })
    return c.json({ ok: true }, 201)
  })
