// Creates the dev channels, each drawn with the stick rig. Runs before seed-dev.sql,
// whose batches and palettes belong to these channels. The rig comes from STICK_RIG
// rather than a JSON copy in SQL, so the seed cannot drift from it.
// Local only: the wrangler call passes --local. Run via `pnpm run db:seed:channels`.
import { execFileSync } from 'node:child_process'
import { STICK_RIG } from '../shared/stick-rig.ts'
import { ORIGINAL_CHANNEL_ID, SKETCHBOOK_CHANNEL_ID } from './seed-dev-ids.ts'

interface SeedChannel {
  id: string
  slug: string
  name: string
}

const SEED_CHANNELS: SeedChannel[] = [
  { id: ORIGINAL_CHANNEL_ID, slug: 'original', name: 'Original' },
  { id: SKETCHBOOK_CHANNEL_ID, slug: 'sketchbook', name: 'Sketchbook' },
]

const sqlString = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`

function channelRowSql(channel: SeedChannel) {
  const values = [channel.id, channel.slug, channel.name, JSON.stringify(STICK_RIG)].map(sqlString)
  return `INSERT INTO channels (id, slug, name, rig) VALUES (${values.join(', ')})
  ON CONFLICT (id) DO UPDATE SET slug = excluded.slug, name = excluded.name, rig = excluded.rig;`
}

const command = SEED_CHANNELS.map(channelRowSql).join('\n')
execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--command', command, '--env', 'dev', '--local'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
process.stdout.write(`Seeded ${SEED_CHANNELS.length} channels\n`)
