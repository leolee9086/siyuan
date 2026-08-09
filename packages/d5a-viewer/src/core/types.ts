export type D5aVariant = 'd5mesh' | 'legacy-fbx' | 'encrypted' | 'unknown'

export interface D5MeshMetadata {
  triangleCount: number
  upVector: number
  writedFromMemory?: number
  [key: string]: unknown
}

export interface D5MeshDescriptor {
  key: string
  materialName: string
  meshName?: string
  groupIndex: number
  transform: Float32Array
}

export interface D5MeshGroup {
  key: string
  descriptorIndex: number
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  extra: Float32Array
  interleaved?: Float32Array
  indices: Uint32Array | null
  triangleCount: number
}

export interface D5MeshModel {
  version: number
  metadata: D5MeshMetadata
  descriptors: D5MeshDescriptor[]
  groups: D5MeshGroup[]
  triangleCount: number
  vertexCount: number
  sourceBytes: number
  warnings: string[]
}

export interface D5MaterialParameter {
  name: string
  type: number
  value: string
  group?: string
  default?: boolean
}

export interface D5TextureTransform {
  repeat: [number, number]
  offset: [number, number]
  rotation: number
}

export interface D5Material {
  index: number
  key: string
  /** D5 material record identifier from detailInfo, when the source provided one. */
  id?: string
  title: string
  /** Unreal material template selected by D5 for this material. */
  uePath?: string
  /** Original detailInfo.materialData fields retained for D5A round trips. */
  sourceData?: Record<string, unknown>
  color: [number, number, number, number]
  diffuseMap?: string
  normalMap?: string
  roughnessMap?: string
  metallicMap?: string
  opacityMap?: string
  emissiveMap?: string
  roughness?: number
  roughnessMapStrength?: number
  roughnessMapInverted?: boolean
  metallic?: number
  opacity?: number
  normalScale?: [number, number]
  textureTransform: D5TextureTransform
  parameters: D5MaterialParameter[]
}

export interface D5Info {
  title: string
  productId?: string
  dimensions?: { length: number; depth: number; height: number }
  infoVersion?: number
  materialKeys: string[]
  materials: D5Material[]
  raw: Record<string, unknown>
}

export interface D5aEntryInfo {
  filename: string
  compressedSize: number
  uncompressedSize: number
  encrypted: boolean
  directory: boolean
}

export interface D5aBundleInspection {
  /** Stable archive-relative identifier. The root bundle uses an empty string. */
  id: string
  prefix: string
  meshEntry: string
  infoEntry?: string
  iconEntry?: string
  materialXmlEntry?: string
}

export interface D5aVector3 {
  x: number
  y: number
  z: number
}

export interface D5aQuaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface D5aTransform {
  rotation: D5aQuaternion
  translation: D5aVector3
  scale3D: D5aVector3
}

export interface D5aGroupModel {
  id: string
  title?: string
  parent?: string
  transform?: D5aTransform
  autoAlignToWorld?: boolean
}

export interface D5aGroupInfo {
  models: D5aGroupModel[]
  groups: { id: string; title?: string; parent?: string }[]
  originTrans?: D5aTransform
  raw: Record<string, unknown>
}

export interface D5aInspection {
  variant: D5aVariant
  entries: D5aEntryInfo[]
  totalUncompressedBytes: number
  bundles: D5aBundleInspection[]
  meshEntry?: string
  fbxEntry?: string
  infoEntry?: string
  iconEntry?: string
  materialXmlEntry?: string
  groupInfoEntry?: string
  warnings: string[]
}

export interface LoadProgress {
  phase: 'inspect' | 'metadata' | 'extract' | 'parse' | 'textures' | 'ready'
  loaded: number
  total: number
  label: string
}

export interface D5aResourceBudget {
  archiveBytes: number
  uncompressedBytes: number
  geometryCpuBytes: number
  geometryGpuBytes: number
  textureSourceBytes: number
  severity: 'normal' | 'elevated' | 'heavy'
  notes: string[]
}
