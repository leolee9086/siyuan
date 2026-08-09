import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three'

export interface SceneBounds {
  min: [number, number, number]
  max: [number, number, number]
  size: [number, number, number]
}

export interface MeshTransformSnapshot {
  name: string
  matrix: number[]
}

export interface TextureSlotSnapshot {
  slot: string
  channel: number
  colorSpace: string
  wrapS: number
  wrapT: number
  matrix: number[]
  dimensions: [number, number]
}

export interface MaterialSnapshot {
  key: string
  name: string
  type: string
  color?: [number, number, number]
  emissive?: [number, number, number]
  roughness?: number
  metalness?: number
  opacity: number
  alphaTest: number
  transparent: boolean
  side: number
  textures: TextureSlotSnapshot[]
}

export interface SceneMetrics {
  nodeCount: number
  meshNodeCount: number
  instanceCount: number
  primitiveCount: number
  uniqueGeometryCount: number
  materialCount: number
  textureCount: number
  triangleCount: number
  vertexCount: number
  primitivesWithNormals: number
  primitivesWithTangents: number
  primitivesWithUv0: number
  primitivesWithUv1: number
  transparentMaterialCount: number
  alphaCutoutMaterialCount: number
  bounds: SceneBounds
  meshTransforms: MeshTransformSnapshot[]
  materials: MaterialSnapshot[]
}

export type FidelityCheckStatus = 'pass' | 'warning' | 'fail'

export interface FidelityCheck {
  id: string
  label: string
  status: FidelityCheckStatus
  expected: number | string
  actual: number | string
  detail?: string
}

export interface FidelityReport {
  schemaVersion: 2
  sourceFormat: string
  targetFormat: string
  sourceName: string
  generatedAt: string
  status: FidelityCheckStatus
  exportBytes: number
  exportMs: number
  source: SceneMetrics
  roundTrip: SceneMetrics
  checks: FidelityCheck[]
  notes: string[]
  validator?: GltfValidatorSummary
}

export interface GltfValidatorMessage {
  code: string
  message: string
  severity: number
  pointer?: string
}

export interface GltfValidatorSummary {
  version: string
  errors: number
  warnings: number
  infos: number
  hints: number
  truncated: boolean
  messages: GltfValidatorMessage[]
}

const TEXTURE_SLOTS = [
  'map',
  'lightMap',
  'aoMap',
  'emissiveMap',
  'bumpMap',
  'normalMap',
  'displacementMap',
  'roughnessMap',
  'metalnessMap',
  'alphaMap',
  'envMap',
] as const

