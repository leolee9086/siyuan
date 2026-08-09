import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const input = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a')
const artifactDirectory = resolve(root, '.artifacts', `scene-batch-interrupt-${process.pid}`)
const manifestPath = resolve(artifactDirectory, 'manifest.json')
const statePath = resolve(artifactDirectory, 'state.json')
const batchReportPath = resolve(artifactDirectory, 'report.json')
const jobReportPath = resolve(artifactDirectory, 'highpoly-inspect.json')
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-batch-interrupt.json')

await mkdir(artifactDirectory, { recursive: true })
await writeJson(manifestPath, {
  schemaVersion: 1,
  jobs: [{
    id: 'highpoly',
    operation: 'scene.inspect',
    input,
    report: 'highpoly-inspect.json',
    estimatedBytes: 128 * 1024 * 1024,
  }],
})

const first = spawn(process.execPath, [
  cli, 'batch', '--manifest', manifestPath, '--state', statePath, '--report', batchReportPath, '--json',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let stdout = ''
let stderr = ''
let sentSignal
const startedAt = performance.now()
const interruptedExit = await new Promise((resolveExit, reject) => {
  const timeout = setTimeout(() => reject(new Error('等待高面数场景批处理中断超时')), 45_000)
  first.stdout.setEncoding('utf8')
  first.stderr.setEncoding('utf8')
  first.stdout.on('data', (chunk) => { stdout += chunk })
  first.stderr.on('data', (chunk) => {
    stderr += chunk
    if (!sentSignal && stderr.includes('[batch:highpoly:extract]')) {
      sentSignal = first.kill('SIGINT') ? 'SIGINT' : first.kill('SIGTERM') ? 'SIGTERM' : undefined
    }
  })
  first.once('error', reject)
  first.once('close', (code, signal) => {
    clearTimeout(timeout)
    resolveExit({ code, signal })
  })
})
if (!sentSignal) throw new Error('场景批处理未进入可取消的 D5Mesh 解压阶段')
if (interruptedExit.code !== 130 && interruptedExit.signal !== 'SIGINT') {
  throw new Error(`中断场景批处理应以取消状态退出，实际 ${interruptedExit.code ?? interruptedExit.signal}`)
}
const interruptedState = await readJson(statePath)
const interruptedStatus = interruptedState.jobs?.highpoly?.status
if (interruptedStatus !== 'running' && interruptedStatus !== 'cancelled') {
  throw new Error(`中断状态应为 running 或 cancelled，实际 ${interruptedStatus}`)
}

const resumed = await runCli([
  'batch', '--manifest', manifestPath, '--state', statePath, '--report', batchReportPath,
  '--resume', '--quiet', '--json',
])
if (resumed.status !== 'pass') throw new Error(`中断后批处理恢复失败：${resumed.status}`)
const resumedState = await readJson(statePath)
if (resumedState.jobs?.highpoly?.attempts !== 2 || resumedState.jobs?.highpoly?.status !== 'passed') {
  throw new Error('恢复后的高面数作业状态或尝试次数不符合预期')
}
const jobReport = await readJson(jobReportPath)
const bundle = jobReport.d5a?.bundles?.[0]
if (jobReport.status !== 'pass' || (bundle?.mesh?.triangleCount ?? 0) < 1_000_000) {
  throw new Error(`恢复后的高面数检查未通过：${jobReport.status} / ${bundle?.mesh?.triangleCount ?? 0} 面`)
}
if (!Number.isFinite(jobReport.runtime?.maxRssBytes) || jobReport.runtime.maxRssBytes <= 0) {
  throw new Error('恢复后的高面数报告没有有效 RSS 峰值')
}

const report = {
  schemaVersion: 1,
  command: 'verify:interrupt-batch-scene',
  input,
  signal: sentSignal,
  interruptedExit,
  interruptedStatus,
  interruptedElapsedMs: performance.now() - startedAt,
  interruptedOutput: {
    stdoutBytes: Buffer.byteLength(stdout),
    stderr: stderr.trim(),
  },
  resumed: {
    status: resumed.status,
    attempts: resumedState.jobs.highpoly.attempts,
    triangles: bundle.mesh.triangleCount,
    vertices: bundle.mesh.vertexCount,
    inspectionElapsedMs: jobReport.elapsedMs,
    runtime: jobReport.runtime,
  },
}
await mkdir(dirname(reportPath), { recursive: true })
await writeJson(reportPath, report)
process.stdout.write(`高面数场景批处理 ${sentSignal} 中断并恢复通过\n`)
process.stdout.write(`${report.resumed.triangles.toLocaleString()} 面 / RSS 峰值 ${(report.resumed.runtime.maxRssBytes / 1024 / 1024).toFixed(1)} MB\n`)
process.stdout.write(`报告: ${reportPath}\n`)

async function runCli(args) {
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdoutChunks = []
    const stderrChunks = []
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk))
    child.once('error', reject)
    child.once('close', (code) => resolveResult({
      code,
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
    }))
  })
  if (result.code !== 0) throw new Error(`恢复批处理失败：${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
