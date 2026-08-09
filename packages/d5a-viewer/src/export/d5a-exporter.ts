import {
  BlobReader,
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { Box3, Matrix4, Vector3, type Object3D } from 'three'
import { loadD5aDocument } from '../core/document-loader'
import {
  createFidelityReport,
  inspectScene,
  type FidelityCheck,
  type FidelityReport,
} from '../interchange/fidelity'
import {
  validateSceneDocument,
  type SceneAccessor,
  type SceneDocument,
  type SceneImage,
  type SceneJsonValue,
  type SceneMaterial,
  type SceneMesh,
  type SceneNode,
  type ScenePrimitive,
  type SceneTexture,
  type SceneTextureBinding,
} from '../interchange/scene-document'
import { buildModel } from '../render/model-builder'

const D5MESH_VERSION = 11
const D5_INFO_VERSION = 19
const MAX_D5_ITEMS = 100_000
const D5_DEFAULT_MATERIAL_TEMPLATE = '/Game/MatLib2/Base/Base/Base_9/m.m'
const D5_ROOT_FROM_Y_UP = new Matrix4().makeRotationX(Math.PI / 2)
const IDENTITY = new Matrix4()

const D5_TEXTURE_SLOTS: Record<string, { parameter: string; group: string }> = {
  map: { parameter: 'Diffuse Map', group: 'Base Color' },
  normalMap: { parameter: 'Normal Map One', group: 'Normal' },
  roughnessMap: { parameter: 'Roughness Map', group: 'Roughness' },
  metalnessMap: { parameter: 'Metallic Map', group: 'Metallic' },
  alphaMap: { parameter: 'Opacity Map', group: 'Opacity' },
  emissiveMap: { parameter: 'Emissive Map', group: 'Emissive' },
}

export interface D5aExportDiagnostic {
  severity: 'info' | 'warning'
  code: string
  message: string
  path?: string
}

export interface D5aArchiveResult {
  d5a: Blob
  meshBytes: number
  triangleCount: number
  descriptorCount: number
  geometryGroupCount: number
  textureCount: number
  diagnostics: D5aExportDiagnostic[]
  timings: D5aArchiveTimings
}

export interface D5aArchiveTimings {
  compileMs: number
  textureEncodeMs: number
  zipWriteMs: number
  archiveMs: number
}

export interface D5aExportTimings extends D5aArchiveTimings {
  sourceInspectMs: number
  roundTripMs: number
  totalMs: number
}

export interface D5aExportResult extends D5aArchiveResult {
  timings: D5aExportTimings
  report: FidelityReport
}

export interface D5aExportOptions {
  signal?: AbortSignal
  maxTextureSize?: number
  onProgress?: (label: string) => void
}

export class D5aFidelityError extends Error {
  constructor(readonly report: FidelityReport) {
    const failures = report.checks
      .filter((check) => check.status === 'fail')
      .map((check) => `${check.label} (${check.expected} -> ${check.actual})`)
    super(`D5A 回读保真检查失败: ${failures.join('、')}`)
    this.name = 'D5aFidelityError'
  }
}

export async function exportD5a(
  root: Object3D,
  scene: SceneDocument,
  sourceName: string,
  options: D5aExportOptions = {},
): Promise<D5aExportResult> {
  const started = performance.now()
  const sourceInspectStarted = performance.now()
  const source = inspectScene(root)
  const sourceInspectMs = performance.now() - sourceInspectStarted
  options.onProgress?.('写入 D5Mesh v11')
  const archiveResult = await writeD5aArchive(scene, sourceName, options)
  throwIfAborted(options.signal)

  const outputName = `${fileStem(sourceName)}.d5a`
  const file = new File([archiveResult.d5a], outputName, { type: 'application/zip' })
  options.onProgress?.('由查看器回读 D5A')
  const roundTripStarted = performance.now()
  const loaded = await loadD5aDocument(file, { signal: options.signal })
  let roundTripModel: Awaited<ReturnType<typeof buildModel>> | undefined
  let roundTrip
  try {
    roundTripModel = await buildModel(loaded, {
      signal: options.signal,
      maxTextureSize: options.maxTextureSize ?? 2048,
    })
    roundTrip = inspectScene(roundTripModel.root)
  } finally {
    roundTripModel?.dispose()
    await loaded.close()
  }
  const roundTripMs = performance.now() - roundTripStarted
  const totalMs = performance.now() - started
  const timings: D5aExportTimings = {
    ...archiveResult.timings,
    sourceInspectMs,
    roundTripMs,
    totalMs,
  }

  const warnings = archiveResult.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')
  const textureDegraded = warnings.some((diagnostic) => diagnostic.code.startsWith('texture-'))
  const diagnosticCheck: FidelityCheck = {
    id: 'd5a-degradations',
    label: 'D5A 语义降级',
    status: warnings.length > 0 ? 'warning' : 'pass',
    expected: '0 项',
    actual: `${warnings.length} 项`,
    detail: warnings.map((diagnostic) => diagnostic.message).join('；') || undefined,
  }
  const descriptorCoverageCheck = d5DescriptorCoverageCheck(source.primitiveCount, archiveResult.descriptorCount)
  const report = createFidelityReport({
    sourceName,
    sourceFormat: scene.sourceFormat,
    targetFormat: 'D5A / D5Mesh v11',
    source,
    roundTrip,
    exportBytes: archiveResult.d5a.size,
    exportMs: totalMs,
    criticalChecks: {
      instances: false,
      tangents: false,
      uv1: false,
      materialStructure: false,
      'material-structure': false,
      'material-parameters': false,
      'texture-transforms': !textureDegraded,
      'alpha-cutout': true,
    },
    extraChecks: [descriptorCoverageCheck, diagnosticCheck],
    notes: [
      'D5A 已由本查看器重新解包、解析 D5Mesh v11、重建 PBR 材质并检查世界空间结果。',
      '节点层级按 D5Mesh 描述符能力折叠为世界矩阵；共享 primitive 只写一份几何，实例写为共享 group 的多个描述符。',
      `阶段计时: 场景检查 ${durationText(timings.sourceInspectMs)}，D5Mesh 编译 ${durationText(timings.compileMs)}，纹理编码 ${durationText(timings.textureEncodeMs)}，ZIP 写入 ${durationText(timings.zipWriteMs)}，回读检查 ${durationText(timings.roundTripMs)}，总计 ${durationText(timings.totalMs)}。`,
      ...archiveResult.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
    ],
  })
  if (report.status === 'fail') throw new D5aFidelityError(report)
  return { ...archiveResult, timings, report }
}

export function d5DescriptorCoverageCheck(primitiveCount: number, descriptorCount: number): FidelityCheck {
  return {
    id: 'd5-descriptor-coverage',
    label: 'D5 描述符覆盖',
    status: descriptorCount === primitiveCount ? 'pass' : 'fail',
    expected: primitiveCount,
    actual: descriptorCount,
    detail: '每个可见渲染 primitive/实例应对应一个 D5Mesh 描述符',
  }
}

export async function writeD5aArchive(
  scene: SceneDocument,
  sourceName: string,
  options: D5aExportOptions = {},
): Promise<D5aArchiveResult> {
  const archiveStarted = performance.now()
  throwIfAborted(options.signal)
  const compileStarted = performance.now()
  const compiled = compileD5MeshV11(scene)
  const compileMs = performance.now() - compileStarted
  options.onProgress?.('编码 D5A 纹理')
  const textureStarted = performance.now()
  const texturePackage = await encodeTextures(scene, compiled.materials, compiled.diagnostics, options.signal)
  const textureEncodeMs = performance.now() - textureStarted
  throwIfAborted(options.signal)
  const info = createD5Info(scene, compiled, texturePackage.bindingsByMaterial)
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    useWebWorkers: true,
    signal: options.signal,
  })
  const zipStarted = performance.now()
  try {
    await writer.add('1.d5mesh', new Uint8ArrayReader(new Uint8Array(compiled.mesh)), {
      level: 6,
      signal: options.signal,
    })
    await writer.add('info.json', new TextReader(JSON.stringify(info)), {
      level: 6,
      signal: options.signal,
    })
    await writer.add('summary.txt', new TextReader(sourceName), {
      level: 0,
      signal: options.signal,
    })
    for (const texture of texturePackage.entries) {
      throwIfAborted(options.signal)
      await writer.add(texture.path, new BlobReader(texture.blob), {
        level: 0,
        signal: options.signal,
      })
    }
    throwIfAborted(options.signal)
    const d5a = await writer.close()
    throwIfAborted(options.signal)
    const zipWriteMs = performance.now() - zipStarted
    return {
      d5a,
      meshBytes: compiled.mesh.byteLength,
      triangleCount: compiled.triangleCount,
      descriptorCount: compiled.descriptors.length,
      geometryGroupCount: compiled.groups.length,
      textureCount: texturePackage.entries.length,
      diagnostics: compiled.diagnostics,
      timings: {
        compileMs,
        textureEncodeMs,
        zipWriteMs,
        archiveMs: performance.now() - archiveStarted,
      },
    }
  } catch (error) {
    await writer.close().catch(() => undefined)
    throw error
  }
}

