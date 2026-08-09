import { spawn, execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openAsBlob } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
import { basename, dirname, resolve } from 'node:path'
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'

const execFile = promisify(execFileCallback)
const root = resolve(import.meta.dirname, '..')
const binary = resolve(process.argv[2] ?? resolve(root, 'release/d5-tool.exe'))
const samples = {
  v9: resolve(process.argv[3] ?? 'E:/D5 WorkSpace/model/化肥.d5a'),
  v10: resolve(process.argv[4] ?? 'E:/D5 WorkSpace/model/30宽磁吸灯组.skp.d5a'),
  v11: resolve(process.argv[5] ?? 'E:/D5 WorkSpace/model/_1.d5a'),
  glb: resolve(process.argv[6] ?? 'C:/Users/al765/Downloads/_1-selection.glb'),
  highPoly: resolve(process.argv[7] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a'),
}
const artifactDirectory = resolve(root, '.artifacts', `native-cli-verification-${process.pid}`)
const reportPath = resolve(root, 'research/output/phase7-native-cli-verification.json')
const environment = isolatedEnvironment()

await mkdir(artifactDirectory, { recursive: true })
try {
  const releaseEntries = await readdir(resolve(root, 'release'), { withFileTypes: true })
  if (releaseEntries.length !== 1 || !releaseEntries[0].isFile() || releaseEntries[0].name !== basename(binary)) {
    throw new Error(`release 目录必须只包含 ${basename(binary)}，实际为 ${releaseEntries.map((entry) => entry.name).join(', ')}`)
  }
  const binaryBytes = await readFile(binary)
  if (binaryBytes[0] !== 0x4d || binaryBytes[1] !== 0x5a) throw new Error('原生发布物缺少 Windows PE 标记')
  const binaryStat = await stat(binary)
  const binarySha256 = sha256(binaryBytes)
  const versionText = (await runText(['--version'])).trim()
  const capabilities = await runJSON(['capabilities', '--json'])
  assertCapabilities(capabilities)

  const inspections = {}
  inspections.v9 = await validateD5A(samples.v9, { version: 9, triangles: 18_708, vertices: 10_917, descriptors: 4 })
  inspections.v10 = await validateD5A(samples.v10, { version: 10, triangles: 52_540, vertices: 79_396, descriptors: 73 })
  inspections.v11 = await validateD5A(samples.v11, { version: 11, triangles: 12_844, vertices: 38_532, descriptors: 5 })
  inspections.highPoly = await validateD5A(samples.highPoly, { version: 11, triangles: 1_499_441, vertices: 4_498_323 })
  const glb = await runJSON(['validate', samples.glb, '--json', '--quiet'])
  if (glb.status !== 'pass' || glb.glb?.triangleCount !== 3_968 || glb.glb?.meshCount !== 1 || glb.glb?.materialCount !== 1) {
    throw new Error(`GLB 原生校验结果异常: ${JSON.stringify(glb)}`)
  }
  if (glb.validation?.errorCount !== 0 || glb.validation?.warningCount !== 0) {
    throw new Error(`GLB 原生结构校验未通过: ${JSON.stringify(glb.validation)}`)
  }

  const extraction = await verifyExtraction(inspections.v11)
  const serve = await verifyEmbeddedServe()
  const views = {
    d5a: await verifyView(samples.v11, 'd5a'),
    glb: await verifyView(samples.glb, 'glb'),
  }
  const report = {
    schemaVersion: 1,
    command: 'verify:native',
    status: 'pass',
    binary: {
      path: binary,
      bytes: binaryStat.size,
      sha256: binarySha256,
      pe: true,
      version: versionText,
      releaseEntries: releaseEntries.map((entry) => entry.name),
      pathEnvironmentEmpty: environment.PATH === '',
    },
    capabilities,
    d5a: Object.fromEntries(Object.entries(inspections).map(([key, value]) => [key, summarizeD5A(value)])),
    glb: {
      input: samples.glb,
      status: glb.status,
      triangles: glb.glb.triangleCount,
      meshes: glb.glb.meshCount,
      materials: glb.glb.materialCount,
      validation: glb.validation,
      runtime: glb.runtime,
    },
    extraction,
    serve,
    views,
  }
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`原生单文件: ${(binaryStat.size / 1024 / 1024).toFixed(2)} MiB / ${binarySha256}\n`)
  process.stdout.write(`D5Mesh: v9 ${inspections.v9.d5a.bundles[0].mesh.triangleCount.toLocaleString()} 面 / v10 ${inspections.v10.d5a.bundles[0].mesh.triangleCount.toLocaleString()} 面 / v11 ${inspections.v11.d5a.bundles[0].mesh.triangleCount.toLocaleString()} 面\n`)
  process.stdout.write(`高面数: ${inspections.highPoly.d5a.bundles[0].mesh.triangleCount.toLocaleString()} 面 / ${inspections.highPoly.elapsedMs.toFixed(1)} ms / Go Alloc ${(inspections.highPoly.runtime.goAllocatedBytes / 1024 / 1024).toFixed(2)} MiB\n`)
  process.stdout.write(`GLB: ${glb.glb.triangleCount.toLocaleString()} 面 / 0 错误 / 0 警告\n`)
  process.stdout.write(`WebUI: 端口回退 ${serve.blockedPort} -> ${serve.port} / D5A 与 GLB 文件哈希一致\n`)
  process.stdout.write(`报告: ${reportPath}\n`)
} finally {
  await rm(artifactDirectory, { recursive: true, force: true })
}

