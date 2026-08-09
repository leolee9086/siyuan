import { D5aArchive } from './d5a-archive'
import { parseD5GroupInfo } from './group-info'
import { parseD5Info } from './materials'
import { parseD5MeshInWorker } from './parse-worker'
import type {
  D5aBundleInspection,
  D5aGroupInfo,
  D5aInspection,
  D5aResourceBudget,
  D5aTransform,
  D5Info,
  D5MeshModel,
  LoadProgress,
} from './types'

export interface LoadedD5aBundle {
  id: string
  title: string
  meshEntry: string
  infoEntry?: string
  mesh: D5MeshModel
  info?: D5Info
  transform?: D5aTransform
  parseMs: number
}

export interface LoadedD5aDocument {
  kind: 'd5a'
  file: File
  archive: D5aArchive
  inspection: D5aInspection
  title: string
  bundles: LoadedD5aBundle[]
  groupInfo?: D5aGroupInfo
  /** The first D5Mesh bundle, retained for single-bundle compatibility. */
  info?: D5Info
  mesh?: D5MeshModel
  legacyFbx?: ArrayBuffer
  legacyMaterialXml?: string
  iconUrl?: string
  parseMs?: number
  budget: D5aResourceBudget
  warnings: string[]
  close(): Promise<void>
}

export interface LoadD5aOptions {
  signal?: AbortSignal
  onProgress?: (progress: LoadProgress) => void
}