export interface D5MeshV11Compilation {
  mesh: ArrayBuffer
  triangleCount: number
  descriptors: readonly D5DescriptorPlan[]
  groups: readonly D5GeometryPlan[]
  materials: readonly ExportMaterial[]
  dimensions: { length: number; depth: number; height: number }
  diagnostics: D5aExportDiagnostic[]
}

export function compileD5MeshV11(scene: SceneDocument): D5MeshV11Compilation {
  const validationErrors = validateSceneDocument(scene).filter((issue) => issue.severity === 'error')
  if (validationErrors.length > 0) {
    throw new Error(`场景中间层不适合写入: ${validationErrors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`)
  }

  const diagnostics: D5aExportDiagnostic[] = []
  const diagnosticKeys = new Set<string>()
  const addDiagnostic = (diagnostic: D5aExportDiagnostic): void => {
    const key = `${diagnostic.code}|${diagnostic.path ?? ''}|${diagnostic.message}`
    if (!diagnosticKeys.has(key)) {
      diagnosticKeys.add(key)
      diagnostics.push(diagnostic)
    }
  }
  const accessors = new Map(scene.accessors.map((accessor) => [accessor.id, accessor]))
  const meshes = new Map(scene.meshes.map((mesh) => [mesh.id, mesh]))
  const nodes = new Map(scene.nodes.map((node) => [node.id, node]))
  const materials = createExportMaterials(scene.materials)
  const materialsById = new Map(materials.map((material) => [material.source.id, material]))
  let defaultMaterial: ExportMaterial | undefined
  const groups: D5GeometryPlan[] = []
  const groupsByPrimitive = new Map<string, D5GeometryPlan>()
  const descriptors: D5DescriptorPlan[] = []
  const worldBounds = new Box3()

  if (scene.animations.length > 0) addDiagnostic({
    severity: 'warning',
    code: 'animation-omitted',
    message: `D5Mesh v11 不表达动画，已记录但未写入 ${scene.animations.length} 个动画`,
  })
  if (scene.skins.length > 0) addDiagnostic({
    severity: 'warning',
    code: 'skin-omitted',
    message: `D5Mesh v11 不表达蒙皮，已记录但未写入 ${scene.skins.length} 个 skin`,
  })

  const geometryFor = (
    mesh: SceneMesh,
    primitive: ScenePrimitive,
    primitiveIndex: number,
  ): D5GeometryPlan | undefined => {
    const identity = `${mesh.id}\u0000${primitive.id}\u0000${primitiveIndex}`
    const existing = groupsByPrimitive.get(identity)
    if (existing) return existing
    const path = `meshes.${mesh.id}.primitives[${primitiveIndex}]`
    if (primitive.mode !== 'triangles') {
      addDiagnostic({
        severity: 'warning',
        code: 'primitive-mode-omitted',
        path,
        message: `已跳过 ${primitive.mode} 图元；D5Mesh v11 写入器当前只保存三角形`,
      })
      return undefined
    }
    const position = primitive.attributes.POSITION ? accessors.get(primitive.attributes.POSITION) : undefined
    if (!position || position.itemSize < 3) {
      addDiagnostic({ severity: 'warning', code: 'position-missing', path, message: '图元缺少可用 POSITION，已跳过' })
      return undefined
    }
    const indices = primitive.indices ? accessors.get(primitive.indices) : undefined
    if (primitive.indices && !indices) throw new Error(`${path} 未找到索引访问器 ${primitive.indices}`)
    if (indices && indices.itemSize !== 1) throw new Error(`${path} 的索引 itemSize 为 ${indices.itemSize}，应为 1`)
    const available = indices?.count ?? position.count
    if (primitive.start + primitive.count > available) {
      throw new Error(`${path} 的范围 ${primitive.start}+${primitive.count} 超过 ${available}`)
    }
    const indexCount = primitive.count - primitive.count % 3
    if (indexCount !== primitive.count) addDiagnostic({
      severity: 'warning',
      code: 'triangle-tail-omitted',
      path,
      message: `图元末尾 ${primitive.count - indexCount} 个元素不能组成三角形，已跳过`,
    })
    if (indexCount === 0) {
      addDiagnostic({ severity: 'info', code: 'empty-primitive', path, message: '空三角形图元未写入' })
      return undefined
    }
    validatePrimitiveIndices(position.count, indices, primitive.start, indexCount, path)
    const vertexRemap = compactPrimitiveVertices(position.count, indices, primitive.start, indexCount)
    const normalCandidate = primitive.attributes.NORMAL ? accessors.get(primitive.attributes.NORMAL) : undefined
    const normal = normalCandidate && normalCandidate.itemSize >= 3 && normalCandidate.count >= position.count
      ? normalCandidate
      : undefined
    const uvCandidate = primitive.attributes.TEXCOORD_0 ? accessors.get(primitive.attributes.TEXCOORD_0) : undefined
    const uv = uvCandidate && uvCandidate.itemSize >= 2 && uvCandidate.count >= position.count
      ? uvCandidate
      : undefined
    let generatedNormals: Float32Array | undefined
    if (!normal) {
      generatedNormals = generateNormals(position, vertexRemap, indexCount)
      addDiagnostic({
        severity: 'warning',
        code: 'normal-generated',
        path,
        message: '图元缺少完整法线，已按三角形生成平滑法线',
      })
    }
    if (!uv) addDiagnostic({
      severity: 'warning',
      code: 'uv0-generated',
      path,
      message: '图元缺少完整 UV0，已写入 (0,0) 默认值',
    })
    if (primitive.attributes.TANGENT) addDiagnostic({
      severity: 'warning',
      code: 'tangent-omitted',
      path,
      message: 'D5Mesh v11 当前布局不保存切线，运行时将由法线贴图路径重建或近似',
    })
    if (primitive.attributes.TEXCOORD_1) addDiagnostic({
      severity: 'warning',
      code: 'uv1-omitted',
      path,
      message: 'D5Mesh v11 当前布局只保存 UV0，UV1 已记录为降级',
    })
    if (primitive.morphTargets.length > 0) addDiagnostic({
      severity: 'warning',
      code: 'morph-omitted',
      path,
      message: `D5Mesh v11 不表达 morph target，已跳过 ${primitive.morphTargets.length} 组`,
    })
    for (const semantic of Object.keys(primitive.attributes)) {
      if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT', 'TEXCOORD_1'].includes(semantic)) addDiagnostic({
        severity: 'warning',
        code: 'attribute-omitted',
        path: `${path}.attributes.${semantic}`,
        message: `D5Mesh v11 当前布局不保存 ${semantic}`,
      })
    }
    const material = primitive.material ? materialsById.get(primitive.material) : undefined
    const plan: D5GeometryPlan = {
      key: `group-${groups.length}`,
      position,
      normal,
      uv,
      generatedNormals,
      sourceVertexStart: vertexRemap.sourceVertexStart,
      sourceVertexIndices: vertexRemap.sourceVertexIndices,
      localIndices: vertexRemap.localIndices,
      indexCount,
      vertexCount: vertexRemap.vertexCount,
      triangleCount: indexCount / 3,
      material: material ?? (defaultMaterial ??= createDefaultMaterial(materials)),
      localBounds: accessorBounds(position, vertexRemap),
    }
    groups.push(plan)
    groupsByPrimitive.set(identity, plan)
    return plan
  }

  const addNodeGeometry = (node: SceneNode, nodeWorld: Matrix4): void => {
    if (!node.mesh) return
    const mesh = meshes.get(node.mesh)
    if (!mesh) throw new Error(`节点 ${node.id} 引用了不存在的 mesh ${node.mesh}`)
    const transforms: Matrix4[] = []
    if (node.instances) {
      const matrices = accessors.get(node.instances.matrices)
      if (!matrices || matrices.itemSize !== 16 || matrices.count < node.instances.count) {
        throw new Error(`节点 ${node.id} 的实例矩阵访问器无效`)
      }
      for (let index = 0; index < node.instances.count; index += 1) {
        const instance = new Matrix4().fromArray(readAccessorTuple(matrices, index, 16))
        transforms.push(new Matrix4().multiplyMatrices(nodeWorld, instance))
      }
      if (node.instances.colors) addDiagnostic({
        severity: 'warning',
        code: 'instance-color-omitted',
        path: `nodes.${node.id}.instances.colors`,
        message: 'D5Mesh 描述符不保存逐实例颜色',
      })
    } else {
      transforms.push(nodeWorld.clone())
    }
    if (node.skin) addDiagnostic({
      severity: 'warning',
      code: 'node-skin-omitted',
      path: `nodes.${node.id}.skin`,
      message: '节点蒙皮引用未写入 D5Mesh 描述符',
    })
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const group = geometryFor(mesh, primitive, primitiveIndex)
      if (!group) continue
      for (const worldMatrix of transforms) {
        const d5Matrix = new Matrix4().multiplyMatrices(D5_ROOT_FROM_Y_UP, worldMatrix)
        descriptors.push({
          key: group.key,
          materialName: group.material.key,
          matrix: d5Matrix.toArray(),
          group,
          worldMatrix: worldMatrix.clone(),
        })
        worldBounds.union(group.localBounds.clone().applyMatrix4(worldMatrix))
      }
    }
  }

  const visit = (nodeId: string, parentWorld: Matrix4, ancestorsVisible: boolean): void => {
    const node = nodes.get(nodeId)
    if (!node) return
    const visible = ancestorsVisible && node.visible
    if (!visible) {
      addDiagnostic({ severity: 'info', code: 'hidden-node-omitted', path: `nodes.${node.id}`, message: '隐藏节点及其子树未写入' })
      return
    }
    const local = new Matrix4().fromArray(node.matrix)
    const world = new Matrix4().multiplyMatrices(parentWorld, local)
    addNodeGeometry(node, world)
    for (const child of node.children) visit(child, world, visible)
  }

  for (const root of scene.roots) visit(root, IDENTITY, true)
  if (descriptors.length === 0 || groups.length === 0) throw new Error('场景中没有可写入 D5A 的可见三角形')
  if (descriptors.length > MAX_D5_ITEMS || groups.length > MAX_D5_ITEMS) {
    throw new Error(`D5Mesh 描述符或几何组超过 ${MAX_D5_ITEMS.toLocaleString()} 项`)
  }

  const triangleCount = descriptors.reduce((total, descriptor) => total + descriptor.group.triangleCount, 0)
  const metadata = JSON.stringify({ triangleCount, upVector: 3, writedFromMemory: 1 })
  const mesh = writeD5Mesh(metadata, descriptors, groups)
  const size = worldBounds.isEmpty() ? new Vector3() : worldBounds.getSize(new Vector3())
  const sourceDimensions = d5SourceDimensions(scene.extras.dimensions)
  return {
    mesh,
    triangleCount,
    descriptors,
    groups,
    materials,
    dimensions: sourceDimensions ?? { length: size.z, depth: size.x, height: size.y },
    diagnostics,
  }
}

