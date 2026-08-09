import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  LinearSRGBColorSpace,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  Sphere,
  StaticDrawUsage,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import type { LoadedD5aDocument } from '../core/document-loader'
import type { LoadedGlbDocument, LoadedModelDocument } from '../core/model-document'
import type { D5Material, D5MeshGroup, D5aTransform } from '../core/types'
import { createGltfRuntime, type GltfRuntime } from '../interchange/gltf-runtime'
import {
  createSceneDocumentFromObject,
  type SceneDocument,
} from '../interchange/scene-document'
import { parseLegacyMaterials, type LegacyMaterialSpec } from './legacy-materials'
import { disposeObject, disposeSceneResources, inspectTextureResources } from './scene-resources'
import { ArchiveTextureCache, ProtectedD5TextureError } from './texture-cache'

export interface ModelBuildProgress {
  loaded: number
  total: number
  label: string
}

export interface BuiltModel {
  root: Object3D
  scene: SceneDocument
  triangleCount: number
  vertexCount: number
  drawCalls: number
  geometryGpuBytes: number
  parseMs: number
  textureCount: number
  textureGpuBytes: number
  declaredTextureCount: number
  textureFailureCount: number
  dispose(): void
}

export interface ModelBuildOptions {
  signal?: AbortSignal
  maxTextureSize?: number
  gltfRuntime?: GltfRuntime
  onProgress?: (progress: ModelBuildProgress) => void
  onChange?: () => void
}

export async function buildModel(
  document: LoadedModelDocument,
  options: ModelBuildOptions = {},
): Promise<BuiltModel> {
  if (document.kind === 'glb') return buildGlbModel(document, options)
  if (document.bundles.length > 0 || document.mesh) return buildD5MeshModel(document, options)
  if (document.inspection.variant === 'legacy-fbx') return buildLegacyFbxModel(document, options)
  throw new Error('D5A 文档中没有可渲染的模型数据')
}

async function buildGlbModel(
  document: LoadedGlbDocument,
  options: ModelBuildOptions,
): Promise<BuiltModel> {
  throwIfAborted(options.signal)
  options.onProgress?.({ loaded: 0, total: document.file.size, label: '读取 GLB 文件数据' })
  const payload = await document.takePayload(options.signal)
  const payloadBytes = payload.byteLength
  options.onProgress?.({ loaded: 0, total: payloadBytes, label: '解析 GLB 场景' })
  const started = performance.now()
  const ownedRuntime = options.gltfRuntime ? undefined : await createGltfRuntime()
  const runtime = options.gltfRuntime ?? ownedRuntime!
  let gltf: Awaited<ReturnType<GltfRuntime['parseGlb']>>
  try {
    gltf = await runtime.parseGlb(payload)
  } finally {
    ownedRuntime?.dispose()
  }
  throwIfAborted(options.signal)
  const root = gltf.scene
  root.name ||= document.title
  root.userData.sourceDocument = {
    format: 'glb',
    sourceName: document.file.name,
    animations: gltf.animations.map((animation) => animation.name),
  }
  const parseMs = performance.now() - started
  const stats = inspectObject(root)
  const textureStats = inspectTextureResources(root)
  const scene = createSceneDocumentFromObject(root, {
    name: document.title,
    sourceFormat: 'glb-2.0',
    animations: gltf.animations,
    metersPerUnit: 1,
  })
  options.onProgress?.({
    loaded: payloadBytes,
    total: payloadBytes,
    label: 'GLB 模型就绪',
  })
  return {
    root,
    scene,
    ...stats,
    parseMs,
    textureCount: textureStats.count,
    textureGpuBytes: textureStats.gpuBytes,
    declaredTextureCount: textureStats.count,
    textureFailureCount: 0,
    dispose() {
      disposeSceneResources(root)
    },
  }
}

