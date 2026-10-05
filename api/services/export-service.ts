import { IntakeSettings, StoredAnswers } from '../../shared/intake'
import type { AnswerValue, Question, StoredAnswer } from '../../shared/intake'
import { toCsv } from '../csv'

interface ExportGroupRow {
  slug: string
  intake: string
}

interface ExportEntryRow {
  name: string | null
  email: string | null
  status: string
  submitted_at: string | null
  likeness_key: string | null
  answers: string
}

interface QuestionColumn {
  id: string
  label: string
}

const FIXED_HEADERS = ['Name', 'Email', 'Status', 'Submitted', 'Photo']

// The storage path below v2/: unique, and it names the real file, so a zip of the
// images can use the same names. What the follower called the file is never kept.
const fileNameOf = (key: string | null) => key?.replace(/^v2\//, '') ?? ''

const ANSWER_CELLS: { [K in AnswerValue['kind']]: (value: Extract<AnswerValue, { kind: K }>) => string } = {
  text: value => value.text,
  choice: value => value.choice,
  other: value => `Other: ${value.text}`,
  image: value => fileNameOf(value.key),
}

function answerCell(value: AnswerValue | undefined) {
  if (!value) return ''
  const toCell = ANSWER_CELLS[value.kind] as (answer: AnswerValue) => string
  return toCell(value)
}

// One column per question anyone was asked: the current form's first, in its order and
// with its labels, then retired ones under the label they were last asked with.
// Matching is by id, so a reworded question stays one column.
function questionColumns(current: Question[], asked: Question[]): QuestionColumn[] {
  const currentIds = new Set(current.map(question => question.id))
  const retired = new Map(asked.filter(question => !currentIds.has(question.id)).map(question => [question.id, question.label]))
  return [
    ...current.map(({ id, label }) => ({ id, label })),
    ...[...retired].map(([id, label]) => ({ id, label })),
  ]
}

function toRow(entry: ExportEntryRow, answers: StoredAnswer[], columns: QuestionColumn[]) {
  const valueById = new Map(answers.map(answer => [answer.question.id, answer.value]))
  return [
    entry.name ?? '',
    entry.email ?? '',
    entry.status,
    entry.submitted_at ?? '',
    fileNameOf(entry.likeness_key),
    ...columns.map(column => answerCell(valueById.get(column.id))),
  ]
}

export function createExportService(db: D1Database) {
  return {
    // Every entry, skipped ones included, oldest first. Status says which to keep.
    async batchResponses(batchId: string): Promise<{ fileName: string, csv: string } | null> {
      const group = await db
        .prepare('SELECT groups.slug, channels.intake FROM groups JOIN channels ON channels.id = groups.channel_id WHERE groups.id = ?')
        .bind(batchId)
        .first<ExportGroupRow>()
      if (!group) return null
      const rows = await db
        .prepare(`SELECT name, email, status, submitted_at, likeness_key, answers FROM entries
                  WHERE group_id = ? ORDER BY submitted_at, id`)
        .bind(batchId)
        .all<ExportEntryRow>()
      const entries = rows.results.map(entry => ({ entry, answers: StoredAnswers.parse(JSON.parse(entry.answers)) }))
      const current = IntakeSettings.parse(JSON.parse(group.intake)).questions
      const columns = questionColumns(current, entries.flatMap(({ answers }) => answers.map(answer => answer.question)))
      const header = [...FIXED_HEADERS, ...columns.map(column => column.label)]
      return {
        fileName: `${group.slug}-responses.csv`,
        csv: toCsv([header, ...entries.map(({ entry, answers }) => toRow(entry, answers, columns))]),
      }
    },
  }
}
