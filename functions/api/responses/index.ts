import { setCache } from '../cache'
import _uniq from 'lodash/uniq'

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (env.mock) {
    return setCache(new Response(JSON.stringify(['__DEV__'])))
  }

  try {
    const kv = env.STICK_FIGURE_DATA
    // get list from kv
    const data = await kv.list()
    const kvFilenames = data.keys.map(key => key.name)
    const bucket = env.STICK_FIGURES
    const responses = await bucket.list({ prefix: 'responses/' })
    if (!responses.objects.length) {
      return setCache(new Response('Not found', { status: 404 }))
    }
    const filenames = responses.objects.map(
      obj => obj.key.replace('responses/', '')
    ).filter(Boolean)
    filenames.push.apply(filenames, kvFilenames)
    return setCache(new Response(JSON.stringify(_uniq(filenames))))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}