import { tryParseD5mParameterSet } from './document'
import { createD5mDraft, getD5mDraftParameters, type D5mMaterialDraft } from './writer'
import type {
  D5mMaterialData,
  D5mMaterialParameter,
  D5mParameterSetKey,
  D5mTextEncoding,
} from './types'

export type D5mFamilyStatus = 'confirmed' | 'provisional'

export interface D5mFamilyTemplate {
  id: string
  key: string
  label: string
  description: string
  status: D5mFamilyStatus
  uePath: string
  materialType: number
  observedCount: number
  profileCount: number
  textureSlots: string[]
  profileIds: string[]
}

export interface D5mProfileTemplate {
  id: string
  familyId: string
  count: number
  label: string
  parameterCount: number
  textureSlots: string[]
  encoding: D5mTextEncoding
  material: D5mMaterialData
  provenance: {
    source: string
    observedExamples: number
  }
}

export interface D5mTemplateRegistry {
  schemaVersion: 1
  source: string
  observedMaterialCount: number
  familyCount: number
  profileCount: number
  families: D5mFamilyTemplate[]
  profiles: D5mProfileTemplate[]
}

let registryPromise: Promise<D5mTemplateRegistry> | undefined

export function loadD5mTemplateRegistry(signal?: AbortSignal): Promise<D5mTemplateRegistry> {
  registryPromise ??= fetch(`${import.meta.env.BASE_URL}generated/d5m-profile-templates.json`, { signal })
    .then(async (response) => {
      if (!response.ok) throw new Error(`D5M 制式注册表加载失败: HTTP ${response.status}`)
      return parseD5mTemplateRegistry(await response.json())
    })
    .catch((error) => {
      registryPromise = undefined
      throw error
    })
  return registryPromise
}

export function parseD5mTemplateRegistry(value: unknown): D5mTemplateRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('D5M 制式注册表格式错误')
  const registry = value as Partial<D5mTemplateRegistry>
  if (registry.schemaVersion !== 1) throw new Error(`不支持的 D5M 制式注册表版本 ${registry.schemaVersion}`)
  if (!Array.isArray(registry.families) || !Array.isArray(registry.profiles)) {
    throw new Error('D5M 制式注册表缺少族或制式列表')
  }
  if (registry.familyCount !== registry.families.length || registry.profileCount !== registry.profiles.length) {
    throw new Error('D5M 制式注册表计数不一致')
  }
  const profileIds = new Set(registry.profiles.map((profile) => profile.id))
  for (const family of registry.families) {
    if (family.profileIds.some((profileId) => !profileIds.has(profileId))) {
      throw new Error(`D5M 材质族 ${family.label} 引用了缺失制式`)
    }
  }
  return registry as D5mTemplateRegistry
}

export function mostObservedD5mProfile(
  registry: D5mTemplateRegistry,
  familyId: string,
): D5mProfileTemplate | undefined {
  return registry.profiles
    .filter((profile) => profile.familyId === familyId)
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))[0]
}

export function resolveD5mProfileTemplate(
  registry: D5mTemplateRegistry,
  selection: { profile?: string; family?: string } = {},
): { family: D5mFamilyTemplate; profile: D5mProfileTemplate } {
  if (selection.profile) {
    const matches = registry.profiles.filter((profile) =>
      profile.id === selection.profile || profile.label === selection.profile)
    if (matches.length !== 1) {
      throw new Error(matches.length === 0
        ? `未找到 D5M 制式 ${selection.profile}`
        : `D5M 制式名称 ${selection.profile} 不唯一，请使用制式 ID`)
    }
    const profile = matches[0]!
    const family = registry.families.find((candidate) => candidate.id === profile.familyId)
    if (!family) throw new Error(`D5M 制式 ${profile.id} 引用了缺失材质族`)
    return { family, profile }
  }

  const familySelection = selection.family ?? 'standard-surface'
  const familyMatches = registry.families.filter((family) =>
    family.id === familySelection || family.key === familySelection || family.label === familySelection)
  if (familyMatches.length !== 1) {
    throw new Error(familyMatches.length === 0
      ? `未找到 D5M 材质族 ${familySelection}`
      : `D5M 材质族名称 ${familySelection} 不唯一，请使用族 ID`)
  }
  const family = familyMatches[0]!
  const profile = mostObservedD5mProfile(registry, family.id)
  if (!profile) throw new Error(`D5M 材质族 ${family.label} 没有可用制式`)
  return { family, profile }
}