function d5SourceDimensions(value: SceneJsonValue | undefined): {
  length: number
  depth: number
  height: number
} | undefined {
  const dimensions = jsonObject(value)
  const length = dimensions?.length
  const depth = dimensions?.depth
  const height = dimensions?.height
  return typeof length === 'number' && Number.isFinite(length) && length >= 0
    && typeof depth === 'number' && Number.isFinite(depth) && depth >= 0
    && typeof height === 'number' && Number.isFinite(height) && height >= 0
    ? { length, depth, height }
    : undefined
}

interface D5DescriptorPlan {
  key: string
  materialName: string
  matrix: number[]
  group: D5GeometryPlan
  worldMatrix: Matrix4
}

interface D5GeometryPlan {
  key: string
  position: SceneAccessor
  normal?: SceneAccessor
  uv?: SceneAccessor
  generatedNormals?: Float32Array
  sourceVertexStart: number
  sourceVertexIndices?: Uint32Array
  localIndices?: Uint32Array
  indexCount: number
  vertexCount: number
  triangleCount: number
  material: ExportMaterial
  localBounds: Box3
}

interface ExportMaterial {
  source: SceneMaterial
  index: number
  key: string
  title: string
}

interface EncodedTextureBinding {
  binding: SceneTextureBinding
  texture: SceneTexture
  path: string
}

