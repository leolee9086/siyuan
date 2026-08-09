import {
  Bone,
  DoubleSide,
  InstancedMesh,
  InterleavedBufferAttribute,
  Line,
  LineLoop,
  LineSegments,
  Mesh,
  Points,
  SkinnedMesh,
  type AnimationClip,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three'

export type SceneNumericArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

export type SceneJsonValue =
  | null
  | boolean
  | number
  | string
  | SceneJsonValue[]
  | { [key: string]: SceneJsonValue }

export type ScenePrimitiveMode =
  | 'points'
  | 'lines'
  | 'line-loop'
  | 'line-strip'
  | 'triangles'

export interface SceneCoordinateSystem {
  handedness: 'right'
  upAxis: 'Y'
  metersPerUnit?: number
}

export interface SceneAccessor {
  id: string
  sourceName: string
  array: SceneNumericArray
  itemSize: number
  count: number
  normalized: boolean
  offset: number
  stride: number
  usage: number
}

export interface ScenePrimitive {
  id: string
  mode: ScenePrimitiveMode
  attributes: Record<string, string>
  morphTargets: Record<string, string>[]
  indices?: string
  material?: string
  start: number
  count: number
}

export interface SceneMesh {
  id: string
  name: string
  primitives: ScenePrimitive[]
  weights?: number[]
  morphTargetNames?: Record<string, number>
}

export interface SceneInstances {
  count: number
  matrices: string
  colors?: string
}

export interface SceneNode {
  id: string
  name: string
  matrix: number[]
  children: string[]
  mesh?: string
  skin?: string
  instances?: SceneInstances
  weights?: number[]
  visible: boolean
  extras: Record<string, SceneJsonValue>
}

export interface SceneSkin {
  id: string
  name: string
  joints: string[]
  inverseBindMatrices: number[][]
}

export interface SceneTextureBinding {
  slot: string
  texture: string
  texCoord: number
  scale?: number
  strength?: number
}

export interface ScenePbrMaterial {
  baseColor: [number, number, number, number]
  emissive: [number, number, number]
  metalness: number
  roughness: number
  opacity: number
  alphaMode: 'opaque' | 'mask' | 'blend'
  alphaCutoff: number
  doubleSided: boolean
  normalScale?: [number, number]
  emissiveIntensity?: number
}

export interface SceneMaterial {
  id: string
  name: string
  model: string
  pbr: ScenePbrMaterial
  textures: SceneTextureBinding[]
  extras: Record<string, SceneJsonValue>
}

export interface SceneSampler {
  wrapS: number
  wrapT: number
  magFilter: number
  minFilter: number
  anisotropy: number
}

export interface SceneTexture {
  id: string
  name: string
  image: string
  sampler: SceneSampler
  colorSpace: string
  offset: [number, number]
  repeat: [number, number]
  center: [number, number]
  rotation: number
  matrix: number[]
  extras: Record<string, SceneJsonValue>
}

export interface SceneImageMip {
  data: ArrayBufferView
  width: number
  height: number
  depth?: number
}

export type SceneImagePayload =
  | { kind: 'compressed-mipmaps'; mipmaps: SceneImageMip[]; format: number; type: number }
  /** Encoded image bytes retained by a file-format reader.  This keeps CLI conversion independent from Canvas. */
  | { kind: 'encoded'; data: Uint8Array; mimeType: string; extension?: string }
  | { kind: 'pixels'; data: ArrayBufferView; width: number; height: number; depth?: number }
  | { kind: 'runtime-image'; data: object }
  | { kind: 'empty' }

export interface SceneImage {
  id: string
  name: string
  mimeType?: string
  width: number
  height: number
  depth: number
  payload: SceneImagePayload
}

export interface SceneAnimationTrack {
  name: string
  times: SceneNumericArray
  values: SceneNumericArray
  valueSize: number
  interpolation: number
}

export interface SceneAnimation {
  id: string
  name: string
  duration: number
  tracks: SceneAnimationTrack[]
}

export interface SceneDocument {
  schemaVersion: 1
  name: string
  sourceFormat: string
  coordinateSystem: SceneCoordinateSystem
  roots: string[]
  nodes: SceneNode[]
  meshes: SceneMesh[]
  accessors: SceneAccessor[]
  materials: SceneMaterial[]
  textures: SceneTexture[]
  images: SceneImage[]
  skins: SceneSkin[]
  animations: SceneAnimation[]
  extras: Record<string, SceneJsonValue>
}

export interface SceneDocumentOptions {
  name?: string
  sourceFormat: string
  animations?: AnimationClip[]
  metersPerUnit?: number
  extras?: Record<string, unknown>
}

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'lightMap',
  'bumpMap',
  'displacementMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularMap',
  'specularColorMap',
  'thicknessMap',
  'transmissionMap',
  'anisotropyMap',
] as const