export async function loadD5aDocument(
  file: File,
  options: LoadD5aOptions = {},
): Promise<LoadedD5aDocument> {
  const { signal, onProgress } = options
  throwIfAborted(signal)
  emit(onProgress, 'inspect', 0, file.size, '检查 D5A 容器')
  const archive = await D5aArchive.open(file, {
    signal,
    onprogress: (loaded, total) => emit(onProgress, 'inspect', loaded, total, '读取文件目录'),
  })
  let iconUrl: string | undefined

  try {
    const { inspection } = archive
    if (inspection.variant === 'encrypted') {
      throw new Error('此 D5A 使用官方素材库加密容器，当前版本仅检查文件信息')
    }
    if (inspection.variant === 'unknown') {
      throw new Error('容器中未发现 D5Mesh 或 FBX 模型')
    }

    emit(onProgress, 'metadata', 0, 1, '读取模型信息')
    const [groupInfoText, materialXml, iconBlob] = await Promise.all([
      inspection.groupInfoEntry ? archive.text(inspection.groupInfoEntry, signal).catch(() => undefined) : undefined,
      inspection.materialXmlEntry
        ? archive.text(inspection.materialXmlEntry, signal).catch(() => undefined)
        : undefined,
      inspection.iconEntry
        ? archive.blob(inspection.iconEntry, undefined, signal).catch(() => undefined)
        : undefined,
    ])
    throwIfAborted(signal)
    const groupInfo = groupInfoText ? parseD5GroupInfo(groupInfoText) : undefined
    const bundleInputs = await readBundleInputs(archive, inspection.bundles, groupInfo, fileStem(file.name), signal)
    throwIfAborted(signal)
    if (iconBlob) iconUrl = URL.createObjectURL(iconBlob)

    const bundles: LoadedD5aBundle[] = []
    let legacyFbx: ArrayBuffer | undefined
    let parseMs = 0

    if (inspection.variant === 'd5mesh' && bundleInputs.length > 0) {
      const totalMeshBytes = bundleInputs.reduce(
        (total, bundle) => total + (findInspectionEntry(inspection, bundle.meshEntry)?.uncompressedSize ?? 0),
        0,
      )
      let extractedBytes = 0
      for (const [index, bundle] of bundleInputs.entries()) {
        const entry = findInspectionEntry(inspection, bundle.meshEntry)
        const size = entry?.uncompressedSize ?? 1
        const label = bundleInputs.length > 1
          ? `解压 D5Mesh ${index + 1}/${bundleInputs.length}`
          : '解压 D5Mesh'
        emit(onProgress, 'extract', extractedBytes, Math.max(totalMeshBytes, 1), label)
        const buffer = await archive.arrayBuffer(bundle.meshEntry, {
          signal,
          onprogress: (loaded) => emit(
            onProgress,
            'extract',
            Math.min(extractedBytes + loaded, totalMeshBytes),
            Math.max(totalMeshBytes, 1),
            label,
          ),
        })
        throwIfAborted(signal)
        emit(onProgress, 'parse', index, bundleInputs.length, `解析 D5Mesh ${index + 1}/${bundleInputs.length}`)
        const result = await parseD5MeshInWorker(buffer, signal)
        parseMs += result.elapsedMs
        bundles.push({
          ...bundle,
          mesh: result.model,
          parseMs: result.elapsedMs,
        })
        extractedBytes += size
      }
    } else if (inspection.variant === 'legacy-fbx' && inspection.fbxEntry) {
      const entry = inspection.entries.find((item) => item.filename === inspection.fbxEntry)
      emit(onProgress, 'extract', 0, entry?.uncompressedSize ?? 1, '解压旧版 FBX')
      legacyFbx = await archive.arrayBuffer(inspection.fbxEntry, {
        signal,
        onprogress: (loaded, total) => emit(onProgress, 'extract', loaded, total, '解压旧版 FBX'),
      })
      throwIfAborted(signal)
    }

    const title = groupInfo?.groups.find((group) => !group.parent)?.title
      ?? bundleInputs[0]?.title
      ?? fileStem(file.name)
    const info = bundles[0]?.info
    const mesh = bundles[0]?.mesh
    const budget = calculateResourceBudget(file, inspection, bundles.map((bundle) => bundle.mesh), legacyFbx, bundles.map((bundle) => bundle.info).filter((item): item is D5Info => Boolean(item)))
    const warnings = [
      ...inspection.warnings,
      ...bundles.flatMap((bundle) => bundle.mesh.warnings.map((warning) => `${bundle.title}: ${warning}`)),
      ...budget.notes,
    ]
    if (inspection.bundles.length > 1 && !groupInfo) {
      warnings.push('多子包容器缺少可用 groupinfo.json；子包将按各自局部坐标显示')
    }
    emit(onProgress, 'ready', 1, 1, '模型数据就绪')

    return {
      kind: 'd5a',
      file,
      archive,
      inspection,
      title,
      bundles,
      groupInfo,
      info,
      mesh,
      legacyFbx,
      legacyMaterialXml: materialXml,
      iconUrl,
      parseMs,
      budget,
      warnings,
      async close() {
        if (iconUrl) URL.revokeObjectURL(iconUrl)
        await archive.close()
      },
    }
  } catch (error) {
    if (iconUrl) URL.revokeObjectURL(iconUrl)
    await archive.close().catch(() => undefined)
    throw error
  }
}

