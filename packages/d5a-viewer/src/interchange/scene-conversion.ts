import { Matrix4, Quaternion, Vector3 } from 'three'
import { D5aArchive } from '../core/d5a-archive'
import { parseD5GroupInfo } from '../core/group-info'
import { parseD5Info } from '../core/materials'
import { parseD5Mesh } from '../core/d5mesh'
import type { D5Info, D5Material, D5MeshGroup, D5MeshModel, D5aBundleInspection, D5aTransform } from '../core/types'
import { writeD5aArchive, type D5aExportDiagnostic } from '../export/d5a-exporter'
import { readDxfStructure, writeDxfScene, type DxfDiagnostic } from './dxf-format'
import {
  validateSceneDocument,
  type SceneAccessor,
  type SceneDocument,
  type SceneImage,
  type SceneJsonValue,
  type SceneMaterial,
  type SceneNumericArray,
  type ScenePrimitiveMode,
  type SceneTexture,
  type SceneTextureBinding,
} from './scene-document'
import { validateGlb } from './glb-container'

export type SceneConversionFormat = 'd5a' | 'glb' | 'dxf'
export type SceneReadableFormat = Exclude<SceneConversionFormat, 'dxf'>

export interface SceneConversionProgress {
  phase: 'open' | 'extract' | 'parse' | 'textures' | 'encode' | 'verify'
  completed: number
  total: number
  message: string
}

export interface SceneConversionDiagnostic {
  severity: 'warning' | 'error'
  code: string
  message: string
  path?: string
}

export interface SceneDocumentReadResult {
  format: SceneReadableFormat
  scene: SceneDocument
  warnings: SceneConversionDiagnostic[]
}

export interface SceneDocumentMetrics {
  nodeCount: number
  meshNodeCount: number
  meshDefinitionCount: number
  primitiveCount: number
  triangleCount: number
  vertexCount: number
  materialCount: number
  textureCount: number
  imageCount: number
  primitivesWithNormals: number
  primitivesWithUv0: number
  primitivesWithUv1: number
  animationCount: number
  skinCount: number
}

export interface SceneConversionCheck {
  id: string
  label: string
  status: 'pass' | 'warning' | 'fail'
  expected: number | string
  actual: number | string
  detail?: string
}

export interface SceneConversionReport {
  schemaVersion: 1
  documentKind: 'scene'
  operation: 'convert'
  status: 'pass' | 'warning' | 'fail'
  sourceFormat: SceneConversionFormat
  targetFormat: SceneConversionFormat
  sourceName: string
  outputName: string
  outputBytes: number
  elapsedMs: number
  source: SceneDocumentMetrics
  roundTrip: SceneDocumentMetrics
  checks: SceneConversionCheck[]
  warnings: SceneConversionDiagnostic[]
  validator?: {
    errors: number
    warnings: number
    infos: number
    hints: number
    messages: Array<{
      severity: 'error' | 'warning' | 'info' | 'hint'
      code: string
      message: string
      pointer?: string
    }>
  }
}

export interface ConvertSceneOptions {
  targetFormat: SceneConversionFormat
  signal?: AbortSignal
  onProgress?: (progress: SceneConversionProgress) => void
}

export interface ConvertSceneResult {
  output: Blob
  report: SceneConversionReport
}

const IDENTITY = new Matrix4().toArray()
const D5_ROOT_TO_Y_UP = new Matrix4().makeRotationX(-Math.PI / 2).toArray()
const D5_TEXTURE_SLOTS: Array<[string, keyof D5Material]> = [
  ['map', 'diffuseMap'],
  ['normalMap', 'normalMap'],
  ['roughnessMap', 'roughnessMap'],
  ['metalnessMap', 'metallicMap'],
  ['alphaMap', 'opacityMap'],
  ['emissiveMap', 'emissiveMap'],
]
const GLB_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/ktx2'])
// MikkTSpace copies all three input streams into WASM. Keep it for ordinary
// assets while retaining a bounded-memory tangent path for dense D5A meshes.
const MIKK_TANGENT_VERTEX_LIMIT = 500_000

export async function convertSceneFile(file: File, options: ConvertSceneOptions): Promise<ConvertSceneResult> {
  const started = performance.now()
  const sourceFormat = sceneFormatFromFilename(file.name)
  if (sourceFormat === options.targetFormat) {
    throw new Error('输入与目标格式相同；请使用 inspect 或指定另一种场景格式')
  }
  const source = await readSceneDocument(file, options)
  throwIfAborted(options.signal)
  if (options.targetFormat === 'dxf') {
    return exportSceneDocumentToDxf(source.scene, file.name, {
      ...options,
      sourceFormat,
      sourceWarnings: source.warnings,
      started,
    })
  }
  const sourceMetrics = inspectSceneDocument(source.scene)
  const diagnostics = [...source.warnings]
  let output: Blob
  let targetWarnings: SceneConversionDiagnostic[]
  let validator: SceneConversionReport['validator']
  if (options.targetFormat === 'd5a') {
    emit(options, 'encode', 0, 1, '编译 D5Mesh v11 与 D5A 容器')
    const result = await writeD5aArchive(source.scene, file.name, {
      signal: options.signal,
      onProgress: (message) => emit(options, 'encode', 0, 1, message),
    })
    output = result.d5a
    targetWarnings = result.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'warning')
      .map((diagnostic) => ({
        severity: 'warning' as const,
        code: diagnostic.code,
        message: diagnostic.message,
        path: diagnostic.path,
      }))
  } else {
    emit(options, 'encode', 0, 1, '写入 GLB 缓冲区、图像与场景目录')
    const result = await writeGlbScene(source.scene)
    output = new Blob([result.bytes], { type: 'model/gltf-binary' })
    targetWarnings = result.diagnostics
    const gltfValidator = await import('gltf-validator')
    const validation = await gltfValidator.validateBytes(new Uint8Array(result.bytes), {
      uri: outputName(file.name, 'glb'),
      format: 'glb',
      maxIssues: 100,
      writeTimestamp: false,
    })
    const validatorMessages = validation.issues.messages.slice(0, 100).map((message) => ({
      severity: message.severity === 0
        ? 'error' as const
        : message.severity === 1
          ? 'warning' as const
          : message.severity === 2
            ? 'info' as const
            : 'hint' as const,
      code: String(message.code),
      message: String(message.message),
      ...(message.pointer ? { pointer: String(message.pointer) } : {}),
    }))
    validator = {
      errors: validation.issues.numErrors,
      warnings: validation.issues.numWarnings,
      infos: validation.issues.numInfos,
      hints: validation.issues.numHints,
      messages: validatorMessages,
    }
    if (validator.errors > 0) {
      const detail = validation.issues.messages
        .filter((message) => message.severity === 0)
        .slice(0, 3)
        .map((message) => `${message.code}${message.pointer ? ` (${message.pointer})` : ''}: ${message.message}`)
        .join('；')
      throw new Error(`Khronos glTF Validator 报告 ${validator.errors} 个错误${detail ? `：${detail}` : ''}`)
    }
    if (validator.warnings > 0) {
      const warnings = validatorMessages.filter((message) => message.severity === 'warning')
      if (warnings.length === 0) {
        targetWarnings.push({
          severity: 'warning',
          code: 'gltf-validator-warning',
          message: `Khronos glTF Validator 报告 ${validator.warnings} 个警告`,
        })
      } else {
        for (const warning of warnings) {
          targetWarnings.push({
            severity: 'warning',
            code: `gltf-validator-${warning.code.toLowerCase()}`,
            message: `Khronos glTF Validator: ${warning.message}`,
            path: warning.pointer,
          })
        }
      }
    }
  }
  throwIfAborted(options.signal)
  emit(options, 'verify', 0, 1, `按 ${options.targetFormat.toUpperCase()} 读取输出以核对结构`)
  const outputFile = new File([output], outputName(file.name, options.targetFormat), { type: output.type })
  const roundTrip = await readSceneDocument(outputFile, options)
  const roundTripMetrics = inspectSceneDocument(roundTrip.scene)
  diagnostics.push(...targetWarnings, ...roundTrip.warnings)
  const checks = compareSceneMetrics(sourceMetrics, roundTripMetrics)
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : diagnostics.some((diagnostic) => diagnostic.severity === 'warning') || checks.some((check) => check.status === 'warning')
      ? 'warning'
      : 'pass'
  emit(options, 'verify', 1, 1, '结构与保真报告完成')
  return {
    output,
    report: {
      schemaVersion: 1,
      documentKind: 'scene',
      operation: 'convert',
      status,
      sourceFormat,
      targetFormat: options.targetFormat,
      sourceName: file.name,
      outputName: outputFile.name,
      outputBytes: output.size,
      elapsedMs: performance.now() - started,
      source: sourceMetrics,
      roundTrip: roundTripMetrics,
      checks,
      warnings: diagnostics,
      validator,
    },
  }
}

