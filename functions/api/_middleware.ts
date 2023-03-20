export async function onRequest({ env, next }) {
  env.mock = false
  return await next()
}