import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openAsBlob } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(root, '.artifacts', `scene-batch-verification-${process.pid}`)
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-batch-verification.json')
const d5aPath = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/_1.d5a')
const glbPath = resolve(process.argv[3] ?? 'C:/Users/al765/Downloads/_1-selection.glb')

await mkdir(artifactDirectory, { recursive: true })

const manifestPath = resolve(artifactDirectory, 'scene-batch.json')
const statePath = resolve(artifactDirectory, 'scene-batch.state.json')
const batchReportPath = resolve(artifactDirectory, 'scene-batch.report.json')
await writeJson(manifestPath, {
  schemaVersion: 1,
  jobs: [
    {
      id: 'inspect-d5a',
      operation: 'scene.inspect',
      input: d5aPath,
      report: 'reports/d5a-inspect.json',
    },
    {
      id: 'validate-glb',
      operation: 'scene.validate',
      input: glbPath,
      report: 'reports/glb-validate.json',
    },
    {
      id: 'convert-d5a',
      operation: 'scene.convert',
      input: d5aPath,
      output: 'converted/source.glb',
      report: 'reports/d5a-convert.json',
      dependsOn: ['inspect-d5a'],
    },
    {
      id: 'validate-converted-glb',
      operation: 'scene.validate',
      input: 'converted/source.glb',
      report: 'reports/converted-glb-validate.json',
      dependsOn: ['convert-d5a'],
    },
    {
      id: 'extract-info',
      operation: 'scene.extract',
      input: d5aPath,
      output: 'extract',
      entries: ['info.json'],
      report: 'reports/extract.json',
      dependsOn: ['inspect-d5a'],
    },
  ],
})

const initial = await runCli([
  'batch', '--manifest', manifestPath, '--state', statePath, '--report', batchReportPath,
  '--concurrency', '2', '--memory-mb', '128', '--quiet', '--json',
])
assertPass(initial, '场景批处理首轮')
assertJobs(initial, {
  'inspect-d5a': 'passed',
  'validate-glb': 'passed',
  'convert-d5a': 'passed',
  'validate-converted-glb': 'passed',
  'extract-info': 'passed',
})
const sourceInfo = await readArchiveEntry(d5aPath, 'info.json')
const extractedPath = resolve(artifactDirectory, 'extract', 'info.json')
const extractedInfo = await readFile(extractedPath)
const extractionHash = sha256(extractedInfo)
if (extractionHash !== sha256(sourceInfo)) throw new Error('批处理解包的 info.json 哈希不一致')

const stateAfterInitial = await readJson(statePath)
const resumed = await runCli([
  'batch', '--manifest', manifestPath, '--state', statePath, '--report', batchReportPath,
  '--resume', '--concurrency', '2', '--memory-mb', '128', '--quiet', '--json',
])
assertPass(resumed, '场景批处理恢复')
if (resumed.peakActiveCount !== 0) throw new Error(`恢复不应重跑已完成作业，实际峰值 ${resumed.peakActiveCount}`)
const stateAfterResume = await readJson(statePath)
for (const id of ['inspect-d5a', 'validate-glb', 'convert-d5a', 'validate-converted-glb', 'extract-info']) {
  if (stateAfterResume.jobs?.[id]?.attempts !== stateAfterInitial.jobs?.[id]?.attempts) {
    throw new Error(`恢复错误地重跑了 ${id}`)
  }
}

const recoveryManifestPath = resolve(artifactDirectory, 'scene-recovery.json')
const recoveryStatePath = resolve(artifactDirectory, 'scene-recovery.state.json')
const recoveryReportPath = resolve(artifactDirectory, 'scene-recovery.report.json')
const recoverInput = resolve(artifactDirectory, 'recover.glb')
await writeJson(recoveryManifestPath, {
  schemaVersion: 1,
  jobs: [
    { id: 'missing-input', operation: 'scene.validate', input: 'recover.glb' },
    { id: 'dependent-inspect', operation: 'scene.inspect', input: 'recover.glb', dependsOn: ['missing-input'] },
  ],
})
const failed = await runCli([
  'batch', '--manifest', recoveryManifestPath, '--state', recoveryStatePath, '--report', recoveryReportPath,
  '--quiet', '--json',
], 1)
if (failed.status !== 'fail') throw new Error(`缺失输入应产生失败状态，实际 ${failed.status}`)
assertJobs(failed, { 'missing-input': 'failed', 'dependent-inspect': 'blocked' })
await copyFile(glbPath, recoverInput)
const recovered = await runCli([
  'batch', '--manifest', recoveryManifestPath, '--state', recoveryStatePath, '--report', recoveryReportPath,
  '--resume', '--retry-failed', '--quiet', '--json',
])
assertPass(recovered, '场景批处理失败续跑')
assertJobs(recovered, { 'missing-input': 'passed', 'dependent-inspect': 'passed' })
const recoveryState = await readJson(recoveryStatePath)
if (recoveryState.jobs?.['missing-input']?.attempts !== 2 || recoveryState.jobs?.['dependent-inspect']?.attempts !== 1) {
  throw new Error('失败续跑的作业尝试计数不符合预期')
}

const report = {
  schemaVersion: 1,
  command: 'verify:batch-scene',
  inputs: { d5a: d5aPath, glb: glbPath },
  initial: summarize(initial),
  resumed: summarize(resumed),
  recovery: summarize(recovered),
  extraction: {
    entry: 'info.json',
    output: extractedPath,
    sourceSha256: sha256(sourceInfo),
    extractedSha256: extractionHash,
    equal: extractionHash === sha256(sourceInfo),
  },
  conversion: {
    output: resolve(artifactDirectory, 'converted', 'source.glb'),
    report: resolve(artifactDirectory, 'reports', 'd5a-convert.json'),
    result: initial.jobs?.find((job) => job.id === 'convert-d5a')?.result,
  },
}
await mkdir(dirname(reportPath), { recursive: true })
await writeJson(reportPath, report)
process.stdout.write(`场景批处理: ${report.initial.counts.passed} 通过 / 恢复零重跑 / 失败续跑通过\n`)
process.stdout.write(`解包: ${report.extraction.entry} / 哈希一致\n`)
process.stdout.write(`报告: ${reportPath}\n`)

async function runCli(args, expectedCode = 0) {
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
    child.once('close', (code) => resolveResult({
      code,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }))
  })
  if (result.code !== expectedCode) {
    throw new Error(`d5-tool batch 应以 ${expectedCode} 退出，实际 ${result.code}: ${result.stderr || result.stdout}`)
  }
  return JSON.parse(result.stdout)
}

function assertPass(report, label) {
  if (report.status !== 'pass') throw new Error(`${label}未通过：${report.status}`)
}

function assertJobs(report, expected) {
  const actual = Object.fromEntries((report.jobs ?? []).map((job) => [job.id, job.status]))
  for (const [id, status] of Object.entries(expected)) {
    if (actual[id] !== status) throw new Error(`作业 ${id} 状态应为 ${status}，实际 ${actual[id]}`)
  }
}

function summarize(report) {
  return {
    status: report.status,
    counts: report.counts,
    elapsedMs: report.elapsedMs,
    peakActiveCount: report.peakActiveCount,
    peakActiveBytes: report.peakActiveBytes,
    jobs: report.jobs?.map((job) => ({ id: job.id, status: job.status, attempts: job.attempts, result: job.result })),
  }
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

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}