export async function exportSceneDocumentToDxf(
  scene: SceneDocument,
  sourceName: string,
  options: Omit<ConvertSceneOptions, 'targetFormat'> & {
    sourceFormat?: SceneReadableFormat
    sourceWarnings?: SceneConversionDiagnostic[]
    started?: number
  } = {},
): Promise<ConvertSceneResult> {
  const started = options.started ?? performance.now()
  const sourceFormat = options.sourceFormat ?? sceneFormatFromFilename(sourceName)
  const sourceMetrics = inspectSceneDocument(scene)
  emit(options, 'encode', 0, sourceMetrics.triangleCount, '写入 ASCII DXF 3DFACE 与材质图层')
  const written = writeDxfScene(scene, {
    signal: options.signal,
    onProgress: (completed, total, message) => emit(options, 'encode', completed, total, message),
  })
  throwIfAborted(options.signal)
  const outputFile = new File([written.dxf], outputName(sourceName, 'dxf'), { type: 'application/dxf' })
  emit(options, 'verify', 0, written.faceCount, '流式回读 DXF 组码、图层与 3DFACE')
  const inspected = await readDxfStructure(outputFile, options.signal)
  const roundTripMetrics = dxfMetrics(inspected.faceCount, inspected.usedLayerCount)
  const diagnostics = [
    ...(options.sourceWarnings ?? []),
    ...written.diagnostics.map(sceneDiagnostic),
    ...inspected.diagnostics.map(sceneDiagnostic),
  ]
  const checks = compareSceneMetrics(sourceMetrics, roundTripMetrics, 'dxf')
  checks.push({
    id: 'dxf-layer-table',
    label: 'DXF 图层声明',
    status: inspected.declaredLayerCount >= inspected.usedLayerCount ? 'pass' : 'fail',
    expected: `${inspected.usedLayerCount} 个已用图层均有声明`,
    actual: `${inspected.declaredLayerCount} 个声明图层`,
  })
  const status = checks.some((check) => check.status === 'fail')
    ? 'fail'
    : diagnostics.some((diagnostic) => diagnostic.severity === 'warning') || checks.some((check) => check.status === 'warning')
      ? 'warning'
      : 'pass'
  emit(options, 'verify', inspected.faceCount, written.faceCount, 'DXF 结构与保真报告完成')
  return {
    output: written.dxf,
    report: {
      schemaVersion: 1,
      documentKind: 'scene',
      operation: 'convert',
      status,
      sourceFormat,
      targetFormat: 'dxf',
      sourceName,
      outputName: outputFile.name,
      outputBytes: written.dxf.size,
      elapsedMs: performance.now() - started,
      source: sourceMetrics,
      roundTrip: roundTripMetrics,
      checks,
      warnings: diagnostics,
    },
  }
}

export async function readSceneDocument(
  file: File,
  options: Pick<ConvertSceneOptions, 'signal' | 'onProgress'> = {},
): Promise<SceneDocumentReadResult> {
  const format = sceneFormatFromFilename(file.name)
  return format === 'd5a' ? readD5aSceneDocument(file, options) : readGlbSceneDocument(file, options)
}

async function readD5aSceneDocument(
  file: File,
  options: Pick<ConvertSceneOptions, 'signal' | 'onProgress'>,
): Promise<SceneDocumentReadResult> {
  emit(options, 'open', 0, file.size, '读取 D5A ZIP 目录')
  const archive = await D5aArchive.open(file, {
    signal: options.signal,
    onprogress: (completed, total) => emit(options, 'open', completed, total, '读取 D5A ZIP 目录'),
  })
  const warnings: SceneConversionDiagnostic[] = archive.inspection.warnings.map((message) => ({
    severity: 'warning', code: 'd5a-container-warning', message,
  }))
  try {
    if (archive.inspection.variant === 'encrypted') {
      throw new Error('官方素材库加密 D5A 仅支持容器检查，不能转换')
    }
    if (archive.inspection.variant === 'legacy-fbx') {
      throw new Error('旧版 FBX D5A 的 Node 转换器尚未接入；请在查看器中检查或等待 FBX 适配器')
    }
    if (archive.inspection.variant !== 'd5mesh') {
      throw new Error('D5A 中没有可转换的普通 D5Mesh 载荷')
    }
    let groupInfo
    if (archive.inspection.groupInfoEntry) {
      groupInfo = parseD5GroupInfo(await archive.text(archive.inspection.groupInfoEntry, options.signal).catch(() => ''))
    }
    const bundles = orderD5Bundles(archive.inspection.bundles, groupInfo?.models.map((model) => model.id) ?? [])
    const bundlesByGroupId = new Map(groupInfo?.models.map((model) => [model.id.toLowerCase(), model]) ?? [])
    const title = groupInfo?.groups.find((group) => !group.parent)?.title || fileStem(file.name)
    const accessors: SceneAccessor[] = []
    const meshes: SceneDocument['meshes'] = []
    const materials: SceneMaterial[] = []
    const textures: SceneTexture[] = []
    const images: SceneImage[] = []
    const nodes: SceneDocument['nodes'] = [{
      id: 'node-root', name: title, matrix: D5_ROOT_TO_Y_UP, children: [], visible: true, extras: {},
    }]
    const imageByArchivePath = new Map<string, string>()
    const textureBySignature = new Map<string, string>()
    const materialByBundleIndex = new Map<string, string>()
    const materialByBundleKey = new Map<string, D5Material>()
    let dimensions: D5Info['dimensions'] | undefined

    const textureFor = async (path: string, transform: D5Material['textureTransform'], colorSpace: string): Promise<string | undefined> => {
      const entry = archive.find(path)
      if (!entry) {
        warnings.push({ severity: 'warning', code: 'd5-texture-missing', path, message: `D5A 中未找到纹理 ${path}` })
        return undefined
      }
      const archivePath = canonicalPath(entry.filename)
      let image = imageByArchivePath.get(archivePath)
      if (!image) {
        emit(options, 'textures', images.length, Math.max(images.length + 1, 1), `保留原始纹理 ${entry.filename}`)
        const data = new Uint8Array(await archive.arrayBuffer(entry.filename, { signal: options.signal }))
        image = `image-${images.length}`
        images.push({
          id: image,
          name: entry.filename,
          mimeType: mimeFromFilename(entry.filename),
          width: 0,
          height: 0,
          depth: 1,
          payload: { kind: 'encoded', data, mimeType: mimeFromFilename(entry.filename), extension: extensionFromFilename(entry.filename) },
        })
        imageByArchivePath.set(archivePath, image)
      }
      const signature = `${image}|${colorSpace}|${transform.repeat.join(',')}|${transform.offset.join(',')}|${transform.rotation}`
      const cached = textureBySignature.get(signature)
      if (cached) return cached
      const id = `texture-${textures.length}`
      const matrix = textureMatrix(transform.repeat, transform.offset, transform.rotation, [0.5, 0.5])
      textures.push({
        id,
        name: entry.filename,
        image,
        sampler: { wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987, anisotropy: 1 },
        colorSpace,
        offset: transform.offset,
        repeat: transform.repeat,
        center: [0.5, 0.5],
        rotation: transform.rotation,
        matrix,
        extras: { d5aPath: entry.filename },
      })
      textureBySignature.set(signature, id)
      return id
    }

    for (const [bundleIndex, bundle] of bundles.entries()) {
      throwIfAborted(options.signal)
      const groupModel = bundlesByGroupId.get(bundle.id.toLowerCase())
      const bundleTitle = groupModel?.title || title
      const info = bundle.infoEntry
        ? parseD5Info(await archive.text(bundle.infoEntry, options.signal), bundleTitle, bundle.prefix)
        : undefined
      dimensions ??= info?.dimensions
      emit(options, 'extract', bundleIndex, Math.max(bundles.length, 1), `解压 ${bundle.meshEntry}`)
      const model = parseD5Mesh(await archive.arrayBuffer(bundle.meshEntry, { signal: options.signal }))
      for (const warning of model.warnings) warnings.push({
        severity: 'warning', code: 'd5mesh-warning', path: bundle.meshEntry, message: warning,
      })
      const bundleNodeId = `node-bundle-${bundleIndex}`
      nodes.push({
        id: bundleNodeId,
        name: bundleTitle,
        matrix: d5TransformMatrix(groupModel?.transform),
        children: [],
        visible: true,
        extras: { d5aBundle: { id: bundle.id, meshEntry: bundle.meshEntry } },
      })
      nodes[0]!.children.push(bundleNodeId)
      const d5Materials = info?.materials ?? []
      for (const material of d5Materials) {
        const id = `material-${materials.length}`
        const bindings: SceneTextureBinding[] = []
        for (const [slot, property] of D5_TEXTURE_SLOTS) {
          const path = material[property]
          if (typeof path !== 'string' || !path) continue
          const texture = await textureFor(path, material.textureTransform, slot === 'map' || slot === 'emissiveMap' ? 'srgb' : 'linear')
          if (texture) bindings.push({ slot, texture, texCoord: 0, scale: slot === 'normalMap' ? material.normalScale?.[0] : undefined })
        }
        const opacity = clamp(material.opacity ?? material.color[3], 0, 1)
        materials.push({
          id,
          name: material.title,
          model: 'D5MeshStandard',
          pbr: {
            baseColor: material.color,
            emissive: [0, 0, 0],
            metalness: clamp(material.metallic ?? 0, 0, 1),
            roughness: clamp(material.roughnessMapStrength ?? material.roughness ?? 0.68, 0, 1),
            opacity,
            alphaMode: material.opacityMap ? 'mask' : opacity < 1 ? 'blend' : 'opaque',
            alphaCutoff: material.opacityMap ? 0.35 : 0,
            doubleSided: true,
            normalScale: material.normalScale,
          },
          textures: bindings,
          extras: jsonRecord({
            d5Material: {
              index: material.index,
              key: material.key,
              id: material.id,
              title: material.title,
              uePath: material.uePath,
              sourceData: material.sourceData,
              textureTransform: material.textureTransform,
              normalScale: material.normalScale,
              roughnessMapStrength: material.roughnessMapStrength,
              roughnessMapInverted: material.roughnessMapInverted,
              parameters: material.parameters,
            },
          }),
        })
        materialByBundleIndex.set(`${bundleIndex}:${material.index}`, id)
        materialByBundleKey.set(`${bundleIndex}:${material.key.toLowerCase()}`, material)
      }
      const attributesByGroup = model.groups.map((group, groupIndex) => addD5Accessors(accessors, group, bundleIndex, groupIndex))
      const meshByGroupMaterial = new Map<string, string>()
      const meshFor = (groupIndex: number, material: D5Material | undefined): string => {
        const materialId = material ? materialByBundleIndex.get(`${bundleIndex}:${material.index}`) : undefined
        const signature = `${groupIndex}:${materialId ?? 'default'}`
        const existing = meshByGroupMaterial.get(signature)
        if (existing) return existing
        const group = model.groups[groupIndex]!
        const data = attributesByGroup[groupIndex]!
        const id = `mesh-${meshes.length}`
        meshes.push({
          id,
          name: group.key,
          primitives: [{
            id: `${id}-primitive-0`, mode: 'triangles', attributes: data.attributes, morphTargets: [],
            indices: data.indices, material: materialId, start: 0, count: data.count,
          }],
        })
        meshByGroupMaterial.set(signature, id)
        return id
      }
      const descriptorsByGroup = model.groups.map(() => [] as number[])
      for (const [descriptorIndex, descriptor] of model.descriptors.entries()) {
        if (descriptor.groupIndex >= 0 && descriptor.groupIndex < model.groups.length) descriptorsByGroup[descriptor.groupIndex]!.push(descriptorIndex)
      }
      for (const [groupIndex, group] of model.groups.entries()) {
        const descriptorIndices = descriptorsByGroup[groupIndex]!
        const candidates = descriptorIndices.length > 0 ? descriptorIndices : [-1]
        for (const descriptorIndex of candidates) {
          const descriptor = descriptorIndex >= 0 ? model.descriptors[descriptorIndex] : undefined
          const material = descriptor
            ? materialByBundleKey.get(`${bundleIndex}:${descriptor.materialName.toLowerCase()}`)
              ?? materialByBundleKey.get(`${bundleIndex}:${group.key.toLowerCase()}`)
              ?? d5Materials[descriptorIndex]
            : materialByBundleKey.get(`${bundleIndex}:${group.key.toLowerCase()}`) ?? d5Materials[groupIndex]
          const nodeId = `node-${nodes.length}`
          nodes.push({
            id: nodeId,
            name: descriptor?.meshName || descriptor?.materialName || group.key,
            matrix: descriptor ? [...descriptor.transform] : IDENTITY,
            children: [],
            mesh: meshFor(groupIndex, material),
            visible: true,
            extras: jsonRecord({
              d5Mesh: { bundleId: bundle.id, groupIndex, descriptorIndex, groupKey: group.key, descriptorKey: descriptor?.key },
            }),
          })
          nodes.find((node) => node.id === bundleNodeId)!.children.push(nodeId)
        }
      }
    }
    const scene: SceneDocument = {
      schemaVersion: 1,
      name: title,
      sourceFormat: 'd5a-d5mesh',
      coordinateSystem: { handedness: 'right', upAxis: 'Y', metersPerUnit: 1 },
      roots: ['node-root'],
      nodes,
      meshes,
      accessors,
      materials,
      textures,
      images,
      skins: [],
      animations: [],
      extras: jsonRecord({
        d5a: { sourceName: file.name, bundleCount: bundles.length },
        ...(dimensions ? { dimensions } : {}),
      }),
    }
    assertValidScene(scene)
    return { format: 'd5a', scene, warnings }
  } finally {
    await archive.close()
  }
}

