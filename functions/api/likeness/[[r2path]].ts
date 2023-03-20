import { setCache } from '../cache'

const parsePath = (parts: string | string[]) => {
  const path = typeof parts === 'string' ?
    parts :
    parts.join('/')
  return decodeURIComponent(path)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const { r2path } = params
    const bucket = env.STICK_FIGURES
    const path = parsePath(r2path)
    const obj = await bucket.get(`likeness/${path}`)
    if (obj === null) {
      return setCache(new Response('Not found', { status: 404 }))
    }
    return setCache(new Response(obj.body))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}