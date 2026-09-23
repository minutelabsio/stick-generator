// No 0/O, 1/I/L: codes may be read aloud or typed from an email.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const JOIN_CODE_GROUPS = 3
const JOIN_CODE_GROUP_LENGTH = 4

export function generateJoinCode() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(JOIN_CODE_GROUPS * JOIN_CODE_GROUP_LENGTH))
  const characters = Array.from(randomBytes, byte => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length])
  const groups = Array.from({ length: JOIN_CODE_GROUPS }, (_, index) =>
    characters.slice(index * JOIN_CODE_GROUP_LENGTH, (index + 1) * JOIN_CODE_GROUP_LENGTH).join(''),
  )
  return groups.join('-')
}

export function normalizeJoinCode(input: string) {
  const compact = input.toUpperCase().replaceAll(/[^A-Z0-9]/g, '')
  const groups = compact.match(new RegExp(`.{1,${JOIN_CODE_GROUP_LENGTH}}`, 'g')) ?? []
  return groups.join('-')
}