export function createSceneDocumentFromObject(
  root: Object3D,
  options: SceneDocumentOptions,
): SceneDocument {
  root.updateMatrixWorld(true)
  const objects: Object3D[] = []
  root.traverse((object) => objects.push(object))
  const nodeIds = new Map(objects.map((object, index) => [object, `node-${index}`]))
  const accessors: SceneAccessor[] = []
  const accessorIds = new WeakMap<object, string>()
  const meshes: SceneMesh[] = []
  const meshIds = new Map<BufferGeometry, Map<string, string>>()
  const materials: SceneMaterial[] = []
  const materialIds = new Map<Material, string>()
  const textures: SceneTexture[] = []
  const textureIds = new Map<Texture, string>()
  const images: SceneImage[] = []
  const imageIds = new WeakMap<object, string>()
  const skins: SceneSkin[] = []
  const skinIds = new WeakMap<object, string>()

  const accessorId = (
    attribute: BufferAttribute | InterleavedBufferAttribute,
    sourceName: string,
  ): string => {
    const cached = accessorIds.get(attribute)
    if (cached) return cached
    const id = `accessor-${accessors.length}`
    const interleaved = attribute instanceof InterleavedBufferAttribute
    const array = (interleaved ? attribute.data.array : attribute.array) as SceneNumericArray
    accessors.push({
      id,
      sourceName,
      array,
      itemSize: attribute.itemSize,
      count: attribute.count,
      normalized: attribute.normalized,
      offset: interleaved ? attribute.offset : 0,
      stride: interleaved ? attribute.data.stride : attribute.itemSize,
      usage: interleaved ? attribute.data.usage : attribute.usage,
    })
    accessorIds.set(attribute, id)
    return id
  }

  const imageId = (texture: Texture): string => {
    const source = texture.source as object
    const cached = imageIds.get(source)
    if (cached) return cached
    const id = `image-${images.length}`
    const image = texture.image as ImageDescriptor | undefined
    const dimensions = imageDimensions(image, texture.mipmaps as SceneImageMip[])
    images.push({
      id,
      name: texture.source.data && typeof texture.source.data === 'object' && 'name' in texture.source.data
        ? String((texture.source.data as { name?: unknown }).name ?? texture.name)
        : texture.name,
      mimeType: texture.userData.mimeType as string | undefined,
      ...dimensions,
      payload: imagePayload(texture, image),
    })
    imageIds.set(source, id)
    return id
  }

  const textureId = (texture: Texture): string => {
    const cached = textureIds.get(texture)
    if (cached) return cached
    if (texture.matrixAutoUpdate) texture.updateMatrix()
    const id = `texture-${textures.length}`
    textures.push({
      id,
      name: texture.name,
      image: imageId(texture),
      sampler: {
        wrapS: texture.wrapS,
        wrapT: texture.wrapT,
        magFilter: texture.magFilter,
        minFilter: texture.minFilter,
        anisotropy: texture.anisotropy,
      },
      colorSpace: texture.colorSpace,
      offset: [texture.offset.x, texture.offset.y],
      repeat: [texture.repeat.x, texture.repeat.y],
      center: [texture.center.x, texture.center.y],
      rotation: texture.rotation,
      matrix: texture.matrix.toArray(),
      extras: jsonRecord(texture.userData),
    })
    textureIds.set(texture, id)
    return id
  }

  const materialId = (material: Material): string => {
    const cached = materialIds.get(material)
    if (cached) return cached
    const id = `material-${materials.length}`
    const pbr = material as PbrMaterialLike
    const bindings = TEXTURE_SLOTS.flatMap((slot): SceneTextureBinding[] => {
      const texture = pbr[slot]
      if (!texture?.isTexture) return []
      return [{
        slot,
        texture: textureId(texture),
        texCoord: texture.channel,
        scale: slot === 'normalMap' ? pbr.normalScale?.x : slot === 'bumpMap' ? pbr.bumpScale : undefined,
        strength: slot === 'aoMap' ? pbr.aoMapIntensity : undefined,
      }]
    })
    materials.push({
      id,
      name: material.name,
      model: material.type,
      pbr: {
        baseColor: [pbr.color?.r ?? 1, pbr.color?.g ?? 1, pbr.color?.b ?? 1, material.opacity],
        emissive: [pbr.emissive?.r ?? 0, pbr.emissive?.g ?? 0, pbr.emissive?.b ?? 0],
        metalness: pbr.metalness ?? 0,
        roughness: pbr.roughness ?? 1,
        opacity: material.opacity,
        alphaMode: material.alphaTest > 0 ? 'mask' : material.transparent || material.opacity < 1 ? 'blend' : 'opaque',
        alphaCutoff: material.alphaTest,
        doubleSided: material.side === DoubleSide,
        normalScale: pbr.normalScale ? [pbr.normalScale.x, pbr.normalScale.y] : undefined,
        emissiveIntensity: pbr.emissiveIntensity,
      },
      textures: bindings,
      extras: jsonRecord(material.userData),
    })
    materialIds.set(material, id)
    return id
  }

  const meshId = (object: Mesh | Line | Points): string => {
    const geometry = object.geometry
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    const materialRefs = objectMaterials.map(materialId)
    const signature = `${primitiveMode(object)}|${materialRefs.join(',')}`
    const cached = meshIds.get(geometry)?.get(signature)
    if (cached) return cached

    const id = `mesh-${meshes.length}`
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [
      semanticAttributeName(name),
      accessorId(attribute, name),
    ]))
    const morphTargets = morphTargetAccessors(geometry, accessorId)
    const indices = geometry.index ? accessorId(geometry.index, 'index') : undefined
    const available = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
    const ranges = primitiveRanges(geometry, available)
    const mode = primitiveMode(object)
    const primitives = ranges.map((range, index): ScenePrimitive => ({
      id: `${id}-primitive-${index}`,
      mode,
      attributes,
      morphTargets,
      indices,
      material: materialRefs[range.materialIndex] ?? materialRefs[0],
      start: range.start,
      count: range.count,
    }))
    meshes.push({
      id,
      name: object.name || geometry.name,
      primitives,
      weights: object.morphTargetInfluences ? [...object.morphTargetInfluences] : undefined,
      morphTargetNames: object.morphTargetDictionary ? { ...object.morphTargetDictionary } : undefined,
    })
    const variants = meshIds.get(geometry) ?? new Map<string, string>()
    variants.set(signature, id)
    meshIds.set(geometry, variants)
    return id
  }

  const skinId = (mesh: SkinnedMesh): string => {
    const cached = skinIds.get(mesh.skeleton)
    if (cached) return cached
    const id = `skin-${skins.length}`
    skins.push({
      id,
      name: mesh.skeleton.bones.find((bone) => bone instanceof Bone)?.name ?? mesh.name,
      joints: mesh.skeleton.bones.flatMap((bone) => {
        const node = nodeIds.get(bone)
        return node ? [node] : []
      }),
      inverseBindMatrices: mesh.skeleton.boneInverses.map((matrix) => matrix.toArray()),
    })
    skinIds.set(mesh.skeleton, id)
    return id
  }

  const nodes = objects.map((object): SceneNode => {
    const renderable = object instanceof Mesh || object instanceof Line || object instanceof Points
    const meshObject = renderable ? object as Mesh | Line | Points : undefined
    const instances = object instanceof InstancedMesh ? {
      count: object.count,
      matrices: accessorId(object.instanceMatrix, 'instanceMatrix'),
      colors: object.instanceColor ? accessorId(object.instanceColor, 'instanceColor') : undefined,
    } : undefined
    return {
      id: nodeIds.get(object)!,
      name: object.name,
      matrix: object.matrix.toArray(),
      children: object.children.flatMap((child) => {
        const id = nodeIds.get(child)
        return id ? [id] : []
      }),
      mesh: meshObject ? meshId(meshObject) : undefined,
      skin: object instanceof SkinnedMesh ? skinId(object) : undefined,
      instances,
      weights: object instanceof Mesh && object.morphTargetInfluences
        ? [...object.morphTargetInfluences]
        : undefined,
      visible: object.visible,
      extras: jsonRecord(object.userData),
    }
  })

  const document: SceneDocument = {
    schemaVersion: 1,
    name: options.name || root.name,
    sourceFormat: options.sourceFormat,
    coordinateSystem: {
      handedness: 'right',
      upAxis: 'Y',
      metersPerUnit: options.metersPerUnit,
    },
    roots: [nodeIds.get(root)!],
    nodes,
    meshes,
    accessors,
    materials,
    textures,
    images,
    skins,
    animations: (options.animations ?? []).map((animation, animationIndex) => ({
      id: `animation-${animationIndex}`,
      name: animation.name,
      duration: animation.duration,
      tracks: animation.tracks.map((track) => ({
        name: track.name,
        times: track.times as SceneNumericArray,
        values: track.values as SceneNumericArray,
        valueSize: track.getValueSize(),
        interpolation: track.getInterpolation(),
      })),
    })),
    extras: jsonRecord(options.extras ?? {}),
  }
  const errors = validateSceneDocument(document).filter((issue) => issue.severity === 'error')
  if (errors.length > 0) {
    throw new Error(`场景中间层验证失败: ${errors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`)
  }
  return document
}