async function buildD5MeshModel(
  document: LoadedD5aDocument,
  options: ModelBuildOptions,
): Promise<BuiltModel> {
  const bundles = document.bundles.length > 0
    ? document.bundles
    : document.mesh
      ? [{
          id: '',
          title: document.title,
          meshEntry: document.inspection.meshEntry ?? '',
          mesh: document.mesh,
          info: document.info,
          parseMs: document.parseMs ?? 0,
        }]
      : []
  if (bundles.length === 0) throw new Error('D5A 文档中没有可渲染的 D5Mesh 数据')
  const root = new Group()
  root.name = document.title
  root.userData.d5a = {
    sourceName: document.file.name,
    container: 'd5a',
    bundleCount: bundles.length,
    meshVersions: [...new Set(bundles.map((bundle) => bundle.mesh.version))],
    products: bundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      infoVersion: bundle.info?.infoVersion,
      productId: bundle.info?.productId,
      dimensions: bundle.info?.dimensions,
    })),
  }
  // D5Mesh payloads are normalized for Unreal (Z-up). upVector describes the import source.
  root.rotation.x = -Math.PI / 2
  const textureCache = new ArchiveTextureCache(document.archive, options.maxTextureSize)
  const pendingTextures: Promise<void>[] = []
  const referencedTextures = new Set<string>()
  for (const bundle of bundles) {
    for (const material of bundle.info?.materials ?? []) {
      for (const path of texturePaths(material)) if (path) referencedTextures.add(path.toLowerCase())
    }
  }
  let textureProgress = 0
  let drawCalls = 0
  for (const [bundleIndex, bundle] of bundles.entries()) {
    const model = bundle.mesh
    const bundleRoot = new Group()
    bundleRoot.name = bundle.title || `子包 ${bundleIndex + 1}`
    applyD5aTransform(bundleRoot, bundle.transform)
    bundleRoot.userData.d5aBundle = {
      id: bundle.id,
      meshEntry: bundle.meshEntry,
      title: bundle.title,
    }
    root.add(bundleRoot)

    const materialCache = new Map<number, MeshStandardMaterial>()
    const infoByKey = indexMaterialsByKey(bundle.info?.materials ?? [])
    const descriptorIndicesByGroup = model.groups.map(() => [] as number[])
    for (const [descriptorIndex, descriptor] of model.descriptors.entries()) {
      if (descriptor.groupIndex >= 0 && descriptor.groupIndex < model.groups.length) {
        descriptorIndicesByGroup[descriptor.groupIndex]!.push(descriptorIndex)
      }
    }

    for (const [groupIndex, group] of model.groups.entries()) {
      throwIfAborted(options.signal)
      const geometry = createD5Geometry(group)
      const descriptorIndices = descriptorIndicesByGroup[groupIndex]!
      const instanceIndices = descriptorIndices.length > 0 ? descriptorIndices : [-1]

      for (const descriptorIndex of instanceIndices) {
        const descriptor = descriptorIndex >= 0 ? model.descriptors[descriptorIndex] : undefined
        const infoMaterial = descriptor
          ? infoByKey.get(descriptor.materialName.toLowerCase())
            ?? infoByKey.get(group.key.toLowerCase())
            ?? bundle.info?.materials[descriptorIndex]
          : infoByKey.get(group.key.toLowerCase()) ?? bundle.info?.materials[groupIndex]
        const materialIndex = infoMaterial?.index ?? -(groupIndex + 1)
        let material = materialCache.get(materialIndex)
        if (!material) {
          material = createMaterial(infoMaterial)
          materialCache.set(materialIndex, material)
          if (infoMaterial) {
            pendingTextures.push(
              bindModernTextures(material, infoMaterial, textureCache, options.signal).finally(() => {
                textureProgress += texturePaths(infoMaterial).filter(Boolean).length
                options.onProgress?.({
                  loaded: Math.min(textureProgress, referencedTextures.size),
                  total: referencedTextures.size,
                  label: '载入材质纹理',
                })
                options.onChange?.()
              }),
            )
          }
        }
        const mesh = new Mesh(geometry, material)
        mesh.name = descriptor?.meshName || descriptor?.materialName || group.key
        mesh.userData.d5Mesh = {
          bundleId: bundle.id,
          bundleIndex,
          groupIndex,
          descriptorIndex,
          groupKey: group.key,
          descriptorKey: descriptor?.key,
          materialName: descriptor?.materialName,
        }
        if (descriptor) {
          mesh.matrix.fromArray(descriptor.transform)
          mesh.matrixAutoUpdate = false
        }
        bundleRoot.add(mesh)
        drawCalls += 1
      }
    }
  }

  const textureFailureCount = await settleTextureAssignments(pendingTextures, document.warnings)
  throwIfAborted(options.signal)
  const geometryStats = inspectObject(root)
  const scene = createSceneDocumentFromObject(root, {
    name: root.name,
    sourceFormat: `d5a-d5mesh-v${bundles.map((bundle) => bundle.mesh.version).join('+')}`,
    extras: root.userData.d5a,
  })
  return {
    root,
    scene,
    triangleCount: geometryStats.triangleCount,
    vertexCount: geometryStats.vertexCount,
    drawCalls,
    geometryGpuBytes: geometryStats.geometryGpuBytes,
    parseMs: bundles.reduce((total, bundle) => total + bundle.parseMs, 0),
    textureCount: textureCache.stats.count,
    textureGpuBytes: textureCache.stats.gpuBytes,
    declaredTextureCount: referencedTextures.size,
    textureFailureCount,
    dispose() {
      disposeObject(root)
      textureCache.dispose()
    },
  }
}