async function validateD5A(input, expected) {
  const report = await runJSON(['validate', input, '--json', '--quiet'])
  const mesh = report.d5a?.bundles?.[0]?.mesh
  if (report.status !== 'pass' || report.validation?.errorCount !== 0 || report.validation?.warningCount !== 0 || !mesh) {
    throw new Error(`${basename(input)} 原生校验未通过: ${JSON.stringify(report)}`)
  }
  for (const [name, value] of Object.entries(expected)) {
    const actual = name === 'triangles' ? mesh.triangleCount : name === 'vertices' ? mesh.vertexCount : name === 'descriptors' ? mesh.descriptorCount : mesh[name]
    if (actual !== value) throw new Error(`${basename(input)} ${name} 预期 ${value}，实际 ${actual}`)
  }
  return report
}

async function verifyExtraction(v11Report) {
  const entry = v11Report.d5a?.bundles?.[0]?.infoEntry
  if (!entry) throw new Error('v11 D5A 检查报告缺少 info.json 条目')
  const output = resolve(artifactDirectory, 'extract')
  const report = await runJSON(['extract', samples.v11, '--entry', entry, '--output', output, '--json'])
  if (report.status !== 'pass' || report.entries?.length !== 1) throw new Error(`原生解包报告异常: ${JSON.stringify(report)}`)
  const extracted = await readFile(report.entries[0].output)
  const archived = await readArchiveEntry(samples.v11, entry)
  const sourceSha256 = sha256(archived)
  const extractedSha256 = sha256(extracted)
  if (sourceSha256 !== extractedSha256) throw new Error(`${entry} 原生解包哈希不一致`)
  return { entry, bytes: extracted.length, sourceSha256, extractedSha256, equal: true }
}

async function verifyEmbeddedServe() {
  const statePath = resolve(artifactDirectory, 'state.json')
  await writeFile(statePath, `${JSON.stringify({ schemaVersion: 1, jobs: { fixture: { status: 'running' } }, events: [{ id: 'fixture', status: 'running' }] })}\n`)
  const blocker = createServer((_, response) => response.end('reserved'))
  const blockedPort = await listen(blocker)
  const holding = await startHolding(['serve', '--host', '127.0.0.1', '--port', String(blockedPort), '--state', statePath, '--json'])
  try {
    if (holding.output.port === blockedPort) throw new Error('serve 未在首选端口占用时回退')
    const index = await fetch(holding.output.url)
    const registry = await fetch(new URL('generated/d5m-profile-templates.json', holding.output.url))
    const spa = await fetch(new URL('models/fixture', holding.output.url))
    const state = await fetch(new URL('api/d5m-batch/state', holding.output.url))
    const indexText = await index.text()
    const registryData = await registry.json()
    const stateData = await state.json()
    if (!index.ok || !indexText.includes('id="root"') || !registry.ok || registryData.profileCount !== 272 || !spa.ok || !state.ok) {
      throw new Error(`内嵌 WebUI 验证异常: index=${index.status}, registry=${registry.status}, profiles=${registryData.profileCount}, spa=${spa.status}, state=${state.status}`)
    }
    if (stateData.state?.jobs?.fixture?.status !== 'running' || stateData.state?.events?.length !== 1) {
      throw new Error(`原生状态 API 内容异常: ${JSON.stringify(stateData)}`)
    }
    return {
      blockedPort,
      port: holding.output.port,
      indexStatus: index.status,
      registryStatus: registry.status,
      spaStatus: spa.status,
      stateStatus: state.status,
      profileCount: registryData.profileCount,
      stateEventCount: stateData.state.events.length,
    }
  } finally {
    await holding.stop()
    await close(blocker)
  }
}