async function readGlbSceneDocument(
  file: File,
  options: Pick<ConvertSceneOptions, 'signal' | 'onProgress'>,
): Promise<SceneDocumentReadResult> {
  emit(options, 'open', 0, file.size, '读取 GLB 容器')
  const bytes = await file.arrayBuffer()
  throwIfAborted(options.signal)
  const { json, binary } = unpackGlb(bytes)
  const warnings: SceneConversionDiagnostic[] = []
  const extensions = stringArray(json.extensionsUsed)
  for (const extension of ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'EXT_mesh_gpu_instancing']) {
    if (extensions.includes(extension)) {
      throw new Error(`${extension} 需要可选解码器；当前 Node 转换器不会静默丢弃压缩或实例数据`)
    }
  }
  if (arrayRecord(json.skins).length > 0) warnings.push({
    severity: 'warning', code: 'skin-omitted', message: 'GLB 包含 skin；当前 D5A 目标不表达蒙皮，保真报告会标记此语义缺口',
  })
  if (arrayRecord(json.animations).length > 0) warnings.push({
    severity: 'warning', code: 'animation-omitted', message: 'GLB 包含动画；当前 D5A 目标不表达动画，保真报告会标记此语义缺口',
  })
  const bufferViews = arrayRecord(json.bufferViews)
  const rawAccessors = arrayRecord(json.accessors)
  if (arrayRecord(json.buffers).length > 1) throw new Error('当前 GLB 转换器仅支持一个内嵌二进制缓冲区')
  const accessors = rawAccessors.map((accessor, index) => glbAccessor(accessor, index, bufferViews, binary))
  const images: SceneImage[] = []
  const textures: SceneTexture[] = []
  const rawImages = arrayRecord(json.images)
  const rawTextures = arrayRecord(json.textures)
  const rawSamplers = arrayRecord(json.samplers)
  const imageByIndex = new Map<number, string>()
  const textureBySignature = new Map<string, string>()
  const imageFor = (index: number): string => {
    const existing = imageByIndex.get(index)
    if (existing) return existing
    const image = rawImages[index]
    if (!image) throw new Error(`textures[*].source 引用不存在的 images[${index}]`)
    const bufferViewIndex = integer(image.bufferView)
    const mimeType = string(image.mimeType)
    if (bufferViewIndex == null || !mimeType || !GLB_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new Error(`images[${index}] 需要受支持的内嵌 mimeType 与 bufferView`)
    }
    const bufferView = bufferViews[bufferViewIndex]
    if (!bufferView) throw new Error(`images[${index}] 引用不存在的 bufferViews[${bufferViewIndex}]`)
    const offset = integer(bufferView.byteOffset) ?? 0
    const length = positiveInteger(bufferView.byteLength, `bufferViews[${bufferViewIndex}].byteLength`)
    if (offset + length > binary.byteLength) throw new Error(`images[${index}] 的 bufferView 超出 GLB BIN 范围`)
    const id = `image-${images.length}`
    images.push({
      id,
      name: string(image.name) ?? `image-${index}`,
      mimeType,
      width: 0,
      height: 0,
      depth: 1,
      payload: {
        kind: 'encoded', data: new Uint8Array(binary.buffer, binary.byteOffset + offset, length), mimeType, extension: extensionFromMime(mimeType),
      },
    })
    imageByIndex.set(index, id)
    return id
  }
  const textureFor = (index: number, transform: TextureTransform, colorSpace: string): string => {
    const texture = rawTextures[index]
    if (!texture) throw new Error(`纹理引用不存在的 textures[${index}]`)
    const source = integer(texture.source)
    if (source == null) throw new Error(`textures[${index}] 没有内嵌 image source`)
    const image = imageFor(source)
    const signature = `${index}|${colorSpace}|${JSON.stringify(transform)}`
    const existing = textureBySignature.get(signature)
    if (existing) return existing
    const sampler = rawSamplers[integer(texture.sampler) ?? -1]
    const id = `texture-${textures.length}`
    textures.push({
      id,
      name: string(texture.name) ?? `texture-${index}`,
      image,
      sampler: {
        wrapS: integer(sampler?.wrapS) ?? 10497,
        wrapT: integer(sampler?.wrapT) ?? 10497,
        magFilter: integer(sampler?.magFilter) ?? 9729,
        minFilter: integer(sampler?.minFilter) ?? 9987,
        anisotropy: 1,
      },
      colorSpace,
      offset: transform.offset,
      repeat: transform.scale,
      center: [0, 0],
      rotation: transform.rotation,
      matrix: textureMatrix(transform.scale, transform.offset, transform.rotation, [0, 0]),
      extras: jsonRecord(texture.extras ?? {}),
    })
    textureBySignature.set(signature, id)
    return id
  }
  const materials: SceneMaterial[] = []
  const rawMaterials = arrayRecord(json.materials)
  const materialIds = rawMaterials.map((material, index) => {
    const pbr = record(material.pbrMetallicRoughness) ?? {}
    const bindings: SceneTextureBinding[] = []
    const textureBinding = (value: unknown, slot: string, colorSpace: string, scale?: number): void => {
      const info = record(value)
      if (!info) return
      const textureIndex = integer(info.index)
      if (textureIndex == null) throw new Error(`materials[${index}] 的 ${slot} 没有 texture index`)
      const transform = textureTransformFromInfo(info)
      bindings.push({ slot, texture: textureFor(textureIndex, transform, colorSpace), texCoord: transform.texCoord, scale })
    }
    textureBinding(pbr.baseColorTexture, 'map', 'srgb')
    textureBinding(pbr.metallicRoughnessTexture, 'roughnessMap', 'linear')
    textureBinding(pbr.metallicRoughnessTexture, 'metalnessMap', 'linear')
    textureBinding(material.normalTexture, 'normalMap', 'linear', number(material.normalTexture, 'scale'))
    textureBinding(material.occlusionTexture, 'aoMap', 'linear', number(material.occlusionTexture, 'strength'))
    textureBinding(material.emissiveTexture, 'emissiveMap', 'srgb')
    const alphaMode = string(material.alphaMode) === 'MASK' ? 'mask' : string(material.alphaMode) === 'BLEND' ? 'blend' : 'opaque'
    const factor = numberArray(pbr.baseColorFactor, 4, [1, 1, 1, 1]) as [number, number, number, number]
    const emissive = numberArray(material.emissiveFactor, 3, [0, 0, 0]) as [number, number, number]
    const id = `material-${materials.length}`
    materials.push({
      id,
      name: string(material.name) ?? `material-${index}`,
      model: 'glTF metallic-roughness',
      pbr: {
        baseColor: factor,
        emissive,
        metalness: number(pbr, 'metallicFactor') ?? 1,
        roughness: number(pbr, 'roughnessFactor') ?? 1,
        opacity: factor[3],
        alphaMode,
        alphaCutoff: number(material, 'alphaCutoff') ?? 0.5,
        doubleSided: material.doubleSided === true,
        normalScale: number(material.normalTexture, 'scale') != null ? [number(material.normalTexture, 'scale')!, number(material.normalTexture, 'scale')!] : undefined,
      },
      textures: bindings,
      extras: jsonRecord(material.extras ?? {}),
    })
    return id
  })
  const meshes: SceneDocument['meshes'] = []
  const rawMeshes = arrayRecord(json.meshes)
  const meshIds = rawMeshes.map((mesh, meshIndex) => {
    const id = `mesh-${meshes.length}`
    const primitives = arrayRecord(mesh.primitives).map((primitive, primitiveIndex) => {
      if (record(primitive.extensions)?.KHR_draco_mesh_compression) {
        throw new Error(`meshes[${meshIndex}].primitives[${primitiveIndex}] 使用 Draco 压缩`)
      }
      const attributes = Object.fromEntries(Object.entries(record(primitive.attributes) ?? {}).flatMap(([semantic, rawAccessor]) => {
        const accessorIndex = integer(rawAccessor)
        return accessorIndex == null ? [] : [[semantic, accessors[accessorIndex]?.id]]
      }).filter((entry): entry is [string, string] => Boolean(entry[1])))
      const indices = integer(primitive.indices)
      const position = attributes.POSITION ? accessors.find((accessor) => accessor.id === attributes.POSITION) : undefined
      const count = indices == null ? position?.count ?? 0 : accessors[indices]?.count ?? 0
      return {
        id: `${id}-primitive-${primitiveIndex}`,
        mode: glbPrimitiveMode(integer(primitive.mode) ?? 4),
        attributes,
        morphTargets: [],
        indices: indices == null ? undefined : accessors[indices]?.id,
        material: integer(primitive.material) == null ? undefined : materialIds[integer(primitive.material)!],
        start: 0,
        count,
      }
    })
    meshes.push({ id, name: string(mesh.name) ?? `mesh-${meshIndex}`, primitives })
    return id
  })
  const rawNodes = arrayRecord(json.nodes)
  const nodes = rawNodes.map((node, index) => ({
    id: `node-${index}`,
    name: string(node.name) ?? `node-${index}`,
    matrix: glbNodeMatrix(node),
    children: integerArray(node.children).map((child) => `node-${child}`).filter((id) => rawNodes[Number(id.slice(5))]),
    mesh: integer(node.mesh) == null ? undefined : meshIds[integer(node.mesh)!],
    visible: true,
    extras: jsonRecord(node.extras ?? {}),
  }))
  const rawScenes = arrayRecord(json.scenes)
  const selectedScene = rawScenes[integer(json.scene) ?? 0] ?? rawScenes[0]
  const roots = integerArray(selectedScene?.nodes).map((index) => `node-${index}`).filter((id) => rawNodes[Number(id.slice(5))])
  if (roots.length === 0 && nodes.length > 0) {
    const children = new Set(nodes.flatMap((node) => node.children))
    roots.push(...nodes.filter((node) => !children.has(node.id)).map((node) => node.id))
  }
  const scene: SceneDocument = {
    schemaVersion: 1,
    name: string(json.asset && record(json.asset)?.generator) ?? fileStem(file.name),
    sourceFormat: 'glb-2.0',
    coordinateSystem: { handedness: 'right', upAxis: 'Y', metersPerUnit: 1 },
    roots,
    nodes,
    meshes,
    accessors,
    materials,
    textures,
    images,
    skins: [],
    animations: [],
    extras: jsonRecord({ gltfAsset: record(json.asset) ?? {}, sourceExtras: json.extras ?? {} }),
  }
  assertValidScene(scene)
  emit(options, 'parse', 1, 1, 'GLB 场景目录已解析')
  return { format: 'glb', scene, warnings }
}