export function inspectScene(root: Object3D): SceneMetrics {
  root.updateMatrixWorld(true)
  const geometries = new Set<string>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const vertexBuffers = new Set<unknown>()
  const bounds = new Box3()
  const transformedBounds = new Box3()
  const instanceMatrix = new Matrix4()
  const worldMatrix = new Matrix4()
  const meshTransforms: MeshTransformSnapshot[] = []
  let nodeCount = 0
  let meshNodeCount = 0
  let instanceCount = 0
  let primitiveCount = 0
  let triangleCount = 0
  let vertexCount = 0
  let primitivesWithNormals = 0
  let primitivesWithTangents = 0
  let primitivesWithUv0 = 0
  let primitivesWithUv1 = 0

  root.traverseVisible((object) => {
    nodeCount += 1
    if (!(object instanceof Mesh)) return
    meshNodeCount += 1
    const geometry = object.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    const copies = object instanceof InstancedMesh ? object.count : 1
    const primitiveCopies = Math.max(1, geometry.groups.length) * copies
    const elements = drawElementCount(object)
    instanceCount += copies
    primitiveCount += primitiveCopies
    triangleCount += Math.floor(elements / 3) * copies
    const positionStorage = 'isInterleavedBufferAttribute' in position && position.isInterleavedBufferAttribute
      ? position.data
      : position
    if (!vertexBuffers.has(positionStorage)) {
      vertexBuffers.add(positionStorage)
      vertexCount += position.count
    }
    if (geometry.getAttribute('normal')) primitivesWithNormals += primitiveCopies
    if (geometry.getAttribute('tangent')) primitivesWithTangents += primitiveCopies
    if (geometry.getAttribute('uv')) primitivesWithUv0 += primitiveCopies
    if (geometry.getAttribute('uv1')) primitivesWithUv1 += primitiveCopies
    geometries.add(geometry.uuid)

    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of objectMaterials) {
      materials.add(material)
      for (const slot of TEXTURE_SLOTS) {
        const texture = (material as Material & Partial<Record<(typeof TEXTURE_SLOTS)[number], Texture>>)[slot]
        if (texture?.isTexture) textures.add(texture)
      }
    }

    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingBox) return
    if (object instanceof InstancedMesh) {
      for (let index = 0; index < object.count; index += 1) {
        object.getMatrixAt(index, instanceMatrix)
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix)
        transformedBounds.copy(geometry.boundingBox).applyMatrix4(worldMatrix)
        bounds.union(transformedBounds)
        meshTransforms.push({ name: semanticName(object), matrix: worldMatrix.toArray() })
      }
    } else {
      transformedBounds.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld)
      bounds.union(transformedBounds)
      meshTransforms.push({ name: semanticName(object), matrix: object.matrixWorld.toArray() })
    }
  })

  const minimum = bounds.isEmpty() ? new Vector3() : bounds.min
  const maximum = bounds.isEmpty() ? new Vector3() : bounds.max
  const size = bounds.isEmpty() ? new Vector3() : bounds.getSize(new Vector3())
  const materialSnapshots = [...materials].map(snapshotMaterial).sort(compareMaterialSnapshots)
  return {
    nodeCount,
    meshNodeCount,
    instanceCount,
    primitiveCount,
    uniqueGeometryCount: geometries.size,
    materialCount: materials.size,
    textureCount: textures.size,
    triangleCount,
    vertexCount,
    primitivesWithNormals,
    primitivesWithTangents,
    primitivesWithUv0,
    primitivesWithUv1,
    transparentMaterialCount: [...materials].filter((material) => material.transparent).length,
    alphaCutoutMaterialCount: [...materials].filter((material) => material.alphaTest > 0).length,
    bounds: {
      min: vectorTuple(minimum),
      max: vectorTuple(maximum),
      size: vectorTuple(size),
    },
    meshTransforms,
    materials: materialSnapshots,
  }
}