export interface SceneDocumentIssue {
  severity: 'warning' | 'error'
  code: string
  path: string
  message: string
}

export function validateSceneDocument(document: SceneDocument): SceneDocumentIssue[] {
  const issues: SceneDocumentIssue[] = []
  const accessors = uniqueIndex(document.accessors, 'accessor', issues)
  const meshes = uniqueIndex(document.meshes, 'mesh', issues)
  const materials = uniqueIndex(document.materials, 'material', issues)
  const textures = uniqueIndex(document.textures, 'texture', issues)
  const images = uniqueIndex(document.images, 'image', issues)
  const nodes = uniqueIndex(document.nodes, 'node', issues)
  const skins = uniqueIndex(document.skins, 'skin', issues)

  for (const [index, accessor] of document.accessors.entries()) {
    const path = `accessors[${index}]`
    if (!Number.isInteger(accessor.itemSize) || accessor.itemSize < 1) error('accessor-item-size', path, 'itemSize 必须为正整数', issues)
    if (!Number.isInteger(accessor.count) || accessor.count < 0) error('accessor-count', path, 'count 必须为非负整数', issues)
    if (!Number.isInteger(accessor.offset) || accessor.offset < 0) error('accessor-offset', path, 'offset 必须为非负整数', issues)
    if (!Number.isInteger(accessor.stride) || accessor.stride < accessor.itemSize) error('accessor-stride', path, 'stride 小于 itemSize', issues)
    const required = accessor.count === 0
      ? accessor.offset
      : accessor.offset + (accessor.count - 1) * accessor.stride + accessor.itemSize
    if (required > accessor.array.length) error('accessor-bounds', path, `访问范围 ${required} 超出数组长度 ${accessor.array.length}`, issues)
  }

  for (const [meshIndex, mesh] of document.meshes.entries()) {
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const path = `meshes[${meshIndex}].primitives[${primitiveIndex}]`
      if (!primitive.attributes.POSITION) warning('missing-position', path, '图元没有 POSITION 属性', issues)
      for (const [semantic, reference] of Object.entries(primitive.attributes)) {
        if (!accessors.has(reference)) error('missing-accessor', `${path}.attributes.${semantic}`, `未找到 ${reference}`, issues)
      }
      for (const [targetIndex, target] of primitive.morphTargets.entries()) {
        for (const [semantic, reference] of Object.entries(target)) {
          if (!accessors.has(reference)) error('missing-morph-accessor', `${path}.morphTargets[${targetIndex}].${semantic}`, `未找到 ${reference}`, issues)
        }
      }
      if (primitive.indices && !accessors.has(primitive.indices)) error('missing-index-accessor', `${path}.indices`, `未找到 ${primitive.indices}`, issues)
      if (primitive.material && !materials.has(primitive.material)) error('missing-material', `${path}.material`, `未找到 ${primitive.material}`, issues)
      if (!Number.isInteger(primitive.start) || primitive.start < 0 || !Number.isInteger(primitive.count) || primitive.count < 0) {
        error('primitive-range', path, 'start/count 必须为非负整数', issues)
      }
    }
  }

  for (const [index, texture] of document.textures.entries()) {
    if (!images.has(texture.image)) error('missing-image', `textures[${index}].image`, `未找到 ${texture.image}`, issues)
    if (texture.matrix.length !== 9 || texture.matrix.some((value) => !Number.isFinite(value))) {
      error('texture-matrix', `textures[${index}].matrix`, '纹理矩阵必须包含 9 个有限数值', issues)
    }
  }
  for (const [index, material] of document.materials.entries()) {
    for (const [bindingIndex, binding] of material.textures.entries()) {
      if (!textures.has(binding.texture)) error('missing-texture', `materials[${index}].textures[${bindingIndex}]`, `未找到 ${binding.texture}`, issues)
    }
  }
  for (const [index, skin] of document.skins.entries()) {
    for (const [jointIndex, joint] of skin.joints.entries()) {
      if (!nodes.has(joint)) error('missing-joint', `skins[${index}].joints[${jointIndex}]`, `未找到 ${joint}`, issues)
    }
    if (skin.joints.length !== skin.inverseBindMatrices.length) warning('skin-bind-count', `skins[${index}]`, '关节数量与逆绑定矩阵数量不同', issues)
  }
  for (const [index, node] of document.nodes.entries()) {
    const path = `nodes[${index}]`
    if (node.matrix.length !== 16 || node.matrix.some((value) => !Number.isFinite(value))) error('node-matrix', `${path}.matrix`, '节点矩阵必须包含 16 个有限数值', issues)
    if (node.mesh && !meshes.has(node.mesh)) error('missing-mesh', `${path}.mesh`, `未找到 ${node.mesh}`, issues)
    if (node.skin && !skins.has(node.skin)) error('missing-skin', `${path}.skin`, `未找到 ${node.skin}`, issues)
    for (const [childIndex, child] of node.children.entries()) {
      if (!nodes.has(child)) error('missing-child', `${path}.children[${childIndex}]`, `未找到 ${child}`, issues)
    }
    if (node.instances) {
      const matrixAccessor = accessors.get(node.instances.matrices)
      if (!matrixAccessor) error('missing-instance-matrices', `${path}.instances.matrices`, `未找到 ${node.instances.matrices}`, issues)
      else if (matrixAccessor.itemSize !== 16 || matrixAccessor.count < node.instances.count) error('instance-matrices', `${path}.instances`, '实例矩阵访问器数量或维度不符', issues)
      if (node.instances.colors && !accessors.has(node.instances.colors)) error('missing-instance-colors', `${path}.instances.colors`, `未找到 ${node.instances.colors}`, issues)
    }
  }
  for (const [index, root] of document.roots.entries()) {
    if (!nodes.has(root)) error('missing-root', `roots[${index}]`, `未找到 ${root}`, issues)
  }
  detectNodeCycles(document, nodes, issues)

  for (const [animationIndex, animation] of document.animations.entries()) {
    for (const [trackIndex, track] of animation.tracks.entries()) {
      const path = `animations[${animationIndex}].tracks[${trackIndex}]`
      if (track.valueSize < 1 || track.values.length !== track.times.length * track.valueSize) {
        error('animation-track-size', path, '关键帧时间和值数组长度不匹配', issues)
      }
    }
  }
  return issues
}

