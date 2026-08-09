import { validateBytes, type GltfValidationMessage, type GltfValidationReport } from 'gltf-validator'
import { D5aArchive } from '../core/d5a-archive'
import { parseD5Mesh } from '../core/d5mesh'
import { parseD5Info } from '../core/materials'
import type { D5aVariant, D5MeshModel, D5Info } from '../core/types'
import { validateGlb } from './glb-container'

export type SceneInspectionFormat = 'd5a' | 'glb'
export type SceneInspectionStatus = 'pass' | 'warning' | 'unsupported' | 'fail'

export interface SceneInspectionProgress {
  phase: 'inspect' | 'metadata' | 'extract' | 'parse' | 'validate' | 'ready'
  completed: number
  total: number
  message: string
}

export interface SceneInspectionOptions {
  signal?: AbortSignal
  onProgress?: (progress: SceneInspectionProgress) => void
}

export interface SceneInspectionReport {
  schemaVersion: 1
  documentKind: 'scene'
  operation: 'inspect' | 'validate'
  status: SceneInspectionStatus
  format: SceneInspectionFormat
  file: {
    name: string
    bytes: number
    lastModified: number
  }
  elapsedMs: number
  warnings: string[]
  d5a?: D5aSceneInspection
  glb?: GlbSceneInspection
  validation?: SceneValidationSummary
}

export interface D5aSceneInspection {
  variant: D5aVariant
  entryCount: number
  fileEntryCount: number
  encryptedEntryCount: number
  compressedBytes: number
  uncompressedBytes: number
  groupInfoEntry?: string
  legacyFbx?: {
    entry: string
    bytes: number
    materialXmlEntry?: string
  }
  bundles: D5aBundleSceneInspection[]
}

export interface D5aBundleSceneInspection {
  id: string
  meshEntry: string
  infoEntry?: string
  status: 'parsed' | 'protected'
  mesh?: {
    version: number
    sourceBytes: number
    triangleCount: number
    vertexCount: number
    descriptorCount: number
    geometryGroupCount: number
    metadataTriangleCount?: number
  }
  material?: {
    title: string
    infoVersion?: number
    materialCount: number
    textureReferenceCount: number
  }
  warnings: string[]
}

export interface GlbSceneInspection {
  version: number
  jsonBytes: number
  binaryBytes: number
  chunks: Array<{ type: 'JSON' | 'BIN' | 'unknown'; bytes: number }>
  assetVersion?: string
  sceneCount: number
  nodeCount: number
  meshCount: number
  primitiveCount: number
  triangleCount: number
  materialCount: number
  textureCount: number
  imageCount: number
  animationCount: number
  skinCount: number
  extensionsUsed: string[]
  extensionsRequired: string[]
}

export interface SceneValidationSummary {
  engine: 'd5mesh-parser' | 'gltf-validator'
  errorCount: number
  warningCount: number
  infoCount?: number
  hintCount?: number
  messages: Array<{
    severity: 'error' | 'warning' | 'info' | 'hint'
    code: string
    message: string
    pointer?: string
  }>
}

interface ParsedGlbContainer {
  inspection: GlbSceneInspection
  json: Record<string, unknown>
}

export async function inspectSceneFile(
  file: File,
  options: SceneInspectionOptions = {},
): Promise<SceneInspectionReport> {
  const started = performance.now()
  const format = sceneFormatFromName(file.name)
  emit(options, 'inspect', 0, file.size, `检查 ${format.toUpperCase()} 容器`)
  const report = format === 'd5a'
    ? await inspectD5aFile(file, options)
    : await inspectGlbFile(file, options)
  report.elapsedMs = performance.now() - started
  emit(options, 'ready', 1, 1, '场景检查完成')
  return report
}

