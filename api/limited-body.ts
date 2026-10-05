import { httpError } from './http-errors'

// Reads a multipart body, refusing it once it passes maxBytes. The Content-Length
// header is only a shortcut: a client can leave it out (chunked upload), so the bytes
// are counted as they stream in, and nothing past the limit is ever read.
export async function readLimitedFormData(request: Request, maxBytes: number, tooLargeMessage: string): Promise<FormData> {
  const tooLarge = () => httpError(413, tooLargeMessage)
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) throw tooLarge()
  if (!request.body) throw httpError(400, 'The form arrived empty. Please try sending it again.')

  let bytesRead = 0
  const counted = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength
      if (bytesRead > maxBytes) controller.error(tooLarge())
      else controller.enqueue(chunk)
    },
  }))
  const contentType = request.headers.get('Content-Type') ?? ''
  try {
    return await new Response(counted, { headers: { 'Content-Type': contentType } }).formData()
  } catch {
    // The parser may wrap the stream's error, so the count decides what went wrong.
    if (bytesRead > maxBytes) throw tooLarge()
    throw httpError(400, 'We couldn\'t read that form. Please try sending it again.')
  }
}
