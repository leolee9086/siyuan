import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const outputDirectory = resolve(root, 'research/output/phase7-cli-d5m-families')
const families = [
  'standard-surface',
  'height-surface',
  'glass',
  'fabric',
  'landscape',
  'water',
  'glazed',
  'base-7',
  'sheer-fabric',
  'base-13',
]

await mkdir(outputDirectory, { recursive: true })
const startedAt = performance.now()
const results = []
for (const family of families) {
  const output = resolve(outputDirectory, `${family}.d5m`)
  const created = await run(process.execPath, [
    cli,
    'd5m',
    'create',
    '--family', family,
    '--title', `CLI ${family}`,
    '--output', output,
    '--overwrite',
    '--quiet',
    '--json',
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
  const creation = JSON.parse(created.stdout)
  const validated = await run(process.execPath, [
    cli,
    'd5m',
    'validate',
    output,
    '--quiet',
    '--json',
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
  const validation = JSON.parse(validated.stdout)
  if (creation.status !== 'pass') throw new Error(`${family} 的创建保真检查未通过`)
  if (validation.material.familyKey !== family) throw new Error(`${family} 回读为 ${validation.material.familyKey}`)
  if (!validation.material.registeredProfile) throw new Error(`${family} 回读后未识别精确制式`)
  const edited = await run(process.execPath, [
    cli,
    'd5m',
    'edit',
    output,
    '--output', output,
    '--title', `CLI edited ${family}`,
    '--overwrite',
    '--quiet',
    '--json',
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
  const edit = JSON.parse(edited.stdout)
  const revalidated = await run(process.execPath, [
    cli,
    'd5m',
    'validate',
    output,
    '--quiet',
    '--json',
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
  const editedValidation = JSON.parse(revalidated.stdout)
  if (edit.status !== 'pass') throw new Error(`${family} 的编辑保真检查未通过`)
  if (editedValidation.material.familyKey !== family) throw new Error(`${family} 编辑后回读为 ${editedValidation.material.familyKey}`)
  if (!editedValidation.material.registeredProfile) throw new Error(`${family} 编辑后未识别精确制式`)
  results.push({
    family,
    familyStatus: creation.family.status,
    profileId: creation.profile.id,
    parameterCount: creation.profile.parameterCount,
    outputBytes: creation.outputBytes,
    createStatus: creation.status,
    validateStatus: validation.status,
    editStatus: edit.status,
    editValidateStatus: editedValidation.status,
    copiedEntryCount: edit.write.copiedEntryCount,
    warnings: editedValidation.warnings,
  })
}

const report = {
  schemaVersion: 1,
  command: 'verify:cli-d5m',
  familyCount: families.length,
  profileRegistryCount: 272,
  status: 'pass',
  elapsedMs: performance.now() - startedAt,
  results,
}
const reportPath = resolve(root, 'research/output/phase7-cli-d5m-family-matrix.json')
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${families.length}/${families.length} 个 D5M 材质族 CLI 创建、编辑与回读通过\n`)
process.stdout.write(`${reportPath}\n`)
