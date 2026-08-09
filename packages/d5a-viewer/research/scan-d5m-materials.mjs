import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Reader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

const ZIP_SIGNATURES = new Set(['504b0304', '504b0506', '504b0708'])
const SEVEN_Z_SIGNATURE = '377abcaf271c'
const IMAGE_EXTENSION = /\.(?:avif|bmp|dds|exr|hdr|jpe?g|ktx2?|png|tga|tiff?|webp)$/i
const DEFAULT_OUTPUT = 'research/output/d5m-material-scan.json'

class NodeFileReader extends Reader {
  constructor(filename, size) {
    super()
    this.filename = filename
    this.size = size
    this.handle = undefined
  }

  async init() {
    this.handle = await fs.open(this.filename, 'r')
    this.initialized = true
  }

  async readUint8Array(offset, length) {
    if (!this.handle) await this.init()
    const buffer = Buffer.allocUnsafe(length)
    let bytesRead = 0
    while (bytesRead < length) {
      const result = await this.handle.read(buffer, bytesRead, length - bytesRead, offset + bytesRead)
      if (result.bytesRead === 0) break
      bytesRead += result.bytesRead
    }
    return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead)
  }

  async close() {
    const handle = this.handle
    this.handle = undefined
    if (handle) await handle.close()
  }
}

const arguments_ = process.argv.slice(2)
const roots = arguments_.filter((argument) => !argument.startsWith('--'))
const outputPath = optionValue(arguments_, 'output') ?? DEFAULT_OUTPUT
const concurrency = positiveInteger(optionValue(arguments_, 'concurrency') ?? '6', 'concurrency')
const maxMaterialBytes = positiveInteger(
  optionValue(arguments_, 'max-material-bytes') ?? String(8 * 1024 * 1024),
  'max-material-bytes',
)
const excludes = arguments_
  .filter((argument) => argument.startsWith('--exclude='))
  .map((argument) => argument.slice('--exclude='.length).toLocaleLowerCase())

if (roots.length === 0) {
  console.error(
    'Usage: npm run scan:d5m -- ROOT... [--output=FILE] [--concurrency=6] [--exclude=TEXT]',
  )
  process.exit(1)
}

const files = []
for (const root of roots) {
  for await (const filename of walk(root)) {
    const normalized = filename.replaceAll('\\', '/').toLocaleLowerCase()
    if (!normalized.endsWith('.d5m')) continue
    if (excludes.some((excluded) => normalized.includes(excluded))) continue
    files.push(filename)
  }
}
files.sort((left, right) => left.localeCompare(right))

const startedAt = Date.now()
let completed = 0
const records = await mapLimit(files, concurrency, async (filename) => {
  let record
  try {
    record = await inspectD5m(filename, maxMaterialBytes)
  } catch (error) {
    record = {
      file: filename,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
  completed += 1
  if (completed % 50 === 0 || completed === files.length) {
    const elapsedSeconds = Math.max(0.001, (Date.now() - startedAt) / 1000)
    console.log(`${completed}/${files.length} (${(completed / elapsedSeconds).toFixed(1)} files/s)`)
  }
  return record
})

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  roots,
  excludes,
  elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
  totalFiles: records.length,
  summary: summarize(records),
  records,
}
await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(compactSummary(report.summary), null, 2))
if (report.summary.errors.length > 0) process.exitCode = 2

async function inspectD5m(filename, materialByteLimit) {
  const stat = await fs.stat(filename)
  const signatureBytes = await readPrefix(filename, 8)
  const signature = signatureBytes.toString('hex')
  const container = detectContainer(signature)
  if (container !== 'zip') {
    return {
      file: filename,
      bytes: stat.size,
      signature,
      container,
      status: container === '7z' ? 'deferred-container' : 'unknown-container',
    }
  }

  const fileReader = new NodeFileReader(filename, stat.size)
  const zipReader = new ZipReader(fileReader, { filenameEncoding: 'gbk' })
  try {
    const zipEntries = await zipReader.getEntries({ filenameEncoding: 'gbk' })
    const entries = zipEntries.map(toEntryRecord)
    const filesOnly = entries.filter((entry) => !entry.directory)
    const materialIndex = entries.findIndex((entry) => basename(entry.name) === 'material.json')
    const materialEntry = materialIndex >= 0 ? zipEntries[materialIndex] : undefined
    const encrypted = entries.some((entry) => entry.encrypted)
    const textureEntries = filesOnly.filter((entry) => IMAGE_EXTENSION.test(entry.name))
    const materialResult = await readMaterial(materialEntry, materialByteLimit)
    const material = materialResult.material
      ? summarizeMaterial(materialResult.material, textureEntries)
      : undefined
    return {
      file: filename,
      bytes: stat.size,
      signature,
      container,
      status: encrypted
        ? 'protected'
        : material
          ? 'material-package'
          : materialResult.error
            ? 'invalid-material'
            : 'missing-material',
      archive: {
        entryCount: entries.length,
        fileCount: filesOnly.length,
        compressionMethods: countBy(filesOnly, (entry) => String(entry.compressionMethod)),
        encryptedEntries: entries.filter((entry) => entry.encrypted).map((entry) => entry.name),
        entries,
      },
      resources: {
        textureEntryCount: textureEntries.length,
        textureBytes: sum(textureEntries, (entry) => entry.uncompressedSize),
        hasIcon: filesOnly.some((entry) => /^icon\.(?:jpe?g|png|webp)$/i.test(basename(entry.name))),
        hasSummary: filesOnly.some((entry) => basename(entry.name) === 'summary.txt'),
      },
      material,
      materialEncoding: materialResult.encoding,
      materialError: materialResult.error,
    }
  } finally {
    await zipReader.close()
    await fileReader.close()
  }
}