interface GlbWriteResult {
  bytes: ArrayBuffer
  diagnostics: SceneConversionDiagnostic[]
}

interface MikkTSpaceModule {
  ready: PromiseLike<unknown>
  generateTangents(position: Float32Array, normal: Float32Array, texcoord: Float32Array): Float32Array
}

export async function writeGlbScene(sourceScene: SceneDocument): Promise<GlbWriteResult> {
  const tangentPrepared = await prepareTangentsForGlb(sourceScene)
  const scene = tangentPrepared.scene
  assertValidScene(scene)
  const diagnostics: SceneConversionDiagnostic[] = [...tangentPrepared.diagnostics]
  const assembler = new BinaryAssembler()
  const json: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'd5-tool Node scene converter' },
    scene: 0,
    scenes: [{ nodes: [] as number[] }],
    nodes: [] as Record<string, unknown>[],
    meshes: [] as Record<string, unknown>[],
    materials: [] as Record<string, unknown>[],
    accessors: [] as Record<string, unknown>[],
    bufferViews: [] as Record<string, unknown>[],
    buffers: [{ byteLength: 0 }],
  }
  const accessors = new Map(scene.accessors.map((accessor) => [accessor.id, accessor]))
  const meshes = new Map(scene.meshes.map((mesh) => [mesh.id, mesh]))
  const materials = new Map(scene.materials.map((material) => [material.id, material]))
  const textures = new Map(scene.textures.map((texture) => [texture.id, texture]))
  const images = new Map(scene.images.map((image) => [image.id, image]))
  const emittedAccessors = new Map<string, number>()
  const emittedImages = new Map<string, number>()
  const emittedTextures = new Map<string, number>()
  const emittedSamplers = new Map<string, number>()
  const glbAccessors = json.accessors as Record<string, unknown>[]
  const glbBufferViews = json.bufferViews as Record<string, unknown>[]
  const glbImages: Record<string, unknown>[] = []
  const glbTextures: Record<string, unknown>[] = []
  const glbSamplers: Record<string, unknown>[] = []
  const extensionsUsed = new Set<string>()
  const accessorFor = (id: string, range?: { start: number; count: number }): number => {
    const source = accessors.get(id)
    if (!source) throw new Error(`GLB 写入器找不到访问器 ${id}`)
    const start = range?.start ?? 0
    const count = range?.count ?? source.count
    const cacheKey = `${id}:${start}:${count}`
    const cached = emittedAccessors.get(cacheKey)
    if (cached != null) return cached
    if (start < 0 || count < 0 || start + count > source.count) throw new Error(`访问器 ${id} 的导出范围无效`)
    const compact = start !== 0 || count !== source.count || source.stride !== source.itemSize || source.offset !== 0
    const values = compact ? materializeAccessor(source, start, count) : rawAccessorBytes(source, count)
    const byteOffset = assembler.add(values)
    const bufferView = glbBufferViews.length
    glbBufferViews.push({ buffer: 0, byteOffset, byteLength: values.byteLength, target: source.itemSize === 1 ? 34963 : 34962 })
    const index = glbAccessors.length
    const bounds = source.sourceName === 'position' ? accessorBounds(source, start, count) : undefined
    glbAccessors.push(stripUndefined({
      bufferView,
      componentType: glbComponentType(source.array),
      count,
      type: glbAccessorType(source.itemSize),
      normalized: source.normalized || undefined,
      name: source.sourceName || undefined,
      min: bounds?.min,
      max: bounds?.max,
    }))
    emittedAccessors.set(cacheKey, index)
    return index
  }
  const textureInfo = (binding: SceneTextureBinding): Record<string, unknown> | undefined => {
    const texture = textures.get(binding.texture)
    if (!texture) {
      diagnostics.push({ severity: 'warning', code: 'texture-reference-missing', message: `未写入缺失纹理 ${binding.texture}` })
      return undefined
    }
    const index = textureFor(texture)
    const transform = gltfTextureTransform(texture, binding.texCoord)
    const info: Record<string, unknown> = { index, texCoord: binding.texCoord || undefined }
    if (transform) {
      extensionsUsed.add('KHR_texture_transform')
      info.extensions = { KHR_texture_transform: transform }
    }
    if (binding.scale != null) info.scale = binding.scale
    if (binding.strength != null) info.strength = binding.strength
    return info
  }
  const textureFor = (texture: SceneTexture): number => {
    const cached = emittedTextures.get(texture.id)
    if (cached != null) return cached
    const image = images.get(texture.image)
    if (!image || image.payload.kind !== 'encoded') {
      diagnostics.push({
        severity: 'warning', code: 'texture-transcode-omitted', path: `images.${texture.image}`,
        message: `${texture.name || texture.id} 没有可直接写入 GLB 的编码图像`,
      })
      return -1
    }
    const imageIndex = imageFor(image)
    const samplerKey = JSON.stringify(texture.sampler)
    let sampler = emittedSamplers.get(samplerKey)
    if (sampler == null) {
      sampler = glbSamplers.length
      glbSamplers.push({
        wrapS: glbWrap(texture.sampler.wrapS), wrapT: glbWrap(texture.sampler.wrapT),
        magFilter: glbMagFilter(texture.sampler.magFilter), minFilter: glbMinFilter(texture.sampler.minFilter),
      })
      emittedSamplers.set(samplerKey, sampler)
    }
    const index = glbTextures.length
    glbTextures.push({ sampler, source: imageIndex, name: texture.name || undefined, extras: objectOrUndefined(texture.extras) })
    emittedTextures.set(texture.id, index)
    return index
  }
  const imageFor = (image: SceneImage): number => {
    const cached = emittedImages.get(image.id)
    if (cached != null) return cached
    if (image.payload.kind !== 'encoded') throw new Error(`图像 ${image.id} 没有编码载荷`)
    const byteOffset = assembler.add(image.payload.data)
    const bufferView = glbBufferViews.length
    glbBufferViews.push({ buffer: 0, byteOffset, byteLength: image.payload.data.byteLength })
    const index = glbImages.length
    glbImages.push({ bufferView, mimeType: image.payload.mimeType, name: image.name || undefined })
    emittedImages.set(image.id, index)
    return index
  }
  const materialFor = (materialId: string | undefined): number | undefined => {
    if (!materialId) return undefined
    const existing = (json.materials as Record<string, unknown>[]).findIndex((entry) => entry.extras && record(entry.extras)?.sceneMaterialId === materialId)
    if (existing >= 0) return existing
    const material = materials.get(materialId)
    if (!material) {
      diagnostics.push({ severity: 'warning', code: 'material-reference-missing', message: `未写入缺失材质 ${materialId}` })
      return undefined
    }
    const bySlot = new Map(material.textures.map((binding) => [binding.slot, binding]))
    const roughness = bySlot.get('roughnessMap')
    const metallic = bySlot.get('metalnessMap')
    const metallicRoughness = roughness ?? metallic
    if (roughness && metallic && roughness.texture !== metallic.texture) diagnostics.push({
      severity: 'warning', code: 'metallic-roughness-texture-not-packed', path: `materials.${material.id}`,
      message: `${material.name} 的粗糙度和金属度是不同贴图；Node 路径无法在不解码图像的情况下打包，已优先保留粗糙度贴图`,
    })
    const pbr: Record<string, unknown> = {
      baseColorFactor: material.pbr.baseColor,
      metallicFactor: material.pbr.metalness,
      roughnessFactor: material.pbr.roughness,
    }
    const baseColor = bySlot.get('map')
    if (baseColor) {
      const info = textureInfo(baseColor)
      if (info && info.index !== -1) pbr.baseColorTexture = info
    }
    if (metallicRoughness) {
      const info = textureInfo(metallicRoughness)
      if (info && info.index !== -1) pbr.metallicRoughnessTexture = info
    }
    const normal = bySlot.get('normalMap')
    const occlusion = bySlot.get('aoMap')
    const emissive = bySlot.get('emissiveMap')
    const entry: Record<string, unknown> = {
      name: material.name || undefined,
      pbrMetallicRoughness: pbr,
      emissiveFactor: material.pbr.emissive,
      alphaMode: material.pbr.alphaMode === 'mask' ? 'MASK' : material.pbr.alphaMode === 'blend' ? 'BLEND' : undefined,
      alphaCutoff: material.pbr.alphaMode === 'mask' ? material.pbr.alphaCutoff : undefined,
      doubleSided: material.pbr.doubleSided || undefined,
      extras: { ...material.extras, sceneMaterialId: material.id },
    }
    if (normal) {
      const info = textureInfo(normal)
      if (info && info.index !== -1) entry.normalTexture = info
    }
    if (occlusion) {
      const info = textureInfo(occlusion)
      if (info && info.index !== -1) entry.occlusionTexture = info
    }
    if (emissive) {
      const info = textureInfo(emissive)
      if (info && info.index !== -1) entry.emissiveTexture = info
    }
    const index = (json.materials as Record<string, unknown>[]).length
    ;(json.materials as Record<string, unknown>[]).push(stripUndefined(entry))
    return index
  }
  const meshIndexById = new Map<string, number>()
  for (const mesh of scene.meshes) {
    const primitives = mesh.primitives.flatMap((primitive): Record<string, unknown>[] => {
      if (primitive.mode !== 'triangles') {
        diagnostics.push({ severity: 'warning', code: 'primitive-mode-omitted', message: `${mesh.name} 的 ${primitive.mode} 图元未写入 GLB` })
        return []
      }
      const sourceIndex = primitive.indices ? accessors.get(primitive.indices) : undefined
      const sourcePosition = primitive.attributes.POSITION ? accessors.get(primitive.attributes.POSITION) : undefined
      const rebaseUnindexed = !sourceIndex && (primitive.start !== 0 || primitive.count !== sourcePosition?.count)
      const attributes: Record<string, number> = {}
      for (const [semantic, accessorId] of Object.entries(primitive.attributes)) {
        attributes[semantic] = accessorFor(accessorId, rebaseUnindexed ? { start: primitive.start, count: primitive.count } : undefined)
      }
      const count = primitive.count
      const indices = primitive.indices ? accessorFor(primitive.indices, { start: primitive.start, count }) : undefined
      if (rebaseUnindexed) diagnostics.push({ severity: 'warning', code: 'unindexed-range-rebased', message: `${mesh.name} 的未索引图元范围已重排为独立访问器` })
      return [stripUndefined({
        attributes,
        indices,
        material: materialFor(primitive.material),
        mode: 4,
      })]
    })
    const index = (json.meshes as Record<string, unknown>[]).length
    ;(json.meshes as Record<string, unknown>[]).push({ name: mesh.name || undefined, primitives })
    meshIndexById.set(mesh.id, index)
  }
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]))
  const glbNodes = json.nodes as Record<string, unknown>[]
  const nodeIndexById = new Map<string, number>()
  const nodeFor = (nodeId: string): number => {
    const cached = nodeIndexById.get(nodeId)
    if (cached != null) return cached
    const node = nodesById.get(nodeId)
    if (!node) throw new Error(`GLB 写入器找不到节点 ${nodeId}`)
    const index = glbNodes.length
    nodeIndexById.set(nodeId, index)
    glbNodes.push({})
    const children = node.children.map(nodeFor)
    if (node.instances) {
      const matrixAccessor = accessors.get(node.instances.matrices)
      if (!matrixAccessor) throw new Error(`节点 ${node.id} 缺少实例矩阵`)
      for (let instance = 0; instance < node.instances.count; instance += 1) {
        const instanceIndex = glbNodes.length
        glbNodes.push(stripUndefined({
          name: `${node.name || node.id} #${instance + 1}`,
          matrix: accessorTuple(matrixAccessor, instance, 16),
          mesh: meshIndexById.get(node.mesh ?? ''),
        }))
        children.push(instanceIndex)
      }
      if (node.instances.colors) diagnostics.push({
        severity: 'warning', code: 'instance-color-omitted', message: `${node.name || node.id} 的逐实例颜色未写入 GLB`,
      })
    }
    if (!node.visible) diagnostics.push({
      severity: 'warning', code: 'hidden-node-visible', message: `${node.name || node.id} 在 GLB 中按可见节点写入`,
    })
    glbNodes[index] = stripUndefined({
      name: node.name || undefined,
      matrix: node.matrix,
      mesh: node.instances ? undefined : meshIndexById.get(node.mesh ?? ''),
      children: children.length > 0 ? children : undefined,
      extras: objectOrUndefined(node.extras),
    })
    return index
  }
  ;(json.scenes as Record<string, unknown>[])[0] = { nodes: scene.roots.map(nodeFor), name: scene.name || undefined }
  if (glbImages.length > 0) json.images = glbImages
  if (glbTextures.length > 0) json.textures = glbTextures
  if (glbSamplers.length > 0) json.samplers = glbSamplers
  if (extensionsUsed.size > 0) json.extensionsUsed = [...extensionsUsed]
  ;(json.buffers as Record<string, unknown>[])[0]!.byteLength = assembler.byteLength
  const bytes = packGlb(json, assembler)
  return { bytes, diagnostics }
}

