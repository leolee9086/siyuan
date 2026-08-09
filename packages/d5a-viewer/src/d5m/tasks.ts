import { assertD5mFidelity, verifyD5mOutput, type D5mFidelityReport } from './fidelity'
import { loadD5mDocument } from './document'
import {
  clearDraftTexture,
  createDraftFromTemplate,
  resolveD5mProfileTemplate,
  setDraftTexture,
  type D5mFamilyTemplate,
  type D5mProfileTemplate,
  type D5mTemplateRegistry,
} from './templates'
import {
  getD5mDraftParameters,
  writeD5mArchive,
  type D5mMaterialDraft,
  type D5mWriteResult,
} from './writer'
import type { D5mParameterSetKey } from './types'
import { createAssetTaskReporter, type AssetTaskContext } from '../tasks/protocol'

export interface D5mParameterOverride {
  name?: string
  index?: number
  parameterSet?: D5mParameterSetKey
  value: string
}

export interface D5mTextureOverride {
  slot?: string
  index?: number
  parameterSet?: D5mParameterSetKey
  blob: Blob
  filename: string
}

export interface D5mTextureSelector {
  slot?: string
  index?: number
  parameterSet?: D5mParameterSetKey
}

export interface D5mDraftChanges {
  title?: string
  parameters?: D5mParameterOverride[]
  textures?: D5mTextureOverride[]
  clearTextures?: D5mTextureSelector[]
  summary?: string
  icon?: Blob
}

export interface D5mCreateRequest extends D5mDraftChanges {
  profile?: string
  family?: string
}

export interface PreparedD5mCreation {
  family: D5mFamilyTemplate
  profile: D5mProfileTemplate
  draft: D5mMaterialDraft
}

export interface D5mBlobArtifact {
  file: File
  write: D5mWriteResult
  report: D5mFidelityReport
}

export interface D5mInspectionReport {
  schemaVersion: 1
  format: 'd5m'
  status: 'pass' | 'warning'
  file: { name: string; bytes: number }
  archive: {
    entries: number
    textureEntries: number
    uncompressedBytes: number
    protected: boolean
  }
  material: {
    title: string
    familyId: string
    familyKey?: string
    familyLabel?: string
    familyStatus?: D5mFamilyTemplate['status']
    profileId: string
    profileLabel?: string
    registeredFamily: boolean
    registeredProfile: boolean
    parameterCount: number
    textureReferences: number
    resolvedTextures: number
    uePath: string
    materialType?: number
    encoding: string
    matInfoStorage: 'string' | 'array'
  }
  warnings: string[]
}

export function prepareD5mCreation(
  registry: D5mTemplateRegistry,
  request: D5mCreateRequest,
): PreparedD5mCreation {
  const { family, profile } = resolveD5mProfileTemplate(registry, request)
  const draft = createDraftFromTemplate(profile, request.title)
  applyD5mDraftChanges(draft, request)
  return { family, profile, draft }
}

export function applyD5mDraftChanges(
  draft: D5mMaterialDraft,
  changes: D5mDraftChanges,
): D5mMaterialDraft {
  if (changes.title != null) {
    const title = changes.title.trim()
    if (!title) throw new Error('D5M 材质名称不能为空')
    draft.material.title = title
  }
  for (const override of changes.parameters ?? []) {
    const target = resolveParameter(draft, override, '参数')
    getD5mDraftParameters(draft, target.parameterSet)[target.index]!.value = override.value
  }
  for (const selector of changes.clearTextures ?? []) {
    const target = resolveParameter(draft, selector, '纹理槽', 3)
    clearDraftTexture(draft, target.index, target.parameterSet)
  }
  for (const override of changes.textures ?? []) {
    const target = resolveParameter(draft, override, '纹理槽', 3)
    setDraftTexture(draft, target.index, override.blob, override.filename, target.parameterSet)
  }
  if (changes.summary != null) draft.summary = changes.summary
  if (changes.icon) draft.icon = changes.icon
  draft.material.updateTime = Date.now()
  return draft
}

export async function createD5mBlobArtifact(
  draft: D5mMaterialDraft,
  filename: string,
  context: AssetTaskContext = {},
  operation: 'create' | 'edit' = 'create',
): Promise<D5mBlobArtifact> {
  const reporter = createAssetTaskReporter(operation, 'material', 'd5m', context)
  reporter.throwIfAborted('D5M 制作已取消')
  reporter.emit('started', 'write', '开始写入 D5M')
  const write = await writeD5mArchive(draft, {
    signal: reporter.signal,
    onProgress: (completed, total, label) => reporter.emit(
      'progress',
      'write',
      `写入 ${label}`,
      { completed, total },
    ),
  })
  const file = new File([write.blob], normalizeD5mFilename(filename), {
    type: 'application/zip',
    lastModified: Date.now(),
  })
  reporter.emit('progress', 'verify', '回读并核对材质与纹理', { completed: 0, total: 1 })
  const report = await verifyD5mOutput(draft, file, reporter.signal)
  assertD5mFidelity(report)
  reporter.emit('completed', 'verify', 'D5M 写入与往返检查通过', { completed: 1, total: 1 })
  return { file, write, report }
}

