export async function onRequest({ request, env, next }) {
  env.mock = !request.url.startsWith('https://stick')
  return await next()
}