async function buildLegacyFbxModel(
  document: LoadedD5aDocument,
  options: ModelBuildOptions,
): Promise<BuiltModel> {
  throwIfAborted(options.signal)
  options.onProgress?.({ loaded: 0, total: 1, label: '解析旧版 FBX' })
  const started = performance.now()
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
  const manager = new LoadingManager()
  manager.setURLModifier(() => TRANSPARENT_PIXEL)
  const fbxBuffer = document.legacyFbx ?? (
    document.inspection.fbxEntry
      ? await document.archive.arrayBuffer(document.inspection.fbxEntry, {
          signal: options.signal,
          onprogress: (loaded, total) => options.onProgress?.({ loaded, total, label: '重新解压旧版 FBX' }),
        })
      : undefined
  )
  if (!fbxBuffer) throw new Error('D5A 文档中没有可用的 FBX 数据')
  const root = new FBXLoader(manager).parse(fbxBuffer, '')
  root.userData.d5a = {
    sourceName: document.file.name,
    container: 'd5a',
    meshVersion: 'legacy-fbx',
  }
  const parseMs = performance.now() - started
  document.legacyFbx = undefined
  throwIfAborted(options.signal)
  options.onProgress?.({ loaded: 0, total: 1, label: '合并材质绘制批次' })
  root.traverse((object) => {
    if (object instanceof Mesh) batchGeometryGroups(object.geometry)
  })

  const textureCache = new ArchiveTextureCache(document.archive, options.maxTextureSize)
  const specs = parseLegacyMaterials(document.legacyMaterialXml)
  const specsByName = new Map(specs.map((spec, index) => [spec.name.toLowerCase(), { spec, index }]))
  const materialsByName = new Map<string, MeshStandardMaterial>()
  const pending: Promise<void>[] = []
  let textureTotal = specs.reduce((total, spec) => total + texturePaths(spec).filter(Boolean).length, 0)
  let textureLoaded = 0

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const current = Array.isArray(object.material) ? object.material : [object.material]
    const mapped = current.map((source) => {
      const key = source.name.toLowerCase()
      const match = specsByName.get(key)
      if (!match) {
        source.side = DoubleSide
        return source
      }
      const { spec, index: materialIndex } = match
      let material = materialsByName.get(key)
      if (!material) {
        material = createLegacyMaterial(spec, materialIndex)
        materialsByName.set(key, material)
        pending.push(
          bindLegacyTextures(material, spec, textureCache, options.signal).finally(() => {
            textureLoaded += texturePaths(spec).filter(Boolean).length
            options.onProgress?.({ loaded: textureLoaded, total: textureTotal, label: '载入旧版材质' })
            options.onChange?.()
          }),
        )
      }
      source.dispose()
      return material
    })
    object.material = Array.isArray(object.material) ? mapped : mapped[0]!
  })
  splitStaticMeshesByMaterialGroups(root)

  const textureFailureCount = await settleTextureAssignments(pending, document.warnings)
  throwIfAborted(options.signal)
  const stats = inspectObject(root)
  const scene = createSceneDocumentFromObject(root, {
    name: root.name,
    sourceFormat: 'd5a-legacy-fbx',
    extras: root.userData.d5a,
  })
  options.onProgress?.({ loaded: Math.max(textureTotal, 1), total: Math.max(textureTotal, 1), label: '旧版模型就绪' })
  return {
    root,
    scene,
    ...stats,
    parseMs,
    textureCount: textureCache.stats.count,
    textureGpuBytes: textureCache.stats.gpuBytes,
    declaredTextureCount: new Set(specs.flatMap((spec) => texturePaths(spec).filter(Boolean))).size,
    textureFailureCount,
    dispose() {
      disposeObject(root)
      textureCache.dispose()
    },
  }
}

