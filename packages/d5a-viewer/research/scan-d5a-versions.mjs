import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { createInflateRaw, inflateRawSync } from 'node:zlib'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const MAX_EOCD_BYTES = 65_557
const PROTECTED_D5MESH_MARKER = 0x206c6c41
const textDecoders = {
  utf8: new TextDecoder('utf-8'),
  gbk: new TextDecoder('gbk'),
}

const roots = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='))
const concurrencyArgument = process.argv.find((argument) => argument.startsWith('--concurrency='))
const outputPath = outputArgument?.slice('--output='.length) ?? 'research/output/d5a-version-scan.json'
const concurrency = Number(concurrencyArgument?.slice('--concurrency='.length) ?? 12)

if (roots.length === 0) {
  console.error('Usage: node research/scan-d5a-versions.mjs ROOT... [--output=FILE] [--concurrency=12]')
  process.exit(1)
}

const files = []
for (const root of roots) {
  for await (const filename of walk(root)) {
    if (filename.toLowerCase().endsWith('.d5a')) files.push(filename)
  }
}

const startedAt = Date.now()
let completed = 0
const records = await mapLimit(files, concurrency, async (filename) => {
  let record
  try {
    record = await inspectD5a(filename)
  } catch (error) {
    record = {
      file: filename,
      variant: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
  completed += 1
  if (completed % 250 === 0 || completed === files.length) {
    const elapsed = Math.max(1, (Date.now() - startedAt) / 1000)
    console.log(`${completed}/${files.length} (${(completed / elapsed).toFixed(1)} files/s)`)
  }
  return record
})

const report = {
  generatedAt: new Date().toISOString(),
  roots,
  elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
  totalFiles: records.length,
  summary: summarize(records),
  records,
}
await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.summary, null, 2))

async function inspectD5a(filename) {
  const handle = await fs.open(filename, 'r')
  try {
    const stat = await handle.stat()
    const entries = await readCentralDirectory(handle, stat.size)
    const mesh = entries.find((entry) => entry.name.toLowerCase().endsWith('.d5mesh'))
    const fbx = entries.find((entry) => entry.name.toLowerCase().endsWith('.fbx'))
    const info = entries.find((entry) => basename(entry.name) === 'info.json')
    const encrypted = [mesh, fbx, info].some((entry) => entry?.encrypted)
    let meshVersion
    let infoVersion
    let infoError
    if (mesh && !mesh.encrypted) meshVersion = await readMeshVersion(handle, filename, mesh)
    const protectedMesh = meshVersion === PROTECTED_D5MESH_MARKER
    if (info && !info.encrypted && info.uncompressedSize <= 16 * 1024 * 1024) {
      try {
        const bytes = await readEntry(handle, info)
        const json = JSON.parse(new TextDecoder().decode(bytes))
        if (Number.isFinite(json.infoVersion)) infoVersion = json.infoVersion
      } catch (error) {
        infoError = error instanceof Error ? error.message : String(error)
      }
    }
    return {
      file: filename,
      bytes: stat.size,
      variant: encrypted ? 'encrypted' : protectedMesh ? 'protected' : mesh ? 'd5mesh' : fbx ? 'legacy-fbx' : 'unknown',
      meshVersion: protectedMesh ? undefined : meshVersion,
      protectedMesh,
      infoVersion,
      meshBytes: mesh?.uncompressedSize,
      entryCount: entries.length,
      infoError,
    }
  } finally {
    await handle.close()
  }
}