interface TexturePackage {
  entries: { path: string; blob: Blob }[]
  bindingsByMaterial: Map<string, EncodedTextureBinding[]>
}

function writeD5Mesh(
  metadata: string,
  descriptors: readonly D5DescriptorPlan[],
  groups: readonly D5GeometryPlan[],
): ArrayBuffer {
  let bytes = 4 + countedUtf16Bytes(metadata) + 4 + 4
  for (const descriptor of descriptors) {
    bytes = checkedAdd(bytes, countedUtf16Bytes(descriptor.key) + countedUtf16Bytes(descriptor.materialName) + 16 * 4)
  }
  bytes = checkedAdd(bytes, 4)
  for (const group of groups) {
    bytes = checkedAdd(bytes, countedUtf16Bytes(group.key))
    bytes = checkedAdd(bytes, 4 + group.vertexCount * 3 * 4)
    bytes = checkedAdd(bytes, 4 + group.vertexCount * 3 * 4)
    bytes = checkedAdd(bytes, 4 + group.vertexCount * 2 * 4)
    bytes = checkedAdd(bytes, 4)
    bytes = checkedAdd(bytes, 4 + group.indexCount * 4)
  }

  const output = new ArrayBuffer(bytes)
  const writer = new BinaryWriter(output)
  writer.uint32(D5MESH_VERSION)
  writer.countedUtf16(metadata)
  writer.uint32(0)
  writer.uint32(descriptors.length)
  for (const descriptor of descriptors) {
    writer.countedUtf16(descriptor.key)
    writer.countedUtf16(descriptor.materialName)
    for (const value of descriptor.matrix) writer.float32(value)
  }
  writer.uint32(groups.length)
  for (const group of groups) {
    writer.countedUtf16(group.key)
    writer.uint32(group.vertexCount * 3)
    writeAccessor(writer, group.position, group, 3)
    writer.uint32(group.vertexCount * 3)
    if (group.normal) writeAccessor(writer, group.normal, group, 3)
    else writeGeneratedNormals(writer, group.generatedNormals!, group)
    writer.uint32(group.vertexCount * 2)
    if (group.uv) writeAccessor(writer, group.uv, group, 2)
    else for (let index = 0; index < group.vertexCount * 2; index += 1) writer.float32(0)
    writer.uint32(0)
    writer.uint32(group.indexCount)
    for (let index = 0; index < group.indexCount; index += 1) {
      writer.uint32(group.localIndices?.[index] ?? index)
    }
  }
  if (writer.offset !== output.byteLength) {
    throw new Error(`D5Mesh 写入长度 ${writer.offset} 与预分配 ${output.byteLength} 不一致`)
  }
  return output
}

async function encodeTextures(
  scene: SceneDocument,
  materials: readonly ExportMaterial[],
  diagnostics: D5aExportDiagnostic[],
  signal?: AbortSignal,
): Promise<TexturePackage> {
  const textures = new Map(scene.textures.map((texture) => [texture.id, texture]))
  const images = new Map(scene.images.map((image) => [image.id, image]))
  const encodedImages = new Map<string, { path: string; blob: Blob } | null>()
  const entries: { path: string; blob: Blob }[] = []
  const bindingsByMaterial = new Map<string, EncodedTextureBinding[]>()
  let imageIndex = 0

  for (const material of materials) {
    const bindings: EncodedTextureBinding[] = []
    for (const binding of material.source.textures) {
      const slot = D5_TEXTURE_SLOTS[binding.slot]
      if (!slot) {
        diagnostics.push({
          severity: 'warning',
          code: 'texture-slot-omitted',
          path: `materials.${material.source.id}.textures.${binding.slot}`,
          message: `D5 PBR 映射暂不保存 ${binding.slot} 纹理槽`,
        })
        continue
      }
      const texture = textures.get(binding.texture)
      const image = texture ? images.get(texture.image) : undefined
      if (!texture || !image) {
        diagnostics.push({
          severity: 'warning',
          code: 'texture-reference-missing',
          path: `materials.${material.source.id}.textures.${binding.slot}`,
          message: `${binding.slot} 引用的纹理或图像不存在`,
        })
        continue
      }
      let encoded = encodedImages.get(image.id)
      if (encoded === undefined) {
        throwIfAborted(signal)
        const passthrough = encodedImageBlob(image)
        const blob = passthrough ?? await encodeImageAsPng(image)
        if (blob) {
          const folder = `D5A_VIEWER_${String(imageIndex).padStart(4, '0')}`
          const extension = passthrough ? imageExtension(image) : 'png'
          const path = `textures/ModelTextures/${folder}/${String(imageIndex).padStart(4, '0')}.${extension}`
          encoded = { path, blob }
          entries.push(encoded)
          imageIndex += 1
        } else {
          encoded = null
          diagnostics.push({
            severity: 'warning',
            code: 'texture-transcode-omitted',
            path: `images.${image.id}`,
            message: image.payload.kind === 'compressed-mipmaps'
              ? `${image.name || image.id} 仅有压缩 mip，当前未转码为 D5A PNG`
              : `${image.name || image.id} 没有可编码的二维像素源`,
          })
        }
        encodedImages.set(image.id, encoded)
      }
      if (encoded) bindings.push({ binding, texture, path: encoded.path })
    }
    bindingsByMaterial.set(material.source.id, bindings)
  }
  return { entries, bindingsByMaterial }
}

