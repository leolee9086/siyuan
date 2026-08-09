import { BlobReader, BlobWriter, TextWriter, ZipReader, type Entry, type FileEntry, type WritableWriter } from '@zip.js/zip.js'
import type { D5aBundleInspection, D5aInspection } from './types'

export interface ArchiveOpenOptions {
  signal?: AbortSignal
  onprogress?: (loaded: number, total: number) => void
}

export class D5aArchive {
  readonly file: File
  readonly inspection: D5aInspection
  private readonly reader: ZipReader<Blob>
  private readonly entries: Entry[]
  private readonly entriesByPath: Map<string, FileEntry>
  private closed = false

  private constructor(file: File, reader: ZipReader<Blob>, entries: Entry[], inspection: D5aInspection) {
    this.file = file
    this.reader = reader
    this.entries = entries
    this.inspection = inspection
    this.entriesByPath = new Map(
      entries
        .filter((entry): entry is FileEntry => !entry.directory)
        .map((entry) => [canonicalPath(entry.filename), entry]),
    )
  }

  static async open(file: File, options: ArchiveOpenOptions = {}): Promise<D5aArchive> {
    if (!file.name.toLowerCase().endsWith('.d5a')) {
      throw new Error('请选择 .d5a 文件')
    }
    const reader = new ZipReader(new BlobReader(file), {
      filenameEncoding: 'gbk',
      useWebWorkers: true,
      checkAmbiguity: true,
      signal: options.signal,
    })
    try {
      const entries = await reader.getEntries({
        onprogress: (loaded, total) => options.onprogress?.(loaded, total),
      })
      return new D5aArchive(file, reader, entries, inspectEntries(entries))
    } catch (error) {
      await reader.close().catch(() => undefined)
      throw error
    }
  }

  has(path: string): boolean {
    this.assertOpen()
    return this.entriesByPath.has(canonicalPath(path))
  }

  find(path: string): FileEntry | undefined {
    this.assertOpen()
    const canonical = canonicalPath(path)
    const exact = this.entriesByPath.get(canonical)
    if (exact) return exact
    const suffix = `/${canonical}`
    return [...this.entriesByPath.entries()].find(([entryPath]) => entryPath.endsWith(suffix))?.[1]
  }

  async arrayBuffer(
    path: string,
    options: { signal?: AbortSignal; onprogress?: (loaded: number, total: number) => void } = {},
  ): Promise<ArrayBuffer> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于加密容器中`)
    return entry.arrayBuffer(options)
  }

  async text(path: string, signal?: AbortSignal): Promise<string> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于加密容器中`)
    return entry.getData(new TextWriter('utf-8'), { signal })
  }

  async blob(path: string, mimeType?: string, signal?: AbortSignal): Promise<Blob> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于加密容器中`)
    return entry.getData(new BlobWriter(mimeType ?? mimeFromFilename(entry.filename)), { signal })
  }

  async writeTo(
    path: string,
    writable: WritableStream,
    options: { signal?: AbortSignal; onprogress?: (loaded: number, total: number) => void } = {},
  ): Promise<void> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于加密容器中`)
    await entry.getData({ writable } satisfies WritableWriter, options)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.reader.close()
  }

  private requireFile(path: string): FileEntry {
    const entry = this.find(path)
    if (!entry) throw new Error(`D5A 中未找到 ${path}`)
    return entry
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('D5A 文件已关闭')
  }
}

