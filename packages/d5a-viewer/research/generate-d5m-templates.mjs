import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Reader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

const arguments_ = process.argv.slice(2)
const reportPath = optionValue('report') ?? 'research/output/d5m-material-scan-e-material.json'
const outputPath = optionValue('output') ?? 'public/generated/d5m-profile-templates.json'
const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'))
const recordsByFile = new Map(report.records.map((record) => [normalizeFile(record.file), record]))
const sourceRoot = path.resolve(report.roots[0])

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

async function generate() {
  const profiles = []
  let completed = 0
  for (const profile of report.summary.profiles) {
  const sourceFile = profile.examples[0]
  const sourceRecord = recordsByFile.get(normalizeFile(sourceFile))
  if (!sourceRecord?.material) throw new Error(`Missing scan record for ${sourceFile}`)
  const material = await readMaterialJson(sourceFile)
  const sanitized = sanitizeMaterial(material, familyMetadata(sourceRecord.material.uePath).label)
  const parameters = parseParameters(sanitized.matInfo)
  profiles.push({
    id: profile.profileId,
    familyId: sourceRecord.material.familyId,
    count: profile.count,
    label: sourceRecord.material.title || path.basename(sourceFile, path.extname(sourceFile)),
    parameterCount: parameters.length,
    textureSlots: parameters
      .filter((parameter) => Number(parameter.type) === 3)
      .map((parameter) => String(parameter.name)),
    encoding: sourceRecord.materialEncoding ?? 'utf-8',
    material: sanitized,
    provenance: {
      source: path.relative(sourceRoot, sourceFile).replaceAll('\\', '/'),
      observedExamples: profile.examples.length,
    },
  })
  completed += 1
  if (completed % 50 === 0 || completed === report.summary.profiles.length) {
    console.log(`${completed}/${report.summary.profiles.length}`)
  }
  }

  const profilesByFamily = Map.groupBy(profiles, (profile) => profile.familyId)
  const families = report.summary.families.map((family) => ({
  id: family.familyId,
  ...familyMetadata(family.uePath),
  uePath: family.uePath,
  materialType: family.materialType,
  observedCount: family.count,
  profileCount: family.profileCount,
  textureSlots: family.textureSlots,
  profileIds: (profilesByFamily.get(family.familyId) ?? [])
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
    .map((profile) => profile.id),
  }))

  const registry = {
  schemaVersion: 1,
  source: path.basename(reportPath),
  observedMaterialCount: report.summary.statuses['material-package'] ?? 0,
  familyCount: families.length,
  profileCount: profiles.length,
  families,
  profiles,
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`)
  const outputStat = await fs.stat(outputPath)
  console.log(JSON.stringify({ outputPath, bytes: outputStat.size, families: families.length, profiles: profiles.length }, null, 2))
}

async function readMaterialJson(filename) {
  const stat = await fs.stat(filename)
  const reader = new NodeFileReader(filename, stat.size)
  const archive = new ZipReader(reader, { filenameEncoding: 'gbk', useWebWorkers: false })
  try {
    const entries = await archive.getEntries({ filenameEncoding: 'gbk' })
    const entry = entries.find((candidate) => (
      !candidate.directory && candidate.filename.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() === 'material.json'
    ))
    if (!entry || entry.directory) throw new Error(`${filename} has no material.json`)
    const bytes = await entry.getData(new Uint8ArrayWriter(), { useWebWorkers: false })
    return JSON.parse(decodeText(bytes).replace(/^\uFEFF/, ''))
  } finally {
    await archive.close()
    await reader.close()
  }
}

function sanitizeMaterial(source, label) {
  const material = structuredClone(source)
  const parameters = sanitizeParameters(parseParameters(material.matInfo))
  const secondaryParameters = tryParseParameters(material.matInfo2)
  Object.assign(material, {
    id: '',
    title: `新建${label}`,
    thumbnailUrl: '',
    isDel: false,
    isPrivate: true,
    userId: 0,
    companyId: 0,
    categoryId: 0,
    brand: '',
    code: '',
    collection: '',
    color: '',
    createTime: 0,
    updateTime: 0,
    isSubmit: false,
    isPublished: false,
    sync_status: 0,
    pak_url: '',
    dependent_pak_lists: [],
    fromReplace: false,
    keyForFurniture: '',
    matInfo: JSON.stringify(parameters),
  })
  if (secondaryParameters) {
    material.matInfo2 = typeof material.matInfo2 === 'string'
      ? JSON.stringify(sanitizeParameters(secondaryParameters))
      : sanitizeParameters(secondaryParameters)
  }
  return material
}

function sanitizeParameters(parameters) {
  return parameters.map((parameter) => (
    Number(parameter.type) === 3 ? { ...parameter, value: '' } : parameter
  ))
}

function parseParameters(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value
  if (!Array.isArray(parsed)) throw new Error('Template matInfo is not an array')
  return parsed
}

function tryParseParameters(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function familyMetadata(uePath) {
  return FAMILY_METADATA[uePath] ?? {
    key: uePath.split('/').at(-2)?.toLowerCase() ?? 'unknown',
    label: '未分类材质',
    description: '语料尚不足，保留原始制式参数。',
    status: 'provisional',
  }
}

function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  const offset = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset))
}

function normalizeFile(value) {
  return path.resolve(value).replaceAll('\\', '/').toLowerCase()
}

function optionValue(name) {
  return arguments_.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
}

const FAMILY_METADATA = {
  '/Game/MatLib2/Base/Base/Base_9/m.m': {
    key: 'standard-surface',
    label: '通用表面',
    description: '木材、石材、瓷砖、皮革、金属等常规 PBR 表面。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_6/m.m': {
    key: 'height-surface',
    label: '增强凹凸表面',
    description: '带高度、AO 和完整 PBR 贴图的织物、铺装及木地板表面。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_2/m.m': {
    key: 'glass',
    label: '玻璃与透射',
    description: '透明、磨砂、渐变和带纹理玻璃。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_12/m.m': {
    key: 'fabric',
    label: '织物',
    description: '布纹、丝绸、麻布及带不透明度的织物。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_18/m.m': {
    key: 'landscape',
    label: '草地材质',
    description: '普通 ZIP 草地材质制式，不包含特殊 3.d5m 辅助载荷研究。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_5/m.m': {
    key: 'water',
    label: '水体',
    description: '平静、小波纹与颜色可调的水面材质。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_11/m.m': {
    key: 'glazed',
    label: '釉面与涂层',
    description: '釉面陶瓷及类似涂层表面。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_15/m.m': {
    key: 'sheer-fabric',
    label: '纱帘与透光织物',
    description: '带不透明度和透光参数的薄织物。',
    status: 'confirmed',
  },
  '/Game/MatLib2/Base/Base/Base_7/m.m': {
    key: 'base-7',
    label: 'Base 7 待确认制式',
    description: '样本较少，完整保留原始参数，不推断材质语义。',
    status: 'provisional',
  },
  '/Game/MatLib2/Base/Base/Base_13/m.m': {
    key: 'base-13',
    label: 'Base 13 待确认制式',
    description: '样本较少且类别混合，完整保留原始参数。',
    status: 'provisional',
  },
}

await generate()