async function encodeImageAsPng(image: SceneImage): Promise<Blob | undefined> {
  if (image.width < 1 || image.height < 1 || image.depth > 1) return undefined
  if (image.payload.kind === 'compressed-mipmaps' || image.payload.kind === 'empty') return undefined
  const canvas = createCanvas(image.width, image.height)
  if (!canvas) return undefined
  if (image.payload.kind === 'pixels') {
    const pixels = rgbaPixels(image.payload.data, image.width, image.height)
    const imageData = canvas.context.createImageData(image.width, image.height)
    imageData.data.set(pixels)
    canvas.context.putImageData(imageData, 0, 0)
  } else {
    try {
      canvas.context.drawImage(image.payload.data as CanvasImageSource, 0, 0, image.width, image.height)
    } catch {
      return undefined
    }
  }
  if (typeof OffscreenCanvas !== 'undefined' && canvas.element instanceof OffscreenCanvas) {
    return canvas.element.convertToBlob({ type: 'image/png' })
  }
  const htmlCanvas = canvas.element as HTMLCanvasElement
  return new Promise<Blob>((resolve, reject) => htmlCanvas.toBlob((blob: Blob | null) => {
    if (blob) resolve(blob)
    else reject(new Error(`纹理 ${image.name || image.id} PNG 编码失败`))
  }, 'image/png'))
}

function encodedImageBlob(image: SceneImage): Blob | undefined {
  if (image.payload.kind !== 'encoded' || image.payload.data.byteLength === 0) return undefined
  const bytes = new Uint8Array(image.payload.data.byteLength)
  bytes.set(image.payload.data)
  return new Blob([bytes.buffer], { type: image.payload.mimeType })
}

function imageExtension(image: SceneImage): string {
  if (image.payload.kind === 'encoded' && image.payload.extension && /^[A-Za-z0-9]+$/.test(image.payload.extension)) {
    return image.payload.extension.toLowerCase()
  }
  const mimeType = image.payload.kind === 'encoded' ? image.payload.mimeType : image.mimeType
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/avif') return 'avif'
  return 'png'
}

function createCanvas(width: number, height: number): {
  element: OffscreenCanvas | HTMLCanvasElement
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
} | undefined {
  if (typeof OffscreenCanvas !== 'undefined') {
    const element = new OffscreenCanvas(width, height)
    const context = element.getContext('2d', { alpha: true })
    return context ? { element, context } : undefined
  }
  if (typeof document === 'undefined') return undefined
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d', { alpha: true })
  return context ? { element, context } : undefined
}

function rgbaPixels(data: ArrayBufferView, width: number, height: number): Uint8ClampedArray {
  const pixels = width * height
  const values = numericView(data)
  const channels = values.length / pixels
  if (!Number.isInteger(channels) || channels < 1 || channels > 4) {
    throw new Error(`像素数据长度 ${values.length} 与 ${width}x${height} 不匹配`)
  }
  const output = new Uint8ClampedArray(pixels * 4)
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const source = pixel * channels
    const target = pixel * 4
    if (channels === 1) {
      const value = pixelByte(values[source]!, data)
      output[target] = value
      output[target + 1] = value
      output[target + 2] = value
      output[target + 3] = 255
    } else {
      output[target] = pixelByte(values[source]!, data)
      output[target + 1] = pixelByte(values[source + 1]!, data)
      output[target + 2] = channels >= 3 ? pixelByte(values[source + 2]!, data) : 0
      output[target + 3] = channels === 2
        ? pixelByte(values[source + 1]!, data)
        : channels === 4
          ? pixelByte(values[source + 3]!, data)
          : 255
    }
  }
  return output
}

function numericView(view: ArrayBufferView): ArrayLike<number> {
  if (view instanceof DataView) return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  return view as unknown as ArrayLike<number>
}

function pixelByte(value: number, source: ArrayBufferView): number {
  const scaled = source instanceof Float32Array || source instanceof Float64Array ? value * 255 : value
  return Math.round(Math.min(255, Math.max(0, scaled)))
}

