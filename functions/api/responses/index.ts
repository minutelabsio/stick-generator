
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (env.mock) {
    return new Response(JSON.stringify(['__DEV__']))
  }

  try {
    const bucket = env.STICK_FIGURES
    const responses = await bucket.list({ prefix: 'responses/' })
    if (!responses.objects.length) {
      return new Response('Not found', { status: 404 })
    }
    const filenames = responses.objects.map(
      obj => obj.key.replace('responses/', '')
    ).filter(Boolean)
    return new Response(JSON.stringify(filenames))
  } catch (e) {
    return new Response(e.message, { status: 500 })
  }
}