async function verifyView(input, format) {
  const port = await reservePort()
  const holding = await startHolding(['view', input, '--host', '127.0.0.1', '--port', String(port), '--json'])
  try {
    if (holding.output.status !== 'ready' || holding.output.operation !== 'view' || holding.output.format !== format) {
      throw new Error(`原生 view 就绪信息异常: ${JSON.stringify(holding.output)}`)
    }
    const pageURL = new URL(holding.output.url)
    const scene = pageURL.searchParams.get('scene')
    if (!scene) throw new Error(`${format} view URL 缺少 scene 参数`)
    const sceneURL = new URL(scene, pageURL)
    const wrongTokenURL = new URL(sceneURL)
    wrongTokenURL.searchParams.set('token', 'WRONG')
    const page = await fetch(pageURL)
    const wrongToken = await fetch(wrongTokenURL)
    const wrongMethod = await fetch(sceneURL, { method: 'POST' })
    const head = await fetch(sceneURL, { method: 'HEAD' })
    const delivered = await fetch(sceneURL)
    const deliveredBytes = new Uint8Array(await delivered.arrayBuffer())
    const sourceBytes = await readFile(input)
    const sourceSha256 = sha256(sourceBytes)
    const deliveredSha256 = sha256(deliveredBytes)
    if (!page.ok || wrongToken.status !== 404 || wrongMethod.status !== 405 || !head.ok || !delivered.ok || sourceSha256 !== deliveredSha256) {
      throw new Error(`${format} view 端点验证异常: page=${page.status}, token=${wrongToken.status}, method=${wrongMethod.status}, head=${head.status}, get=${delivered.status}, equal=${sourceSha256 === deliveredSha256}`)
    }
    const encodedName = delivered.headers.get('x-d5-scene-filename')
    if (!encodedName || decodeURIComponent(encodedName) !== basename(input)) throw new Error(`${format} view 文件名头异常: ${encodedName}`)
    if (Number(head.headers.get('content-length')) !== sourceBytes.length) throw new Error(`${format} view HEAD 长度异常`)
    return {
      input,
      port: holding.output.port,
      bytes: sourceBytes.length,
      pageStatus: page.status,
      wrongTokenStatus: wrongToken.status,
      wrongMethodStatus: wrongMethod.status,
      headStatus: head.status,
      getStatus: delivered.status,
      sourceSha256,
      deliveredSha256,
      equal: true,
    }
  } finally {
    await holding.stop()
  }
}

async function runJSON(args) {
  const text = await runText(args)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`原生命令 JSON 无效: ${args.join(' ')}\n${text}`, { cause: error })
  }
}

async function runText(args) {
  const { stdout, stderr } = await execFile(binary, args, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  if (stderr.trim()) throw new Error(`原生命令输出错误流: ${args.join(' ')}\n${stderr}`)
  return stdout
}

async function startHolding(args) {
  const child = spawn(binary, args, { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const output = await waitForJSON(child, 20_000)
  return { child, output, stop: () => stopChild(child) }
}

function waitForJSON(child, timeoutMs) {
  return new Promise((resolveJSON, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => finish(new Error(`等待原生服务就绪超时: ${stderr || stdout}`)), timeoutMs)
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolveJSON(value)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      try {
        finish(undefined, JSON.parse(stdout))
      } catch {
        // The Go host writes one indented JSON document before holding the server open.
      }
    })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', (error) => finish(error))
    child.once('exit', (code, signal) => finish(new Error(`原生服务过早退出: code=${code}, signal=${signal}, stderr=${stderr}`)))
  })
}

async function stopChild(child) {
  if (child.exitCode != null || child.signalCode != null) return
  child.kill('SIGTERM')
  try {
    await waitForExit(child, 10_000)
  } catch {
    child.kill('SIGKILL')
    await waitForExit(child, 5_000)
  }
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit, reject) => {
    if (child.exitCode != null || child.signalCode != null) {
      resolveExit()
      return
    }
    const timer = setTimeout(() => reject(new Error('等待原生服务退出超时')), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveExit()
    })
  })
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

async function reservePort() {
  const server = createServer()
  const port = await listen(server)
  await close(server)
  return port
}

async function readArchiveEntry(path, target) {
  const archive = new ZipReader(new BlobReader(await openAsBlob(path)), { useWebWorkers: false, filenameEncoding: 'gbk' })
  try {
    const canonical = target.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
    const entry = (await archive.getEntries()).find((item) => !item.directory && item.filename.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase() === canonical)
    if (!entry) throw new Error(`源 D5A 不含 ${target}`)
    return entry.getData(new Uint8ArrayWriter())
  } finally {
    await archive.close()
  }
}

function assertCapabilities(capabilities) {
  if (capabilities.host !== 'go' || capabilities.singleBinary !== true || capabilities.nodeRuntime !== false || capabilities.webUi?.embedded !== true) {
    throw new Error(`原生能力声明异常: ${JSON.stringify(capabilities)}`)
  }
  const formats = new Map(capabilities.formats?.map((format) => [format.format, format.operations]))
  for (const [format, operations] of [
    ['d5a', ['inspect', 'view', 'validate', 'extract', 'convert:dxf']],
    ['glb', ['inspect', 'view', 'validate', 'convert:dxf']],
    ['dxf', ['write']],
  ]) {
    for (const operation of operations) {
      if (!formats.get(format)?.includes(operation)) throw new Error(`capabilities 缺少 ${format}.${operation}`)
    }
  }
}

function summarizeD5A(report) {
  const mesh = report.d5a.bundles[0].mesh
  return {
    input: report.file.name,
    status: report.status,
    version: mesh.version,
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    descriptors: mesh.descriptorCount,
    geometryGroups: mesh.geometryGroupCount,
    elapsedMs: report.elapsedMs,
    runtime: report.runtime,
  }
}

function isolatedEnvironment() {
  const result = { ...process.env }
  for (const name of Object.keys(result)) {
    if (name.toLowerCase() === 'path') delete result[name]
  }
  result.PATH = ''
  return result
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}
