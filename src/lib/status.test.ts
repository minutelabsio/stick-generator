import { describe, expect, it } from 'vitest'
import { formatDateTime, localTimeZoneLabel } from './status'

// One close time, as stored (UTC), read in two places.
const CLOSES_AT = '2026-10-20T03:00:00.000Z'

describe('formatDateTime', () => {
  it('names the zone, so the same instant reads unambiguously anywhere', () => {
    expect(formatDateTime(CLOSES_AT, { timeZone: 'America/Toronto', locale: 'en-US' })).toBe('Oct 19, 2026, 11:00 PM EDT')
    expect(formatDateTime(CLOSES_AT, { timeZone: 'Europe/London', locale: 'en-GB' })).toBe('20 Oct 2026, 04:00 BST')
  })
})

describe('localTimeZoneLabel', () => {
  it('gives the zone and its abbreviation', () => {
    expect(localTimeZoneLabel({ timeZone: 'America/Toronto', locale: 'en-US' })).toMatch(/^America\/Toronto \((EDT|EST)\)$/)
  })
})