async function prepareTangentsForGlb(scene: SceneDocument): Promise<{
  scene: SceneDocument
  diagnostics: SceneConversionDiagnostic[]
}> {
  const accessorById = new Map(scene.accessors.map((accessor) => [accessor.id, accessor]))
  const materialById = new Map(scene.materials.map((material) => [material.id, material]))
  const diagnostics: SceneConversionDiagnostic[] = []
  const generatedAccessors: SceneAccessor[] = []
  const existingIds = new Set(accessorById.keys())
  let mikk: MikkTSpaceModule | undefined
  let changed = false
  const meshes: SceneDocument['meshes'] = []

  for (const [meshIndex, mesh] of scene.meshes.entries()) {
    let meshChanged = false
    const primitives: typeof mesh.primitives = []
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const material = primitive.material ? materialById.get(primitive.material) : undefined
      const normalBinding = material?.textures.find((binding) => binding.slot === 'normalMap')
      if (!normalBinding || primitive.attributes.TANGENT || primitive.mode !== 'triangles' || primitive.count < 3) {
        primitives.push(primitive)
        continue
      }
      const position = primitive.attributes.POSITION ? accessorById.get(primitive.attributes.POSITION) : undefined
      const normal = primitive.attributes.NORMAL ? accessorById.get(primitive.attributes.NORMAL) : undefined
      const uvSemantic = `TEXCOORD_${normalBinding.texCoord}`
      const uv = primitive.attributes[uvSemantic] ? accessorById.get(primitive.attributes[uvSemantic]) : undefined
      const indices = primitive.indices ? accessorById.get(primitive.indices) : undefined
      if (!position || !normal || !uv || position.itemSize < 3 || normal.itemSize < 3 || uv.itemSize < 2) {
        diagnostics.push({
          severity: 'warning',
          code: 'normal-map-tangent-unavailable',
          path: `meshes.${meshIndex}.primitives.${primitiveIndex}`,
          message: `${mesh.name || mesh.id} 使用法线贴图，但缺少 POSITION、NORMAL 或 ${uvSemantic}，无法生成 TANGENT`,
        })
        primitives.push(primitive)
        continue
      }

      let tangent: Float32Array
      const wholeUnindexedPrimitive = !indices && primitive.start === 0 && primitive.count === position.count &&
        normal.count === position.count && uv.count === position.count
      if (wholeUnindexedPrimitive && position.count <= MIKK_TANGENT_VERTEX_LIMIT) {
        try {
          mikk ??= await loadMikkTSpace()
          tangent = generateMikkTangents(mikk, position, normal, uv)
        } catch {
          tangent = generateStandardTangents(position, normal, uv, undefined, primitive.start, primitive.count)
        }
      } else {
        tangent = generateStandardTangents(position, normal, uv, indices, primitive.start, primitive.count)
      }

      let id = `generated-tangent-${meshIndex}-${primitiveIndex}`
      let suffix = 1
      while (existingIds.has(id)) id = `generated-tangent-${meshIndex}-${primitiveIndex}-${suffix++}`
      const accessor: SceneAccessor = {
        id,
        sourceName: 'tangent',
        array: tangent,
        itemSize: 4,
        count: position.count,
        normalized: false,
        offset: 0,
        stride: 4,
        usage: 35044,
      }
      generatedAccessors.push(accessor)
      accessorById.set(id, accessor)
      existingIds.add(id)
      primitives.push({ ...primitive, attributes: { ...primitive.attributes, TANGENT: id } })
      changed = true
      meshChanged = true
    }
    meshes.push(meshChanged ? { ...mesh, primitives } : mesh)
  }

  return changed
    ? { scene: { ...scene, meshes, accessors: [...scene.accessors, ...generatedAccessors] }, diagnostics }
    : { scene, diagnostics }
}

