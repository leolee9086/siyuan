import { loadD5aDocument, type LoadD5aOptions, type LoadedD5aDocument } from './document-loader'
import type { D5aResourceBudget, LoadProgress } from './types'
import { validateGlb } from '../interchange/glb-container'

export { validateGlb } from '../interchange/glb-container'

export interface LoadedGlbDocument {
  kind: 'glb'
  file: File
  glb: ArrayBuffer
  title: string
  parseMs?: number
  budget: D5aResourceBudget
  warnings: string[]
  takePayload(signal?: AbortSignal): Promise<ArrayBuffer>
  close(): Promise<void>
}

export type LoadedModelDocument = LoadedD5aDocument | LoadedGlbDocument
export type LoadModelOptions = LoadD5aOptions

export async function loadModelDocument(
  file: File,
  options: LoadModelOptions = {},
): Promise<LoadedModelDocument> {
  const extension = file.name.split('.').at(-1)?.toLowerCase()
  if (extension === 'd5a') return loadD5aDocument(file, options)
  if (extension === 'glb') return loadGlbDocument(file, options)
  throw new Error('请选择 .d5a 或 .glb 模型文件')
}

export async function loadGlbDocument(
  file: File,
  options: LoadModelOptions = {},
): Promise<LoadedGlbDocument> {
  const { signal, onProgress } = options
  throwIfAborted(signal)
  emit(onProgress, 'inspect', 0, file.size, '读取 GLB 容器')
  const started = performance.now()
  const glb = await file.arrayBuffer()
  throwIfAborted(signal)
  validateGlb(glb)
  const parseMs = performance.now() - started
  emit(onProgress, 'ready', file.size, file.size, 'GLB 数据就绪')
  const document: LoadedGlbDocument = {
    kind: 'glb',
    file,
    glb,
    title: file.name.replace(/\.glb$/i, ''),
    parseMs,
    budget: {
      archiveBytes: file.size,
      uncompressedBytes: glb.byteLength,
      geometryCpuBytes: glb.byteLength,
      geometryGpuBytes: 0,
      textureSourceBytes: 0,
      severity: file.size >= 250 * 1024 * 1024 ? 'elevated' : 'normal',
      notes: file.size >= 250 * 1024 * 1024 ? ['GLB 超过 250 MB，解析和纹理解码会占用较多内存'] : [],
    },
    warnings: [],
    async takePayload(readSignal) {
      throwIfAborted(readSignal)
      if (document.glb.byteLength === 0) {
        const payload = await file.arrayBuffer()
        throwIfAborted(readSignal)
        validateGlb(payload)
        document.glb = payload
      }
      const payload = document.glb
      document.glb = new ArrayBuffer(0)
      return payload
    },
    async close() {
      document.glb = new ArrayBuffer(0)
    },
  }
  return document
}

function emit(
  callback: LoadModelOptions['onProgress'],
  phase: LoadProgress['phase'],
  loaded: number,
  total: number,
  label: string,
): void {
  callback?.({ phase, loaded, total, label })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}
