import { execFile, spawn } from 'node:child_process'
import { mkdir, open, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'research/output')
const workDirectory = resolve(outputRoot, 'phase7-batch-interrupt')
if (!workDirectory.startsWith(`${outputRoot}${sep}`)) throw new Error('中断验证目录超出 research/output')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const registry = JSON.parse(await readFile(resolve(root, 'public/generated/d5m-profile-templates.json'), 'utf8'))
const profile = registry.profiles[0]
const manifestPath = resolve(workDirectory, 'interrupt-manifest.json')
const statePath = `${manifestPath}.state.json`
const stateLockPath = `${statePath}.d5-tool.lock`

await rm(workDirectory, { recursive: true, force: true })
await writeLargeSparseTexture(resolve(workDirectory, 'large-texture.png'), 96 * 1024 * 1024)
const manifest = {
  schemaVersion: 1,
  jobs: [
    {
      id: 'large-active',
      operation: 'd5m.create',
      profile: profile.id,
      output: 'created/large-active.d5m',
      textures: [{ slot: profile.textureSlots[0], file: 'large-texture.png' }],
    },
    ...Array.from({ length: 199 }, (_, index) => ({
      id: `queued-${String(index).padStart(3, '0')}`,
      operation: 'd5m.create',
      profile: registry.profiles[(index + 1) % registry.profiles.length].id,
      output: `created/queued-${String(index).padStart(3, '0')}.d5m`,
    })),
  ],
}
await writeJson(manifestPath, manifest)

const first = spawn(process.execPath, [
  cli, 'd5m', 'batch',
  '--manifest', manifestPath,
  '--restart',
  '--concurrency', '1',
  '--memory-mb', '160',
  '--quiet',
  '--json',
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
const firstOutput = collectOutput(first)

await waitFor(async () => {
  const state = await readJsonIfPresent(statePath)
  const partials = await listFiles(workDirectory, (name) => name.includes('.partial.'))
  return Boolean(state && Object.values(state.jobs).some((job) => job.status === 'running') && partials.length > 0)
}, 20_000, 'CLI 没有进入带暂存文件的运行状态')

const contender = await runExpectingFailure(process.execPath, [
  cli, 'd5m', 'batch',
  '--manifest', manifestPath,
  '--resume',
  '--concurrency', '1',
  '--quiet',
  '--json',
], root)
if (!contender.stderr.includes(`资源正由进程 ${first.pid} 使用`)) {
  throw new Error(`并发实例没有命中状态锁: ${contender.stderr}`)
}

const sentSignal = first.kill('SIGINT') ? 'SIGINT' : first.kill('SIGTERM') ? 'SIGTERM' : 'SIGKILL'
if (sentSignal === 'SIGKILL') first.kill('SIGKILL')
const interruptedExit = await waitForExit(first, 20_000)
const interruptedOutput = await firstOutput
if (interruptedExit.code === 0) throw new Error('被中断 CLI 错误地以成功状态退出')

const interruptedState = await readJsonIfPresent(statePath)
if (!interruptedState) throw new Error('中断后的状态文件缺失或 JSON 损坏')
const partialsAfterExit = await listFiles(workDirectory, (name) => name.includes('.partial.'))
const staleLockAfterExit = await fileExists(stateLockPath)

const resumed = JSON.parse((await run(process.execPath, [
  cli, 'd5m', 'batch',
  '--manifest', manifestPath,
  '--resume',
  '--concurrency', '4',
  '--memory-mb', '192',
  '--quiet',
  '--json',
], { cwd: root, maxBuffer: 64 * 1024 * 1024 })).stdout)
if (resumed.status !== 'pass' || resumed.counts.passed !== manifest.jobs.length) {
  throw new Error(`中断续跑未完成: ${JSON.stringify(resumed.counts)}`)
}
const partialsAfterResume = await listFiles(workDirectory, (name) => name.includes('.partial.'))
const locksAfterResume = await listFiles(workDirectory, (name) => name.endsWith('.d5-tool.lock'))
if (partialsAfterResume.length > 0 || locksAfterResume.length > 0) {
  throw new Error(`续跑后仍有暂存文件或锁: ${[...partialsAfterResume, ...locksAfterResume].join(', ')}`)
}

const finalState = await readJsonIfPresent(statePath)
const attempts = Object.values(finalState.jobs).map((job) => job.attempts)
const report = {
  schemaVersion: 1,
  status: 'pass',
  signal: sentSignal,
  interruptedExit,
  interruptedOutput: {
    stdoutBytes: interruptedOutput.stdout.length,
    stderr: interruptedOutput.stderr.trim(),
  },
  concurrentLock: {
    exitCode: contender.code,
    protectedPid: first.pid,
  },
  interruptedState: summarizeState(interruptedState),
  partialsAfterExit: partialsAfterExit.length,
  staleLockAfterExit,
  resumed: {
    elapsedMs: resumed.elapsedMs,
    peakActiveCount: resumed.peakActiveCount,
    peakActiveBytes: resumed.peakActiveBytes,
    counts: resumed.counts,
    attempts: {
      minimum: Math.min(...attempts),
      maximum: Math.max(...attempts),
      retried: attempts.filter((value) => value > 1).length,
    },
  },
  cleanup: {
    partialsAfterResume: partialsAfterResume.length,
    locksAfterResume: locksAfterResume.length,
  },
}
const reportPath = resolve(outputRoot, 'phase7-d5m-interrupt-verification.json')
await writeJson(reportPath, report)
process.stdout.write('D5M 真实进程中断、并发锁、恢复与暂存清理通过\n')
process.stdout.write(`${reportPath}\n`)

async function writeLargeSparseTexture(path, bytes) {
  await mkdir(dirname(path), { recursive: true })
  const handle = await open(path, 'w')
  try {
    await handle.truncate(bytes)
  } finally {
    await handle.close()
  }
}

function collectOutput(child) {
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (value) => { stdout += value })
  child.stderr.on('data', (value) => { stderr += value })
  return new Promise((resolveOutput) => child.once('close', () => resolveOutput({ stdout, stderr })))
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    if (child.exitCode != null || child.signalCode != null) {
      resolveExit({ code: child.exitCode, signal: child.signalCode })
      return
    }
    const timer = setTimeout(() => reject(new Error('等待中断进程退出超时')), timeoutMs)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      resolveExit({ code, signal })
    })
  })
}

async function runExpectingFailure(command, args, cwd) {
  try {
    const result = await run(command, args, { cwd })
    throw new Error(`并发实例错误地成功: ${result.stdout}`)
  } catch (error) {
    if (typeof error.code !== 'number') throw error
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise((resolveWait) => setTimeout(resolveWait, 10))
  }
  throw new Error(message)
}

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return undefined
    throw error
  }
}

async function listFiles(directory, include, prefix = '') {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path, include, relative))
    else if (include(entry.name)) files.push(relative)
  }
  return files
}

async function fileExists(path) {
  try {
    await readFile(path)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function summarizeState(state) {
  const statuses = Object.values(state.jobs).map((job) => job.status)
  return Object.fromEntries(['pending', 'running', 'passed', 'warning', 'failed', 'blocked', 'cancelled']
    .map((status) => [status, statuses.filter((value) => value === status).length]))
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
