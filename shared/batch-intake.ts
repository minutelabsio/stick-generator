// Whether a batch's join link takes submissions right now. The submit itself is
// enforced by one conditional insert in the intake service, which must match this.

export type IntakeState = 'open' | 'closed' | 'full'

export const MAX_SUBMISSION_LIMIT = 10_000

export interface IntakeGate {
  hasJoinCode: boolean
  isOpen: boolean
  closesAt: string | null
  // Null means no limit.
  maxSubmissions: number | null
  // Entries that came in through the link, skipped ones included.
  submittedCount: number
}

export function intakeStateOf(gate: IntakeGate, now: number): IntakeState {
  if (!gate.hasJoinCode || !gate.isOpen || !gate.closesAt || now >= Date.parse(gate.closesAt)) return 'closed'
  if (gate.maxSubmissions !== null && gate.submittedCount >= gate.maxSubmissions) return 'full'
  return 'open'
}