export function createDraftFromTemplate(
  profile: D5mProfileTemplate,
  title?: string,
): D5mMaterialDraft {
  const material = structuredClone(profile.material)
  const parameters = parseTemplateParameters(material.matInfo)
  const now = Date.now()
  material.id = randomD5Id()
  material.title = title?.trim() || `新建${profile.label}`
  material.createTime = now
  material.updateTime = now
  material.matInfo = JSON.stringify(parameters)
  const draft = createD5mDraft()
  draft.material = material
  draft.parameters = parameters
  draft.encoding = profile.encoding
  draft.bom = profile.encoding !== 'utf-8'
  const secondary = tryParseD5mParameterSet(material.matInfo2)
  if (secondary) {
    draft.secondaryParameters = secondary.parameters.map((parameter) => (
      parameter.type === 3 ? { ...parameter, value: '' } : parameter
    ))
    draft.matInfo2Storage = secondary.storage
  }
  draft.summary = material.title
  return draft
}

export function setDraftTexture(
  draft: D5mMaterialDraft,
  parameterIndex: number,
  file: File | Blob,
  filename?: string,
  parameterSet: D5mParameterSetKey = 'matInfo',
): string {
  const parameters = getD5mDraftParameters(draft, parameterSet)
  const parameter = parameters[parameterIndex]
  if (!parameter || parameter.type !== 3) throw new Error('目标参数不是纹理槽')
  const previousValue = parameter.value
  const extension = textureExtension(filename ?? (file instanceof File ? file.name : 'texture.png'))
  const materialId = normalizedId(draft.material.id)
  const resourceId = randomD5Id()
  const value = `um/${materialId}/${resourceId}.${extension}`
  parameter.value = value
  removeUnreferencedGeneratedTexture(draft, previousValue)
  draft.resources.set(`textures/${value}`, file)
  draft.material.updateTime = Date.now()
  return value
}

export function clearDraftTexture(
  draft: D5mMaterialDraft,
  parameterIndex: number,
  parameterSet: D5mParameterSetKey = 'matInfo',
): void {
  const parameters = getD5mDraftParameters(draft, parameterSet)
  const parameter = parameters[parameterIndex]
  if (!parameter || parameter.type !== 3) throw new Error('目标参数不是纹理槽')
  const previousValue = parameter.value
  parameter.value = ''
  removeUnreferencedGeneratedTexture(draft, previousValue)
  draft.material.updateTime = Date.now()
}

function parseTemplateParameters(value: D5mMaterialData['matInfo']): D5mMaterialParameter[] {
  const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value
  if (!Array.isArray(parsed)) throw new Error('D5M 制式模板的 matInfo 不是数组')
  return structuredClone(parsed) as D5mMaterialParameter[]
}

function removeUnreferencedGeneratedTexture(
  draft: D5mMaterialDraft,
  value: string,
): void {
  if (!value) return
  const canonical = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^textures\//i, '')
  const stillReferenced = [draft.parameters, draft.secondaryParameters ?? []]
    .flat()
    .some((parameter) => parameter.type === 3 && canonicalPath(parameter.value) === canonical)
  if (!stillReferenced) draft.resources.delete(`textures/${canonical}`)
}

function canonicalPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^textures\//i, '')
}

function normalizedId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.replace(/[^a-z0-9]/gi, '') : ''
  return normalized || randomD5Id()
}

function randomD5Id(): string {
  return crypto.randomUUID().replaceAll('-', '').toUpperCase()
}

function textureExtension(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  if (extension && /^(?:avif|bmp|dds|exr|hdr|jpe?g|ktx2?|png|tga|tiff?|webp)$/.test(extension)) {
    return extension === 'jpeg' ? 'jpg' : extension
  }
  return 'png'
}