export async function validateSceneFile(
  file: File,
  options: SceneInspectionOptions = {},
): Promise<SceneInspectionReport> {
  const report = await inspectSceneFile(file, options)
  report.operation = 'validate'
  if (report.format === 'd5a') {
    const protectedBundles = report.d5a?.bundles.filter((bundle) => bundle.status === 'protected').length ?? 0
    const unsupported = report.status === 'unsupported' || protectedBundles > 0
    report.validation = {
      engine: 'd5mesh-parser',
      errorCount: report.status === 'fail' ? 1 : 0,
      warningCount: report.warnings.length,
      messages: report.warnings.map((message) => ({ severity: 'warning', code: 'D5A_WARNING', message })),
    }
    if (unsupported) report.status = 'unsupported'
    else if (report.status !== 'fail') report.status = report.warnings.length > 0 ? 'warning' : 'pass'
    return report
  }

  throwIfAborted(options.signal)
  emit(options, 'validate', 0, 1, '运行 Khronos glTF Validator')
  const bytes = new Uint8Array(await file.arrayBuffer())
  throwIfAborted(options.signal)
  const validator = await validateBytes(bytes, {
    uri: file.name,
    format: 'glb',
    writeTimestamp: false,
    maxIssues: 100,
  })
  report.validation = summarizeGltfValidation(validator)
  if (report.validation.errorCount > 0) report.status = 'fail'
  else if (report.validation.warningCount > 0 || report.warnings.length > 0) report.status = 'warning'
  else report.status = 'pass'
  emit(options, 'validate', 1, 1, 'Khronos glTF Validator 完成')
  return report
}

export function parseGlbContainer(buffer: ArrayBuffer): ParsedGlbContainer {
  validateGlb(buffer)
  const view = new DataView(buffer)
  let offset = 12
  let json: Record<string, unknown> | undefined
  let jsonBytes = 0
  let binaryBytes = 0
  const chunks: GlbSceneInspection['chunks'] = []
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error('GLB 块头不完整')
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const payloadOffset = offset + 8
    const payloadEnd = payloadOffset + length
    if (payloadEnd > buffer.byteLength) throw new Error('GLB 块长度越过文件结尾')
    if (type === 0x4e4f534a) {
      if (json) throw new Error('GLB 包含多个 JSON 块')
      jsonBytes = length
      const text = new TextDecoder().decode(new Uint8Array(buffer, payloadOffset, length)).replace(/\u0000+$/g, '')
      json = requireJsonObject(text)
      chunks.push({ type: 'JSON', bytes: length })
    } else if (type === 0x004e4942) {
      binaryBytes += length
      chunks.push({ type: 'BIN', bytes: length })
    } else {
      chunks.push({ type: 'unknown', bytes: length })
    }
    offset = payloadEnd
  }
  if (!json) throw new Error('GLB 缺少 JSON 块')
  if (offset !== buffer.byteLength) throw new Error('GLB 块边界与文件长度不一致')
  return {
    json,
    inspection: inspectGlbJson(json, view.getUint32(4, true), jsonBytes, binaryBytes, chunks),
  }
}

function inspectGlbFile(file: File, options: SceneInspectionOptions): Promise<SceneInspectionReport> {
  return file.arrayBuffer().then((buffer) => {
    throwIfAborted(options.signal)
    emit(options, 'parse', file.size, file.size, '解析 GLB JSON 与缓冲区目录')
    const parsed = parseGlbContainer(buffer)
    return {
      schemaVersion: 1,
      documentKind: 'scene',
      operation: 'inspect',
      status: 'pass',
      format: 'glb',
      file: fileSummary(file),
      elapsedMs: 0,
      warnings: [],
      glb: parsed.inspection,
    }
  })
}

