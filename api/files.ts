// Every R2 object is served through /api/files so the buckets stay private.

export const FILE_BUCKETS = {
  assets: 'ASSET_BUCKET',
  figures: 'FIGURE_BUCKET',
} as const satisfies Record<string, keyof Env>

export type FileBucketAlias = keyof typeof FILE_BUCKETS

// Only v2 keys are reachable, so v1 objects sharing the production buckets never leak.
export const SERVABLE_KEY_PREFIX = 'v2/'

export const fileUrl = (bucket: FileBucketAlias, key: string) => `/api/files/${bucket}/${key}`
