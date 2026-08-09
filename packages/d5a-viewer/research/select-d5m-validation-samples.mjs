import { promises as fs } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const reportPath = option('report') ?? 'research/output/d5m-material-scan-e-material.json'
const outputPath = option('output') ?? 'research/output/d5m-validation-samples.json'
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
const records = report.records.filter((record) => record.status === 'material-package' && record.material)

const families = [...Map.groupBy(records, (record) => record.material.uePath)]
  .map(([uePath, familyRecords]) => ({
    uePath,
    count: familyRecords.length,
    candidates: familyRecords
      .map(summarize)
      .sort((left, right) => right.score - left.score || left.bytes - right.bytes || left.file.localeCompare(right.file))
      .slice(0, 5),
  }))
  .sort((left, right) => right.count - left.count || left.uePath.localeCompare(right.uePath))

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: path.basename(reportPath),
  materialCount: records.length,
  families,
  textureFormats: Object.fromEntries(['dds', 'tif', 'tiff', 'png', 'bmp', 'jpg', 'jpeg'].map((extension) => [
    extension,
    select(records, (record) => extensions(record).has(extension), 8),
  ])),
  semanticCases: {
    height: select(records, (record) => slots(record).has('Height Map'), 8),
    opacity: select(records, (record) => slots(record).has('OpacityMap'), 8),
    localUv: select(records, (record) => parameterNames(record).some((name) => name.startsWith('Local_UV_')), 8),
    offset: select(records, (record) => parameterNames(record).some((name) => /^(?:Xmove|Ymove)(?:_|$)/.test(name)), 8),
    rotation: select(records, (record) => parameterNames(record).some((name) => /^UVAngle(?:_|$)/.test(name)), 8),
  },
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({
  outputPath,
  materialCount: output.materialCount,
  familyCount: output.families.length,
  formats: Object.fromEntries(Object.entries(output.textureFormats).map(([key, value]) => [key, value.length])),
}, null, 2))

function select(source, predicate, limit) {
  return source
    .filter(predicate)
    .map(summarize)
    .sort((left, right) => right.score - left.score || left.bytes - right.bytes || left.file.localeCompare(right.file))
    .slice(0, limit)
}

function summarize(record) {
  const materialSlots = [...slots(record)]
  const materialExtensions = [...extensions(record)]
  const parameters = parameterNames(record)
  const semanticParameterCount = parameters.filter((name) => (
    /^(?:Local_UV_|Utiling|Vtiling|Xmove|Ymove|UVAngle)/.test(name)
  )).length
  const usefulSlots = materialSlots.filter((slot) => (
    ['Diffuse Map', 'Normal Map One', 'Roughness Map', 'MetallicMap', 'SpecularMap', 'AOMap', 'OpacityMap', 'Height Map'].includes(slot)
  )).length
  const preferredSize = record.bytes <= 64 * 1024 * 1024 ? 30 : record.bytes <= 128 * 1024 * 1024 ? 10 : 0
  const score = usefulSlots * 100 + new Set(materialExtensions).size * 20 + semanticParameterCount * 4 + preferredSize
  return {
    file: record.file,
    title: record.material.title,
    bytes: record.bytes,
    familyId: record.material.familyId,
    profileId: record.material.profileId,
    parameterCount: record.material.parameterCount,
    slots: materialSlots,
    extensions: materialExtensions,
    uvParameters: parameters.filter((name) => /^(?:Local_UV_|Utiling|Vtiling|Xmove|Ymove|UVAngle)/.test(name)),
    score,
  }
}

function slots(record) {
  return new Set(record.material.textureReferences.map((reference) => reference.slot))
}

function extensions(record) {
  return new Set(record.material.textureReferences.flatMap((reference) => {
    const value = reference.resolvedPath ?? reference.value
    const extension = value.split('.').at(-1)?.toLowerCase()
    return extension ? [extension] : []
  }))
}

function parameterNames(record) {
  return record.material.parameterSignature.map((parameter) => parameter.name)
}

function option(name) {
  return args.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
}
