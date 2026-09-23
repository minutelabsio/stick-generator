import { z } from 'zod'
import { MAX_PHOTO_BYTES, Question } from '../../shared/api-types'
import type { JoinBatch, JoinBatchState } from '../../shared/api-types'
import { normalizeJoinCode } from '../../shared/join-code'
import { httpError } from '../http-errors'

interface IntakeGroupRow {
  id: string
  name: string
  opens_at: string
  closes_at: string
  questions: string
  contact_email: string | null
}

interface IntakeDependencies {
  db: D1Database
  figureBucket: R2Bucket
}

interface Submission {
  joinCode: string
  name: string
  email: string
  answers: Record<string, string>
  photo: File
}

const CONSENT_VERSION = 'prototype-1'

// The file's own bytes decide its type, not the name or Content-Type the browser sent.
const PHOTO_SIGNATURES: { contentType: string, extension: string, matches: (bytes: Uint8Array) => boolean }[] = [
  { contentType: 'image/jpeg', extension: 'jpg', matches: bytes => bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF },
  { contentType: 'image/png', extension: 'png', matches: bytes => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 },
  {
    contentType: 'image/webp',
    extension: 'webp',
    matches: bytes => new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP',
  },
]

const StoredQuestions = z.array(Question)

const CLOSED_BATCH: JoinBatch = { state: 'closed', batchName: null, closesAt: null, questions: [], contactEmail: null }

export function createIntakeService({ db, figureBucket }: IntakeDependencies) {
  const findGroup = (joinCode: string) => db
    .prepare('SELECT id, name, opens_at, closes_at, questions, contact_email FROM groups WHERE join_code = ? AND archived_at IS NULL')
    .bind(normalizeJoinCode(joinCode))
    .first<IntakeGroupRow>()

  return {
    // An unknown code looks exactly like a closed batch, so the response never confirms a code exists.
    async getBatch(joinCode: string): Promise<JoinBatch> {
      const group = await findGroup(joinCode)
      if (!group) return CLOSED_BATCH
      const state = windowState(group, Date.now())
      if (state === 'closed') return { ...CLOSED_BATCH, contactEmail: group.contact_email }
      return {
        state,
        batchName: group.name,
        closesAt: group.closes_at,
        questions: StoredQuestions.parse(JSON.parse(group.questions)),
        contactEmail: group.contact_email,
      }
    },

    async submit(submission: Submission): Promise<void> {
      const group = await findGroup(submission.joinCode)
      if (!group || windowState(group, Date.now()) !== 'open') {
        throw httpError(403, 'This batch is closed. If you missed it, email the team.')
      }
      const photo = await readPhoto(submission.photo)
      const entryId = crypto.randomUUID()
      const likenessKey = `v2/likeness/${entryId}-${crypto.randomUUID().slice(0, 8)}.${photo.extension}`
      await figureBucket.put(likenessKey, photo.bytes, { httpMetadata: { contentType: photo.contentType } })
      await db
        .prepare(`INSERT INTO entries (id, group_id, name, email, answers, likeness_key, submitted_at, consent_at, consent_version)
                  VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)`)
        .bind(entryId, group.id, submission.name, submission.email.toLowerCase(), JSON.stringify(submission.answers),
          likenessKey, CONSENT_VERSION)
        .run()
    },
  }
}

function windowState(group: IntakeGroupRow, now: number): JoinBatchState {
  if (now < Date.parse(group.opens_at)) return 'not_yet_open'
  if (now >= Date.parse(group.closes_at)) return 'closed'
  return 'open'
}

async function readPhoto(photo: File) {
  if (photo.size > MAX_PHOTO_BYTES) throw httpError(413, 'That photo is too large. Please choose one under 5 MB.')
  const bytes = new Uint8Array(await photo.arrayBuffer())
  const signature = PHOTO_SIGNATURES.find(candidate => candidate.matches(bytes))
  if (!signature) throw httpError(415, 'We couldn\'t read that photo. Please use a JPEG, PNG, or WebP image.')
  return { bytes, contentType: signature.contentType, extension: signature.extension }
}
