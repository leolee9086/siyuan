import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const input = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/_1.d5a')
const format = input.toLowerCase().endsWith('.glb') ? 'glb' : input.toLowerCase().endsWith('.d5a') ? 'd5a' : undefined
if (!format) throw new Error(`场景查看验证只支持 .d5a 或 .glb：${input}`)
const reportPath = resolve(root, 'research', 'output', `phase7-scene-cli-view-${format}.json`)
const child = spawn(process.execPath, [cli, 'view', input, '--port', '5350', '--json'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let stdout = ''
let stderr = ''
const view = await new Promise((resolveView, reject) => {
  const timeout = setTimeout(() => reject(new Error('等待 view 命令启动超时')), 20_000)
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    try {
      const parsed = JSON.parse(stdout)
      clearTimeout(timeout)
      resolveView(parsed)
    } catch {
      // The CLI emits one pretty JSON document before holding the local server open.
    }
  })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  child.once('error', reject)
  child.once('close', (code, signal) => reject(new Error(`view 在就绪前退出: ${code ?? signal}\n${stderr}`)))
})

try {
  if (view.status !== 'ready' || view.operation !== 'view' || view.format !== format) {
    throw new Error(`view 返回内容无效: ${JSON.stringify(view)}`)
  }
  const page = new URL(view.url)
  const scene = page.searchParams.get('scene')
  if (!scene) throw new Error('view URL 缺少 scene 参数')
  const sceneUrl = new URL(scene, view.url)
  const pageResponse = await fetch(view.url)
  if (pageResponse.status !== 200 || !(await pageResponse.text()).includes('root')) {
    throw new Error(`view WebUI 首页未成功返回: ${pageResponse.status}`)
  }
  const sourceBytes = await readFile(input)
  const sourceHash = sha256(sourceBytes)
  const fileResponse = await fetch(sceneUrl)
  const deliveredBytes = new Uint8Array(await fileResponse.arrayBuffer())
  const deliveredHash = sha256(deliveredBytes)
  if (fileResponse.status !== 200 || deliveredHash !== sourceHash) {
    throw new Error(`view 文件端点字节不一致: ${fileResponse.status}`)
  }
  if (fileResponse.headers.get('x-d5-scene-filename') !== encodeURIComponent(basename(input))) {
    throw new Error(`view 文件名头错误: ${fileResponse.headers.get('x-d5-scene-filename')}`)
  }
  const report = {
    schemaVersion: 1,
    command: 'verify:cli-view',
    input,
    status: view.status,
    format: view.format,
    url: view.url,
    port: view.port,
    bytes: view.bytes,
    sourceSha256: sourceHash,
    deliveredSha256: deliveredHash,
    equal: sourceHash === deliveredHash,
  }
  await writeJson(reportPath, report)
  process.stdout.write(`view: ${report.format.toUpperCase()} / ${report.bytes.toLocaleString()} 字节 / 哈希一致\n`)
  process.stdout.write(`报告: ${reportPath}\n`)
} finally {
  const exit = await stopChild(child)
  if (exit.code !== 0 && exit.signal !== 'SIGINT') {
    throw new Error(`view 结束状态异常: ${exit.code ?? exit.signal}`)
  }
}

function stopChild(process) {
  return new Promise((resolveExit) => {
    if (process.exitCode != null || process.signalCode != null) {
      resolveExit({ code: process.exitCode, signal: process.signalCode })
      return
    }
    process.once('close', (code, signal) => resolveExit({ code, signal }))
    if (!process.kill('SIGINT')) process.kill('SIGTERM')
  })
}

async function writeJson(path, value) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}
