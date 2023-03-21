export async function onRequest({ env, next }) {
  env.mock = true
  return await next()
}