function primitiveMode(object: Mesh | Line | Points): ScenePrimitiveMode {
  if (object instanceof Points) return 'points'
  if (object instanceof LineLoop) return 'line-loop'
  if (object instanceof LineSegments) return 'lines'
  if (object instanceof Line) return 'line-strip'
  return 'triangles'
}

function primitiveRanges(
  geometry: BufferGeometry,
  available: number,
): { start: number; count: number; materialIndex: number }[] {
  const drawStart = Math.min(available, Math.max(0, geometry.drawRange.start))
  const requested = Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : available - drawStart
  const drawEnd = Math.min(available, drawStart + Math.max(0, requested))
  const groups = geometry.groups.length > 0
    ? geometry.groups
    : [{ start: 0, count: available, materialIndex: 0 }]
  return groups.flatMap((group) => {
    const start = Math.max(drawStart, group.start)
    const end = Math.min(drawEnd, group.start + group.count)
    return end > start ? [{ start, count: end - start, materialIndex: group.materialIndex ?? 0 }] : []
  })
}

function morphTargetAccessors(
  geometry: BufferGeometry,
  accessorId: (attribute: BufferAttribute | InterleavedBufferAttribute, name: string) => string,
): Record<string, string>[] {
  const targetCount = Math.max(0, ...Object.values(geometry.morphAttributes).map((attributes) => attributes.length))
  return Array.from({ length: targetCount }, (_, targetIndex) => Object.fromEntries(
    Object.entries(geometry.morphAttributes).flatMap(([name, attributes]) => {
      const attribute = attributes[targetIndex]
      return attribute ? [[semanticAttributeName(name), accessorId(attribute, `morph.${name}.${targetIndex}`)]] : []
    }),
  ))
}

