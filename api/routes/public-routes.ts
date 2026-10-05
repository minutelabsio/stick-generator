import { Hono } from 'hono'
import type { Context } from 'hono'
import { IMAGE_ANSWER_FIELD_PREFIX, JOIN_CODE_HEADER, MAX_PHOTO_BYTES, SubmissionFields } from '../../shared/api-types'
import { MAX_IMAGE_QUESTIONS } from '../../shared/intake'
import type { AppEnv } from '../app'
import { httpError } from '../http-errors'
import { createIntakeService } from '../services/intake-service'

// Allows for the photo, every image answer a form can ask for, multipart overhead, and
// the text fields.
const MAX_SUBMISSION_BYTES = MAX_PHOTO_BYTES * (1 + MAX_IMAGE_QUESTIONS) + 64 * 1024

// Everything here is reachable WITHOUT Access. It may only read batch info by join
// code and create new entries; it must never read or change existing entries.

const intakeService = (c: Context<AppEnv>) => createIntakeService({ db: c.env.DB, figureBucket: c.env.FIGURE_BUCKET })

// Keyed by question id. Anything that isn't a file is ignored here.
const imageAnswersIn = (form: FormData) => new Map([...form.entries()].flatMap(([field, value]) =>
  field.startsWith(IMAGE_ANSWER_FIELD_PREFIX) && value instanceof File ? [[field.slice(IMAGE_ANSWER_FIELD_PREFIX.length), value] as const] : []))

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
      throw httpError(413, 'Those photos are too large. Please choose ones under 5 MB each.')
    }
    const form = await c.req.formData()
    const fields = SubmissionFields.safeParse(Object.fromEntries(form))
    if (!fields.success) throw httpError(400, fields.error.issues[0]?.message ?? 'Please check the form and try again.')
    const photo = form.get('photo')
    if (!(photo instanceof File)) throw httpError(400, 'Please add a photo of yourself.')
    await intakeService(c).submit({ joinCode, ...fields.data, photo, images: imageAnswersIn(form) })
    return c.json({ ok: true }, 201)
  })
