import { z } from 'zod'

export const ApiError = z.object({ error: z.string() })

export const MeResponse = z.object({ email: z.string() })
export type MeResponse = z.infer<typeof MeResponse>