export function calculateResourceBudget(
  file: File,
  inspection: D5aInspection,
  meshes: readonly D5MeshModel[] = [],
  legacyFbx?: ArrayBuffer,
  infos: readonly D5Info[] = [],
): D5aResourceBudget {
  let geometryCpuBytes = legacyFbx?.byteLength ?? 0
  let geometryGpuBytes = 0
  for (const mesh of meshes) {
    for (const group of mesh.groups) {
      geometryCpuBytes +=
        (group.interleaved?.byteLength ?? 0) +
        group.positions.byteLength +
        group.normals.byteLength +
        group.uvs.byteLength +
        group.extra.byteLength +
        (group.indices?.byteLength ?? 0)
      geometryGpuBytes +=
        (group.interleaved?.byteLength ?? 0) +
        group.positions.byteLength +
        group.normals.byteLength +
        group.uvs.byteLength +
        (group.indices?.byteLength ?? 0)
    }
  }
  const entriesByPath = new Map(
    inspection.entries.filter((entry) => !entry.directory).map((entry) => [canonicalPath(entry.filename), entry]),
  )
  const textureSourceBytes = [...declaredTexturePaths(infos)]
    .map((path) => entriesByPath.get(canonicalPath(path))?.uncompressedSize ?? 0)
    .reduce((total, bytes) => total + bytes, 0)
  const triangleCount = meshes.reduce((total, mesh) => total + mesh.triangleCount, 0)
  const notes: string[] = []
  if (file.size >= 250 * 1024 * 1024) notes.push('压缩包超过 250 MB，首次载入会占用较多内存')
  if (inspection.totalUncompressedBytes >= 1024 * 1024 * 1024) notes.push('解包体积超过 1 GB')
  if (triangleCount >= 5_000_000) notes.push('模型超过 500 万三角面，建议降低像素比并关闭线框')
  if (geometryGpuBytes >= 512 * 1024 * 1024) notes.push('几何显存估算超过 512 MB')
  if (textureSourceBytes >= 512 * 1024 * 1024) notes.push('源纹理总量超过 512 MB，载入时将限制分辨率')
  const severity = notes.some((note) => /1 GB|500 万|512 MB/.test(note))
    ? 'heavy'
    : notes.length > 0
      ? 'elevated'
      : 'normal'
  return {
    archiveBytes: file.size,
    uncompressedBytes: inspection.totalUncompressedBytes,
    geometryCpuBytes,
    geometryGpuBytes,
    textureSourceBytes,
    severity,
    notes,
  }
}

export function declaredTexturePaths(infos: readonly D5Info[]): Set<string> {
  const paths = new Set<string>()
  for (const info of infos) {
    for (const material of info.materials) {
      for (const path of [
        material.diffuseMap,
        material.normalMap,
        material.roughnessMap,
        material.metallicMap,
        material.opacityMap,
        material.emissiveMap,
      ]) {
        if (path) paths.add(canonicalPath(path))
      }
    }
  }
  return paths
}

async function readBundleInputs(
  archive: D5aArchive,
  bundles: readonly D5aBundleInspection[],
  groupInfo: D5aGroupInfo | undefined,
  fallbackTitle: string,
  signal?: AbortSignal,
): Promise<Omit<LoadedD5aBundle, 'mesh' | 'parseMs'>[]> {
  const groupModels = new Map(groupInfo?.models.map((model) => [model.id.toLowerCase(), model]))
  const ordered = orderBundles(bundles, groupInfo)
  return Promise.all(ordered.map(async (bundle) => {
    const groupModel = groupModels.get(bundle.id.toLowerCase())
    const infoText = bundle.infoEntry ? await archive.text(bundle.infoEntry, signal).catch(() => undefined) : undefined
    return {
      id: bundle.id,
      title: groupModel?.title || fallbackTitle,
      meshEntry: bundle.meshEntry,
      infoEntry: bundle.infoEntry,
      info: infoText ? parseD5Info(infoText, groupModel?.title || fallbackTitle, bundle.prefix) : undefined,
      transform: groupModel?.transform,
    }
  }))
}

function orderBundles(
  bundles: readonly D5aBundleInspection[],
  groupInfo: D5aGroupInfo | undefined,
): D5aBundleInspection[] {
  if (!groupInfo?.models.length) return [...bundles]
  const byId = new Map(bundles.map((bundle) => [bundle.id.toLowerCase(), bundle]))
  const ordered = groupInfo.models
    .map((model) => byId.get(model.id.toLowerCase()))
    .filter((bundle): bundle is D5aBundleInspection => Boolean(bundle))
  const selected = new Set(ordered)
  return [...ordered, ...bundles.filter((bundle) => !selected.has(bundle))]
}

function findInspectionEntry(inspection: D5aInspection, path: string) {
  const target = canonicalPath(path)
  return inspection.entries.find((entry) => canonicalPath(entry.filename) === target)
}

function canonicalPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase()
}

function emit(
  callback: LoadD5aOptions['onProgress'],
  phase: LoadProgress['phase'],
  loaded: number,
  total: number,
  label: string,
): void {
  callback?.({ phase, loaded, total, label })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}

function fileStem(filename: string): string {
  return filename.replace(/\.d5a$/i, '')
}