export async function inspectD5mTask(
  file: File,
  registry?: D5mTemplateRegistry,
  context: AssetTaskContext = {},
): Promise<D5mInspectionReport> {
  const reporter = createAssetTaskReporter('validate', 'material', 'd5m', context)
  reporter.throwIfAborted('D5M 检查已取消')
  reporter.emit('started', 'inspect', '检查 D5M 容器')
  const document = await loadD5mDocument(file, {
    signal: reporter.signal,
    onProgress: (progress) => reporter.emit(
      'progress',
      progress.phase,
      progress.label,
      { completed: progress.loaded, total: progress.total },
    ),
  })
  try {
    const family = registry?.families.find((candidate) => candidate.id === document.profile.familyId)
    const profile = registry?.profiles.find((candidate) => candidate.id === document.profile.profileId)
    const resolvedTextures = document.textureReferences.filter((reference) => reference.resolvedPath).length
    const warnings = [...document.warnings]
    if (registry && !family) warnings.push('当前材质族不在已观察 D5M 制式注册表中')
    else if (registry && !profile) warnings.push('当前参数签名不在已观察 D5M 精确制式注册表中')
    if (family?.status === 'provisional') warnings.push(`${family.label} 的运行时语义仍待确认`)
    const report: D5mInspectionReport = {
      schemaVersion: 1,
      format: 'd5m',
      status: warnings.length > 0 ? 'warning' : 'pass',
      file: { name: file.name, bytes: file.size },
      archive: {
        entries: document.inspection.entries.filter((entry) => !entry.directory).length,
        textureEntries: document.inspection.textureEntries.length,
        uncompressedBytes: document.inspection.totalUncompressedBytes,
        protected: document.inspection.protected,
      },
      material: {
        title: String(document.material.title ?? ''),
        familyId: document.profile.familyId,
        familyKey: family?.key,
        familyLabel: family?.label,
        familyStatus: family?.status,
        profileId: document.profile.profileId,
        profileLabel: profile?.label,
        registeredFamily: Boolean(family),
        registeredProfile: Boolean(profile),
        parameterCount: document.parameters.length,
        textureReferences: document.textureReferences.length,
        resolvedTextures,
        uePath: document.profile.uePath,
        materialType: document.profile.materialType,
        encoding: `${document.encoding}${document.bom ? '+bom' : ''}`,
        matInfoStorage: document.matInfoStorage,
      },
      warnings,
    }
    reporter.emit('completed', 'inspect', 'D5M 检查完成', { completed: 1, total: 1 })
    return report
  } finally {
    await document.close()
  }
}

function resolveParameter(
  draft: D5mMaterialDraft,
  selector: { name?: string; slot?: string; index?: number; parameterSet?: D5mParameterSetKey },
  label: string,
  requiredType?: number,
): { parameterSet: D5mParameterSetKey; index: number } {
  const parameterSet = selector.parameterSet ?? 'matInfo'
  const parameters = getD5mDraftParameters(draft, parameterSet)
  const setLabel = parameterSet === 'matInfo2' ? ' matInfo2' : ''
  if (selector.index != null) {
    if (!Number.isInteger(selector.index) || selector.index < 0 || selector.index >= parameters.length) {
      throw new Error(`${label}${setLabel}索引 ${selector.index} 超出范围 0-${Math.max(0, parameters.length - 1)}`)
    }
    const parameter = parameters[selector.index]!
    if (requiredType != null && parameter.type !== requiredType) {
      throw new Error(`${label}${setLabel}索引 ${selector.index} 指向 ${parameter.name}，类型不是 ${requiredType}`)
    }
    return { parameterSet, index: selector.index }
  }
  const name = selector.name ?? selector.slot
  if (!name) throw new Error(`${label}缺少名称或索引`)
  const matches = parameters
    .map((parameter, index) => ({ parameter, index }))
    .filter(({ parameter }) => parameter.name === name && (requiredType == null || parameter.type === requiredType))
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `未找到${label}${setLabel} ${name}`
      : `${label}${setLabel} ${name} 出现 ${matches.length} 次，请使用索引`)
  }
  return { parameterSet, index: matches[0]!.index }
}

function normalizeD5mFilename(filename: string): string {
  const trimmed = filename.trim() || 'material.d5m'
  return trimmed.toLowerCase().endsWith('.d5m') ? trimmed : `${trimmed}.d5m`
}
