// Releases the trunk's pushed head to production by pushing the next build tag (v1, v2,
// …). The tag push is what deploys: .github/workflows/deploy.yml runs production on v*.
// Usage: `pnpm prod:deploy`.
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

// Staging deploys every push to this branch, so its pushed head is what staging runs.
// Switch back to main at cutover, together with the staging trigger in deploy.yml.
const TRUNK = 'refresh'
const REMOTE = 'origin'
const RELEASE_TAG = /^v(\d+)$/

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const lines = (output: string) => output.split('\n').filter(Boolean)

function nextTag() {
  const builds = lines(git('tag', '--list', 'v*')).map(tag => Number(RELEASE_TAG.exec(tag)?.[1] ?? 0))
  return `v${Math.max(0, ...builds) + 1}`
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

async function release() {
  assertHeadIsPushedTrunk()
  const tag = nextTag()
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
  await release()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
