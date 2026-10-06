// Releases the trunk's pushed head to production by pushing the next v* tag. The tag
// push is what deploys: .github/workflows/deploy.yml runs the production job on v* tags.
// Usage: `pnpm prod:deploy [patch|minor|major]` (default patch).
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

// Staging deploys every push to this branch, so its pushed head is what staging runs.
// Switch back to main at cutover, together with the staging trigger in deploy.yml.
const TRUNK = 'refresh'
const REMOTE = 'origin'
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/
// v2 is the first version of the app to be tagged, so its releases start here.
const FIRST_RELEASE: Version = [2, 0, 0]

type Version = readonly [number, number, number]

const BUMPS: Record<string, (version: Version) => Version> = {
  major: ([major]) => [major + 1, 0, 0],
  minor: ([major, minor]) => [major, minor + 1, 0],
  patch: ([major, minor, patch]) => [major, minor, patch + 1],
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const lines = (output: string) => output.split('\n').filter(Boolean)
const formatTag = (version: Version) => `v${version.join('.')}`

function parseTag(tag: string): Version | null {
  const match = RELEASE_TAG.exec(tag)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function latestRelease() {
  const tags = lines(git('tag', '--list', 'v*', '--sort=-v:refname'))
  return tags.map(parseTag).find(version => version !== null) ?? null
}

function nextTag(bumpName: string) {
  const bump = BUMPS[bumpName]
  if (!bump) throw new Error(`Unknown bump "${bumpName}". Use one of: ${Object.keys(BUMPS).join(', ')}.`)
  const latest = latestRelease()
  return formatTag(latest ? bump(latest) : FIRST_RELEASE)
}

// Releasing anything other than the pushed trunk head would ship code staging never ran.
function assertHeadIsPushedTrunk() {
  git('fetch', '--quiet', '--tags', REMOTE, TRUNK)
  if (git('rev-parse', 'HEAD') !== git('rev-parse', `${REMOTE}/${TRUNK}`)) {
    throw new Error(`HEAD is not the head of ${REMOTE}/${TRUNK}. Check out ${TRUNK} and push it, let staging deploy, then release.`)
  }
  const existing = lines(git('tag', '--points-at', 'HEAD')).find(tag => RELEASE_TAG.test(tag))
  if (existing) throw new Error(`HEAD is already released as ${existing}.`)
}

async function confirm(question: string) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(`${question} [y/N] `)
  prompt.close()
  return answer.trim().toLowerCase() === 'y'
}

// A tag left behind by a failed push would make the next run report HEAD as released.
function pushTag(tag: string) {
  git('tag', '--annotate', tag, '--message', `Release ${tag}`)
  try {
    git('push', '--quiet', REMOTE, tag)
  } catch (error) {
    git('tag', '--delete', tag)
    throw error
  }
}

async function release(bumpName: string) {
  assertHeadIsPushedTrunk()
  const tag = nextTag(bumpName)
  const commit = git('log', '-1', '--format=%h %s')
  if (!await confirm(`Tag ${commit} as ${tag} and deploy it to production?`)) {
    process.stdout.write('Cancelled. Nothing was tagged.\n')
    return
  }
  pushTag(tag)
  process.stdout.write(`Pushed ${tag}. Follow the deploy with: gh run watch\n`)
}

// Every failure is a message for the person releasing, so skip the stack trace.
try {
  await release(process.argv[2] ?? 'patch')
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
