import { spawn } from 'node:child_process'
import { access, mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const input = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a')
const artifactDirectory = resolve(root, '.artifacts', `scene-cli-interrupt-${process.pid}`)
const output = resolve(artifactDirectory, 'highpoly.glb')
const conversionReport = resolve(artifactDirectory, 'highpoly.glb.fidelity.json')
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-cli-interrupt.json')

await mkdir(artifactDirectory, { recursive: true })
const first = spawn(process.execPath, [
  cli, 'convert', input, '--output', output, '--report', conversionReport, '--json',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let stdout = ''
let stderr = ''
let sentSignal
let observedPartial
const startedAt = performance.now()
const interruptedExit = await new Promise((resolveExit, reject) => {
  let checkingPartial = false
  const partialPrefix = `${basename(output)}.`
  const detector = setInterval(() => {
    if (checkingPartial || sentSignal) return
    checkingPartial = true
    void readdir(artifactDirectory)
      .then((entries) => {
        const partial = entries.find((entry) => entry.startsWith(partialPrefix) && entry.endsWith('.partial'))
        if (!partial || sentSignal) return
        observedPartial = resolve(artifactDirectory, partial)
        sentSignal = first.kill('SIGINT') ? 'SIGINT' : first.kill('SIGTERM') ? 'SIGTERM' : undefined
      })
      .finally(() => { checkingPartial = false })
  }, 5)
  const timeout = setTimeout(() => {
    clearInterval(detector)
    first.kill('SIGTERM')
    reject(new Error('等待场景转换暂存文件超时'))
  }, 45_000)
  first.stdout.setEncoding('utf8')
  first.stderr.setEncoding('utf8')
  first.stdout.on('data', (chunk) => { stdout += chunk })
  first.stderr.on('data', (chunk) => { stderr += chunk })
  first.once('error', (error) => {
    clearTimeout(timeout)
    clearInterval(detector)
    reject(error)
  })
  first.once('close', (code, signal) => {
    clearTimeout(timeout)
    clearInterval(detector)
    resolveExit({ code, signal })
  })
})

if (!sentSignal || !observedPartial) throw new Error('CLI 未进入可取消的 GLB 暂存写入阶段')
if (interruptedExit.code !== 130 && interruptedExit.signal !== 'SIGINT') {
  throw new Error(`中断 CLI 应以取消状态退出，实际 ${interruptedExit.code ?? interruptedExit.signal}`)
}
if (await pathExists(output) || await pathExists(conversionReport)) {
  throw new Error('中断转换不应提交最终输出或保真报告')
}
const interruptedPartials = await readdir(artifactDirectory)
  .then((entries) => entries.filter((entry) => entry.endsWith('.partial') || entry.endsWith('.partial.json')))
if (!interruptedPartials.includes(basename(observedPartial))) {
  throw new Error('中断转换没有保留预期的暂存文件用于恢复检查')
}

const resumed = await runCli([
  'convert', input, '--output', output, '--report', conversionReport, '--quiet', '--json',
])
if (resumed.status !== 'pass') throw new Error(`中断后重新转换失败：${resumed.status}`)
if (resumed.source.triangleCount < 1_000_000 || resumed.source.triangleCount !== resumed.roundTrip.triangleCount) {
  throw new Error(`中断后高面数转换三角面不一致：${resumed.source.triangleCount} -> ${resumed.roundTrip.triangleCount}`)
}
if (resumed.validator?.errors !== 0 || resumed.validator?.warnings !== 0) {
  throw new Error(`中断后 GLB Validator 未通过：${resumed.validator?.errors} 错误 / ${resumed.validator?.warnings} 警告`)
}
if (!await pathExists(output) || !await pathExists(conversionReport)) {
  throw new Error('中断后重新转换未提交输出或保真报告')
}
const remainingPartials = await readdir(artifactDirectory)
  .then((entries) => entries.filter((entry) => entry.endsWith('.partial') || entry.endsWith('.partial.json')))
if (remainingPartials.length > 0) throw new Error(`恢复后仍残留暂存文件：${remainingPartials.join(', ')}`)

const report = {
  schemaVersion: 1,
  command: 'verify:interrupt-scene',
  input,
  output,
  conversionReport,
  signal: sentSignal,
  interruptedExit,
  interruptedElapsedMs: performance.now() - startedAt,
  interruptedOutput: {
    stdoutBytes: Buffer.byteLength(stdout),
    stderr: stderr.trim(),
    observedPartial,
    interruptedPartials,
    remainingPartials,
  },
  resumed: {
    status: resumed.status,
    triangles: resumed.source.triangleCount,
    outputBytes: resumed.outputBytes,
    elapsedMs: resumed.elapsedMs,
    runtime: resumed.runtime,
    validator: resumed.validator,
  },
}
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`场景转换 ${sentSignal} 中断、暂存清理并重新执行通过\n`)
process.stdout.write(`${reportPath}\n`)

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
  if (result.code !== 0) throw new Error(`重新转换失败：${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
