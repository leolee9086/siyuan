import { D5mArchive, canonicalD5mPath } from './archive'
import { decodeD5mText } from './text'
import type {
  D5mInspection,
  D5mLoadProgress,
  D5mMaterialData,
  D5mMaterialParameter,
  D5mMaterialProfile,
  D5mParameterSetKey,
  D5mParameterStorage,
  D5mTextEncoding,
  D5mTextureReference,
} from './types'

export interface LoadedD5mDocument {
  kind: 'd5m'
  file: File
  archive: D5mArchive
  inspection: D5mInspection
  material: D5mMaterialData
  parameters: D5mMaterialParameter[]
  matInfoStorage: D5mParameterStorage
  secondaryParameters?: D5mMaterialParameter[]
  matInfo2Storage?: D5mParameterStorage
  encoding: D5mTextEncoding
  bom: boolean
  profile: D5mMaterialProfile
  textureReferences: D5mTextureReference[]
  warnings: string[]
  close(): Promise<void>
}

export interface LoadD5mOptions {
  signal?: AbortSignal
  onProgress?: (progress: D5mLoadProgress) => void
}

export async function loadD5mDocument(
  file: File,
  options: LoadD5mOptions = {},
): Promise<LoadedD5mDocument> {
  const { signal, onProgress } = options
  throwIfAborted(signal)
  emit(onProgress, 'inspect', 0, file.size, '检查 D5M 容器')
  const archive = await D5mArchive.open(file, {
    signal,
    onprogress: (loaded, total) => emit(onProgress, 'inspect', loaded, total, '读取文件目录'),
  })
  try {
    const { inspection } = archive
    if (inspection.protected) throw new Error('此 D5M 使用官方素材库受保护容器')
    if (!inspection.materialEntry) throw new Error('D5M 中未找到 material.json')
    emit(onProgress, 'material', 0, 1, '读取材质定义')
    const decoded = decodeD5mText(await archive.bytes(inspection.materialEntry, signal))
    const material = parseMaterialJson(decoded.text)
    const parsedParameters = parseD5mParameterSet(material.matInfo, 'matInfo')
    const secondaryParameters = tryParseD5mParameterSet(material.matInfo2, 'matInfo2')
    const textureReferences = [
      ...resolveTextureReferences(parsedParameters.parameters, archive, 'matInfo'),
      ...(secondaryParameters
        ? resolveTextureReferences(secondaryParameters.parameters, archive, 'matInfo2')
        : []),
    ]
    const profile = describeD5mProfile(material, parsedParameters.parameters)
    const warnings = [
      ...inspection.warnings,
      ...textureReferences
        .filter((reference) => !reference.resolvedPath)
        .map((reference) => `纹理槽 ${reference.slot} 未找到归档资源 ${reference.value}`),
    ]
    emit(onProgress, 'ready', 1, 1, '材质数据就绪')
    return {
      kind: 'd5m',
      file,
      archive,
      inspection,
      material,
      parameters: parsedParameters.parameters,
      matInfoStorage: parsedParameters.storage,
      secondaryParameters: secondaryParameters?.parameters,
      matInfo2Storage: secondaryParameters?.storage,
      encoding: decoded.encoding,
      bom: decoded.bom,
      profile,
      textureReferences,
      warnings,
      close: () => archive.close(),
    }
  } catch (error) {
    await archive.close().catch(() => undefined)
    throw error
  }
}

export function describeD5mProfile(
  material: D5mMaterialData,
  parameters: D5mMaterialParameter[],
): D5mMaterialProfile {
  const uePath = typeof material.uePath === 'string' ? material.uePath : ''
  const materialType = finiteNumber(material.type)
  const familySource = JSON.stringify({ uePath, type: materialType })
  const profileSource = JSON.stringify({
    uePath,
    type: materialType,
    parameterSignature: parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      group: parameter.group ?? '',
      default: Boolean(parameter.default),
      fromPlugin: finiteNumber(parameter.fromPlugin),
    })),
    matInfo2Shape: describeJsonShape(parseNestedValue(material.matInfo2)),
  })
  return {
    familyId: stableHash(familySource),
    profileId: stableHash(profileSource),
    uePath,
    materialType,
    parameterCount: parameters.length,
    textureSlots: [...new Set(parameters.filter((parameter) => parameter.type === 3).map((parameter) => parameter.name))],
  }
}

function parseNestedValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

function describeJsonShape(value: unknown): string {
  if (value == null) return String(value)
  if (Array.isArray(value)) return `array:${value.length}`
  if (typeof value === 'object') return `object:${Object.keys(value).sort().join(',')}`
  return typeof value
}

function parseMaterialJson(text: string): D5mMaterialData {
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`material.json 解析失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('material.json 顶层必须是对象')
  }
  return value as D5mMaterialData
}

export function parseD5mParameterSet(
  value: unknown,
  field: D5mParameterSetKey = 'matInfo',
): {
  parameters: D5mMaterialParameter[]
  storage: D5mParameterStorage
} {
  const storage = Array.isArray(value) ? 'array' : 'string'
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = value ? JSON.parse(value) : []
    } catch (error) {
      throw new Error(`${field} 解析失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (parsed == null) parsed = []
  if (!Array.isArray(parsed)) throw new Error(`${field} 必须包含参数数组`)
  return {
    storage,
    parameters: parsed.map((parameter, index) => parseParameter(parameter, index, field)),
  }
}

export function tryParseD5mParameterSet(
  value: unknown,
  field: D5mParameterSetKey = 'matInfo2',
): { parameters: D5mMaterialParameter[]; storage: D5mParameterStorage } | undefined {
  if (value == null || (typeof value === 'string' && !value.trim())) return undefined
  try {
    return parseD5mParameterSet(value, field)
  } catch {
    return undefined
  }
}

function parseParameter(value: unknown, index: number, field: D5mParameterSetKey): D5mMaterialParameter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field}[${index}] 必须是对象`)
  }
  const parameter = value as Record<string, unknown>
  if (typeof parameter.name !== 'string') throw new Error(`${field}[${index}].name 必须是字符串`)
  if (!Number.isFinite(Number(parameter.type))) throw new Error(`${field}[${index}].type 必须是数字`)
  if (typeof parameter.value !== 'string') throw new Error(`${field}[${index}].value 必须是字符串`)
  return {
    ...parameter,
    name: parameter.name,
    type: Number(parameter.type),
    value: parameter.value,
  } as D5mMaterialParameter
}

function resolveTextureReferences(
  parameters: D5mMaterialParameter[],
  archive: D5mArchive,
  parameterSet: D5mParameterSetKey,
): D5mTextureReference[] {
  return parameters.flatMap((parameter, parameterIndex) => {
    if (parameter.type !== 3 || !parameter.value) return []
    const normalized = canonicalD5mPath(parameter.value)
    const resolvedPath = archive.resolve(normalized) ?? archive.resolve(`textures/${normalized}`)
    return [{ parameterSet, parameterIndex, slot: parameter.name, value: parameter.value, resolvedPath }]
  })
}

function stableHash(value: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

function finiteNumber(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function emit(
  callback: LoadD5mOptions['onProgress'],
  phase: D5mLoadProgress['phase'],
  loaded: number,
  total: number,
  label: string,
): void {
  callback?.({ phase, loaded, total, label })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}
