import { canonicalD5mPath } from './archive'
import type { D5mParameterSetKey } from './types'
import { getD5mDraftParameters, type D5mMaterialDraft } from './writer'

export interface D5mResolvedResource {
  path: string
  blob: Blob
  source: 'override' | 'archive'
}

export async function resolveD5mDraftResource(
  draft: D5mMaterialDraft,
  parameterIndex: number,
  parameterSetOrSignal: D5mParameterSetKey | AbortSignal = 'matInfo',
  signal?: AbortSignal,
): Promise<D5mResolvedResource | undefined> {
  const parameterSet = typeof parameterSetOrSignal === 'string' ? parameterSetOrSignal : 'matInfo'
  const effectiveSignal = typeof parameterSetOrSignal === 'string' ? signal : parameterSetOrSignal
  const parameter = getD5mDraftParameters(draft, parameterSet)[parameterIndex]
  if (!parameter || parameter.type !== 3 || !parameter.value) return undefined
  throwIfAborted(effectiveSignal)
  const requested = canonicalD5mPath(parameter.value)
  const candidates = new Set([requested, canonicalD5mPath(`textures/${requested}`)])
  for (const [path, blob] of draft.resources) {
    if (candidates.has(canonicalD5mPath(path))) {
      return { path, blob, source: 'override' }
    }
  }
  const archive = draft.source?.archive
  if (!archive) return undefined
  const resolvedPath = archive.resolve(requested) ?? archive.resolve(`textures/${requested}`)
  if (!resolvedPath) return undefined
  return {
    path: resolvedPath,
    blob: await archive.blob(resolvedPath, mimeFromFilename(resolvedPath), effectiveSignal),
    source: 'archive',
  }
}

export function mimeFromFilename(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'bmp') return 'image/bmp'
  if (extension === 'tif' || extension === 'tiff') return 'image/tiff'
  if (extension === 'dds') return 'image/vnd-ms.dds'
  if (extension === 'hdr') return 'image/vnd.radiance'
  if (extension === 'exr') return 'image/x-exr'
  return 'application/octet-stream'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('材质资源加载已取消', 'AbortError')
}
