import {
  BlobReader,
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { canonicalD5mPath } from './archive'
import type { LoadedD5mDocument } from './document'
import { encodeD5mText } from './text'
import type {
  D5mMaterialData,
  D5mMaterialParameter,
  D5mParameterSetKey,
  D5mParameterStorage,
  D5mTextEncoding,
} from './types'

export interface D5mMaterialDraft {
  source?: LoadedD5mDocument
  material: D5mMaterialData
  parameters: D5mMaterialParameter[]
  matInfoStorage: D5mParameterStorage
  secondaryParameters?: D5mMaterialParameter[]
  matInfo2Storage?: D5mParameterStorage
  encoding: D5mTextEncoding
  bom: boolean
  resources: Map<string, Blob>
  icon?: Blob
  summary?: string
}

export interface WriteD5mOptions {
  signal?: AbortSignal
  allowMissingTextures?: boolean
  onProgress?: (completed: number, total: number, label: string) => void
}

export interface D5mWriteResult {
  blob: Blob
  entryCount: number
  copiedEntryCount: number
  materialBytes: number
  elapsedMs: number
}

export interface D5mWriteStats {
  entryCount: number
  copiedEntryCount: number
  materialBytes: number
  elapsedMs: number
}

export function createD5mDraft(source?: LoadedD5mDocument): D5mMaterialDraft {
  if (!source) {
    return {
      material: {},
      parameters: [],
      matInfoStorage: 'string',
      encoding: 'utf-8',
      bom: false,
      resources: new Map(),
    }
  }
  return {
    source,
    material: structuredClone(source.material),
    parameters: structuredClone(source.parameters),
    matInfoStorage: source.matInfoStorage,
    secondaryParameters: source.secondaryParameters ? structuredClone(source.secondaryParameters) : undefined,
    matInfo2Storage: source.matInfo2Storage,
    encoding: source.encoding,
    bom: source.bom,
    resources: new Map(),
  }
}

export async function writeD5mArchive(
  draft: D5mMaterialDraft,
  options: WriteD5mOptions = {},
): Promise<D5mWriteResult> {
  const blobWriter = new BlobWriter('application/zip')
  const result = await writeD5mArchiveWithWriter(draft, new ZipWriter(blobWriter, {
    useWebWorkers: typeof Worker !== 'undefined',
    signal: options.signal,
  }), options)
  return { blob: result.output, ...result.stats }
}

export async function writeD5mArchiveToStream(
  draft: D5mMaterialDraft,
  writable: WritableStream<Uint8Array>,
  options: WriteD5mOptions = {},
): Promise<D5mWriteStats> {
  const result = await writeD5mArchiveWithWriter(draft, new ZipWriter<void>(writable, {
    useWebWorkers: typeof Worker !== 'undefined',
    signal: options.signal,
  }), options)
  return result.stats
}

async function writeD5mArchiveWithWriter<Output>(
  draft: D5mMaterialDraft,
  writer: ZipWriter<Output>,
  options: WriteD5mOptions,
): Promise<{ output: Output; stats: D5mWriteStats }> {
  const startedAt = performance.now()
  throwIfAborted(options.signal)
  const material = materialDataFromD5mDraft(draft)
  const materialBytes = encodeD5mText(JSON.stringify(material), draft.encoding, draft.bom)
  validateTextureResources(draft, options.allowMissingTextures ?? false)

  const overrides = new Map<string, { filename: string; blob: Blob }>()
  for (const [filename, blob] of draft.resources) {
    overrides.set(canonicalD5mPath(filename), { filename: normalizeOutputPath(filename), blob })
  }
  if (draft.icon) overrides.set('icon.png', { filename: 'icon.png', blob: draft.icon })
  if (draft.summary != null) {
    overrides.set('summary.txt', {
      filename: 'summary.txt',
      blob: new Blob([draft.summary], { type: 'text/plain' }),
    })
  }

  const sourceEntries = draft.source?.inspection.entries.filter((entry) => !entry.directory) ?? []
  const sourceMaterialPath = draft.source?.inspection.materialEntry ?? 'material.json'
  const consumedOverrides = new Set<string>()
  const outputPaths = new Set(sourceEntries.map((entry) => canonicalD5mPath(entry.filename)))
  outputPaths.add(canonicalD5mPath(sourceMaterialPath))
  for (const key of overrides.keys()) outputPaths.add(key)
  let entryCount = 0
  let copiedEntryCount = 0
  const totalEntries = outputPaths.size
  try {
    if (sourceEntries.length === 0) {
      await writer.add(sourceMaterialPath, new Uint8ArrayReader(materialBytes), {
        level: 6,
        signal: options.signal,
      })
      entryCount += 1
      options.onProgress?.(entryCount, totalEntries, sourceMaterialPath)
    } else {
      for (const entry of sourceEntries) {
        throwIfAborted(options.signal)
        const key = canonicalD5mPath(entry.filename)
        if (key === canonicalD5mPath(sourceMaterialPath)) {
          await writer.add(entry.filename, new Uint8ArrayReader(materialBytes), {
            level: entry.compressionMethod === 0 ? 0 : 6,
            signal: options.signal,
          })
        } else {
          const override = overrides.get(key)
          if (override) {
            await writer.add(entry.filename, new BlobReader(override.blob), {
              level: entry.compressionMethod === 0 ? 0 : 6,
              signal: options.signal,
            })
            consumedOverrides.add(key)
          } else {
            await copySourceEntry(writer, draft.source!, entry.filename, entry.compressionMethod, options.signal)
            copiedEntryCount += 1
          }
        }
        entryCount += 1
        options.onProgress?.(entryCount, totalEntries, entry.filename)
      }
    }

    for (const [key, override] of overrides) {
      if (consumedOverrides.has(key)) continue
      throwIfAborted(options.signal)
      await writer.add(override.filename, new BlobReader(override.blob), {
        level: isAlreadyCompressed(override.filename) ? 0 : 6,
        signal: options.signal,
      })
      entryCount += 1
      options.onProgress?.(entryCount, totalEntries, override.filename)
    }

    const output = await writer.close()
    throwIfAborted(options.signal)
    return {
      output,
      stats: {
        entryCount,
        copiedEntryCount,
        materialBytes: materialBytes.byteLength,
        elapsedMs: performance.now() - startedAt,
      },
    }
  } catch (error) {
    await writer.close().catch(() => undefined)
    throw error
  }
}

async function copySourceEntry(
  writer: ZipWriter<unknown>,
  source: LoadedD5mDocument,
  filename: string,
  compressionMethod: number,
  signal?: AbortSignal,
): Promise<void> {
  const bridge = new TransformStream<Uint8Array, Uint8Array>()
  await Promise.all([
    source.archive.pipe(filename, bridge.writable, signal),
    writer.add(filename, bridge.readable, {
      level: compressionMethod === 0 ? 0 : 6,
      signal,
      useWebWorkers: false,
    }),
  ])
}

export function materialDataFromD5mDraft(draft: D5mMaterialDraft): D5mMaterialData {
  const material = structuredClone(draft.material)
  material.matInfo = serializeParameterSet(draft.parameters, draft.matInfoStorage)
  if (draft.secondaryParameters && draft.matInfo2Storage) {
    material.matInfo2 = serializeParameterSet(draft.secondaryParameters, draft.matInfo2Storage)
  }
  return material
}

export function getD5mDraftParameters(
  draft: D5mMaterialDraft,
  parameterSet: D5mParameterSetKey = 'matInfo',
): D5mMaterialParameter[] {
  if (parameterSet === 'matInfo') return draft.parameters
  if (!draft.secondaryParameters) throw new Error('D5M 不包含可编辑的 matInfo2 参数集')
  return draft.secondaryParameters
}

function serializeParameterSet(
  parameters: D5mMaterialParameter[],
  storage: D5mParameterStorage,
): D5mMaterialData['matInfo'] {
  return storage === 'array' ? structuredClone(parameters) : JSON.stringify(parameters)
}

function validateTextureResources(draft: D5mMaterialDraft, allowMissing: boolean): void {
  if (allowMissing) return
  const available = new Set<string>()
  for (const entry of draft.source?.inspection.entries ?? []) {
    if (!entry.directory) available.add(canonicalD5mPath(entry.filename))
  }
  for (const filename of draft.resources.keys()) available.add(canonicalD5mPath(filename))
  const missing = [
    { key: 'matInfo' as const, parameters: draft.parameters },
    ...(draft.secondaryParameters ? [{ key: 'matInfo2' as const, parameters: draft.secondaryParameters }] : []),
  ].flatMap(({ key, parameters }) => parameters.flatMap((parameter) => {
    if (parameter.type !== 3 || !parameter.value) return []
    const value = canonicalD5mPath(parameter.value)
    return available.has(value) || available.has(`textures/${value}`)
      ? []
      : [`${key}.${parameter.name}: ${parameter.value}`]
  }))
  if (missing.length > 0) throw new Error(`D5M 缺少 ${missing.length} 个纹理资源：${missing.join('；')}`)
}

function normalizeOutputPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

function isAlreadyCompressed(filename: string): boolean {
  return /\.(?:avif|dds|gif|jpe?g|ktx2?|png|tiff?|webp)$/i.test(filename)
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('D5M 写入已取消', 'AbortError')
}