async function loadMikkTSpace(): Promise<MikkTSpaceModule> {
  const module = await import('three/examples/jsm/libs/mikktspace.module.js') as unknown as MikkTSpaceModule
  await module.ready
  return module
}

function generateMikkTangents(
  mikk: MikkTSpaceModule,
  position: SceneAccessor,
  normal: SceneAccessor,
  uv: SceneAccessor,
): Float32Array {
  const positions = float32AccessorValues(position)
  const normals = float32AccessorValues(normal)
  const uvs = float32AccessorValues(uv)
  const tangent = mikk.generateTangents(positions, normals, uvs)
  if (tangent.length !== position.count * 4) throw new Error('MikkTSpace 返回的 TANGENT 数量无效')
  // glTF uses the opposite handedness sign from the MikkTSpace module default.
  for (let index = 3; index < tangent.length; index += 4) tangent[index] = (tangent[index] ?? 1) * -1
  normalizeTangentFrames(tangent, normal)
  return tangent
}

function generateStandardTangents(
  position: SceneAccessor,
  normal: SceneAccessor,
  uv: SceneAccessor,
  indices: SceneAccessor | undefined,
  start: number,
  count: number,
): Float32Array {
  if (count % 3 !== 0) throw new Error('三角形图元的切线范围不是 3 的倍数')
  const tangent = new Float32Array(position.count * 4)
  const indexFor = (element: number): number => {
    const value = indices ? accessorComponent(indices, element, 0) : element
    if (!Number.isInteger(value) || value < 0 || value >= position.count) throw new Error(`切线生成遇到无效顶点索引 ${value}`)
    return value
  }
  const vector = (accessor: SceneAccessor, vertex: number): [number, number, number] => [
    accessorComponent(accessor, vertex, 0), accessorComponent(accessor, vertex, 1), accessorComponent(accessor, vertex, 2),
  ]
  const texcoord = (vertex: number): [number, number] => [accessorComponent(uv, vertex, 0), accessorComponent(uv, vertex, 1)]
  for (let element = start; element < start + count; element += 3) {
    const a = indexFor(element)
    const b = indexFor(element + 1)
    const c = indexFor(element + 2)
    const p0 = vector(position, a)
    const p1 = vector(position, b)
    const p2 = vector(position, c)
    const uv0 = texcoord(a)
    const uv1 = texcoord(b)
    const uv2 = texcoord(c)
    const edge1x = p1[0] - p0[0]
    const edge1y = p1[1] - p0[1]
    const edge1z = p1[2] - p0[2]
    const edge2x = p2[0] - p0[0]
    const edge2y = p2[1] - p0[1]
    const edge2z = p2[2] - p0[2]
    const du1 = uv1[0] - uv0[0]
    const dv1 = uv1[1] - uv0[1]
    const du2 = uv2[0] - uv0[0]
    const dv2 = uv2[1] - uv0[1]
    const determinant = du1 * dv2 - du2 * dv1
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) continue
    const inverse = 1 / determinant
    const sx = (dv2 * edge1x - dv1 * edge2x) * inverse
    const sy = (dv2 * edge1y - dv1 * edge2y) * inverse
    const sz = (dv2 * edge1z - dv1 * edge2z) * inverse
    const tx = (du1 * edge2x - du2 * edge1x) * inverse
    const ty = (du1 * edge2y - du2 * edge1y) * inverse
    const tz = (du1 * edge2z - du2 * edge1z) * inverse
    const n0 = vector(normal, a)
    const n1 = vector(normal, b)
    const n2 = vector(normal, c)
    const nx = n0[0] + n1[0] + n2[0]
    const ny = n0[1] + n1[1] + n2[1]
    const nz = n0[2] + n1[2] + n2[2]
    const handedness = (ny * sz - nz * sy) * tx + (nz * sx - nx * sz) * ty + (nx * sy - ny * sx) * tz < 0 ? -1 : 1
    for (const vertex of [a, b, c]) {
      const offset = vertex * 4
      tangent[offset] = (tangent[offset] ?? 0) + sx
      tangent[offset + 1] = (tangent[offset + 1] ?? 0) + sy
      tangent[offset + 2] = (tangent[offset + 2] ?? 0) + sz
      tangent[offset + 3] = (tangent[offset + 3] ?? 0) + handedness
    }
  }
  normalizeTangentFrames(tangent, normal)
  return tangent
}

function normalizeTangentFrames(tangent: Float32Array, normal: SceneAccessor): void {
  for (let vertex = 0; vertex < normal.count; vertex += 1) {
    const offset = vertex * 4
    const nx = accessorComponent(normal, vertex, 0)
    const ny = accessorComponent(normal, vertex, 1)
    const nz = accessorComponent(normal, vertex, 2)
    const normalLength = Math.hypot(nx, ny, nz)
    if (normalLength <= 1e-12) {
      tangent[offset] = 1
      tangent[offset + 1] = 0
      tangent[offset + 2] = 0
      tangent[offset + 3] = (tangent[offset + 3] ?? 0) < 0 ? -1 : 1
      continue
    }
    const unitX = nx / normalLength
    const unitY = ny / normalLength
    const unitZ = nz / normalLength
    const tangentX = tangent[offset] ?? 0
    const tangentY = tangent[offset + 1] ?? 0
    const tangentZ = tangent[offset + 2] ?? 0
    const handedness = tangent[offset + 3] ?? 0
    const projection = unitX * tangentX + unitY * tangentY + unitZ * tangentZ
    let tx = tangentX - unitX * projection
    let ty = tangentY - unitY * projection
    let tz = tangentZ - unitZ * projection
    const length = Math.hypot(tx, ty, tz)
    if (length > 1e-12) {
      tx /= length
      ty /= length
      tz /= length
    } else if (Math.abs(unitZ) < 0.9) {
      tx = -unitY
      ty = unitX
      tz = 0
    } else {
      tx = 0
      ty = -unitZ
      tz = unitY
    }
    tangent[offset] = tx
    tangent[offset + 1] = ty
    tangent[offset + 2] = tz
    tangent[offset + 3] = handedness < 0 ? -1 : 1
  }
  // glTF validates tangent.xyz independently. A final normalization also
  // protects encoded output from accumulated Float32 rounding on dense meshes.
  for (let vertex = 0; vertex < normal.count; vertex += 1) {
    const offset = vertex * 4
    const x = tangent[offset] ?? 0
    const y = tangent[offset + 1] ?? 0
    const z = tangent[offset + 2] ?? 0
    const length = Math.hypot(x, y, z)
    if (Number.isFinite(length) && length > 1e-12) {
      tangent[offset] = x / length
      tangent[offset + 1] = y / length
      tangent[offset + 2] = z / length
    } else {
      tangent[offset] = 1
      tangent[offset + 1] = 0
      tangent[offset + 2] = 0
    }
  }
}

function float32AccessorValues(accessor: SceneAccessor): Float32Array {
  if (accessor.array instanceof Float32Array && accessor.offset === 0 && accessor.stride === accessor.itemSize) return accessor.array
  const values = new Float32Array(accessor.count * accessor.itemSize)
  for (let item = 0; item < accessor.count; item += 1) {
    for (let component = 0; component < accessor.itemSize; component += 1) values[item * accessor.itemSize + component] = accessorComponent(accessor, item, component)
  }
  return values
}