function semanticAttributeName(name: string): string {
  const direct: Record<string, string> = {
    position: 'POSITION',
    normal: 'NORMAL',
    tangent: 'TANGENT',
    uv: 'TEXCOORD_0',
    uv1: 'TEXCOORD_1',
    color: 'COLOR_0',
    skinIndex: 'JOINTS_0',
    skinWeight: 'WEIGHTS_0',
  }
  const mapped = direct[name]
  if (mapped) return mapped
  const uv = name.match(/^uv(\d+)$/)
  if (uv) return `TEXCOORD_${uv[1]}`
  return `_${name.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase()}`
}

function imagePayload(texture: Texture, image?: ImageDescriptor): SceneImagePayload {
  const mipmaps = (texture.mipmaps as SceneImageMip[]).filter((mipmap) => isArrayBufferView(mipmap.data))
  if (mipmaps.length > 0) return { kind: 'compressed-mipmaps', mipmaps, format: texture.format, type: texture.type }
  if (image && isArrayBufferView(image.data)) {
    return {
      kind: 'pixels',
      data: image.data,
      width: image.width ?? 0,
      height: image.height ?? 0,
      depth: image.depth,
    }
  }
  if (texture.source.data && typeof texture.source.data === 'object') {
    return { kind: 'runtime-image', data: texture.source.data }
  }
  return { kind: 'empty' }
}

