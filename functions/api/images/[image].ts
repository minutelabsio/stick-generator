interface Env {
  STICK_FIGURES: R2Bucket
}

const MB = 1024 * 1024
const MAX_UPLOAD_SIZE = 2 * MB

function iteratorToStream(iterator) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })
}

async function* limitBodySize(body: ReadableStream, limit = 2 * MAX_UPLOAD_SIZE) {
  let count = 0
  for await (const chunk of body){
    count += chunk.length
    if (count > limit){
      throw new Error('Upload too large')
    }
    yield chunk
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const filename = params.image
    const bucket = env.STICK_FIGURES
    const obj = await bucket.get(`images/${filename}`)
    if (obj === null) {
      return new Response('Not found', { status: 404 })
    }
    return new Response(obj.body)
  } catch (e) {
    return new Response(e.message, { status: 500 })
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const filename = params.image
    const bucket = env.STICK_FIGURES
    await bucket.put(`images/${filename}`, iteratorToStream(limitBodySize(request.body)))
    return new Response('OK')
  } catch (e) {
    return new Response(e.message, { status: 500 })
  }
}