import { MAX_PHOTO_BYTES } from '../../shared/api-types'
import type { JoinBatch } from '../../shared/api-types'
import { intakeStateOf } from '../../shared/batch-intake'
import type { IntakeState } from '../../shared/batch-intake'
import { DEFAULT_CONSENT_TEXT, DEFAULT_THANK_YOU_MESSAGE, IntakeSettings, parseAnswers } from '../../shared/intake'
import type { ParsedAnswer, StoredAnswer, SubmittedAnswers } from '../../shared/intake'
import { normalizeJoinCode } from '../../shared/join-code'
import { httpError } from '../http-errors'

interface IntakeGroupRow {
  id: string
  name: string
  channel_name: string
  is_open: number
  closes_at: string
  max_submissions: number | null
  submitted_count: number
  intake: string
}

interface IntakeDependencies {
  db: D1Database
  figureBucket: R2Bucket
}

interface Submission {
  joinCode: string
  name: string
  email: string
  answers: SubmittedAnswers
  photo: File
  // Keyed by question id.
  images: ReadonlyMap<string, File>
}

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

const CLOSED_BATCH: JoinBatch = {
  state: 'closed',
  channelName: null,
  batchName: null,
  closesAt: null,
  instructions: '',
  questions: [],
  thankYouMessage: '',
  consentText: '',
  contactEmail: null,
}

const consentTextOf = (intake: IntakeSettings) => intake.consentText || DEFAULT_CONSENT_TEXT

interface CheckedImage {
  bytes: Uint8Array
  contentType: string
  extension: string
}

export function createIntakeService({ db, figureBucket }: IntakeDependencies) {
  const findGroup = (joinCode: string) => db
    .prepare(`SELECT groups.id, groups.name, channels.name AS channel_name, is_open, closes_at, max_submissions, channels.intake,
                     (SELECT count(*) FROM entries WHERE group_id = groups.id AND submitted_at IS NOT NULL) AS submitted_count
              FROM groups JOIN channels ON channels.id = groups.channel_id
              WHERE join_code = ? AND groups.archived_at IS NULL`)
    .bind(normalizeJoinCode(joinCode))
    .first<IntakeGroupRow>()

  return {
    // An unknown code looks like a closed batch, so the response doesn't confirm a code
    // exists. The one difference, accepted on purpose, is that a real closed batch names
    // its contact email so late subscribers know whom to ask.
    async getBatch(joinCode: string): Promise<JoinBatch> {
      const group = await findGroup(joinCode)
      if (!group) return CLOSED_BATCH
      const intake = IntakeSettings.parse(JSON.parse(group.intake))
      const contactEmail = intake.contactEmail || null
      const state = stateOf(group)
      if (state === 'closed') return { ...CLOSED_BATCH, contactEmail }
      if (state === 'full') return { ...CLOSED_BATCH, state, channelName: group.channel_name, batchName: group.name, contactEmail }
      return {
        state,
        channelName: group.channel_name,
        batchName: group.name,
        closesAt: group.closes_at,
        instructions: intake.instructions,
        questions: intake.questions,
        thankYouMessage: intake.thankYouMessage || DEFAULT_THANK_YOU_MESSAGE,
        consentText: consentTextOf(intake),
        contactEmail,
      }
    },

    async submit(submission: Submission): Promise<void> {
      const group = await findGroup(submission.joinCode)
      if (!group) throw REFUSALS.closed()
      requireOpen(stateOf(group))
      const intake = IntakeSettings.parse(JSON.parse(group.intake))
      const parsed = parseAnswers(intake.questions, submission.answers, new Set(submission.images.keys()))
      if (!parsed.success) throw httpError(400, parsed.message)

      // Every file is checked before anything is stored, so a bad image leaves nothing behind.
      const photo = await checkImage(submission.photo, 'that photo')
      const entryId = crypto.randomUUID()
      const prepared = await Promise.all(parsed.answers.map(answer => prepareAnswer(entryId, answer, submission.images)))
      const likenessKey = `v2/likeness/${entryId}-${randomSuffix()}.${photo.extension}`
      const uploads = [{ key: likenessKey, image: photo }, ...prepared.flatMap(({ upload }) => (upload ? [upload] : []))]
      await Promise.all(uploads.map(({ key, image }) => figureBucket.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } })))
      const answers = prepared.map(({ answer }) => answer)
      // One statement checks the switch, the date, and the limit and inserts, so two
      // submits at the same moment can't both take the last place. Mirrors intakeStateOf.
      const inserted = await db
        .prepare(`INSERT INTO entries (id, group_id, name, email, answers, likeness_key, submitted_at, consent_at, consent_text)
                  SELECT ?, id, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?
                  FROM groups
                  WHERE id = ? AND is_open = 1 AND closes_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    AND (max_submissions IS NULL
                      OR (SELECT count(*) FROM entries WHERE group_id = groups.id AND submitted_at IS NOT NULL) < max_submissions)`)
        .bind(entryId, submission.name, submission.email.toLowerCase(), JSON.stringify(answers), likenessKey,
          consentTextOf(intake), group.id)
        .run()
      if (inserted.meta.changes) return
      // It closed or filled up while the files were uploading.
      await figureBucket.delete(uploads.map(({ key }) => key))
      const latest = await findGroup(submission.joinCode)
      if (!latest) throw REFUSALS.closed()
      requireOpen(stateOf(latest))
      throw httpError(409, 'This batch just filled up. If you missed it, email the team.')
    },
  }
}

const randomSuffix = () => crypto.randomUUID().slice(0, 8)

interface PreparedAnswer {
  answer: StoredAnswer
  upload: { key: string, image: CheckedImage } | null
}

// An image answer is stored under a key the server chooses, so nothing the follower
// sent (like a file name) reaches R2.
async function prepareAnswer(entryId: string, { question, value }: ParsedAnswer, files: ReadonlyMap<string, File>): Promise<PreparedAnswer> {
  if (value.kind !== 'image') return { answer: { question, value }, upload: null }
  const file = files.get(question.id)
  if (!file) throw new Error(`Image answer for ${question.id} has no file`)
  const image = await checkImage(file, `the image for “${question.label}”`)
  const key = `v2/answers/${entryId}/${question.id}-${randomSuffix()}.${image.extension}`
  return { answer: { question, value: { kind: 'image', key } }, upload: { key, image } }
}

const stateOf = (group: IntakeGroupRow) => intakeStateOf({
  hasJoinCode: true,
  isOpen: group.is_open === 1,
  closesAt: group.closes_at,
  maxSubmissions: group.max_submissions,
  submittedCount: group.submitted_count,
}, Date.now())

const REFUSALS: Record<Exclude<IntakeState, 'open'>, () => Error> = {
  closed: () => httpError(403, 'This batch is closed. If you missed it, email the team.'),
  full: () => httpError(409, 'This batch is full. If you missed it, email the team.'),
}

function requireOpen(state: IntakeState) {
  if (state !== 'open') throw REFUSALS[state]()
}

async function checkImage(file: File, subject: string): Promise<CheckedImage> {
  if (file.size > MAX_PHOTO_BYTES) throw httpError(413, `${capitalized(subject)} is too large. Please choose one under 5 MB.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = PHOTO_SIGNATURES.find(candidate => candidate.matches(bytes))
  if (!signature) throw httpError(415, `We couldn't read ${subject}. Please use a JPEG, PNG, or WebP image.`)
  return { bytes, contentType: signature.contentType, extension: signature.extension }
}

const capitalized = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`
