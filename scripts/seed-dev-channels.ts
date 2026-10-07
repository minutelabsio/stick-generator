// Creates the dev channels, each drawn with the stick rig. Runs before seed-dev.sql,
// whose batches and palettes belong to these channels. The rig comes from STICK_RIG
// rather than a JSON copy in SQL, so the seed cannot drift from it.
// Local only: the wrangler call passes --local. Run via `pnpm run db:seed:channels`.
import { execFileSync } from 'node:child_process'
import { IntakeSettings } from '../shared/intake.ts'
import { STICK_RIG } from '../shared/stick-rig.ts'
import { ORIGINAL_CHANNEL_ID, SKETCHBOOK_CHANNEL_ID } from './seed-dev-ids.ts'

interface SeedChannel {
  id: string
  slug: string
  name: string
  intake: IntakeSettings
}

// Parsed so a seed form that breaks the rules fails here, not in the app.
const ORIGINAL_INTAKE = IntakeSettings.parse({
  instructions: 'Thanks for supporting us! We\'ll draw you as a stick figure.\nA clear photo of your face works best.',
  questions: [
    { id: 'hair', type: 'text', label: 'Describe your hair', required: true, highlight: true, maxLength: 200 },
    { id: 'hobby', type: 'text', label: 'A hobby or favourite thing', highlight: true, maxLength: 200 },
    { id: 'colour', type: 'select', label: 'Favourite colour', options: ['Red', 'Blue', 'Green'], allowOther: true, highlight: true },
  ],
  thankYouMessage: 'Got it! We\'ll share your stick figure once the batch is drawn.',
  thankYouLinkLabel: 'See past stick figures',
  thankYouLinkUrl: 'https://example.com/gallery',
  contactEmail: 'team@example.com',
})

const SKETCHBOOK_INTAKE = IntakeSettings.parse({
  instructions: 'We sketch every supporter. Send a photo and tell us how you see yourself.',
  questions: [
    { id: 'look', type: 'text', label: 'Describe how you look', required: true, highlight: true, multiline: true },
    { id: 'pet', type: 'image', label: 'A photo of your pet, if they should be in it', highlight: true },
    { id: 'partner', type: 'email', label: 'Ordering for someone else? Their email' },
  ],
  contactEmail: 'sketches@example.com',
})

const SEED_CHANNELS: SeedChannel[] = [
  { id: ORIGINAL_CHANNEL_ID, slug: 'original', name: 'Original', intake: ORIGINAL_INTAKE },
  { id: SKETCHBOOK_CHANNEL_ID, slug: 'sketchbook', name: 'Sketchbook', intake: SKETCHBOOK_INTAKE },
]

const sqlString = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`

function channelRowSql(channel: SeedChannel) {
  const values = [channel.id, channel.slug, channel.name, JSON.stringify(STICK_RIG), JSON.stringify(channel.intake)].map(sqlString)
  return `INSERT INTO channels (id, slug, name, rig, intake) VALUES (${values.join(', ')})
  ON CONFLICT (id) DO UPDATE SET slug = excluded.slug, name = excluded.name, rig = excluded.rig, intake = excluded.intake;`
}

const command = SEED_CHANNELS.map(channelRowSql).join('\n')
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--command', command, '--env', 'dev', '--local'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
process.stdout.write(`Seeded ${SEED_CHANNELS.length} channels\n`)
