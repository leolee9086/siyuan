import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'research/output')
const workDirectory = resolve(outputRoot, 'phase7-batch-100')
if (!workDirectory.startsWith(`${outputRoot}${sep}`)) throw new Error('批处理验证目录超出 research/output')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const registry = JSON.parse(await readFile(resolve(root, 'public/generated/d5m-profile-templates.json'), 'utf8'))
const profiles = registry.profiles.slice(0, 100)

await rm(workDirectory, { recursive: true, force: true })
await mkdir(workDirectory, { recursive: true })

const createManifestPath = resolve(workDirectory, 'create-manifest.json')
const createManifest = {
  schemaVersion: 1,
  jobs: profiles.map((profile, index) => ({
    id: `create-${String(index).padStart(3, '0')}`,
    operation: 'd5m.create',
    profile: profile.id,
    title: `Batch ${index} ${profile.id}`,
    output: `created/${String(index).padStart(3, '0')}-${profile.id}.d5m`,
  })),
}
await writeJson(createManifestPath, createManifest)
const createReport = await runBatch([
  '--manifest', createManifestPath,
  '--restart',
  '--overwrite',
  '--concurrency', '4',
  '--memory-mb', '128',
])
assertCounts(createReport, { passed: 100, warning: 0, failed: 0, pending: 0 })
if (createReport.peakActiveCount !== 4) throw new Error(`100 文件创建峰值并发为 ${createReport.peakActiveCount}`)
if (createReport.peakActiveBytes > 128 * 1024 * 1024) throw new Error('100 文件创建超过估算内存预算')

const resumedCreate = await runBatch([
  '--manifest', createManifestPath,
  '--resume',
  '--concurrency', '4',
  '--memory-mb', '128',
])
assertCounts(resumedCreate, { passed: 100, warning: 0, failed: 0, pending: 0 })
if (resumedCreate.jobs.some((job) => job.attempts !== 1)) throw new Error('恢复时重复执行了已通过创建任务')
const createState = JSON.parse(await readFile(`${createManifestPath}.state.json`, 'utf8'))
if (!Array.isArray(createState.events) || createState.events.length < 200 ||
    !createState.events.some((event) => event.type === 'started') ||
    !createState.events.some((event) => event.type === 'completed' && event.status === 'passed')) {
  throw new Error('批处理状态没有保留可供 WebUI 读取的启动/完成事件')
}

const validateManifestPath = resolve(workDirectory, 'validate-manifest.json')
const validateManifest = {
  schemaVersion: 1,
  jobs: profiles.map((profile, index) => ({
    id: `validate-${String(index).padStart(3, '0')}`,
    operation: 'd5m.validate',
    input: `created/${String(index).padStart(3, '0')}-${profile.id}.d5m`,
  })),
}
await writeJson(validateManifestPath, validateManifest)
const validateReport = await runBatch([
  '--manifest', validateManifestPath,
  '--restart',
  '--concurrency', '8',
  '--memory-mb', '256',
])
assertCompleted(validateReport, 100)
if (validateReport.peakActiveCount !== 8) throw new Error(`100 文件校验峰值并发为 ${validateReport.peakActiveCount}`)

const dependencyManifestPath = resolve(workDirectory, 'dependency-manifest.json')
const dependencyManifest = {
  schemaVersion: 1,
  jobs: [
    {
      id: 'chain-create',
      operation: 'd5m.create',
      profile: profiles[0].id,
      output: 'chain/source.d5m',
    },
    {
      id: 'chain-edit',
      operation: 'd5m.edit',
      dependsOn: ['chain-create'],
      input: 'chain/source.d5m',
      output: 'chain/edited.d5m',
      title: 'Dependency edited',
    },
    {
      id: 'chain-validate',
      operation: 'd5m.validate',
      dependsOn: ['chain-edit'],
      input: 'chain/edited.d5m',
    },
  ],
}
await writeJson(dependencyManifestPath, dependencyManifest)
const dependencyReport = await runBatch([
  '--manifest', dependencyManifestPath,
  '--restart',
  '--overwrite',
  '--concurrency', '3',
  '--memory-mb', '64',
])
assertCounts(dependencyReport, { passed: 3, warning: 0, failed: 0, blocked: 0, pending: 0 })
if (dependencyReport.peakActiveCount !== 1) throw new Error(`依赖链峰值并发应为 1，实际 ${dependencyReport.peakActiveCount}`)