async function inspectD5aFile(file: File, options: SceneInspectionOptions): Promise<SceneInspectionReport> {
  const archive = await D5aArchive.open(file, {
    signal: options.signal,
    onprogress: (completed, total) => emit(options, 'inspect', completed, total, '读取 D5A 文件目录'),
  })
  try {
    throwIfAborted(options.signal)
    const inspection = archive.inspection
    const warnings = [...inspection.warnings]
    const files = inspection.entries.filter((entry) => !entry.directory)
    const bundles: D5aBundleSceneInspection[] = []
    for (const [index, bundle] of inspection.bundles.entries()) {
      throwIfAborted(options.signal)
      emit(options, 'extract', index, Math.max(inspection.bundles.length, 1), `解压 ${bundle.meshEntry}`)
      const bundleWarnings: string[] = []
      let mesh: D5MeshModel | undefined
      try {
        mesh = parseD5Mesh(await archive.arrayBuffer(bundle.meshEntry, { signal: options.signal }))
      } catch (error) {
        const message = normalizeError(error)
        if (!/protected official-library/i.test(message)) throw new Error(`${bundle.meshEntry}: ${message}`)
        const warning = `${bundle.meshEntry}: 受保护 D5Mesh 载荷仅记录容器信息`
        bundleWarnings.push(warning)
        warnings.push(warning)
      }
      let info: D5Info | undefined
      if (bundle.infoEntry) {
        try {
          info = parseD5Info(await archive.text(bundle.infoEntry, options.signal), '', bundle.prefix)
        } catch (error) {
          const warning = `${bundle.infoEntry}: 无法解析 info.json：${normalizeError(error)}`
          bundleWarnings.push(warning)
          warnings.push(warning)
        }
      }
      if (mesh?.warnings.length) {
        for (const warning of mesh.warnings) {
          const prefixed = `${bundle.meshEntry}: ${warning}`
          bundleWarnings.push(prefixed)
          warnings.push(prefixed)
        }
      }
      bundles.push({
        id: bundle.id,
        meshEntry: bundle.meshEntry,
        infoEntry: bundle.infoEntry,
        status: mesh ? 'parsed' : 'protected',
        mesh: mesh ? d5MeshSummary(mesh) : undefined,
        material: info ? d5InfoSummary(info) : undefined,
        warnings: bundleWarnings,
      })
    }
    if (inspection.variant === 'legacy-fbx') {
      warnings.push('旧版 FBX 已完成容器检查；完整 FBX 几何验证将在场景转换命令中执行')
    }
    if (inspection.variant === 'unknown') warnings.push('容器未包含可识别的 D5Mesh 或 FBX 场景载荷')
    const unsupported = inspection.variant === 'encrypted' || inspection.variant === 'unknown' || bundles.some((bundle) => bundle.status === 'protected')
    return {
      schemaVersion: 1,
      documentKind: 'scene',
      operation: 'inspect',
      status: unsupported ? 'unsupported' : warnings.length > 0 ? 'warning' : 'pass',
      format: 'd5a',
      file: fileSummary(file),
      elapsedMs: 0,
      warnings,
      d5a: {
        variant: inspection.variant,
        entryCount: inspection.entries.length,
        fileEntryCount: files.length,
        encryptedEntryCount: files.filter((entry) => entry.encrypted).length,
        compressedBytes: files.reduce((total, entry) => total + entry.compressedSize, 0),
        uncompressedBytes: inspection.totalUncompressedBytes,
        groupInfoEntry: inspection.groupInfoEntry,
        legacyFbx: inspection.fbxEntry
          ? {
              entry: inspection.fbxEntry,
              bytes: inspection.entries.find((entry) => entry.filename === inspection.fbxEntry)?.uncompressedSize ?? 0,
              materialXmlEntry: inspection.materialXmlEntry,
            }
          : undefined,
        bundles,
      },
    }
  } finally {
    await archive.close()
  }
}

function inspectGlbJson(
  json: Record<string, unknown>,
  version: number,
  jsonBytes: number,
  binaryBytes: number,
  chunks: GlbSceneInspection['chunks'],
): GlbSceneInspection {
  const meshes = arrayAt(json, 'meshes')
  const accessors = arrayAt(json, 'accessors')
  const primitiveItems = meshes.flatMap((mesh) => arrayAt(mesh, 'primitives'))
  return {
    version,
    jsonBytes,
    binaryBytes,
    chunks,
    assetVersion: stringAt(objectAt(json, 'asset'), 'version'),
    sceneCount: arrayAt(json, 'scenes').length,
    nodeCount: arrayAt(json, 'nodes').length,
    meshCount: meshes.length,
    primitiveCount: primitiveItems.length,
    triangleCount: primitiveItems.reduce((total, primitive) => total + primitiveTriangleCount(primitive, accessors), 0),
    materialCount: arrayAt(json, 'materials').length,
    textureCount: arrayAt(json, 'textures').length,
    imageCount: arrayAt(json, 'images').length,
    animationCount: arrayAt(json, 'animations').length,
    skinCount: arrayAt(json, 'skins').length,
    extensionsUsed: stringsAt(json, 'extensionsUsed'),
    extensionsRequired: stringsAt(json, 'extensionsRequired'),
  }
}

