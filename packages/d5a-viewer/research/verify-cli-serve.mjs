import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const statePath = resolve(root, 'research/output/phase7-cli-serve-state.fixture.json')
await writeFile(statePath, `${JSON.stringify({
  schemaVersion: 1,
  manifest: 'fixture.json',
  manifestSha256: 'fixture',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date().toISOString(),
  jobs: { sample: { status: 'running', attempts: 1 } },
  events: [{
    timestamp: new Date().toISOString(),
    type: 'started',
    id: 'sample',
    status: 'running',
    message: '启动 sample',
  }],
}, null, 2)}\n`)
const blocker = createServer((_, response) => response.end('reserved'))
const blockedPort = await listen(blocker)
const child = spawn(process.execPath, [
  cli,
  'serve',
  '--host', '127.0.0.1',
  '--port', String(blockedPort),
  '--state', statePath,
  '--json',
], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })

try {
  const output = await waitForJson(child, 15_000)
  if (output.port !== blockedPort + 1) {
    throw new Error(`端口占用后预期 ${blockedPort + 1}，实际 ${output.port}`)
  }
  if (!output.url.startsWith(`http://127.0.0.1:${output.port}/`)) throw new Error(`serve URL 异常: ${output.url}`)
  const index = await fetch(output.url)
  const registry = await fetch(new URL('generated/d5m-profile-templates.json', output.url))
  const spa = await fetch(new URL('materials/batch', output.url))
  const state = await fetch(new URL('api/d5m-batch/state', output.url))
  if (!index.ok || !registry.ok || !spa.ok || !state.ok) {
    throw new Error(`serve 静态资源失败: index=${index.status}, registry=${registry.status}, spa=${spa.status}, state=${state.status}`)
  }
  const registryData = await registry.json()
  const stateData = await state.json()
  if (registryData.profileCount !== 272) throw new Error(`serve 制式注册表异常: ${registryData.profileCount}`)
  if (stateData.state?.jobs?.sample?.status !== 'running' || stateData.state?.events?.length !== 1) {
    throw new Error(`serve 状态 API 异常: ${JSON.stringify(stateData)}`)
  }
  const report = {
    schemaVersion: 1,
    status: 'pass',
    blockedPort,
    servedPort: output.port,
    url: output.url,
    indexStatus: index.status,
    registryStatus: registry.status,
    spaStatus: spa.status,
    stateStatus: state.status,
    stateEventCount: stateData.state.events.length,
    profileCount: registryData.profileCount,
  }
  const reportPath = resolve(root, 'research/output/phase7-cli-serve-verification.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write('本地 serve 静态入口、SPA 回退和端口回退通过\n')
  process.stdout.write(`${reportPath}\n`)
} finally {
  child.kill('SIGINT')
  await waitForExit(child, 10_000).catch(() => child.kill('SIGKILL'))
  await close(blocker)
  await rm(statePath, { force: true })
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address()
      if (!address || typeof address === 'string') reject(new Error('保留端口失败'))
      else resolveListen(address.port)
    })
  })
}

function close(server) {
  return new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
}

function waitForJson(child, timeoutMs) {
  return new Promise((resolveJson, reject) => {
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => reject(new Error(`等待 serve 启动超时: ${stderr}`)), timeoutMs)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      try {
        const value = JSON.parse(stdout)
        clearTimeout(timer)
        resolveJson(value)
      } catch {
        // printJson writes multiline JSON; wait until it is complete.
      }
    })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      reject(new Error(`serve 过早退出: code=${code}, signal=${signal}, stderr=${stderr}`))
    })
  })
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    if (child.exitCode != null || child.signalCode != null) {
      resolveExit()
      return
    }
    const timer = setTimeout(() => reject(new Error('serve 退出超时')), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveExit()
    })
  })
}
