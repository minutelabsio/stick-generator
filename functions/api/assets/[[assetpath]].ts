import { setCache } from '../cache'

const fileList = (pfx, count = 1) => {
  return Array.from({ length: count }, (_, i) => {
    const n = (i + 1).toString().padStart(2, '0')
    return `${pfx}-${n}.png`
  })
}

const mockList = {
  Bodies: fileList('body'),
  Heads: fileList('head').concat(fileList('maskhead')),
  Hairs: fileList('hair', 2).concat([
    'hair-02b.png'
  ]),
  'Facial Hairs': fileList('beard').concat(fileList('mustache')),
  Glasses: fileList('glasses', 2),
  Accessories: fileList('accessory', 3),
  Hats: fileList('hat').concat(fileList('maskhat', 3))
}

const parsePath = (parts: string | string[]) => {
  const path = typeof parts === 'string' ?
    parts :
    parts.join('/')
  return decodeURIComponent(path)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const { assetpath } = params
    if (!assetpath) { return setCache(new Response('Not found', { status: 404 }))  }
    const bucket = env.STICK_FIGURES_ASSETS
    if (assetpath.length === 1){
      const category = decodeURIComponent(assetpath[0])
      if (env.mock){
        return setCache(new Response(JSON.stringify(mockList[category])))
      }
      // list
      const prefix = `assets/${category}/`
      const responses = await bucket.list({ prefix })
      if (!responses.objects.length) {
        return setCache(new Response('Not found', { status: 404 }))
      }
      const filenames = responses.objects.map(
        obj => obj.key.replace(prefix, '')
      ).filter(Boolean)
      return setCache(new Response(JSON.stringify(filenames)))
    }
    const path = parsePath(assetpath)
    const obj = await bucket.get(`assets/${path}`)
    if (obj === null) {
      return setCache(new Response('Not found', { status: 404 }))
    }
    return setCache(new Response(obj.body))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!params.assetpath) {
      throw new Error('No asset path specified')
    }
    const filename = parsePath(params.assetpath)
    const bucket = env.STICK_FIGURES_ASSETS
    const obj = await bucket.head(`assets/${filename}`)
    if (obj){
      return setCache(new Response(`File already exists with the name ${filename}`, { status: 400 }))
    }
    await bucket.put(`assets/${filename}`, request.body)
    return setCache(new Response('OK'))
  } catch (e) {
    return setCache(new Response(e.message, { status: 500 }))
  }
}