function createD5Info(
  scene: SceneDocument,
  compiled: D5MeshV11Compilation,
  bindingsByMaterial: Map<string, EncodedTextureBinding[]>,
): Record<string, unknown> {
  const productId = stableProductId(`${scene.name}|${scene.sourceFormat}|${compiled.triangleCount}`)
  const fileList = new Set<string>()
  const elements = compiled.materials.map((material) => {
    const bindings = bindingsByMaterial.get(material.source.id) ?? []
    for (const binding of bindings) fileList.add(binding.path.replace(/^textures\//i, ''))
    const parameters = materialParameters(material, bindings, compiled.diagnostics)
    const source = sourceD5MaterialData(material.source, bindings)
    const uePath = source.uePath || D5_DEFAULT_MATERIAL_TEMPLATE
    if (!source.uePath) {
      compiled.diagnostics.push({
        severity: 'warning',
        code: 'material-template-fallback',
        path: `materials.${material.source.id}`,
        message: `${material.title} 没有可回写的 D5 材质模板，已使用 Base_9 通用 PBR 模板`,
      })
    }
    return {
      materialIndex: material.index,
      elementName: material.title,
      materialData: {
        ...source.fields,
        id: source.id || stableProductId(`${productId}|${material.key}`),
        title: material.title,
        uePath,
        matInfo: JSON.stringify(parameters),
        roughness: material.source.pbr.roughness,
        metallic: material.source.pbr.metalness,
      },
    }
  })
  return {
    productId,
    uePath: '',
    pakUrl: '1.d5mesh',
    ...compiled.dimensions,
    isInteractive: false,
    intelligentType: 1,
    furnitureStyleId: 1,
    furnitureMainMaterialId: 2,
    detailInfo: JSON.stringify({
      detailVersion: 1,
      furnitureId: productId,
      otherDetails: '',
      lightDatas: [],
      styleDatas: [{
        bActive: true,
        styleId: stableProductId(`${productId}|style`),
        thumbnailPath: '',
        elements,
      }],
      fileList: [...fileList],
    }),
    materialGroup: [],
    myFurnitureColorIngore: false,
    material_MapKey: compiled.materials.map((material) => material.key),
    infoVersion: D5_INFO_VERSION,
    useDccZeroPoint: true,
    instanceIdArray: [],
    isVAT: false,
  }
}

function sourceD5MaterialData(material: SceneMaterial, bindings: readonly EncodedTextureBinding[]): {
  fields: Record<string, SceneJsonValue>
  id?: string
  uePath?: string
} {
  const extras = jsonObject(material.extras.d5Material)
  const source = jsonObject(extras?.sourceData)
  const fields: Record<string, SceneJsonValue> = {}
  for (const [key, value] of Object.entries(source ?? {})) {
    if (
      key === 'id' || key === 'title' || key === 'uePath' || key === 'matInfo' ||
      key === 'roughness' || key === 'metallic' || key === 'thumbnailUrl' || key === 'dependent_pak_lists'
    ) continue
    fields[key] = value
  }
  const resourcePaths = [...new Set(bindings.map((binding) => binding.path.replace(/^textures\//i, '')))]
  const diffusePath = bindings.find((binding) => binding.binding.slot === 'map')?.path.replace(/^textures\//i, '')
  if (resourcePaths.length > 0 || source?.thumbnailUrl != null || source?.dependent_pak_lists != null) {
    fields.thumbnailUrl = diffusePath ?? resourcePaths[0] ?? ''
    fields.dependent_pak_lists = resourcePaths
  }
  const id = nonEmptyString(extras?.id) ?? nonEmptyString(source?.id)
  const uePath = nonEmptyString(extras?.uePath) ?? nonEmptyString(source?.uePath)
  return { fields, id, uePath }
}

function nonEmptyString(value: SceneJsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function materialParameters(
  material: ExportMaterial,
  bindings: EncodedTextureBinding[],
  diagnostics: D5aExportDiagnostic[],
): Record<string, SceneJsonValue>[] {
  const extras = jsonObject(material.source.extras.d5Material)
  const original = Array.isArray(extras?.parameters)
    ? extras.parameters.flatMap((value) => {
        const record = jsonObject(value)
        return record && typeof record.name === 'string' ? [{ ...record }] : []
      })
    : []
  const parameters = original.filter((parameter) => {
    const name = String(parameter.name).toLowerCase()
    return !Object.values(D5_TEXTURE_SLOTS).some((slot) => name === slot.parameter.toLowerCase())
  })
  const upsert = (name: string, type: number, value: string, group: string): void => {
    const existing = parameters.find((parameter) => String(parameter.name).toLowerCase() === name.toLowerCase())
    const next = { name, type, value, group, default: false }
    if (existing) Object.assign(existing, next)
    else parameters.push(next)
  }

  const pbr = material.source.pbr
  upsert(
    'Diffuse (Color)',
    2,
    `(R=${numberText(pbr.baseColor[0])},G=${numberText(pbr.baseColor[1])},B=${numberText(pbr.baseColor[2])},A=${numberText(pbr.baseColor[3])})`,
    'Base Color',
  )
  upsert('Roughness', 1, scalarText(pbr.roughness), 'Roughness')
  upsert('Metallic', 1, scalarText(pbr.metalness), 'Metallic')
  upsert('Opacity', 1, scalarText(pbr.opacity), 'Opacity')
  if (pbr.normalScale) {
    upsert('Normal Map (opacity)', 1, `X=${numberText(pbr.normalScale[0])} Y=${numberText(pbr.normalScale[1])} Z=0.000000`, 'Normal')
  }
  upsert('IsInverted_R', 1, scalarText(0), 'Roughness')

  for (const encoded of bindings) {
    const slot = D5_TEXTURE_SLOTS[encoded.binding.slot]!
    upsert(slot.parameter, 3, encoded.path.replace(/^textures\//i, ''), slot.group)
  }
  const diffuse = bindings.find((binding) => binding.binding.slot === 'map')
  const explicitOpacity = bindings.some((binding) => binding.binding.slot === 'alphaMap')
  if (pbr.alphaMode === 'mask' && diffuse && !explicitOpacity) {
    // D5's modern reader enables alpha cutout from Opacity Map metadata, while
    // the actual alpha may live in the Diffuse PNG. Reusing the path preserves
    // that semantic without emitting a duplicate archive texture.
    const opacitySlot = D5_TEXTURE_SLOTS.alphaMap!
    upsert(opacitySlot.parameter, 3, diffuse.path.replace(/^textures\//i, ''), opacitySlot.group)
  }
  const transformSource = bindings.find((binding) => binding.binding.slot === 'map') ?? bindings[0]
  const transform = transformSource ? d5TextureTransform(transformSource.texture) : {
    repeat: [1, 1] as [number, number],
    offset: [0, 0] as [number, number],
    rotation: 0,
  }
  if (transformSource) {
    for (const binding of bindings) {
      if (matrixDelta(transformSource.texture.matrix, binding.texture.matrix) > 1e-5) {
        diagnostics.push({
          severity: 'warning',
          code: 'texture-transform-approximated',
          path: `materials.${material.source.id}.textures.${binding.binding.slot}`,
          message: `${material.title} 的纹理槽使用不同 UV 变换；D5 材质只能共享一组变换，已采用 ${transformSource.binding.slot}`,
        })
      }
    }
  }
  upsert('Utiling', 1, scalarText(transform.repeat[0]), 'UV')
  upsert('Vtiling', 1, scalarText(transform.repeat[1]), 'UV')
  upsert('Umove', 1, scalarText(transform.offset[0]), 'UV')
  upsert('Vmove', 1, scalarText(transform.offset[1]), 'UV')
  upsert('UVAngle', 1, scalarText(transform.rotation * 180 / Math.PI), 'UV')
  return parameters
}

export function d5TextureTransform(texture: SceneTexture): {
  repeat: [number, number]
  offset: [number, number]
  rotation: number
} {
  const [sx, sy] = texture.repeat
  const rotation = texture.rotation
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const translationX = texture.matrix[6]!
  const translationY = texture.matrix[7]!
  return {
    repeat: [sx, sy],
    offset: [
      translationX + sx * (cosine * 0.5 + sine * 0.5) - 0.5,
      translationY - sy * sine * 0.5 + sy * cosine * 0.5 - 0.5,
    ],
    rotation,
  }
}

function createExportMaterials(materials: SceneMaterial[]): ExportMaterial[] {
  const keys = new Set<string>()
  const ordered = materials
    .map((source, sourceOrder) => ({
      source,
      sourceOrder,
      d5Index: originalD5MaterialIndex(source),
    }))
    .sort((left, right) => {
      if (left.d5Index != null && right.d5Index != null) return left.d5Index - right.d5Index
      if (left.d5Index != null) return -1
      if (right.d5Index != null) return 1
      return left.sourceOrder - right.sourceOrder
    })
  return ordered.map(({ source }, index) => {
    const d5 = jsonObject(source.extras.d5Material)
    const requested = typeof d5?.key === 'string' && d5.key.trim() ? d5.key : source.id
    return {
      source,
      index,
      key: uniqueKey(requested, keys),
      title: typeof d5?.title === 'string' && d5.title.trim() ? d5.title : source.name || `Material ${index + 1}`,
    }
  })
}

function originalD5MaterialIndex(material: SceneMaterial): number | undefined {
  const d5 = jsonObject(material.extras.d5Material)
  const index = d5?.index
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : undefined
}

function createDefaultMaterial(materials: ExportMaterial[]): ExportMaterial {
  const existing = materials.find((material) => material.source.id === '__d5a_default__')
  if (existing) return existing
  const source: SceneMaterial = {
    id: '__d5a_default__',
    name: 'D5 Default',
    model: 'MeshStandardMaterial',
    pbr: {
      baseColor: [0.68, 0.71, 0.69, 1],
      emissive: [0, 0, 0],
      metalness: 0,
      roughness: 0.68,
      opacity: 1,
      alphaMode: 'opaque',
      alphaCutoff: 0,
      doubleSided: true,
    },
    textures: [],
    extras: {},
  }
  const material = { source, index: materials.length, key: '__d5a_default__', title: source.name }
  materials.push(material)
  return material
}

function uniqueKey(value: string, used: Set<string>): string {
  const base = value.slice(0, 240) || 'material'
  let key = base
  let suffix = 2
  while (used.has(key.toLowerCase())) key = `${base}-${suffix++}`
  used.add(key.toLowerCase())
  return key
}

function validatePrimitiveIndices(
  vertexCount: number,
  indices: SceneAccessor | undefined,
  start: number,
  count: number,
  path: string,
): void {
  for (let index = 0; index < count; index += 1) {
    const value = primitiveIndex(indices, start + index)
    if (!Number.isInteger(value) || value < 0 || value >= vertexCount) {
      throw new Error(`${path} 的索引 ${value} 超过顶点范围 0..${vertexCount - 1}`)
    }
  }
}

function primitiveIndex(accessor: SceneAccessor | undefined, index: number): number {
  return accessor ? rawAccessorNumber(accessor, index, 0) : index
}

interface PrimitiveVertexRemap {
  sourceVertexStart: number
  sourceVertexIndices?: Uint32Array
  localIndices?: Uint32Array
  vertexCount: number
}

function compactPrimitiveVertices(
  sourceVertexCount: number,
  indices: SceneAccessor | undefined,
  start: number,
  count: number,
): PrimitiveVertexRemap {
  if (!indices) {
    return { sourceVertexStart: start, vertexCount: count }
  }

  // Avoid three temporary arrays for the common already-local identity case.
  const first = primitiveIndex(indices, start)
  let ascending = first + count <= sourceVertexCount
  for (let index = 1; ascending && index < count; index += 1) {
    ascending = primitiveIndex(indices, start + index) === first + index
  }
  if (ascending) return { sourceVertexStart: first, vertexCount: count }

  // A dense Int32 lookup uses substantially less memory than a Map for large
  // meshes and gives deterministic first-use ordering for sparse vertex sets.
  const sourceToLocal = new Int32Array(sourceVertexCount)
  sourceToLocal.fill(-1)
  const sourceVertices = new Uint32Array(Math.min(sourceVertexCount, count))
  const localIndices = new Uint32Array(count)
  let uniqueCount = 0
  let minimum = sourceVertexCount
  let maximum = -1
  for (let index = 0; index < count; index += 1) {
    const source = primitiveIndex(indices, start + index)
    let local = sourceToLocal[source]!
    if (local < 0) {
      local = uniqueCount
      sourceToLocal[source] = uniqueCount
      sourceVertices[uniqueCount] = source
      uniqueCount += 1
      minimum = Math.min(minimum, source)
      maximum = Math.max(maximum, source)
    }
    localIndices[index] = local
  }

  let compactSources: Uint32Array | undefined
  let sourceVertexStart = 0
  if (maximum - minimum + 1 === uniqueCount) {
    // When all vertices in a contiguous source span are used, retain source
    // order and only rebase the primitive indices. No source map is needed.
    sourceVertexStart = minimum
    for (let index = 0; index < count; index += 1) {
      localIndices[index] = primitiveIndex(indices, start + index) - minimum
    }
  } else {
    compactSources = uniqueCount === sourceVertices.length
      ? sourceVertices
      : sourceVertices.slice(0, uniqueCount)
  }

  let identity = uniqueCount === count
  for (let index = 0; identity && index < count; index += 1) {
    identity = localIndices[index] === index
  }
  return {
    sourceVertexStart,
    sourceVertexIndices: compactSources,
    localIndices: identity ? undefined : localIndices,
    vertexCount: uniqueCount,
  }
}

function generateNormals(
  position: SceneAccessor,
  remap: PrimitiveVertexRemap,
  count: number,
): Float32Array {
  const normals = new Float32Array(remap.vertexCount * 3)
  for (let index = 0; index < count; index += 3) {
    const a = remap.localIndices?.[index] ?? index
    const b = remap.localIndices?.[index + 1] ?? index + 1
    const c = remap.localIndices?.[index + 2] ?? index + 2
    const sourceA = sourceVertexIndex(remap, a)
    const sourceB = sourceVertexIndex(remap, b)
    const sourceC = sourceVertexIndex(remap, c)
    const ax = accessorNumber(position, sourceA, 0)
    const ay = accessorNumber(position, sourceA, 1)
    const az = accessorNumber(position, sourceA, 2)
    const abx = accessorNumber(position, sourceB, 0) - ax
    const aby = accessorNumber(position, sourceB, 1) - ay
    const abz = accessorNumber(position, sourceB, 2) - az
    const acx = accessorNumber(position, sourceC, 0) - ax
    const acy = accessorNumber(position, sourceC, 1) - ay
    const acz = accessorNumber(position, sourceC, 2) - az
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    for (const vertex of [a, b, c]) {
      normals[vertex * 3] = normals[vertex * 3]! + nx
      normals[vertex * 3 + 1] = normals[vertex * 3 + 1]! + ny
      normals[vertex * 3 + 2] = normals[vertex * 3 + 2]! + nz
    }
  }
  for (let vertex = 0; vertex < remap.vertexCount; vertex += 1) {
    const offset = vertex * 3
    const x = normals[offset]!
    const y = normals[offset + 1]!
    const z = normals[offset + 2]!
    const length = Math.hypot(x, y, z)
    if (length > 1e-12) {
      normals[offset] = x / length
      normals[offset + 1] = y / length
      normals[offset + 2] = z / length
    } else {
      normals[offset] = 0
      normals[offset + 1] = 0
      normals[offset + 2] = 1
    }
  }
  return normals
}

function sourceVertexIndex(remap: PrimitiveVertexRemap, localIndex: number): number {
  return remap.sourceVertexIndices?.[localIndex] ?? remap.sourceVertexStart + localIndex
}

function accessorBounds(accessor: SceneAccessor, remap: PrimitiveVertexRemap): Box3 {
  const bounds = new Box3()
  const point = new Vector3()
  for (let index = 0; index < remap.vertexCount; index += 1) {
    const source = sourceVertexIndex(remap, index)
    point.set(
      accessorNumber(accessor, source, 0),
      accessorNumber(accessor, source, 1),
      accessorNumber(accessor, source, 2),
    )
    bounds.expandByPoint(point)
  }
  return bounds
}

function writeAccessor(
  writer: BinaryWriter,
  accessor: SceneAccessor,
  remap: PrimitiveVertexRemap,
  itemSize: number,
): void {
  for (let index = 0; index < remap.vertexCount; index += 1) {
    const source = sourceVertexIndex(remap, index)
    for (let component = 0; component < itemSize; component += 1) {
      writer.float32(accessorNumber(accessor, source, component))
    }
  }
}

function writeGeneratedNormals(
  writer: BinaryWriter,
  normals: Float32Array,
  remap: PrimitiveVertexRemap,
): void {
  if (normals.length !== remap.vertexCount * 3) {
    throw new Error(`生成法线长度 ${normals.length} 与局部顶点数 ${remap.vertexCount} 不一致`)
  }
  for (const value of normals) writer.float32(value)
}

function readAccessorTuple(accessor: SceneAccessor, index: number, itemSize: number): number[] {
  return Array.from({ length: itemSize }, (_, component) => accessorNumber(accessor, index, component))
}

function accessorNumber(accessor: SceneAccessor, index: number, component: number): number {
  const value = rawAccessorNumber(accessor, index, component)
  if (!accessor.normalized) return finite(value, `${accessor.id}[${index},${component}]`)
  const array = accessor.array
  if (array instanceof Int8Array) return Math.max(value / 127, -1)
  if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) return value / 255
  if (array instanceof Int16Array) return Math.max(value / 32767, -1)
  if (array instanceof Uint16Array) return value / 65535
  if (array instanceof Int32Array) return Math.max(value / 2147483647, -1)
  if (array instanceof Uint32Array) return value / 4294967295
  return finite(value, `${accessor.id}[${index},${component}]`)
}

function rawAccessorNumber(accessor: SceneAccessor, index: number, component: number): number {
  const offset = accessor.offset + index * accessor.stride + component
  const value = accessor.array[offset]
  if (value == null) throw new Error(`${accessor.id} 访问 ${offset} 超出数组范围`)
  return finite(value, `${accessor.id}[${index},${component}]`)
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} 不是有限数值`)
  return value
}

class BinaryWriter {
  private readonly view: DataView
  offset = 0

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer)
  }

  uint32(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new Error(`uint32 数值无效: ${value}`)
    this.view.setUint32(this.offset, value, true)
    this.offset += 4
  }

  float32(value: number): void {
    this.view.setFloat32(this.offset, finite(value, `float32@${this.offset}`), true)
    this.offset += 4
  }

  countedUtf16(value: string): void {
    this.uint32(value.length)
    for (let index = 0; index < value.length; index += 1) {
      this.view.setUint16(this.offset, value.charCodeAt(index), true)
      this.offset += 2
    }
  }
}

function countedUtf16Bytes(value: string): number {
  return checkedAdd(4, value.length * 2)
}

function checkedAdd(left: number, right: number): number {
  const result = left + right
  if (!Number.isSafeInteger(result) || result > 0xffff_ffff) {
    throw new Error(`D5Mesh 写入大小 ${result.toLocaleString()} 超出当前 4 GiB 限制`)
  }
  return result
}

function jsonObject(value: SceneJsonValue | undefined): Record<string, SceneJsonValue> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, SceneJsonValue>
    : undefined
}

function numberText(value: number): string {
  return finite(value, '材质参数').toFixed(6)
}

function scalarText(value: number): string {
  return `X=${numberText(value)} Y=0.000000 Z=0.000000`
}

function durationText(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(2)} s` : `${value.toFixed(1)} ms`
}

function matrixDelta(left: number[], right: number[]): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let maximum = 0
  for (let index = 0; index < left.length; index += 1) maximum = Math.max(maximum, Math.abs(left[index]! - right[index]!))
  return maximum
}

function stableProductId(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  const part = (hash >>> 0).toString(16).padStart(8, '0')
  return `${part}${part}${part}${part}`.toUpperCase()
}

function fileStem(filename: string): string {
  return filename.replace(/\.(?:d5a|glb)$/i, '')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('导出已取消', 'AbortError')
}
