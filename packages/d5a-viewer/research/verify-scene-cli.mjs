import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openAsBlob } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(root, '.artifacts', `scene-cli-verification-${process.pid}`)
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-cli-verification.json')
const d5aPath = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/_1.d5a')
const glbPath = resolve(process.argv[3] ?? 'C:/Users/al765/Downloads/_1-selection.glb')

await mkdir(artifactDirectory, { recursive: true })
const capabilities = await runCli(['capabilities', '--json'])
const d5aReportPath = resolve(artifactDirectory, 'd5a-inspect.json')
const glbReportPath = resolve(artifactDirectory, 'glb-validate.json')
await runCli(['inspect', d5aPath, '--report', d5aReportPath, '--quiet', '--json'])
await runCli(['validate', glbPath, '--report', glbReportPath, '--quiet', '--json'])
const d5aInspection = await readJson(d5aReportPath)
const glbValidation = await readJson(glbReportPath)
const entry = d5aInspection.d5a?.bundles?.[0]?.infoEntry ?? d5aInspection.d5a?.legacyFbx?.materialXmlEntry ?? 'summary.txt'
const extractionDirectory = resolve(artifactDirectory, 'extract')
const extractionReportPath = resolve(artifactDirectory, 'extract.json')
await runCli(['extract', d5aPath, '--entry', entry, '--output', extractionDirectory, '--report', extractionReportPath, '--quiet', '--json'])
const extraction = await readJson(extractionReportPath)
const extractedPath = extraction.entries?.[0]?.output
if (typeof extractedPath !== 'string') throw new Error('场景解包报告没有输出条目')
const sourceEntry = await readArchiveEntry(d5aPath, entry)
const extracted = await readFile(extractedPath)
const sourceSha256 = sha256(sourceEntry)
const extractedSha256 = sha256(extracted)
if (sourceSha256 !== extractedSha256) throw new Error(`解包条目哈希不一致 ${entry}`)
const supported = new Map(capabilities.formats?.map((format) => [format.format, format]))
for (const format of ['d5a', 'glb']) {
  if (!supported.has(format)) throw new Error(`capabilities 缺少 ${format}`)
}
if (d5aInspection.status === 'fail' || d5aInspection.status === 'unsupported') throw new Error(`D5A 检查未通过：${d5aInspection.status}`)
if (glbValidation.status !== 'pass' && glbValidation.status !== 'warning') throw new Error(`GLB 校验未通过：${glbValidation.status}`)

const report = {
  schemaVersion: 1,
  command: 'verify:cli-scene',
  d5a: {
    input: d5aPath,
    status: d5aInspection.status,
    variant: d5aInspection.d5a?.variant,
    fileEntries: d5aInspection.d5a?.fileEntryCount,
    bundles: d5aInspection.d5a?.bundles?.map((bundle) => ({
      meshEntry: bundle.meshEntry,
      status: bundle.status,
      version: bundle.mesh?.version,
      triangleCount: bundle.mesh?.triangleCount,
      vertexCount: bundle.mesh?.vertexCount,
      descriptorCount: bundle.mesh?.descriptorCount,
      materialCount: bundle.material?.materialCount,
    })),
  },
  glb: {
    input: glbPath,
    status: glbValidation.status,
    triangles: glbValidation.glb?.triangleCount,
    meshes: glbValidation.glb?.meshCount,
    materials: glbValidation.glb?.materialCount,
    validation: glbValidation.validation,
  },
  extraction: {
    entry,
    output: extractedPath,
    sourceSha256,
    extractedSha256,
    equal: sourceSha256 === extractedSha256,
  },
}
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`D5A: ${report.d5a.status} / ${report.d5a.bundles?.[0]?.triangleCount?.toLocaleString() ?? 0} 面\n`)
process.stdout.write(`GLB: ${report.glb.status} / ${report.glb.triangles?.toLocaleString() ?? 0} 面 / ${report.glb.validation?.errorCount ?? 0} 错误\n`)
process.stdout.write(`解包: ${entry} / ${sourceSha256 === extractedSha256 ? '哈希一致' : '哈希不一致'}\n`)
process.stdout.write(`报告: ${reportPath}\n`)

async function runCli(args) {
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['dist-cli/d5-tool.mjs', ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.once('error', reject)
    child.once('close', (code) => resolveResult({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }))
  })
  if (result.code !== 0) throw new Error(`d5-tool ${args[0]} 失败：${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
}

async function readArchiveEntry(path, target) {
  const archive = new ZipReader(new BlobReader(await openAsBlob(path)), { useWebWorkers: true, filenameEncoding: 'gbk' })
  try {
    const canonical = target.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
    const entry = (await archive.getEntries()).find((item) => !item.directory && item.filename.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase() === canonical)
    if (!entry) throw new Error(`源 D5A 不含 ${target}`)
    return entry.getData(new Uint8ArrayWriter())
  } finally {
    await archive.close()
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}