function createMaterial(info?: D5Material): MeshStandardMaterial {
  const opacity = clamp(info?.opacity ?? info?.color[3] ?? 1, 0, 1)
  const cutout = Boolean(info?.opacityMap)
  const material = new MeshStandardMaterial({
    name: info?.title ?? 'D5 Default',
    color: info ? new Color(info.color[0], info.color[1], info.color[2]) : new Color('#aeb5b1'),
    roughness: clamp(info?.roughnessMapStrength ?? info?.roughness ?? 0.68, 0, 1),
    metalness: clamp(info?.metallic ?? 0, 0, 1),
    opacity,
    transparent: opacity < 1 && !cutout,
    alphaTest: cutout ? 0.35 : 0,
    side: DoubleSide,
  })
  if (info?.normalScale) material.normalScale = new Vector2(info.normalScale[0], info.normalScale[1])
  if (info) {
    material.userData.d5Material = {
      index: info.index,
      key: info.key,
      id: info.id,
      title: info.title,
      uePath: info.uePath,
      sourceData: info.sourceData,
      textureTransform: info.textureTransform,
      normalScale: info.normalScale,
      roughnessMapStrength: info.roughnessMapStrength,
      roughnessMapInverted: info.roughnessMapInverted,
      parameters: info.parameters,
    }
  }
  return material
}

export function createLegacyMaterial(spec: LegacyMaterialSpec, index: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    name: spec.name,
    color: new Color(spec.color),
    roughness: clamp(spec.roughness, 0, 1),
    metalness: clamp(spec.metallic, 0, 1),
    opacity: clamp(spec.opacity, 0, 1),
    transparent: spec.opacity < 1,
    alphaTest: spec.diffuseMap ? 0.35 : 0,
    side: DoubleSide,
  })
  material.userData.d5Material = {
    index,
    key: spec.name,
    title: spec.name,
    source: 'd5material.xml',
    diffuseMap: spec.diffuseMap,
    normalMap: spec.normalMap,
    roughnessMap: spec.roughnessMap,
  }
  return material
}

async function bindModernTextures(
  material: MeshStandardMaterial,
  info: D5Material,
  cache: ArchiveTextureCache,
  signal?: AbortSignal,
): Promise<void> {
  const assignments: TextureAssignment[] = []
  const options = { flipY: false, transform: info.textureTransform }
  if (info.diffuseMap) assignments.push(textureAssignment('漫反射', info.diffuseMap, cache.loadColor(info.diffuseMap, options, signal), material, 'map'))
  if (info.normalMap) assignments.push(textureAssignment('法线', info.normalMap, cache.load(info.normalMap, LinearSRGBColorSpace, options, signal), material, 'normalMap'))
  if (info.roughnessMap) assignments.push(textureAssignment('粗糙度', info.roughnessMap, cache.load(info.roughnessMap, LinearSRGBColorSpace, { ...options, invert: info.roughnessMapInverted }, signal), material, 'roughnessMap'))
  if (info.metallicMap) assignments.push(textureAssignment('金属度', info.metallicMap, cache.load(info.metallicMap, LinearSRGBColorSpace, options, signal), material, 'metalnessMap'))
  // D5 commonly points Diffuse Map and Opacity Map at the same RGBA image.
  // MeshStandardMaterial already applies map.a to alphaTest, so assigning the
  // same image again as alphaMap would duplicate the texture slot and multiply
  // alpha by the image's green channel.
  if (info.opacityMap && !sameArchiveTexture(info.opacityMap, info.diffuseMap)) {
    assignments.push(textureAssignment('透明度', info.opacityMap, cache.load(info.opacityMap, LinearSRGBColorSpace, options, signal), material, 'alphaMap'))
  }
  if (info.emissiveMap) assignments.push(textureAssignment('自发光', info.emissiveMap, cache.loadColor(info.emissiveMap, options, signal), material, 'emissiveMap'))
  await settleMaterialTextureAssignments(info.title, assignments)
  material.needsUpdate = true
}