async function readCentralDirectory(handle, fileSize) {
  const tailSize = Math.min(fileSize, MAX_EOCD_BYTES)
  const tail = Buffer.allocUnsafe(tailSize)
  await handle.read(tail, 0, tail.length, fileSize - tailSize)
  const eocd = findSignatureBackward(tail, EOCD_SIGNATURE)
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record not found')
  const entryCount = tail.readUInt16LE(eocd + 10)
  const centralSize = tail.readUInt32LE(eocd + 12)
  const centralOffset = tail.readUInt32LE(eocd + 16)
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 central directory is not mapped by the scanner')
  }
  if (centralOffset + centralSize > fileSize) throw new Error('Central directory exceeds archive bounds')
  const central = Buffer.allocUnsafe(centralSize)
  await handle.read(central, 0, central.length, centralOffset)
  const entries = []
  let offset = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (central.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error(`Invalid central entry ${index}`)
    const flags = central.readUInt16LE(offset + 8)
    const method = central.readUInt16LE(offset + 10)
    const compressedSize = central.readUInt32LE(offset + 20)
    const uncompressedSize = central.readUInt32LE(offset + 24)
    const nameLength = central.readUInt16LE(offset + 28)
    const extraLength = central.readUInt16LE(offset + 30)
    const commentLength = central.readUInt16LE(offset + 32)
    const localOffset = central.readUInt32LE(offset + 42)
    const nameBytes = central.subarray(offset + 46, offset + 46 + nameLength)
    const name = (flags & 0x800 ? textDecoders.utf8 : textDecoders.gbk).decode(nameBytes)
    entries.push({
      name: name.replaceAll('\\', '/'),
      flags,
      method,
      encrypted: Boolean(flags & 1) || method === 99,
      compressedSize,
      uncompressedSize,
      localOffset,
    })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function readMeshVersion(handle, filename, entry) {
  const dataOffset = await entryDataOffset(handle, entry)
  if (entry.method === 0) {
    const bytes = Buffer.allocUnsafe(4)
    await handle.read(bytes, 0, 4, dataOffset)
    return bytes.readUInt32LE(0)
  }
  if (entry.method !== 8) throw new Error(`Unsupported D5Mesh compression method ${entry.method}`)
  return readDeflatedUint32(filename, dataOffset, entry.compressedSize)
}

async function readEntry(handle, entry) {
  const dataOffset = await entryDataOffset(handle, entry)
  const compressed = Buffer.allocUnsafe(entry.compressedSize)
  await handle.read(compressed, 0, compressed.length, dataOffset)
  if (entry.method === 0) return compressed
  if (entry.method === 8) return inflateRawSync(compressed)
  throw new Error(`Unsupported compression method ${entry.method}`)
}

async function entryDataOffset(handle, entry) {
  const local = Buffer.allocUnsafe(30)
  await handle.read(local, 0, local.length, entry.localOffset)
  if (local.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new Error('Invalid local ZIP header')
  return entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28)
}

function readDeflatedUint32(filename, start, compressedSize) {
  return new Promise((resolve, reject) => {
    const input = createReadStream(filename, { start, end: start + compressedSize - 1 })
    const inflate = createInflateRaw()
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      input.destroy()
      inflate.destroy()
      if (error) reject(error)
      else resolve(value)
    }
    input.on('error', (error) => finish(error))
    inflate.on('error', (error) => finish(error))
    inflate.on('data', (chunk) => {
      if (chunk.length >= 4) finish(undefined, chunk.readUInt32LE(0))
    })
    inflate.on('end', () => finish(new Error('D5Mesh entry is shorter than four bytes')))
    input.pipe(inflate)
  })
}

function summarize(records) {
  const summary = {
    variants: countBy(records, (record) => record.variant),
    meshVersions: countBy(records.filter((record) => record.meshVersion != null), (record) => record.meshVersion),
    infoVersions: countBy(records.filter((record) => record.infoVersion != null), (record) => record.infoVersion),
    combinations: countBy(
      records.filter((record) => record.meshVersion != null),
      (record) => `mesh-${record.meshVersion}/info-${record.infoVersion ?? 'none'}`,
    ),
    examplesByMeshVersion: {},
    errors: records.filter((record) => record.variant === 'error').slice(0, 50),
  }
  for (const record of records) {
    if (record.meshVersion == null) continue
    const examples = summary.examplesByMeshVersion[record.meshVersion] ??= []
    if (examples.length < 12) examples.push(record.file)
  }
  return summary
}

function countBy(items, selector) {
  const counts = {}
  for (const item of items) {
    const key = String(selector(item))
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })))
}

function basename(filename) {
  return filename.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase()
}

function findSignatureBackward(buffer, signature) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset
  }
  return -1
}

async function* walk(root) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const filename = path.join(root, entry.name)
    if (entry.isDirectory()) yield* walk(filename)
    else if (entry.isFile()) yield filename
  }
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
