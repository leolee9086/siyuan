import {
  BlobReader,
  BlobWriter,
  Uint8ArrayWriter,
  ZipReader,
  type Entry,
  type FileEntry,
} from '@zip.js/zip.js'
import type { D5mArchiveEntry, D5mInspection } from './types'

const IMAGE_EXTENSIONS = /\.(?:avif|bmp|dds|exr|hdr|jpe?g|ktx2?|png|tga|tiff?|webp)$/i

export interface D5mArchiveOpenOptions {
  signal?: AbortSignal
  onprogress?: (loaded: number, total: number) => void
}

export class D5mArchive {
  readonly file: File
  readonly inspection: D5mInspection
  private readonly reader: ZipReader<Blob>
  private readonly entriesByPath: Map<string, FileEntry>
  private closed = false

  private constructor(file: File, reader: ZipReader<Blob>, entries: Entry[]) {
    this.file = file
    this.reader = reader
    this.inspection = inspectD5mEntries(entries)
    this.entriesByPath = new Map(
      entries
        .filter((entry): entry is FileEntry => !entry.directory)
        .map((entry) => [canonicalD5mPath(entry.filename), entry]),
    )
  }

  static async open(file: File, options: D5mArchiveOpenOptions = {}): Promise<D5mArchive> {
    if (!file.name.toLowerCase().endsWith('.d5m')) throw new Error('请选择 .d5m 文件')
    const reader = new ZipReader(new BlobReader(file), {
      filenameEncoding: 'gbk',
      useWebWorkers: typeof Worker !== 'undefined',
      checkAmbiguity: true,
      signal: options.signal,
    })
    try {
      const entries = await reader.getEntries({
        onprogress: (loaded, total) => options.onprogress?.(loaded, total),
      })
      return new D5mArchive(file, reader, entries)
    } catch (error) {
      await reader.close().catch(() => undefined)
      throw error
    }
  }

  find(path: string): D5mArchiveEntry | undefined {
    this.assertOpen()
    const entry = this.findFile(path)
    return entry ? toEntryInfo(entry) : undefined
  }

  resolve(path: string): string | undefined {
    this.assertOpen()
    return this.findFile(path)?.filename
  }

  async bytes(path: string, signal?: AbortSignal): Promise<Uint8Array> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于受保护容器中`)
    return entry.getData(new Uint8ArrayWriter(), { signal })
  }

  async blob(path: string, mimeType?: string, signal?: AbortSignal): Promise<Blob> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于受保护容器中`)
    return entry.getData(new BlobWriter(mimeType ?? mimeFromFilename(entry.filename)), { signal })
  }

  async pipe(path: string, writable: WritableStream, signal?: AbortSignal): Promise<void> {
    const entry = this.requireFile(path)
    if (entry.encrypted) throw new Error(`${entry.filename} 位于受保护容器中`)
    await entry.getData(writable, { signal, useWebWorkers: false })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.reader.close()
  }

  private findFile(path: string): FileEntry | undefined {
    const canonical = canonicalD5mPath(path)
    const exact = this.entriesByPath.get(canonical)
    if (exact) return exact
    const suffix = `/${canonical}`
    return [...this.entriesByPath.entries()].find(([entryPath]) => entryPath.endsWith(suffix))?.[1]
  }

  private requireFile(path: string): FileEntry {
    this.assertOpen()
    const entry = this.findFile(path)
    if (!entry) throw new Error(`D5M 中未找到 ${path}`)
    return entry
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('D5M 文件已关闭')
  }
}

export function inspectD5mEntries(entries: Entry[]): D5mInspection {
  const files = entries.filter((entry): entry is FileEntry => !entry.directory)
  const material = findByBasename(files, 'material.json')
  const icon = files.find((entry) => /^icon\.(?:jpe?g|png|webp)$/i.test(basename(entry.filename)))
  const summary = findByBasename(files, 'summary.txt')
  const textureEntries = files
    .filter((entry) => IMAGE_EXTENSIONS.test(entry.filename) && entry !== icon)
    .map((entry) => entry.filename)
  const warnings: string[] = []
  if (!material) warnings.push('容器中没有 material.json')
  if (files.length === 0) warnings.push('容器中没有文件条目')
  return {
    entries: entries.map(toEntryInfo),
    materialEntry: material?.filename,
    iconEntry: icon?.filename,
    summaryEntry: summary?.filename,
    textureEntries,
    totalUncompressedBytes: files.reduce((total, entry) => total + entry.uncompressedSize, 0),
    protected: Boolean(material?.encrypted),
    warnings,
  }
}

export function canonicalD5mPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase()
}

function findByBasename(entries: FileEntry[], name: string): FileEntry | undefined {
  const lower = name.toLowerCase()
  return entries.find((entry) => basename(entry.filename) === lower)
}

function basename(value: string): string {
  return canonicalD5mPath(value).split('/').at(-1) ?? ''
}

function toEntryInfo(entry: Entry): D5mArchiveEntry {
  return {
    filename: entry.filename,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
    compressionMethod: entry.compressionMethod,
    signature: entry.signature,
    encrypted: entry.encrypted,
    directory: entry.directory,
  }
}

function mimeFromFilename(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'tif' || extension === 'tiff') return 'image/tiff'
  if (extension === 'json') return 'application/json'
  return 'application/octet-stream'
}