export function createFidelityReport(options: {
  sourceName: string
  source: SceneMetrics
  roundTrip: SceneMetrics
  exportBytes: number
  exportMs: number
  sourceFormat?: string
  targetFormat?: string
  criticalChecks?: Partial<Record<string, boolean>>
  extraChecks?: FidelityCheck[]
  notes?: string[]
  validator?: GltfValidatorSummary
}): FidelityReport {
  const { source, roundTrip } = options
  const boundsScale = Math.max(...source.bounds.size, 1)
  const boundsTolerance = boundsScale * 1e-5
  const transformTolerance = 1e-5
  const critical = (id: string, fallback: boolean): boolean => options.criticalChecks?.[id] ?? fallback
  const checks: FidelityCheck[] = [
    exactCheck('triangles', '三角面', source.triangleCount, roundTrip.triangleCount, critical('triangles', true)),
    exactCheck('primitives', '渲染图元', source.primitiveCount, roundTrip.primitiveCount, critical('primitives', true)),
    exactCheck('mesh-nodes', '网格节点', source.meshNodeCount, roundTrip.meshNodeCount, critical('mesh-nodes', false)),
    exactCheck('instances', '实例数量', source.instanceCount, roundTrip.instanceCount, critical('instances', false)),
    exactCheck('vertices', '顶点引用数量', source.vertexCount, roundTrip.vertexCount, critical('vertices', false)),
    exactCheck(
      'unique-geometries',
      '唯一几何数量',
      source.uniqueGeometryCount,
      roundTrip.uniqueGeometryCount,
      critical('unique-geometries', false),
    ),
    coverageCheck('normals', '法线覆盖', source.primitivesWithNormals, roundTrip.primitivesWithNormals, critical('normals', true)),
    coverageCheck('tangents', '切线覆盖', source.primitivesWithTangents, roundTrip.primitivesWithTangents, critical('tangents', true)),
    coverageCheck('uv0', 'UV0 覆盖', source.primitivesWithUv0, roundTrip.primitivesWithUv0, critical('uv0', true)),
    coverageCheck('uv1', 'UV1 覆盖', source.primitivesWithUv1, roundTrip.primitivesWithUv1, critical('uv1', true)),
    toleranceCheck('bounds', '包围盒最大误差', 0, boundsDelta(source.bounds, roundTrip.bounds), boundsTolerance, critical('bounds', true)),
    toleranceCheck(
      'transforms',
      '网格世界矩阵最大误差',
      0,
      transformSetDelta(source.meshTransforms, roundTrip.meshTransforms),
      transformTolerance,
      critical('transforms', true),
    ),
    exactCheck(
      'transform-topology',
      '节点变换拓扑',
      transformTopologySignature(source.meshTransforms),
      transformTopologySignature(roundTrip.meshTransforms),
      critical('transform-topology', false),
    ),
    exactCheck('materials', '材质数量', source.materialCount, roundTrip.materialCount, critical('materials', false)),
    exactCheck('textures', '纹理对象数量', source.textureCount, roundTrip.textureCount, critical('textures', false)),
    exactCheck(
      'material-structure',
      '材质与纹理槽结构',
      materialStructureSignature(source.materials),
      materialStructureSignature(roundTrip.materials),
      critical('material-structure', true),
    ),
    toleranceCheck(
      'material-parameters',
      'PBR 材质参数最大误差',
      0,
      materialParameterDelta(source.materials, roundTrip.materials),
      1e-5,
      critical('material-parameters', true),
    ),
    toleranceCheck(
      'texture-transforms',
      '纹理 UV 变换矩阵最大误差',
      0,
      textureTransformDelta(source.materials, roundTrip.materials),
      1e-5,
      critical('texture-transforms', true),
    ),
    exactCheck(
      'texture-dimensions',
      '纹理尺寸',
      textureDimensionSignature(source.materials),
      textureDimensionSignature(roundTrip.materials),
      critical('texture-dimensions', false),
    ),
    exactCheck(
      'alpha-cutout',
      '透明裁切材质',
      source.alphaCutoutMaterialCount,
      roundTrip.alphaCutoutMaterialCount,
      critical('alpha-cutout', false),
    ),
  ]
  checks.push(...(options.extraChecks ?? []))
  if (options.validator) {
    checks.push({
      id: 'khronos-validator',
      label: 'Khronos glTF Validator',
      status: options.validator.errors > 0
        ? 'fail'
        : options.validator.warnings > 0
          ? 'warning'
          : 'pass',
      expected: '0 errors / 0 warnings',
      actual: `${options.validator.errors} errors / ${options.validator.warnings} warnings`,
      detail: `validator ${options.validator.version}`,
    })
  }
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : checks.some((check) => check.status === 'warning')
      ? 'warning'
      : 'pass'
  return {
    schemaVersion: 2,
    sourceFormat: options.sourceFormat ?? 'D5A scene',
    targetFormat: options.targetFormat ?? 'GLB 2.0',
    sourceName: options.sourceName,
    generatedAt: new Date().toISOString(),
    status,
    exportBytes: options.exportBytes,
    exportMs: options.exportMs,
    source,
    roundTrip,
    checks,
    notes: options.notes ?? [],
    validator: options.validator,
  }
}

function coverageCheck(
  id: string,
  label: string,
  expected: number,
  actual: number,
  critical: boolean,
): FidelityCheck {
  const preserved = actual >= expected
  return {
    id,
    label,
    status: preserved ? 'pass' : critical ? 'fail' : 'warning',
    expected,
    actual,
    detail: actual > expected ? '目标格式补充了缺失属性' : undefined,
  }
}

