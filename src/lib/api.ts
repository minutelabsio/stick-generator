import { ApiError } from '@shared/api-schemas'
import { JOIN_CODE_HEADER } from '@shared/api-types'
import type { IntakeSettings } from '@shared/intake'
import type {
  BatchDetail,
  BatchSummary,
  ChannelSummary,
  CreateBatchRequest,
  CreateChannelRequest,
  UpdateBatchRequest,
  EntryDetail,
  JoinBatch,
  Library,
  UpdateEntryRequest,
} from '@shared/api-types'

const FALLBACK_ERROR = 'Something went wrong. Please try again.'

export class ApiRequestError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, init).catch(() => {
    throw new ApiRequestError('Could not reach the server. Check your connection and try again.')
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiRequestError(ApiError.safeParse(body).data?.error ?? FALLBACK_ERROR)
  // Our own API, typed by the shared contracts in shared/api-types.ts.
  return body as T
}

const sendJson = (method: string, payload: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

export const api = {
  listChannels: () => request<ChannelSummary[]>('/api/channels'),
  createChannel: (channel: CreateChannelRequest) => request<ChannelSummary>('/api/channels', sendJson('POST', channel)),
  listBatches: (channelId: string) => request<BatchSummary[]>(`/api/channels/${channelId}/batches`),
  getBatch: (batchId: string) => request<BatchDetail>(`/api/batches/${batchId}`),
  createBatch: (channelId: string, batch: CreateBatchRequest) =>
    request<{ id: string }>(`/api/channels/${channelId}/batches`, sendJson('POST', batch)),
  updateBatch: (batchId: string, changes: UpdateBatchRequest) =>
    request<BatchDetail>(`/api/batches/${batchId}`, sendJson('PATCH', changes)),
  rotateBatchCode: (batchId: string) => request<BatchDetail>(`/api/batches/${batchId}/rotate-code`, { method: 'POST' }),
  getEntry: (entryId: string) => request<EntryDetail>(`/api/entries/${entryId}`),
  updateEntry: (entryId: string, changes: UpdateEntryRequest) =>
    request<EntryDetail>(`/api/entries/${entryId}`, sendJson('PATCH', changes)),
  uploadRender: (entryId: string, png: Blob) =>
    request<EntryDetail>(`/api/entries/${entryId}/render`, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png }),
  getIntake: (channelId: string) => request<IntakeSettings>(`/api/channels/${channelId}/intake`),
  saveIntake: (channelId: string, intake: IntakeSettings) =>
    request<IntakeSettings>(`/api/channels/${channelId}/intake`, sendJson('PUT', intake)),
  getLibrary: (channelId: string) => request<Library>(`/api/channels/${channelId}/library`),
  getJoinBatch: (joinCode: string) => request<JoinBatch>('/api/public/batch', { headers: { [JOIN_CODE_HEADER]: joinCode } }),
  submitJoin: (joinCode: string, form: FormData) =>
    request<{ ok: true }>('/api/public/submission', { method: 'POST', headers: { [JOIN_CODE_HEADER]: joinCode }, body: form }),
}