function imageDimensions(image: ImageDescriptor | undefined, mipmaps: SceneImageMip[]): {
  width: number
  height: number
  depth: number
} {
  const firstMip = mipmaps[0]
  return {
    width: image?.width ?? firstMip?.width ?? 0,
    height: image?.height ?? firstMip?.height ?? 0,
    depth: image?.depth ?? firstMip?.depth ?? 1,
  }
}

function isArrayBufferView(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value)
}

function jsonRecord(value: Record<string, unknown>): Record<string, SceneJsonValue> {
  const cloned = jsonValue(value)
  return cloned && typeof cloned === 'object' && !Array.isArray(cloned) ? cloned : {}
}

function jsonValue(value: unknown, seen = new WeakSet<object>()): SceneJsonValue | undefined {
  if (value == null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) return value.flatMap((item) => {
    const cloned = jsonValue(item, seen)
    return cloned === undefined ? [] : [cloned]
  })
  if (typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return undefined
  seen.add(value)
  const result: Record<string, SceneJsonValue> = {}
  for (const [key, item] of Object.entries(value)) {
    const cloned = jsonValue(item, seen)
    if (cloned !== undefined) result[key] = cloned
  }
  seen.delete(value)
  return result
}

function uniqueIndex<T extends { id: string }>(
  values: T[],
  label: string,
  issues: SceneDocumentIssue[],
): Map<string, T> {
  const indexed = new Map<string, T>()
  for (const [index, value] of values.entries()) {
    if (!value.id) error('empty-id', `${label}s[${index}].id`, 'ID 为空', issues)
    else if (indexed.has(value.id)) error('duplicate-id', `${label}s[${index}].id`, `ID ${value.id} 重复`, issues)
    else indexed.set(value.id, value)
  }
  return indexed
}

function detectNodeCycles(
  document: SceneDocument,
  nodes: Map<string, SceneNode>,
  issues: SceneDocumentIssue[],
): void {
  const state = new Map<string, 0 | 1 | 2>()
  const visit = (id: string): void => {
    if (state.get(id) === 2) return
    if (state.get(id) === 1) {
      error('node-cycle', `nodes.${id}`, '节点层级包含循环引用', issues)
      return
    }
    state.set(id, 1)
    for (const child of nodes.get(id)?.children ?? []) if (nodes.has(child)) visit(child)
    state.set(id, 2)
  }
  for (const root of document.roots) if (nodes.has(root)) visit(root)
  for (const node of document.nodes) if (!state.has(node.id)) visit(node.id)
}

function error(code: string, path: string, message: string, issues: SceneDocumentIssue[]): void {
  issues.push({ severity: 'error', code, path, message })
}

function warning(code: string, path: string, message: string, issues: SceneDocumentIssue[]): void {
  issues.push({ severity: 'warning', code, path, message })
}

interface ImageDescriptor {
  data?: ArrayBufferView
  width?: number
  height?: number
  depth?: number
}

type PbrMaterialLike = Material & {
  color?: { r: number; g: number; b: number }
  emissive?: { r: number; g: number; b: number }
  emissiveIntensity?: number
  metalness?: number
  roughness?: number
  normalScale?: { x: number; y: number }
  bumpScale?: number
  aoMapIntensity?: number
} & Partial<Record<(typeof TEXTURE_SLOTS)[number], Texture>>