const failureManifestPath = resolve(workDirectory, 'resume-manifest.json')
const missingInput = resolve(workDirectory, 'missing-then-restored.d5m')
const failureManifest = {
  schemaVersion: 1,
  jobs: [
    { id: 'existing-a', operation: 'd5m.validate', input: createManifest.jobs[0].output },
    { id: 'missing', operation: 'd5m.validate', input: 'missing-then-restored.d5m' },
    { id: 'dependent', operation: 'd5m.validate', dependsOn: ['missing'], input: 'missing-then-restored.d5m' },
    { id: 'existing-b', operation: 'd5m.validate', input: createManifest.jobs[1].output },
  ],
}
await writeJson(failureManifestPath, failureManifest)
const failedReport = await runBatch([
  '--manifest', failureManifestPath,
  '--restart',
  '--concurrency', '2',
  '--memory-mb', '64',
], 1)
assertCounts(failedReport, { passed: 2, warning: 0, failed: 1, blocked: 1, pending: 0 })
await cp(resolve(workDirectory, createManifest.jobs[2].output), missingInput)
const recoveredReport = await runBatch([
  '--manifest', failureManifestPath,
  '--resume',
  '--retry-failed',
  '--concurrency', '2',
  '--memory-mb', '64',
])
assertCounts(recoveredReport, { passed: 4, warning: 0, failed: 0, blocked: 0, pending: 0 })
const recovered = Object.fromEntries(recoveredReport.jobs.map((job) => [job.id, job]))
if (recovered['existing-a'].attempts !== 1 || recovered['existing-b'].attempts !== 1) {
  throw new Error('失败续跑重复执行了已通过任务')
}
if (recovered.missing.attempts !== 2) throw new Error(`失败任务尝试次数为 ${recovered.missing.attempts}`)
if (recovered.dependent.attempts !== 1) throw new Error(`依赖阻止任务尝试次数为 ${recovered.dependent.attempts}`)

const report = {
  schemaVersion: 1,
  status: 'pass',
  create100: summarize(createReport),
  resumeSkip: summarize(resumedCreate),
  stateEvents: {
    count: createState.events.length,
    first: createState.events[0],
    last: createState.events.at(-1),
  },
  validate100: summarize(validateReport),
  dependencyChain: summarize(dependencyReport),
  failure: summarize(failedReport),
  recovered: summarize(recoveredReport),
}
const reportPath = resolve(outputRoot, 'phase7-d5m-batch-verification.json')
await writeJson(reportPath, report)
process.stdout.write('100 个 D5M 创建、100 个回读校验及失败续跑通过\n')
process.stdout.write(`${reportPath}\n`)

async function runBatch(args, expectedCode = 0) {
  try {
    const result = await run(process.execPath, [cli, 'd5m', 'batch', ...args, '--quiet', '--json'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
    })
    if (expectedCode !== 0) throw new Error(`批处理预期退出码 ${expectedCode}，实际为 0`)
    return JSON.parse(result.stdout)
  } catch (error) {
    if (error.code !== expectedCode || typeof error.stdout !== 'string') throw error
    return JSON.parse(error.stdout)
  }
}

function assertCounts(report, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (report.counts[key] !== value) throw new Error(`${key} 预期 ${value}，实际 ${report.counts[key]}`)
  }
}

function assertCompleted(report, total) {
  if (report.counts.passed + report.counts.warning !== total) {
    throw new Error(`完成数预期 ${total}，实际 ${report.counts.passed + report.counts.warning}`)
  }
  if (report.counts.failed !== 0 || report.counts.cancelled !== 0 || report.counts.pending !== 0) {
    throw new Error(`批处理仍有失败、取消或待运行任务: ${JSON.stringify(report.counts)}`)
  }
}

function summarize(report) {
  return {
    status: report.status,
    elapsedMs: report.elapsedMs,
    peakActiveCount: report.peakActiveCount,
    peakActiveBytes: report.peakActiveBytes,
    counts: report.counts,
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