async function bindLegacyTextures(
  material: MeshStandardMaterial,
  spec: LegacyMaterialSpec,
  cache: ArchiveTextureCache,
  signal?: AbortSignal,
): Promise<void> {
  const assignments: TextureAssignment[] = []
  const options = { flipY: true }
  if (spec.diffuseMap) assignments.push(textureAssignment('漫反射', spec.diffuseMap, cache.loadColor(spec.diffuseMap, options, signal), material, 'map'))
  if (spec.normalMap) assignments.push(textureAssignment('法线', spec.normalMap, cache.load(spec.normalMap, LinearSRGBColorSpace, options, signal), material, 'normalMap'))
  if (spec.roughnessMap) assignments.push(textureAssignment('粗糙度', spec.roughnessMap, cache.load(spec.roughnessMap, LinearSRGBColorSpace, options, signal), material, 'roughnessMap'))
  await settleMaterialTextureAssignments(spec.name, assignments)
  material.needsUpdate = true
}

export interface TextureAssignment {
  slot: string
  path: string
  promise: Promise<void>
}

interface TextureAssignmentFailure {
  assignment: TextureAssignment
  reason: unknown
}

class MaterialTextureAssignmentError extends Error {
  constructor(
    readonly materialName: string,
    readonly failures: TextureAssignmentFailure[],
  ) {
    super(failures.map(({ assignment, reason }) => {
      const detail = reason instanceof Error ? reason.message : String(reason)
      return `${materialName} / ${assignment.slot} / ${assignment.path}: ${detail}`
    }).join('; '))
    this.name = 'MaterialTextureAssignmentError'
  }
}

function textureAssignment(
  slot: string,
  path: string,
  texture: Promise<import('three').Texture>,
  material: MeshStandardMaterial,
  key: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'alphaMap' | 'emissiveMap',
): TextureAssignment {
  return { slot, path, promise: assign(texture, material, key) }
}

export async function settleMaterialTextureAssignments(
  materialName: string,
  assignments: TextureAssignment[],
): Promise<void> {
  const results = await Promise.allSettled(assignments.map((assignment) => assignment.promise))
  const failures = results.flatMap((result, index): TextureAssignmentFailure[] => {
    if (result.status === 'fulfilled') return []
    return [{ assignment: assignments[index]!, reason: result.reason }]
  })
  if (failures.length > 0) throw new MaterialTextureAssignmentError(materialName, failures)
}

async function assign(
  texture: Promise<import('three').Texture>,
  material: MeshStandardMaterial,
  key: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'alphaMap' | 'emissiveMap',
): Promise<void> {
  material[key] = await texture
}

function texturePaths(material: D5Material | LegacyMaterialSpec): (string | undefined)[] {
  if ('key' in material) {
    return [
      material.diffuseMap,
      material.normalMap,
      material.roughnessMap,
      material.metallicMap,
      material.opacityMap,
      material.emissiveMap,
    ]
  }
  return [material.diffuseMap, material.normalMap, material.roughnessMap]
}

export function sameArchiveTexture(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false
  const normalize = (value: string): string => value.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
  return normalize(left) === normalize(right)
}

export function indexMaterialsByKey(materials: D5Material[]): Map<string, D5Material> {
  const indexed = new Map<string, D5Material>()
  for (const material of materials) {
    const key = material.key.toLowerCase()
    const current = indexed.get(key)
    if (!current || materialCompleteness(material) > materialCompleteness(current)) {
      indexed.set(key, material)
    }
  }
  return indexed
}

