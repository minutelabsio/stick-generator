// Loads the v1 layer PNGs in seed/stick-assets into the local dev R2 bucket and D1.
// Local only: every wrangler call passes --local. Run via `pnpm run db:seed:assets`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

type Part = 'line' | 'mask' | 'backLine' | 'backMask'

interface SeedAsset {
  id: string
  slot: string
  label: string
  files: Partial<Record<Part, string>>
}

const SEED_DIR = 'seed/stick-assets'
const ASSET_BUCKET = 'stick-figures-assets-dev'

const SEED_ASSETS: SeedAsset[] = [
  { id: 'seed-body-01', slot: 'body', label: 'Body 1', files: { line: 'Bodies/body-01.png' } },
  { id: 'seed-head-01', slot: 'head', label: 'Head 1', files: { line: 'Heads/head-01.png', mask: 'Heads/maskhead-01.png' } },
  { id: 'seed-hair-01', slot: 'hair', label: 'Hair 1', files: { line: 'Hairs/hair-01.png', mask: 'Hairs/maskhair-01.png' } },
  {
    id: 'seed-hair-02',
    slot: 'hair',
    label: 'Hair 2',
    files: {
      line: 'Hairs/hair-02.png',
      mask: 'Hairs/maskhair-02.png',
      backLine: 'Hairs/hair-02b.png',
      backMask: 'Hairs/maskhair-02b.png',
    },
  },
  { id: 'seed-hat-01', slot: 'hat', label: 'Hat 1', files: { line: 'Hats/hat-01.png', mask: 'Hats/maskhat-01.png' } },
  { id: 'seed-mustache-01', slot: 'mustache', label: 'Mustache 1', files: { line: 'Facial Hairs/mustache-01.png' } },
  { id: 'seed-beard-01', slot: 'beard', label: 'Beard 1', files: { line: 'Facial Hairs/beard-01.png' } },
  {
    id: 'seed-longbeard-01',
    slot: 'longbeard',
    label: 'Long beard 1',
    files: { line: 'Facial Hairs/longbeard-01.png', mask: 'Facial Hairs/masklongbeard-01.png' },
  },
  ...['01', '02', '03', '04', '05'].map(number => ({
    id: `seed-glasses-${number}`,
    slot: 'glasses',
    label: `Glasses ${Number(number)}`,
    files: { line: `Glasses/glasses-${number}.png`, mask: `Glasses/maskglasses-${number}.png` },
  })),
  ...['01', '02', '03'].map(number => ({
    id: `seed-accessory-${number}`,
    slot: 'accessory',
    label: `Accessory ${Number(number)}`,
    files: { line: `Accessories/accessory-${number}.png` },
  })),
]

const assetKey = (assetId: string, part: Part) => `v2/assets/${assetId}/${part}-r1.png`

function wrangler(args: string[]) {
  execFileSync('pnpm', ['exec', 'wrangler', ...args, '--env', 'dev', '--local'], { stdio: ['ignore', 'ignore', 'inherit'] })
}

function uploadParts(asset: SeedAsset) {
  const parts = Object.entries(asset.files).map(([part, file]) => {
    const key = assetKey(asset.id, part as Part)
    wrangler(['r2', 'object', 'put', `${ASSET_BUCKET}/${key}`, '--file', path.join(SEED_DIR, file), '--content-type', 'image/png'])
    return [part, key]
  })
  return Object.fromEntries(parts)
}

const sqlString = (value: string) => `'${value.replaceAll('\'', '\'\'')}'`

function assetRowSql(asset: SeedAsset, index: number, parts: Record<string, string>) {
  const values = [sqlString(asset.id), sqlString(asset.slot), sqlString(asset.label), sqlString(JSON.stringify(parts)), String(index)]
  return `INSERT INTO assets (id, slot, label, parts, sort) VALUES (${values.join(', ')})
  ON CONFLICT (id) DO UPDATE SET slot = excluded.slot, label = excluded.label, parts = excluded.parts, sort = excluded.sort;`
}

const statements = SEED_ASSETS.map((asset, index) => {
  process.stdout.write(`Uploading ${asset.id}\n`)
  return assetRowSql(asset, index, uploadParts(asset))
})

const sqlFile = path.join(mkdtempSync(path.join(tmpdir(), 'seed-assets-')), 'assets.sql')
writeFileSync(sqlFile, statements.join('\n'))
wrangler(['d1', 'execute', 'DB', '--file', sqlFile])
process.stdout.write(`Seeded ${SEED_ASSETS.length} assets\n`)
