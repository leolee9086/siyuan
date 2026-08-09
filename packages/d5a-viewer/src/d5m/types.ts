export type D5mTextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be'
export type D5mParameterSetKey = 'matInfo' | 'matInfo2'
export type D5mParameterStorage = 'string' | 'array'

export interface D5mArchiveEntry {
  filename: string
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
  signature?: number
  encrypted: boolean
  directory: boolean
}

export interface D5mInspection {
  entries: D5mArchiveEntry[]
  materialEntry?: string
  iconEntry?: string
  summaryEntry?: string
  textureEntries: string[]
  totalUncompressedBytes: number
  protected: boolean
  warnings: string[]
}

export interface D5mMaterialParameter {
  name: string
  type: number
  value: string
  group?: string
  default?: boolean
  fromPlugin?: number
  [key: string]: unknown
}

export interface D5mMaterialData {
  id?: string
  title?: string
  uePath?: string
  matInfo?: string | D5mMaterialParameter[]
  matInfo2?: unknown
  type?: number
  [key: string]: unknown
}

export interface D5mTextureReference {
  parameterSet: D5mParameterSetKey
  parameterIndex: number
  slot: string
  value: string
  resolvedPath?: string
}

export interface D5mMaterialProfile {
  familyId: string
  profileId: string
  uePath: string
  materialType?: number
  parameterCount: number
  textureSlots: string[]
}

export interface D5mLoadProgress {
  phase: 'inspect' | 'material' | 'ready'
  loaded: number
  total: number
  label: string
}
