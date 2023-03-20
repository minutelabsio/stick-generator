export const setCache = (res: Response, value = 'no-cache') : Response => {
  res.headers.append('Cache-Control', value)
  return res
}