function drawElementCount(mesh: Mesh): number {
  const geometry = mesh.geometry
  const available = geometry.getIndex()?.count ?? geometry.getAttribute('position')?.count ?? 0
  const start = Math.min(available, Math.max(0, geometry.drawRange.start))
  const requested = Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : available - start
  return Math.min(available - start, Math.max(0, requested))
}

function exactCheck(
  id: string,
  label: string,
  expected: number | string,
  actual: number | string,
  critical: boolean,
): FidelityCheck {
  const matches = expected === actual
  return {
    id,
    label,
    status: matches ? 'pass' : critical ? 'fail' : 'warning',
    expected,
    actual,
  }
}

function snapshotMaterial(material: Material): MaterialSnapshot {
  const pbr = material as Material & {
    color?: { isColor?: boolean; r: number; g: number; b: number }
    emissive?: { isColor?: boolean; r: number; g: number; b: number }
    roughness?: number
    metalness?: number
  }
  const textures = TEXTURE_SLOTS.flatMap((slot) => {
    const texture = (material as Material & Partial<Record<(typeof TEXTURE_SLOTS)[number], Texture>>)[slot]
    if (!texture?.isTexture) return []
    if (slot === 'metalnessMap' && (pbr.metalness ?? 1) === 0) return []
    if (texture.matrixAutoUpdate) texture.updateMatrix()
    const image = texture.image as { width?: number; height?: number } | undefined
    return [{
      slot,
      channel: texture.channel,
      colorSpace: normalizedColorSpace(slot, texture.colorSpace),
      wrapS: texture.wrapS,
      wrapT: texture.wrapT,
      matrix: texture.matrix.toArray(),
      dimensions: [image?.width ?? 0, image?.height ?? 0] as [number, number],
    }]
  })
  return {
    key: semanticMaterialKey(material),
    name: material.name,
    type: material.type,
    color: colorTuple(pbr.color),
    emissive: colorTuple(pbr.emissive),
    roughness: pbr.roughness,
    metalness: pbr.metalness,
    opacity: material.opacity,
    alphaTest: material.alphaTest,
    transparent: material.transparent,
    side: material.side,
    textures,
  }
}

function semanticMaterialKey(material: Material): string {
  const d5Material = material.userData.d5Material
  if (typeof d5Material === 'object' && d5Material !== null) {
    // material_MapKey is the logical D5 identity. Array indices are storage
    // slots and may be sparse or renumbered when duplicate v9/v10 entries are
    // collapsed into the four materials actually referenced by descriptors.
    const key = (d5Material as { key?: unknown }).key
    if (typeof key === 'string' && key.trim()) return `d5-key:${key.trim().toLowerCase()}`
    const index = (d5Material as { index?: unknown }).index
    if (typeof index === 'number' || typeof index === 'string') return `d5:${index}`
  }
  return `${material.type}:${material.name || '(unnamed)'}`
}

function colorTuple(
  value?: { isColor?: boolean; r: number; g: number; b: number },
): [number, number, number] | undefined {
  return value?.isColor ? [value.r, value.g, value.b] : undefined
}

function compareMaterialSnapshots(left: MaterialSnapshot, right: MaterialSnapshot): number {
  return materialSortKey(left).localeCompare(materialSortKey(right))
}

function materialSortKey(material: MaterialSnapshot): string {
  return `${material.key}\u0000${material.name}\u0000${material.textures.map((texture) => texture.slot).join(',')}`
}

function materialStructureSignature(materials: MaterialSnapshot[]): string {
  return materials.map((material) => [
    material.key,
    material.type,
    material.transparent ? 'transparent' : 'opaque',
    material.side,
    material.textures.map((texture) =>
      `${texture.slot}@${texture.channel}:${texture.colorSpace}:${texture.wrapS}/${texture.wrapT}`,
    ).join(','),
  ].join('|')).join(';')
}

function textureDimensionSignature(materials: MaterialSnapshot[]): string {
  return materials.flatMap((material) => material.textures.map((texture) =>
    `${material.key}/${texture.slot}:${texture.dimensions[0]}x${texture.dimensions[1]}`,
  )).join(';')
}