function primitiveTriangleCount(primitive: Record<string, unknown>, accessors: Record<string, unknown>[]): number {
  const attributes = objectAt(primitive, 'attributes')
  const index = integerAt(primitive, 'indices') ?? integerAt(attributes, 'POSITION')
  const count = index == null ? undefined : integerAt(accessors[index], 'count')
  if (count == null || count < 0) return 0
  switch (integerAt(primitive, 'mode') ?? 4) {
    case 4: return Math.floor(count / 3)
    case 5:
    case 6: return Math.max(0, count - 2)
    default: return 0
  }
}

function summarizeGltfValidation(report: GltfValidationReport): SceneValidationSummary {
  const messages = report.issues.messages.map((message) => validationMessage(message))
  return {
    engine: 'gltf-validator',
    errorCount: report.issues.numErrors,
    warningCount: report.issues.numWarnings,
    infoCount: report.issues.numInfos,
    hintCount: report.issues.numHints,
    messages,
  }
}

function validationMessage(message: GltfValidationMessage): SceneValidationSummary['messages'][number] {
  return {
    severity: message.severity === 0 ? 'error' : message.severity === 1 ? 'warning' : message.severity === 2 ? 'info' : 'hint',
    code: message.code,
    message: message.message,
    pointer: message.pointer,
  }
}

function d5MeshSummary(mesh: D5MeshModel): D5aBundleSceneInspection['mesh'] {
  return {
    version: mesh.version,
    sourceBytes: mesh.sourceBytes,
    triangleCount: mesh.triangleCount,
    vertexCount: mesh.vertexCount,
    descriptorCount: mesh.descriptors.length,
    geometryGroupCount: mesh.groups.length,
    metadataTriangleCount: mesh.metadata.triangleCount,
  }
}

function d5InfoSummary(info: D5Info): NonNullable<D5aBundleSceneInspection['material']> {
  const textures = new Set<string>()
  for (const material of info.materials) {
    for (const path of [material.diffuseMap, material.normalMap, material.roughnessMap, material.metallicMap, material.opacityMap, material.emissiveMap]) {
      if (path) textures.add(path)
    }
  }
  return {
    title: info.title,
    infoVersion: info.infoVersion,
    materialCount: info.materials.length,
    textureReferenceCount: textures.size,
  }
}

function sceneFormatFromName(name: string): SceneInspectionFormat {
  if (/\.d5a$/i.test(name)) return 'd5a'
  if (/\.glb$/i.test(name)) return 'glb'
  throw new Error('场景检查仅支持 .d5a 或 .glb 文件')
}

function fileSummary(file: File): SceneInspectionReport['file'] {
  return { name: file.name, bytes: file.size, lastModified: file.lastModified }
}

function emit(
  options: SceneInspectionOptions,
  phase: SceneInspectionProgress['phase'],
  completed: number,
  total: number,
  message: string,
): void {
  options.onProgress?.({ phase, completed, total, message })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('场景任务已取消', 'AbortError')
}

function requireJsonObject(text: string): Record<string, unknown> {
  try {
    return objectValue(JSON.parse(text)) ?? fail('GLB JSON 根节点必须是对象')
  } catch (error) {
    throw new Error(`GLB JSON 无法解析：${normalizeError(error)}`)
  }
}

function arrayAt(value: Record<string, unknown> | undefined, key: string): Record<string, unknown>[] {
  const raw = value?.[key]
  return Array.isArray(raw) ? raw.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item)) : []
}

function stringsAt(value: Record<string, unknown>, key: string): string[] {
  const raw = value[key]
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
}

function objectAt(value: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  return objectValue(value?.[key])
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function integerAt(value: Record<string, unknown> | undefined, key: string): number | undefined {
  const candidate = value?.[key]
  return typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : undefined
}

function stringAt(value: Record<string, unknown> | undefined, key: string): string | undefined {
  const candidate = value?.[key]
  return typeof candidate === 'string' ? candidate : undefined
}

function fail(message: string): never {
  throw new Error(message)
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
