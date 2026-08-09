import { spawn, execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import { basename, dirname, resolve } from 'node:path'

const execFile = promisify(execFileCallback)
const root = resolve(import.meta.dirname, '..')
const binary = resolve(process.argv[2] ?? resolve(root, 'release/d5-tool.exe'))
const fixtures = [
  { id: 'd5a-v11', input: resolve(process.argv[3] ?? 'E:/D5 WorkSpace/model/_1.d5a'), triangles: 12_844, layers: 5 },
  { id: 'glb-selection', input: resolve(process.argv[4] ?? 'C:/Users/al765/Downloads/_1-selection.glb'), triangles: 3_968, layers: 1 },
  { id: 'd5a-highpoly', input: resolve(process.argv[5] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a'), triangles: 1_499_441, layers: 1 },
]
const artifactDirectory = resolve(root, '.artifacts', `native-convert-verification-${process.pid}`)
const reportPath = resolve(root, 'research/output/phase7-native-convert-verification.json')
const environment = isolatedEnvironment()

await mkdir(artifactDirectory, { recursive: true })
try {
  const capabilities = await runJSON(['capabilities', '--json'])
  assertNativeConvertCapabilities(capabilities)
  const binaryBytes = await readFile(binary)
  const binaryStat = await stat(binary)
  const results = []
  for (const fixture of fixtures) {
    const output = resolve(artifactDirectory, `${fixture.id}.dxf`)
    const fidelity = `${output}.fidelity.json`
    const started = performance.now()
    const conversion = await runJSON([
      'convert', fixture.input,
      '--output', output,
      '--report', fidelity,
      '--overwrite',
      '--json',
      '--quiet',
    ])
    const elapsedMs = performance.now() - started
    const [structure, outputStat, fidelityBytes] = await Promise.all([
      inspectDxf(output),
      stat(output),
      readFile(fidelity),
    ])
    assert(conversion.sourceFormat === (fixture.id.startsWith('glb') ? 'glb' : 'd5a'), `${fixture.id}: sourceFormat 异常`)
    assert(conversion.targetFormat === 'dxf', `${fixture.id}: targetFormat 异常`)
    assert(conversion.status === 'warning', `${fixture.id}: 预期显式保真警告`)
    assert(conversion.source.triangleCount === fixture.triangles, `${fixture.id}: 源面数异常`)
    assert(conversion.roundTrip.triangleCount === fixture.triangles, `${fixture.id}: 报告回读面数异常`)
    assert(structure.faceCount === fixture.triangles, `${fixture.id}: DXF 3DFACE 数量异常`)
    assert(structure.usedLayers.size === fixture.layers, `${fixture.id}: 已用图层数量异常`)
    assert(structure.declaredLayers.size === fixture.layers + 1, `${fixture.id}: 声明图层数量异常`)
    assert(structure.insertionUnits === 6, `${fixture.id}: $INSUNITS 不是米制 6`)
    assert(structure.sawEof, `${fixture.id}: DXF 缺少 EOF`)
    assert(structure.trueColorCount >= fixture.triangles + fixture.layers + 1, `${fixture.id}: True Color 覆盖不足`)
    assert(conversion.outputBytes === outputStat.size, `${fixture.id}: 输出字节数报告不一致`)
    assert(conversion.runtime.peakGoAllocatedBytes > 0, `${fixture.id}: 缺少 Go 峰值内存记录`)
    const before = { bytes: outputStat.size, modified: outputStat.mtimeMs, fidelitySha256: sha256(fidelityBytes) }
    const protectedRun = await runFailure(['convert', fixture.input, '--output', output, '--report', fidelity, '--quiet'])
    assert(protectedRun.code !== 0 && protectedRun.stderr.includes('输出已存在'), `${fixture.id}: 覆盖保护未生效`)
    const afterStat = await stat(output)
    const afterFidelity = await readFile(fidelity)
    assert(afterStat.size === before.bytes && afterStat.mtimeMs === before.modified, `${fixture.id}: 拒绝覆盖后输出发生变化`)
    assert(sha256(afterFidelity) === before.fidelitySha256, `${fixture.id}: 拒绝覆盖后报告发生变化`)
    results.push({
      id: fixture.id,
      input: fixture.input,
      outputBytes: outputStat.size,
      elapsedMs,
      reportedElapsedMs: conversion.elapsedMs,
      triangles: structure.faceCount,
      layers: structure.usedLayers.size,
      insertionUnits: structure.insertionUnits,
      trueColorCount: structure.trueColorCount,
      sawEof: structure.sawEof,
      status: conversion.status,
      warnings: conversion.warnings.map((warning) => warning.code),
      runtime: conversion.runtime,
      overwriteProtection: true,
    })
  }
  const report = {
    schemaVersion: 1,
    command: 'npm run verify:native-convert',
    status: 'pass',
    binary: { path: binary, bytes: binaryStat.size, sha256: sha256(binaryBytes), pathEnvironmentEmpty: environment.PATH === '' },
    capabilities: {
      host: capabilities.host,
      singleBinary: capabilities.singleBinary,
      nodeRuntime: capabilities.nodeRuntime,
      formats: capabilities.formats,
    },
    fixtures: results,
  }
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  for (const result of results) {
    process.stdout.write(`${result.id}: ${result.triangles.toLocaleString()} 面 / ${(result.outputBytes / 1024 / 1024).toFixed(2)} MiB / ${result.elapsedMs.toFixed(1)} ms / peak Go ${(result.runtime.peakGoAllocatedBytes / 1024 / 1024).toFixed(1)} MiB\n`)
  }
  process.stdout.write(`报告: ${reportPath}\n`)
} finally {
  await rm(artifactDirectory, { recursive: true, force: true })
}

async function inspectDxf(path) {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Number.POSITIVE_INFINITY })
  let codeLine
  let section = ''
  let awaitingSection = false
  let headerVariable = ''
  let insertionUnits
  let faceCount = 0
  let trueColorCount = 0
  let sawEof = false
  let entityType = ''
  let entityLayer = ''
  const declaredLayers = new Set()
  const usedLayers = new Set()
  const flushEntity = () => {
    if (section === 'TABLES' && entityType === 'LAYER' && entityLayer) declaredLayers.add(entityLayer.toLowerCase())
    if (section === 'ENTITIES' && entityType === '3DFACE') {
      faceCount += 1
      usedLayers.add(entityLayer.toLowerCase())
    }
    entityType = ''
    entityLayer = ''
  }
  for await (const line of lines) {
    if (codeLine == null) {
      codeLine = line
      continue
    }
    const code = Number.parseInt(codeLine.replace(/^\uFEFF/, '').trim(), 10)
    const value = line.trim()
    assert(Number.isInteger(code), `无效 DXF 组码 ${codeLine}`)
    if (code === 0) {
      flushEntity()
      const type = value.toUpperCase()
      if (type === 'SECTION') awaitingSection = true
      else if (type === 'ENDSEC') section = ''
      else if (type === 'EOF') sawEof = true
      else if (type !== 'TABLE' && type !== 'ENDTAB') entityType = type
    } else if (awaitingSection && code === 2) {
      section = value.toUpperCase()
      awaitingSection = false
    } else if (section === 'HEADER') {
      if (code === 9) headerVariable = value.toUpperCase()
      else if (headerVariable === '$INSUNITS' && code === 70) insertionUnits = Number.parseInt(value, 10)
    }
    if ((code === 2 && entityType === 'LAYER') || code === 8) entityLayer = value
    if (code === 420) trueColorCount += 1
    codeLine = undefined
  }
  flushEntity()
  assert(codeLine == null, 'DXF 末尾存在无值组码')
  for (const layer of usedLayers) assert(declaredLayers.has(layer), `实体使用未声明图层 ${layer}`)
  return { faceCount, declaredLayers, usedLayers, trueColorCount, insertionUnits, sawEof }
}

async function runJSON(args) {
  const { stdout, stderr } = await execFile(binary, args, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  })
  if (stderr.trim()) throw new Error(`原生命令输出错误流: ${stderr}`)
  return JSON.parse(stdout)
}

async function runFailure(args) {
  const child = spawn(binary, args, { cwd: root, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const code = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', resolveExit)
  })
  return { code, stdout, stderr }
}

function assertNativeConvertCapabilities(capabilities) {
  assert(capabilities.host === 'go' && capabilities.singleBinary === true && capabilities.nodeRuntime === false, '原生宿主能力声明异常')
  const formats = new Map(capabilities.formats.map((format) => [format.format, format.operations]))
  assert(formats.get('d5a')?.includes('convert:dxf'), 'capabilities 缺少 d5a convert:dxf')
  assert(formats.get('glb')?.includes('convert:dxf'), 'capabilities 缺少 glb convert:dxf')
  assert(formats.get('dxf')?.includes('write'), 'capabilities 缺少 dxf write')
}

function isolatedEnvironment() {
  const result = { ...process.env }
  for (const name of Object.keys(result)) if (name.toLowerCase() === 'path') delete result[name]
  result.PATH = ''
  return result
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