function summarizeMaterial(rawMaterial, textureEntries) {
  const matInfo = parseNestedArray(rawMaterial.matInfo)
  const matInfo2 = parseNestedValue(rawMaterial.matInfo2)
  const parameters = matInfo.value
    .filter((parameter) => parameter && typeof parameter === 'object')
    .map((parameter) => ({
      name: stringValue(parameter.name),
      type: numericValue(parameter.type),
      group: stringValue(parameter.group),
      default: Boolean(parameter.default),
      fromPlugin: numericValue(parameter.fromPlugin),
      value: stringValue(parameter.value),
    }))
  const parameterSignature = parameters.map(({ name, type, group, default: isDefault, fromPlugin }) => ({
    name,
    type,
    group,
    default: isDefault,
    fromPlugin,
  }))
  const profileInput = {
    uePath: stringValue(rawMaterial.uePath),
    type: numericValue(rawMaterial.type),
    parameterSignature,
    matInfo2Shape: describeJsonShape(matInfo2.value),
  }
  const familyInput = {
    uePath: profileInput.uePath,
    type: profileInput.type,
  }
  const textureParameters = parameters.filter((parameter) => parameter.type === 3 && parameter.value)
  const textureNames = new Set(textureEntries.map((entry) => normalizeArchivePath(entry.name)))
  const textureReferences = textureParameters.map((parameter) => {
    const normalized = normalizeArchivePath(parameter.value)
    const candidates = [normalized, `textures/${normalized}`]
    const resolvedPath = candidates.find((candidate) => textureNames.has(candidate))
    return {
      slot: parameter.name,
      value: parameter.value,
      resolvedPath,
    }
  })
  return {
    familyId: hashProfile(familyInput),
    profileId: hashProfile(profileInput),
    id: stringValue(rawMaterial.id),
    title: stringValue(rawMaterial.title),
    uePath: profileInput.uePath,
    type: profileInput.type,
    topLevelKeys: Object.keys(rawMaterial).sort(),
    parameterCount: parameters.length,
    parameterTypeCounts: countBy(parameters, (parameter) => String(parameter.type ?? 'missing')),
    parameterGroups: unique(parameters.map((parameter) => parameter.group).filter(Boolean)),
    parameterSignature,
    textureReferences,
    resolvedTextureReferences: textureReferences.filter((reference) => reference.resolvedPath).length,
    matInfoError: matInfo.error,
    matInfo2Shape: profileInput.matInfo2Shape,
    matInfo2Error: matInfo2.error,
    hasLandscapeGrassParameter: hasStructuredValue(rawMaterial.landscapeGrassParameter),
    scalarFields: {
      metallic: numericValue(rawMaterial.metallic),
      roughness: numericValue(rawMaterial.roughness),
      emissiveColor: numericValue(rawMaterial.emissiveColor),
      fromPlugin: numericValue(rawMaterial.fromPlugin),
      fromReplace: Boolean(rawMaterial.fromReplace),
    },
  }
}