export function inspectEntries(entries: Entry[]): D5aInspection {
  const files = entries.filter((entry): entry is FileEntry => !entry.directory)
  const lowerNames = files.map((entry) => canonicalPath(entry.filename))
  const bundles = collectMeshBundles(files)
  const primaryBundle = bundles[0]
  const mesh = primaryBundle ? findExact(files, primaryBundle.meshEntry) : undefined
  const fbxFiles = files.filter((entry) => canonicalPath(entry.filename).endsWith('.fbx'))
  const fbx = fbxFiles[0]
  const info = primaryBundle?.infoEntry ? findExact(files, primaryBundle.infoEntry) : findByBasename(files, 'info.json')
  const icon = findExact(files, 'icon.png') ?? (primaryBundle?.iconEntry ? findExact(files, primaryBundle.iconEntry) : undefined)
  const materialXml = primaryBundle?.materialXmlEntry
    ? findExact(files, primaryBundle.materialXmlEntry)
    : findByBasename(files, 'd5material.xml')
  const groupInfo = findExact(files, 'groupinfo.json')
  const critical = [
    ...bundles.map((bundle) => findExact(files, bundle.meshEntry)),
    ...bundles.flatMap((bundle) => bundle.infoEntry ? [findExact(files, bundle.infoEntry)] : []),
    fbx,
    groupInfo,
  ].filter((entry): entry is FileEntry => Boolean(entry))
  const encrypted = critical.some((entry) => entry.encrypted)
  const warnings: string[] = []

  if (fbxFiles.length > 1) warnings.push(`容器包含 ${fbxFiles.length} 个 FBX，仅加载第一个`)
  if (bundles.length > 1) {
    warnings.push(`检测到 ${bundles.length} 个 D5Mesh 子包，将按根分组信息合并加载`)
  }
  if (lowerNames.length === 0) warnings.push('容器内没有文件条目')

  const variant = encrypted
    ? 'encrypted'
    : mesh
      ? 'd5mesh'
      : fbx
        ? 'legacy-fbx'
        : 'unknown'

  return {
    variant,
    entries: entries.map((entry) => ({
      filename: entry.filename,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      encrypted: entry.encrypted,
      directory: entry.directory,
    })),
    totalUncompressedBytes: files.reduce((total, entry) => total + entry.uncompressedSize, 0),
    bundles,
    meshEntry: mesh?.filename,
    fbxEntry: fbx?.filename,
    infoEntry: info?.filename,
    iconEntry: icon?.filename,
    materialXmlEntry: materialXml?.filename,
    groupInfoEntry: groupInfo?.filename,
    warnings,
  }
}

function collectMeshBundles(files: FileEntry[]): D5aBundleInspection[] {
  const meshesByPrefix = new Map<string, FileEntry[]>()
  for (const entry of files) {
    if (!canonicalPath(entry.filename).endsWith('.d5mesh')) continue
    const prefix = parentPath(entry.filename)
    const key = canonicalPath(prefix)
    const meshes = meshesByPrefix.get(key) ?? []
    meshes.push(entry)
    meshesByPrefix.set(key, meshes)
  }

  return [...meshesByPrefix.values()].map((meshes) => {
    const mesh = meshes.find((entry) => basename(entry.filename) === '1.d5mesh') ?? meshes[0]!
    const prefix = parentPath(mesh.filename)
    const lookup = (filename: string) => findExact(files, prefix ? `${prefix}/${filename}` : filename)
    return {
      id: prefix || '',
      prefix,
      meshEntry: mesh.filename,
      infoEntry: lookup('info.json')?.filename,
      iconEntry: lookup('icon.png')?.filename,
      materialXmlEntry: lookup('d5material.xml')?.filename,
    }
  })
}

function findByBasename(entries: FileEntry[], basename: string): FileEntry | undefined {
  const lower = basename.toLowerCase()
  return entries.find((entry) => basenameOf(entry.filename) === lower)
}

function findExact(entries: FileEntry[], path: string): FileEntry | undefined {
  const expected = canonicalPath(path)
  return entries.find((entry) => canonicalPath(entry.filename) === expected)
}

function parentPath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '')
  const separator = normalized.lastIndexOf('/')
  return separator >= 0 ? normalized.slice(0, separator) : ''
}

function basename(path: string): string {
  return basenameOf(path)
}

function basenameOf(path: string): string {
  return canonicalPath(path).split('/').at(-1) ?? ''
}

function canonicalPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase()
}

function mimeFromFilename(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'xml') return 'application/xml'
  return 'application/octet-stream'
}