function materialCompleteness(material: D5Material): number {
  return texturePaths(material).filter(Boolean).length * 1_000 + material.parameters.length
}

async function settleTextureAssignments(assignments: Promise<void>[], warnings: string[]): Promise<number> {
  let failures = 0
  const results = await Promise.allSettled(assignments)
  for (const result of results) {
    if (result.status !== 'rejected') continue
    if (result.reason instanceof MaterialTextureAssignmentError) {
      for (const failure of result.reason.failures) {
        if (failure.reason instanceof ProtectedD5TextureError) {
          warnings.push(`受保护贴图原样保留、未解码: ${result.reason.materialName} / ${failure.assignment.slot} / ${failure.assignment.path}`)
        } else {
          failures += 1
          const detail = failure.reason instanceof Error ? failure.reason.message : String(failure.reason)
          warnings.push(`纹理加载失败: ${result.reason.materialName} / ${failure.assignment.slot} / ${failure.assignment.path}: ${detail}`)
        }
      }
      continue
    }
    failures += 1
    const detail = result.reason instanceof Error ? result.reason.message : String(result.reason)
    warnings.push(`纹理加载失败: ${detail}`)
  }
  return failures
}

export function applyD5aTransform(target: Object3D, transform?: D5aTransform): void {
  if (!transform) return
  target.position.set(transform.translation.x, transform.translation.y, transform.translation.z)
  target.quaternion.set(
    transform.rotation.x,
    transform.rotation.y,
    transform.rotation.z,
    transform.rotation.w,
  ).normalize()
  target.scale.set(transform.scale3D.x, transform.scale3D.y, transform.scale3D.z)
  target.updateMatrix()
}

function staticAttribute<T extends BufferAttribute>(attribute: T): T {
  attribute.setUsage(StaticDrawUsage)
  return attribute
}

function createD5Geometry(group: D5MeshGroup): BufferGeometry {
  const geometry = new BufferGeometry()
  if (group.interleaved) {
    const vertices = staticInterleaved(new InterleavedBuffer(group.interleaved, 8))
    geometry.setAttribute('position', new InterleavedBufferAttribute(vertices, 3, 0))
    geometry.setAttribute('uv', new InterleavedBufferAttribute(vertices, 2, 3))
    geometry.setAttribute('normal', new InterleavedBufferAttribute(vertices, 3, 5))
  } else {
    geometry.setAttribute('position', staticAttribute(new BufferAttribute(group.positions, 3)))
    geometry.setAttribute('normal', staticAttribute(new BufferAttribute(group.normals, 3)))
    geometry.setAttribute('uv', staticAttribute(new BufferAttribute(group.uvs, 2)))
  }
  if (group.indices) geometry.setIndex(staticAttribute(new BufferAttribute(group.indices, 1)))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function staticInterleaved<T extends InterleavedBuffer>(buffer: T): T {
  buffer.setUsage(StaticDrawUsage)
  return buffer
}

export function inspectObject(root: Object3D): {
  triangleCount: number
  vertexCount: number
  drawCalls: number
  geometryGpuBytes: number
} {
  let triangleCount = 0
  let vertexCount = 0
  let drawCalls = 0
  let geometryGpuBytes = 0
  const vertexBuffers = new Set<unknown>()
  const gpuBuffers = new Set<unknown>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    const index = object.geometry.getIndex()
    if (position) {
      const storage = attributeStorage(position)
      if (!vertexBuffers.has(storage)) {
        vertexBuffers.add(storage)
        vertexCount += position.count
      }
    }
    triangleCount += Math.floor(geometryDrawElementCount(object.geometry) / 3)
    drawCalls += geometryDrawCallCount(object.geometry)
    for (const attribute of Object.values(object.geometry.attributes) as (
      BufferAttribute | InterleavedBufferAttribute
    )[]) {
      const storage = attributeStorage(attribute)
      if (gpuBuffers.has(storage)) continue
      gpuBuffers.add(storage)
      geometryGpuBytes += attributeStorageBytes(attribute)
    }
    if (index && !gpuBuffers.has(index)) {
      gpuBuffers.add(index)
      geometryGpuBytes += index.array.byteLength
    }
  })
  return { triangleCount, vertexCount, drawCalls, geometryGpuBytes }
}