async function readMaterial(entry, byteLimit) {
  if (!entry) return {}
  if (entry.encrypted) return { error: 'material.json is encrypted' }
  if (entry.uncompressedSize > byteLimit) {
    return { error: `material.json exceeds ${byteLimit} bytes` }
  }
  try {
    const bytes = await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
    const decoded = decodeJson(bytes)
    return {
      material: JSON.parse(decoded.text.replace(/^\uFEFF/, '')),
      encoding: decoded.encoding,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function summarize(records) {
  const materialRecords = records.filter((record) => record.material)
  const profiles = new Map()
  const families = new Map()
  for (const record of materialRecords) {
    const material = record.material
    let profile = profiles.get(material.profileId)
    if (!profile) {
      profile = {
        profileId: material.profileId,
        count: 0,
        bytes: 0,
        uePaths: new Set(),
        materialTypes: new Set(),
        parameterCounts: new Set(),
        parameterSignature: material.parameterSignature,
        matInfo2Shapes: new Set(),
        textureSlots: new Set(),
        examples: [],
      }
      profiles.set(material.profileId, profile)
    }
    profile.count += 1
    profile.bytes += record.bytes ?? 0
    if (material.uePath) profile.uePaths.add(material.uePath)
    profile.materialTypes.add(material.type)
    profile.parameterCounts.add(material.parameterCount)
    profile.matInfo2Shapes.add(material.matInfo2Shape)
    for (const reference of material.textureReferences) profile.textureSlots.add(reference.slot)
    if (profile.examples.length < 8) profile.examples.push(record.file)

    let family = families.get(material.familyId)
    if (!family) {
      family = {
        familyId: material.familyId,
        count: 0,
        bytes: 0,
        uePath: material.uePath,
        materialType: material.type,
        profileIds: new Set(),
        parameterNames: new Set(),
        textureSlots: new Set(),
        examples: [],
      }
      families.set(material.familyId, family)
    }
    family.count += 1
    family.bytes += record.bytes ?? 0
    family.profileIds.add(material.profileId)
    for (const parameter of material.parameterSignature) family.parameterNames.add(parameter.name)
    for (const reference of material.textureReferences) family.textureSlots.add(reference.slot)
    if (family.examples.length < 8) family.examples.push(record.file)
  }

  const profileRecords = [...profiles.values()]
    .map((profile) => ({
      ...profile,
      uePaths: [...profile.uePaths].sort(),
      materialTypes: [...profile.materialTypes].sort(compareValues),
      parameterCounts: [...profile.parameterCounts].sort(compareValues),
      matInfo2Shapes: [...profile.matInfo2Shapes].sort(),
      textureSlots: [...profile.textureSlots].sort(),
    }))
    .sort((left, right) => right.count - left.count || left.profileId.localeCompare(right.profileId))

  const familyRecords = [...families.values()]
    .map((family) => ({
      ...family,
      profileIds: [...family.profileIds].sort(),
      profileCount: family.profileIds.size,
      parameterNames: [...family.parameterNames].sort(),
      textureSlots: [...family.textureSlots].sort(),
    }))
    .sort((left, right) => right.count - left.count || left.familyId.localeCompare(right.familyId))

  return {
    bytes: sum(records, (record) => record.bytes ?? 0),
    containers: countBy(records, (record) => record.container ?? 'error'),
    statuses: countBy(records, (record) => record.status),
    compressionMethods: mergeCounts(records.map((record) => record.archive?.compressionMethods)),
    materialEncodings: countBy(materialRecords, (record) => record.materialEncoding ?? 'unknown'),
    materialFamilyCount: familyRecords.length,
    families: familyRecords,
    materialProfileCount: profileRecords.length,
    profiles: profileRecords,
    uePaths: countBy(materialRecords, (record) => record.material.uePath || 'missing'),
    materialTypes: countBy(materialRecords, (record) => String(record.material.type ?? 'missing')),
    parameterNames: countNested(materialRecords, (record) => record.material.parameterSignature.map((item) => item.name)),
    parameterGroups: countNested(materialRecords, (record) => record.material.parameterGroups),
    textureSlots: countNested(materialRecords, (record) => record.material.textureReferences.map((item) => item.slot)),
    unresolvedTextureReferences: sum(
      materialRecords,
      (record) => record.material.textureReferences.length - record.material.resolvedTextureReferences,
    ),
    matInfoErrors: materialRecords.filter((record) => record.material.matInfoError).map((record) => ({
      file: record.file,
      error: record.material.matInfoError,
    })),
    matInfo2Errors: materialRecords.filter((record) => record.material.matInfo2Error).map((record) => ({
      file: record.file,
      error: record.material.matInfo2Error,
    })),
    errors: records
      .filter((record) => record.status === 'error' || (record.materialError && record.status !== 'protected'))
      .map((record) => ({
        file: record.file,
        status: record.status,
        error: record.error ?? record.materialError,
      })),
  }
}

function compactSummary(summary) {
  return {
    bytes: summary.bytes,
    containers: summary.containers,
    statuses: summary.statuses,
    compressionMethods: summary.compressionMethods,
    materialEncodings: summary.materialEncodings,
    materialFamilyCount: summary.materialFamilyCount,
    materialProfileCount: summary.materialProfileCount,
    topFamilies: summary.families.slice(0, 20).map((family) => ({
      familyId: family.familyId,
      count: family.count,
      profileCount: family.profileCount,
      uePath: family.uePath,
      materialType: family.materialType,
      textureSlots: family.textureSlots,
    })),
    textureSlots: summary.textureSlots,
    unresolvedTextureReferences: summary.unresolvedTextureReferences,
    matInfoErrorCount: summary.matInfoErrors.length,
    matInfo2ErrorCount: summary.matInfo2Errors.length,
    errorCount: summary.errors.length,
  }
}

function decodeJson(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: 'utf-16le', text: new TextDecoder('utf-16le').decode(bytes.subarray(2)) }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: 'utf-16be', text: new TextDecoder('utf-16be').decode(bytes.subarray(2)) }
  }
  const offset = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  return { encoding: 'utf-8', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset)) }
}