function materialParameterDelta(left: MaterialSnapshot[], right: MaterialSnapshot[]): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let maximum = 0
  for (let index = 0; index < left.length; index += 1) {
    const source = left[index]!
    const target = right[index]!
    if (source.key !== target.key) return Number.POSITIVE_INFINITY
    maximum = Math.max(
      maximum,
      optionalArrayDelta(source.color, target.color),
      optionalArrayDelta(source.emissive, target.emissive),
      optionalNumberDelta(source.roughness, target.roughness),
      optionalNumberDelta(source.metalness, target.metalness),
      Math.abs(source.opacity - target.opacity),
      Math.abs(source.alphaTest - target.alphaTest),
    )
  }
  return maximum
}

function textureTransformDelta(left: MaterialSnapshot[], right: MaterialSnapshot[]): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let maximum = 0
  for (let materialIndex = 0; materialIndex < left.length; materialIndex += 1) {
    const source = left[materialIndex]!
    const target = right[materialIndex]!
    if (source.key !== target.key || source.textures.length !== target.textures.length) {
      return Number.POSITIVE_INFINITY
    }
    for (let textureIndex = 0; textureIndex < source.textures.length; textureIndex += 1) {
      const sourceTexture = source.textures[textureIndex]!
      const targetTexture = target.textures[textureIndex]!
      if (sourceTexture.slot !== targetTexture.slot) return Number.POSITIVE_INFINITY
      maximum = Math.max(maximum, arrayDelta(sourceTexture.matrix, targetTexture.matrix))
    }
  }
  return maximum
}

function optionalArrayDelta(left?: number[], right?: number[]): number {
  if (!left && !right) return 0
  if (!left || !right) return Number.POSITIVE_INFINITY
  return arrayDelta(left, right)
}

function optionalNumberDelta(left?: number, right?: number): number {
  if (left == null && right == null) return 0
  if (left == null || right == null) return Number.POSITIVE_INFINITY
  return Math.abs(left - right)
}

function arrayDelta(left: number[], right: number[]): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let maximum = 0
  for (let index = 0; index < left.length; index += 1) {
    maximum = Math.max(maximum, Math.abs(left[index]! - right[index]!))
  }
  return maximum
}

function normalizedColorSpace(slot: (typeof TEXTURE_SLOTS)[number], colorSpace: string): string {
  if (slot === 'map' || slot === 'emissiveMap') return colorSpace
  return colorSpace === '' || colorSpace === 'srgb-linear' ? 'linear-data' : colorSpace
}

function toleranceCheck(
  id: string,
  label: string,
  expected: number,
  actual: number,
  tolerance: number,
  critical: boolean,
): FidelityCheck {
  const matches = Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance
  return {
    id,
    label,
    status: matches ? 'pass' : critical ? 'fail' : 'warning',
    expected,
    actual,
    detail: `容差 ${tolerance.toExponential(3)}`,
  }
}

function boundsDelta(left: SceneBounds, right: SceneBounds): number {
  return Math.max(
    ...left.min.map((value, index) => Math.abs(value - right.min[index]!)),
    ...left.max.map((value, index) => Math.abs(value - right.max[index]!)),
  )
}

function transformSetDelta(left: MeshTransformSnapshot[], right: MeshTransformSnapshot[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0 || right.length === 0) return Number.POSITIVE_INFINITY
  return Math.max(directionalTransformDelta(left, right), directionalTransformDelta(right, left))
}

function directionalTransformDelta(
  source: MeshTransformSnapshot[],
  targets: MeshTransformSnapshot[],
): number {
  let maximum = 0
  for (const sourceTransform of source) {
    let minimum = Number.POSITIVE_INFINITY
    for (const targetTransform of targets) {
      minimum = Math.min(minimum, arrayDelta(sourceTransform.matrix, targetTransform.matrix))
    }
    maximum = Math.max(maximum, minimum)
  }
  return maximum
}

function transformTopologySignature(transforms: MeshTransformSnapshot[]): string {
  return transforms.map((transform) => transform.name).sort().join(';')
}

function vectorTuple(vector: Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function semanticName(object: Object3D): string {
  return typeof object.userData.name === 'string' ? object.userData.name : object.name
}