function attributeStorage(attribute: BufferAttribute | InterleavedBufferAttribute): unknown {
  return attribute instanceof InterleavedBufferAttribute ? attribute.data : attribute
}

function attributeStorageBytes(attribute: BufferAttribute | InterleavedBufferAttribute): number {
  return attribute instanceof InterleavedBufferAttribute
    ? attribute.data.array.byteLength
    : attribute.array.byteLength
}

export function batchGeometryGroups(geometry: BufferGeometry): void {
  const groups = geometry.groups
  if (groups.length < 3 || Object.keys(geometry.morphAttributes).length > 0) return
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const elementCount = index?.count ?? position?.count ?? 0
  if (elementCount === 0) return
  const covered = groups.reduce((total, group) => total + group.count, 0)
  if (
    covered !== elementCount ||
    groups.some((group) =>
      !Number.isInteger(group.start) ||
      !Number.isInteger(group.count) ||
      group.start < 0 ||
      group.count < 0 ||
      group.start + group.count > elementCount,
    )
  ) return

  const ordered = [...groups].sort(
    (left, right) => (left.materialIndex ?? 0) - (right.materialIndex ?? 0),
  )
  if (index) {
    const reordered = reorderArray(index.array, ordered, 1)
    const replacement = new BufferAttribute(reordered, 1, index.normalized)
    replacement.setUsage(index.usage)
    geometry.setIndex(replacement)
  } else {
    const attributes = Object.values(geometry.attributes)
    if (attributes.some((attribute) =>
      attribute.count !== elementCount ||
      ('isInterleavedBufferAttribute' in attribute && attribute.isInterleavedBufferAttribute),
    )) return
    for (const [name, attribute] of Object.entries(geometry.attributes) as [string, BufferAttribute][]) {
      const reordered = reorderArray(attribute.array, ordered, attribute.itemSize)
      const replacement = new BufferAttribute(reordered, attribute.itemSize, attribute.normalized)
      replacement.name = attribute.name
      replacement.setUsage(attribute.usage)
      geometry.setAttribute(name, replacement)
    }
  }

  geometry.clearGroups()
  let cursor = 0
  let activeMaterial = ordered[0]?.materialIndex ?? 0
  let activeStart = 0
  for (const group of ordered) {
    const material = group.materialIndex ?? 0
    if (material !== activeMaterial) {
      geometry.addGroup(activeStart, cursor - activeStart, activeMaterial)
      activeMaterial = material
      activeStart = cursor
    }
    cursor += group.count
  }
  geometry.addGroup(activeStart, cursor - activeStart, activeMaterial)
}

export function splitStaticMeshesByMaterialGroups(root: Object3D): number {
  const candidates: Mesh[] = []
  root.traverse((object) => {
    if (
      object instanceof Mesh &&
      !(object instanceof SkinnedMesh) &&
      object.parent &&
      Array.isArray(object.material) &&
      object.geometry.groups.length > 1 &&
      Object.keys(object.geometry.morphAttributes).length === 0
    ) candidates.push(object)
  })

  let partCount = 0
  for (const source of candidates) {
    const parent = source.parent
    if (!parent) continue
    const materials = source.material as Material[]
    const holder = new Group().copy(source, false)
    holder.name = source.name
    holder.userData = { ...source.userData, splitMaterialGroups: source.geometry.groups.length }
    for (const child of [...source.children]) holder.add(child)
    for (const [groupIndex, group] of source.geometry.groups.entries()) {
      const material = materials[group.materialIndex ?? 0] ?? materials[0]
      if (!material || group.count <= 0) continue
      const geometry = geometryGroupView(source.geometry, group.start, group.count, groupIndex)
      const part = new Mesh(geometry, material)
      const materialName = material.name || `材质 ${(group.materialIndex ?? 0) + 1}`
      part.name = source.name ? `${source.name} / ${materialName}` : materialName
      part.castShadow = source.castShadow
      part.receiveShadow = source.receiveShadow
      part.frustumCulled = source.frustumCulled
      part.renderOrder = source.renderOrder
      part.layers.mask = source.layers.mask
      part.userData = {
        ...source.userData,
        materialGroup: {
          sourceMesh: source.name,
          groupIndex,
          materialIndex: group.materialIndex ?? 0,
        },
      }
      holder.add(part)
      partCount += 1
    }
    parent.add(holder)
    parent.remove(source)
  }
  return partCount
}