function toEntryRecord(entry) {
  return {
    name: entry.filename.replaceAll('\\', '/'),
    directory: Boolean(entry.directory),
    encrypted: Boolean(entry.encrypted),
    compressionMethod: entry.compressionMethod,
    compressedSize: entry.compressedSize,
    uncompressedSize: entry.uncompressedSize,
  }
}

function detectContainer(signature) {
  if (ZIP_SIGNATURES.has(signature.slice(0, 8))) return 'zip'
  if (signature.startsWith(SEVEN_Z_SIGNATURE)) return '7z'
  return 'unknown'
}

function parseNestedArray(value) {
  const parsed = parseNestedValue(value)
  if (parsed.error) return { value: [], error: parsed.error }
  if (Array.isArray(parsed.value)) return { value: parsed.value }
  if (parsed.value == null || parsed.value === '') return { value: [] }
  return { value: [], error: `Expected array, received ${describeJsonShape(parsed.value)}` }
}

function parseNestedValue(value) {
  if (typeof value !== 'string') return { value }
  const trimmed = value.trim()
  if (!trimmed) return { value: '' }
  try {
    return { value: JSON.parse(trimmed) }
  } catch (error) {
    return { value, error: error instanceof Error ? error.message : String(error) }
  }
}

function describeJsonShape(value) {
  if (value == null) return String(value)
  if (Array.isArray(value)) return `array:${value.length}`
  if (typeof value === 'object') return `object:${Object.keys(value).sort().join(',')}`
  return typeof value
}

function hasStructuredValue(value) {
  const parsed = parseNestedValue(value).value
  if (Array.isArray(parsed)) return parsed.length > 0
  if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0
  return Boolean(parsed)
}

function hashProfile(value) {
  const text = JSON.stringify(value)
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

function normalizeArchivePath(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '').toLocaleLowerCase()
}

function basename(value) {
  return value.replaceAll('\\', '/').split('/').at(-1)?.toLocaleLowerCase() ?? ''
}

function stringValue(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function numericValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function unique(values) {
  return [...new Set(values)].sort()
}

function positiveInteger(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(`--${name} must be a positive integer`)
  return number
}

function optionValue(argumentsList, name) {
  return argumentsList.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
}

function countBy(items, selector) {
  const counts = {}
  for (const item of items) {
    const key = String(selector(item))
    counts[key] = (counts[key] ?? 0) + 1
  }
  return sortRecord(counts)
}

function countNested(items, selector) {
  const counts = {}
  for (const item of items) {
    for (const key of selector(item)) counts[key] = (counts[key] ?? 0) + 1
  }
  return sortRecord(counts)
}

function mergeCounts(records) {
  const result = {}
  for (const record of records) {
    if (!record) continue
    for (const [key, value] of Object.entries(record)) result[key] = (result[key] ?? 0) + value
  }
  return sortRecord(result)
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  )
}

function sum(items, selector) {
  let result = 0
  for (const item of items) result += Number(selector(item)) || 0
  return result
}

function compareValues(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true })
}

async function readPrefix(filename, length) {
  const handle = await fs.open(filename, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function* walk(root) {
  const stat = await fs.stat(root)
  if (stat.isFile()) {
    yield path.resolve(root)
    return
  }
  const entries = await fs.readdir(root, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    const filename = path.join(root, entry.name)
    if (entry.isDirectory()) yield* walk(filename)
    else if (entry.isFile()) yield path.resolve(filename)
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