function accessorComponent(accessor: SceneAccessor, item: number, component: number): number {
  const value = accessor.array[accessor.offset + item * accessor.stride + component]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function inspectSceneDocument(scene: SceneDocument): SceneDocumentMetrics {
  const meshMap = new Map(scene.meshes.map((mesh) => [mesh.id, mesh]))
  const accessorMap = new Map(scene.accessors.map((accessor) => [accessor.id, accessor]))
  const materialIds = new Set<string>()
  const textureIds = new Set<string>()
  let meshNodeCount = 0
  let primitiveCount = 0
  let triangleCount = 0
  let vertexCount = 0
  let normals = 0
  let uv0 = 0
  let uv1 = 0
  const usedMeshes = new Set<string>()
  for (const node of scene.nodes) {
    const mesh = node.mesh ? meshMap.get(node.mesh) : undefined
    if (!mesh) continue
    const copies = node.instances?.count ?? 1
    meshNodeCount += copies
    usedMeshes.add(mesh.id)
    for (const primitive of mesh.primitives) {
      primitiveCount += copies
      if (primitive.mode === 'triangles') triangleCount += Math.floor(primitive.count / 3) * copies
      if (primitive.material) materialIds.add(primitive.material)
      if (primitive.attributes.POSITION) vertexCount += (accessorMap.get(primitive.attributes.POSITION)?.count ?? 0) * copies
      if (primitive.attributes.NORMAL) normals += copies
      if (primitive.attributes.TEXCOORD_0) uv0 += copies
      if (primitive.attributes.TEXCOORD_1) uv1 += copies
    }
  }
  for (const materialId of materialIds) {
    for (const binding of scene.materials.find((material) => material.id === materialId)?.textures ?? []) textureIds.add(binding.texture)
  }
  return {
    nodeCount: scene.nodes.length,
    meshNodeCount,
    meshDefinitionCount: usedMeshes.size,
    primitiveCount,
    triangleCount,
    vertexCount,
    materialCount: materialIds.size,
    textureCount: textureIds.size,
    imageCount: new Set([...textureIds].map((id) => scene.textures.find((texture) => texture.id === id)?.image).filter(Boolean)).size,
    primitivesWithNormals: normals,
    primitivesWithUv0: uv0,
    primitivesWithUv1: uv1,
    animationCount: scene.animations.length,
    skinCount: scene.skins.length,
  }
}

function compareSceneMetrics(
  source: SceneDocumentMetrics,
  target: SceneDocumentMetrics,
  targetFormat: SceneConversionFormat = 'glb',
): SceneConversionCheck[] {
  const exact = (id: keyof SceneDocumentMetrics, label: string, critical = false): SceneConversionCheck => ({
    id, label,
    status: source[id] === target[id] ? 'pass' : critical ? 'fail' : 'warning',
    expected: source[id], actual: target[id],
  })
  return [
    exact('triangleCount', '三角面', true),
    exact('meshNodeCount', '网格节点'),
    exact('primitiveCount', '图元数量', targetFormat !== 'dxf'),
    exact('materialCount', '已用材质'),
    exact('textureCount', '已用纹理'),
    exact('primitivesWithNormals', '法线覆盖', targetFormat !== 'dxf'),
    exact('primitivesWithUv0', 'UV0 覆盖', targetFormat !== 'dxf'),
    exact('primitivesWithUv1', 'UV1 覆盖'),
    exact('animationCount', '动画数量'),
    exact('skinCount', '蒙皮数量'),
  ]
}

function addD5Accessors(accessors: SceneAccessor[], group: D5MeshGroup, bundleIndex: number, groupIndex: number): {
  attributes: Record<string, string>
  indices?: string
  count: number
} {
  const prefix = `d5-${bundleIndex}-${groupIndex}`
  const legacy = group.interleaved
  const vertexCount = legacy ? legacy.length / 8 : group.positions.length / 3
  if (!Number.isInteger(vertexCount) || vertexCount < 0) throw new Error(`D5Mesh group ${groupIndex} 的顶点数据不完整`)
  const add = (id: string, sourceName: string, array: SceneNumericArray, itemSize: number, offset = 0, stride = itemSize): string => {
    accessors.push({ id, sourceName, array, itemSize, count: vertexCount, normalized: false, offset, stride, usage: 35044 })
    return id
  }
  const attributes = legacy
    ? {
        POSITION: add(`${prefix}-position`, 'position', legacy, 3, 0, 8),
        TEXCOORD_0: add(`${prefix}-uv0`, 'uv', legacy, 2, 3, 8),
        NORMAL: add(`${prefix}-normal`, 'normal', legacy, 3, 5, 8),
      }
    : {
        POSITION: add(`${prefix}-position`, 'position', group.positions, 3),
        NORMAL: add(`${prefix}-normal`, 'normal', group.normals, 3),
        TEXCOORD_0: add(`${prefix}-uv0`, 'uv', group.uvs, 2),
      }
  let indices: string | undefined
  if (group.indices) {
    indices = `${prefix}-indices`
    accessors.push({
      id: indices, sourceName: 'index', array: group.indices, itemSize: 1, count: group.indices.length,
      normalized: false, offset: 0, stride: 1, usage: 35044,
    })
  }
  return { attributes, indices, count: group.indices?.length ?? vertexCount }
}

function d5TransformMatrix(transform?: D5aTransform): number[] {
  if (!transform) return IDENTITY
  return new Matrix4().compose(
    new Vector3(transform.translation.x, transform.translation.y, transform.translation.z),
    new Quaternion(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w),
    new Vector3(transform.scale3D.x, transform.scale3D.y, transform.scale3D.z),
  ).toArray()
}

function orderD5Bundles(bundles: readonly D5aBundleInspection[], groupOrder: readonly string[]): D5aBundleInspection[] {
  const byId = new Map(bundles.map((bundle) => [bundle.id.toLowerCase(), bundle]))
  const ordered = groupOrder.map((id) => byId.get(id.toLowerCase())).filter((bundle): bundle is D5aBundleInspection => Boolean(bundle))
  const seen = new Set(ordered)
  return [...ordered, ...bundles.filter((bundle) => !seen.has(bundle))]
}

function unpackGlb(buffer: ArrayBuffer): { json: Record<string, unknown>; binary: Uint8Array } {
  validateGlb(buffer)
  const view = new DataView(buffer)
  let offset = 12
  let json: Record<string, unknown> | undefined
  let binary: Uint8Array | undefined
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error('GLB 块头不完整')
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    const end = start + length
    if (end > buffer.byteLength) throw new Error('GLB 块长度越过文件结尾')
    if (type === 0x4e4f534a) {
      if (json) throw new Error('GLB 包含多个 JSON 块')
      json = record(JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)).replace(/\u0000+$/g, '')))
      if (!json) throw new Error('GLB JSON 根节点必须是对象')
    } else if (type === 0x004e4942) {
      if (binary) throw new Error('GLB 包含多个 BIN 块')
      binary = new Uint8Array(buffer, start, length)
    }
    offset = end
  }
  if (!json) throw new Error('GLB 缺少 JSON 块')
  if (!binary) binary = new Uint8Array()
  return { json, binary }
}

function glbAccessor(
  raw: Record<string, unknown>,
  index: number,
  bufferViews: Record<string, unknown>[],
  binary: Uint8Array,
): SceneAccessor {
  if (raw.sparse) throw new Error(`accessors[${index}] 使用 sparse；当前 Node 转换器不会静默展开或忽略稀疏数据`)
  const bufferViewIndex = integer(raw.bufferView)
  if (bufferViewIndex == null) throw new Error(`accessors[${index}] 没有内嵌 bufferView`)
  const bufferView = bufferViews[bufferViewIndex]
  if (!bufferView) throw new Error(`accessors[${index}] 引用不存在的 bufferViews[${bufferViewIndex}]`)
  if (record(bufferView.extensions)?.EXT_meshopt_compression) throw new Error(`bufferViews[${bufferViewIndex}] 使用 Meshopt 压缩`)
  const itemSize = glbItemSize(string(raw.type))
  const count = positiveInteger(raw.count, `accessors[${index}].count`)
  const componentType = integer(raw.componentType)
  const ArrayType = typedArrayForComponentType(componentType)
  const componentBytes = ArrayType.BYTES_PER_ELEMENT
  const byteOffset = (integer(bufferView.byteOffset) ?? 0) + (integer(raw.byteOffset) ?? 0)
  const strideBytes = integer(bufferView.byteStride) ?? itemSize * componentBytes
  if (strideBytes < itemSize * componentBytes || strideBytes % componentBytes !== 0) {
    throw new Error(`accessors[${index}] 的 byteStride 无效`)
  }
  if (byteOffset % componentBytes !== 0) throw new Error(`accessors[${index}] 的 byteOffset 未对齐`)
  const stride = strideBytes / componentBytes
  const required = count === 0 ? 0 : (count - 1) * strideBytes + itemSize * componentBytes
  if (byteOffset + required > binary.byteLength) throw new Error(`accessors[${index}] 数据范围超出 GLB BIN 块`)
  return {
    id: `accessor-${index}`,
    sourceName: string(raw.name) ?? `accessor-${index}`,
    array: new ArrayType(binary.buffer, binary.byteOffset + byteOffset, count === 0 ? 0 : (count - 1) * stride + itemSize),
    itemSize,
    count,
    normalized: raw.normalized === true,
    offset: 0,
    stride,
    usage: 35044,
  }
}

function glbNodeMatrix(node: Record<string, unknown>): number[] {
  const matrix = numberArray(node.matrix, 16)
  if (matrix) return matrix
  const translation = numberArray(node.translation, 3, [0, 0, 0])
  const rotation = numberArray(node.rotation, 4, [0, 0, 0, 1])
  const scale = numberArray(node.scale, 3, [1, 1, 1])
  return new Matrix4().compose(
    new Vector3(...translation as [number, number, number]),
    new Quaternion(...rotation as [number, number, number, number]),
    new Vector3(...scale as [number, number, number]),
  ).toArray()
}

interface TextureTransform {
  offset: [number, number]
  scale: [number, number]
  rotation: number
  texCoord: number
}

function textureTransformFromInfo(info: Record<string, unknown>): TextureTransform {
  const extension = record(record(info.extensions)?.KHR_texture_transform) ?? {}
  return {
    offset: numberArray(extension.offset, 2, [0, 0]) as [number, number],
    scale: numberArray(extension.scale, 2, [1, 1]) as [number, number],
    rotation: number(extension, 'rotation') ?? 0,
    texCoord: integer(extension.texCoord) ?? integer(info.texCoord) ?? 0,
  }
}

function glbPrimitiveMode(mode: number): ScenePrimitiveMode {
  if (mode === 0) return 'points'
  if (mode === 1) return 'lines'
  if (mode === 2) return 'line-loop'
  if (mode === 3) return 'line-strip'
  if (mode === 4) return 'triangles'
  throw new Error(`GLB primitive mode ${mode} 当前不支持`)
}

class BinaryAssembler {
  private readonly chunks: Uint8Array[] = []
  byteLength = 0

  add(value: ArrayBufferView): number {
    const padding = (4 - this.byteLength % 4) % 4
    if (padding > 0) {
      this.chunks.push(new Uint8Array(padding))
      this.byteLength += padding
    }
    const offset = this.byteLength
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    this.chunks.push(bytes)
    this.byteLength += bytes.byteLength
    return offset
  }

