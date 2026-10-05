// RFC 4180 CSV, written for spreadsheets: CRLF line ends, every cell quoted, and a
// byte-order mark so Excel reads the file as UTF-8 (names with accents survive).

const BYTE_ORDER_MARK = String.fromCodePoint(0xFE_FF)

// A cell starting with one of these is read as a formula by Excel and Sheets, so a
// follower could otherwise plant one that runs when the team opens the file.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

function toCell(value: string) {
  const defused = FORMULA_TRIGGERS.some(trigger => value.startsWith(trigger)) ? `'${value}` : value
  return `"${defused.replaceAll('"', '""')}"`
}

export const toCsv = (rows: readonly (readonly string[])[]) =>
  `${BYTE_ORDER_MARK}${rows.map(row => row.map(toCell).join(',')).join('\r\n')}\r\n`
