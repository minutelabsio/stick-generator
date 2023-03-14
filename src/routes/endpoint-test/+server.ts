import type { RequestHandler } from './$types'

export const GET = (async ({ request, platform }) => {
  const obj = await platform.env.STICK_FIGURES.get('some-key')
  if (obj === null) {
    return new Response('Not found', { status: 404 })
  }
  return new Response(obj.body)
}) satisfies RequestHandler