export function geometryDrawElementCount(geometry: BufferGeometry): number {
  const available = geometry.getIndex()?.count ?? geometry.getAttribute('position')?.count ?? 0
  const start = Math.min(available, Math.max(0, geometry.drawRange.start))
  const requested = Number.isFinite(geometry.drawRange.count)
    ? geometry.drawRange.count
    : available - start
  return Math.max(0, Math.min(available, start + Math.max(0, requested)) - start)
}

function geometryDrawCallCount(geometry: BufferGeometry): number {
  const available = geometry.getIndex()?.count ?? geometry.getAttribute('position')?.count ?? 0
  const start = Math.min(available, Math.max(0, geometry.drawRange.start))
  const end = start + geometryDrawElementCount(geometry)
  if (end <= start) return 0
  if (geometry.groups.length === 0) return 1
  return geometry.groups.filter((group) => (
    Math.min(end, group.start + group.count) > Math.max(start, group.start)
  )).length
}

function geometryGroupView(
  source: BufferGeometry,
  start: number,
  count: number,
  groupIndex: number,
): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.name = `${source.name || 'geometry'} group ${groupIndex + 1}`
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute)
  geometry.setIndex(source.getIndex())
  geometry.morphAttributes = source.morphAttributes
  geometry.morphTargetsRelative = source.morphTargetsRelative
  geometry.userData = { ...source.userData, sourceGroup: groupIndex }
  geometry.setDrawRange(start, count)
  const position = geometry.getAttribute('position')
  if (position) {
    const bounds = new Box3()
    const index = geometry.getIndex()
    const available = index?.count ?? position.count
    const end = Math.min(available, start + count)
    const begin = Math.max(0, start)
    if (!(position instanceof InterleavedBufferAttribute) && !position.normalized) {
      const positions = position.array as unknown as ArrayLike<number>
      const indices = index?.array as unknown as ArrayLike<number> | undefined
      let minX = Infinity
      let minY = Infinity
      let minZ = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      let maxZ = -Infinity
      for (let element = begin; element < end; element += 1) {
        const vertex = indices ? Number(indices[element]) : element
        const offset = vertex * position.itemSize
        const x = Number(positions[offset])
        const y = Number(positions[offset + 1])
        const z = Number(positions[offset + 2])
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (z < minZ) minZ = z
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        if (z > maxZ) maxZ = z
      }
      if (minX !== Infinity) bounds.set(
        new Vector3(minX, minY, minZ),
        new Vector3(maxX, maxY, maxZ),
      )
    } else {
      const point = new Vector3()
      for (let element = begin; element < end; element += 1) {
        const vertex = index ? index.getX(element) : element
        point.fromBufferAttribute(position, vertex)
        bounds.expandByPoint(point)
      }
    }
    geometry.boundingBox = bounds
    geometry.boundingSphere = bounds.isEmpty() ? new Sphere() : bounds.getBoundingSphere(new Sphere())
  }
  return geometry
}

function reorderArray(
  source: BufferAttribute['array'],
  groups: BufferGeometry['groups'],
  itemSize: number,
): BufferAttribute['array'] {
  const readable = source as unknown as ReorderableArray
  const target = readable.slice()
  let targetElement = 0
  for (const group of groups) {
    const start = group.start * itemSize
    const end = (group.start + group.count) * itemSize
    target.set(readable.subarray(start, end), targetElement * itemSize)
    targetElement += group.count
  }
  return target as unknown as BufferAttribute['array']
}

interface ReorderableArray extends ArrayLike<number> {
  slice(): ReorderableArray
  subarray(start: number, end: number): ReorderableArray
  set(source: ArrayLike<number>, offset?: number): void
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
