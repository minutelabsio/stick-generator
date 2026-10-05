import { MAX_PHOTO_BYTES } from '../../shared/api-types'
import type { JoinBatch, JoinBatchState } from '../../shared/api-types'
import { DEFAULT_CONSENT_TEXT, DEFAULT_THANK_YOU_MESSAGE, IntakeSettings, parseAnswers } from '../../shared/intake'
import type { ParsedAnswer, StoredAnswer, SubmittedAnswers } from '../../shared/intake'
import { normalizeJoinCode } from '../../shared/join-code'
import { httpError } from '../http-errors'

interface IntakeGroupRow {
  id: string
  name: string
  channel_name: string
  opens_at: string
  closes_at: string
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
    .prepare(`SELECT groups.id, groups.name, channels.name AS channel_name, opens_at, closes_at, channels.intake
              FROM groups JOIN channels ON channels.id = groups.channel_id
              WHERE join_code = ? AND groups.archived_at IS NULL`)
    .bind(normalizeJoinCode(joinCode))
    .first<IntakeGroupRow>()

  return {
    // An unknown code looks exactly like a closed batch, so the response never confirms a code exists.
    async getBatch(joinCode: string): Promise<JoinBatch> {
      const group = await findGroup(joinCode)
      if (!group) return CLOSED_BATCH
      const intake = IntakeSettings.parse(JSON.parse(group.intake))
      const contactEmail = intake.contactEmail || null
      const state = windowState(group, Date.now())
      if (state === 'closed') return { ...CLOSED_BATCH, contactEmail }
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
      if (!group || windowState(group, Date.now()) !== 'open') {
        throw httpError(403, 'This batch is closed. If you missed it, email the team.')
      }
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
      await db
        .prepare(`INSERT INTO entries (id, group_id, name, email, answers, likeness_key, submitted_at, consent_at, consent_text)
                  VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)`)
        .bind(entryId, group.id, submission.name, submission.email.toLowerCase(), JSON.stringify(answers),
          likenessKey, consentTextOf(intake))
        .run()
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

function windowState(group: IntakeGroupRow, now: number): JoinBatchState {
  if (now < Date.parse(group.opens_at)) return 'not_yet_open'
  if (now >= Date.parse(group.closes_at)) return 'closed'
  return 'open'
}

async function checkImage(file: File, subject: string): Promise<CheckedImage> {
  if (file.size > MAX_PHOTO_BYTES) throw httpError(413, `${capitalized(subject)} is too large. Please choose one under 5 MB.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = PHOTO_SIGNATURES.find(candidate => candidate.matches(bytes))
  if (!signature) throw httpError(415, `We couldn't read ${subject}. Please use a JPEG, PNG, or WebP image.`)
  return { bytes, contentType: signature.contentType, extension: signature.extension }
}

const capitalized = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`