  get paddedByteLength(): number {
    return this.byteLength + (4 - this.byteLength % 4) % 4
  }

  copyTo(output: Uint8Array): void {
    if (output.byteLength < this.paddedByteLength) throw new Error('GLB BIN 目标缓冲区长度不足')
    let offset = 0
    for (const chunk of this.chunks) {
      output.set(chunk, offset)
      offset += chunk.byteLength
    }
  }
}

function packGlb(json: Record<string, unknown>, binary: BinaryAssembler): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify(stripUndefined(json)))
  const jsonLength = encoded.byteLength + (4 - encoded.byteLength % 4) % 4
  const binaryLength = binary.paddedByteLength
  const output = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength)
  const view = new DataView(output)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, output.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(output, 20, encoded.byteLength).set(encoded)
  new Uint8Array(output, 20 + encoded.byteLength, jsonLength - encoded.byteLength).fill(0x20)
  const binHeader = 20 + jsonLength
  view.setUint32(binHeader, binaryLength, true)
  view.setUint32(binHeader + 4, 0x004e4942, true)
  binary.copyTo(new Uint8Array(output, binHeader + 8, binaryLength))
  return output
}

function materializeAccessor(accessor: SceneAccessor, start: number, count: number): SceneNumericArray {
  const ArrayType = accessor.array.constructor as { new(length: number): SceneNumericArray }
  const output = new ArrayType(count * accessor.itemSize)
  for (let item = 0; item < count; item += 1) {
    for (let component = 0; component < accessor.itemSize; component += 1) {
      output[item * accessor.itemSize + component] = accessor.array[accessor.offset + (start + item) * accessor.stride + component]!
    }
  }
  return output
}

function rawAccessorBytes(accessor: SceneAccessor, count: number): Uint8Array {
  return new Uint8Array(accessor.array.buffer, accessor.array.byteOffset, count * accessor.itemSize * accessor.array.BYTES_PER_ELEMENT)
}

function accessorTuple(accessor: SceneAccessor, index: number, itemSize: number): number[] {
  return Array.from({ length: itemSize }, (_, component) => accessor.array[accessor.offset + index * accessor.stride + component] ?? 0)
}

function accessorBounds(accessor: SceneAccessor, start: number, count: number): { min: number[]; max: number[] } | undefined {
  if (accessor.itemSize < 3 || count === 0) return undefined
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (let index = 0; index < count; index += 1) {
    for (let component = 0; component < 3; component += 1) {
      const value = accessor.array[accessor.offset + (start + index) * accessor.stride + component]
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${accessor.id} 的 POSITION 包含无效数值`)
      min[component] = Math.min(min[component]!, value)
      max[component] = Math.max(max[component]!, value)
    }
  }
  return { min, max }
}

function glbAccessorType(itemSize: number): string {
  if (itemSize === 1) return 'SCALAR'
  if (itemSize === 2) return 'VEC2'
  if (itemSize === 3) return 'VEC3'
  if (itemSize === 4) return 'VEC4'
  if (itemSize === 16) return 'MAT4'
  throw new Error(`GLB 不支持 itemSize ${itemSize}`)
}

function glbItemSize(type: string | undefined): number {
  const map: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
  const itemSize = type ? map[type] : undefined
  if (!itemSize) throw new Error(`GLB accessor type ${type ?? '(missing)'} 当前不支持`)
  return itemSize
}

function glbComponentType(array: SceneNumericArray): number {
  if (array instanceof Int8Array) return 5120
  if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) return 5121
  if (array instanceof Int16Array) return 5122
  if (array instanceof Uint16Array) return 5123
  if (array instanceof Uint32Array) return 5125
  if (array instanceof Float32Array) return 5126
  throw new Error(`${array.constructor.name} 不能写入 GLB accessor`)
}

function typedArrayForComponentType(componentType: number | undefined): {
  new(buffer: ArrayBufferLike, byteOffset: number, length: number): SceneNumericArray
  BYTES_PER_ELEMENT: number
} {
  const types = new Map<number, any>([
    [5120, Int8Array], [5121, Uint8Array], [5122, Int16Array], [5123, Uint16Array], [5125, Uint32Array], [5126, Float32Array],
  ])
  const type = types.get(componentType ?? -1)
  if (!type) throw new Error(`GLB componentType ${String(componentType)} 当前不支持`)
  return type
}

function glbWrap(value: number): number {
  if (value === 33648 || value === 1001) return 33648
  if (value === 33071 || value === 1002) return 33071
  return 10497
}

function glbMagFilter(value: number): number {
  return value === 9728 || value === 1003 ? 9728 : 9729
}

function glbMinFilter(value: number): number {
  const filters = new Set([9728, 9729, 9984, 9985, 9986, 9987])
  if (filters.has(value)) return value
  const three: Record<number, number> = { 1003: 9728, 1006: 9729, 1004: 9984, 1005: 9985, 1007: 9986, 1008: 9987 }
  return three[value] ?? 9987
}

function gltfTextureTransform(texture: SceneTexture, texCoord: number): Record<string, unknown> | undefined {
  const [cx, cy] = texture.center
  const cosine = Math.cos(texture.rotation)
  const sine = Math.sin(texture.rotation)
  const offset: [number, number] = [
    -texture.repeat[0] * (cosine * cx + sine * cy) + cx + texture.offset[0],
    -texture.repeat[1] * (-sine * cx + cosine * cy) + cy + texture.offset[1],
  ]
  const unchanged = approximately(offset[0], 0) && approximately(offset[1], 0)
    && approximately(texture.repeat[0], 1) && approximately(texture.repeat[1], 1)
    && approximately(texture.rotation, 0) && texCoord === 0
  if (unchanged) return undefined
  return stripUndefined({ offset, scale: texture.repeat, rotation: texture.rotation || undefined, texCoord: texCoord || undefined })
}

function textureMatrix(repeat: [number, number], offset: [number, number], rotation: number, center: [number, number]): number[] {
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const [cx, cy] = center
  return [
    repeat[0] * cosine, repeat[0] * sine, 0,
    -repeat[1] * sine, repeat[1] * cosine, 0,
    offset[0] + cx - repeat[0] * (cosine * cx + sine * cy),
    offset[1] + cy - repeat[1] * (-sine * cx + cosine * cy),
    1,
  ]
}

function sceneFormatFromFilename(filename: string): SceneReadableFormat {
  if (/\.d5a$/i.test(filename)) return 'd5a'
  if (/\.glb$/i.test(filename)) return 'glb'
  throw new Error('场景转换仅支持 .d5a 与 .glb 文件')
}

function outputName(source: string, format: SceneConversionFormat): string {
  return `${fileStem(source)}.${format}`
}

function fileStem(value: string): string {
  return value.replace(/\.(?:d5a|glb|dxf)$/i, '')
}

function dxfMetrics(faceCount: number, layerCount: number): SceneDocumentMetrics {
  return {
    nodeCount: layerCount + 1,
    meshNodeCount: layerCount,
    meshDefinitionCount: layerCount,
    primitiveCount: layerCount,
    triangleCount: faceCount,
    vertexCount: faceCount * 3,
    materialCount: layerCount,
    textureCount: 0,
    imageCount: 0,
    primitivesWithNormals: 0,
    primitivesWithUv0: 0,
    primitivesWithUv1: 0,
    animationCount: 0,
    skinCount: 0,
  }
}

function sceneDiagnostic(diagnostic: DxfDiagnostic): SceneConversionDiagnostic {
  return { ...diagnostic }
}

function mimeFromFilename(filename: string): string {
  const extension = extensionFromFilename(filename)
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'avif') return 'image/avif'
  if (extension === 'ktx2') return 'image/ktx2'
  return 'image/png'
}

function extensionFromFilename(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : 'png'
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/avif') return 'avif'
  if (mimeType === 'image/ktx2') return 'ktx2'
  return 'png'
}

function canonicalPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase()
}

function jsonRecord(value: unknown): Record<string, SceneJsonValue> {
  const json = jsonValue(value)
  return json && typeof json === 'object' && !Array.isArray(json) ? json as Record<string, SceneJsonValue> : {}
}

function jsonValue(value: unknown): SceneJsonValue | undefined {
  if (value == null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) return value.flatMap((entry) => {
    const next = jsonValue(entry)
    return next === undefined ? [] : [next]
  })
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      const next = jsonValue(entry)
      return next === undefined ? [] : [[key, next]]
    }))
  }
  return undefined
}

function assertValidScene(scene: SceneDocument): void {
  const errors = validateSceneDocument(scene).filter((issue) => issue.severity === 'error')
  if (errors.length > 0) throw new Error(`场景中间层验证失败: ${errors.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`)
}

function emit(options: Pick<ConvertSceneOptions, 'onProgress'>, phase: SceneConversionProgress['phase'], completed: number, total: number, message: string): void {
  options.onProgress?.({ phase, completed, total, message })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('场景转换已取消', 'AbortError')
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function approximately(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-8
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function arrayRecord(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.flatMap((entry) => record(entry) ? [record(entry)!] : []) : []
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function integer(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function integerArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === 'number' && Number.isInteger(entry)) : []
}

function number(value: unknown, key: string): number | undefined {
  const candidate = record(value)?.[key]
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
}

function numberArray(value: unknown, length: number, fallback?: number[]): number[] | undefined {
  if (value == null) return fallback ? [...fallback] : undefined
  if (!Array.isArray(value) || value.length !== length || value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new Error(`GLB 数组需要 ${length} 个有限数字`)
  }
  return [...value] as number[]
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${label} 必须是非负整数`)
  return value
}

function objectOrUndefined(value: Record<string, SceneJsonValue>): Record<string, SceneJsonValue> | undefined {
  return Object.keys(value).length > 0 ? value : undefined
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined).filter((entry) => entry !== undefined) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)])) as T
  }
  return value
}
