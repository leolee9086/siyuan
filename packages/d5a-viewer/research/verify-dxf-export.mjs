import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'research', 'output', 'phase7-dxf-export')
const reportPath = join(root, 'research', 'output', 'phase7-dxf-export-verification.json')
const cliPath = join(root, 'dist-cli', 'd5-tool.mjs')
const fixtures = [
  { id: 'd5a-v11', input: 'E:/D5 WorkSpace/model/_1.d5a' },
  { id: 'glb-selection', input: 'C:/Users/al765/Downloads/_1-selection.glb' },
]

await mkdir(outputDirectory, { recursive: true })
const results = []
for (const fixture of fixtures) {
  await access(fixture.input)
  const output = join(outputDirectory, `${fixture.id}.dxf`)
  const fidelity = `${output}.fidelity.json`
  const started = performance.now()
  await runCli([
    'convert', fixture.input,
    '--output', output,
    '--report', fidelity,
    '--overwrite',
    '--json',
    '--quiet',
  ])
  const [conversion, structure, metadata] = await Promise.all([
    readJson(fidelity),
    inspectDxf(output),
    stat(output),
  ])
  assert(conversion.targetFormat === 'dxf', `${fixture.id}: targetFormat 不是 dxf`)
  assert(conversion.status !== 'fail', `${fixture.id}: 保真门禁失败`)
  assert(conversion.source.triangleCount === structure.faceCount, `${fixture.id}: 源三角面与 3DFACE 数量不一致`)
  assert(conversion.roundTrip.triangleCount === structure.faceCount, `${fixture.id}: 回读三角面与 3DFACE 数量不一致`)
  assert(conversion.outputBytes === metadata.size, `${fixture.id}: 报告字节数与文件不一致`)
  assert(structure.insertionUnits === 6, `${fixture.id}: $INSUNITS 不是米制 6`)
  assert(structure.sawEof, `${fixture.id}: DXF 缺少 EOF`)
  assert(structure.layerCount > 0, `${fixture.id}: DXF 没有部件图层`)
  assert(structure.trueColorCount >= structure.layerCount, `${fixture.id}: True Color 覆盖不足`)
  results.push({
    id: fixture.id,
    input: fixture.input,
    output,
    fidelity,
    bytes: metadata.size,
    elapsedMs: performance.now() - started,
    status: conversion.status,
    sourceTriangles: conversion.source.triangleCount,
    ...structure,
    warningCodes: conversion.warnings.map((warning) => warning.code),
  })
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  command: 'npm run verify:cli-dxf',
  status: 'pass',
  fixtures: results,
}
await writeJsonAtomically(reportPath, report)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

async function runCli(args) {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('close', resolveExit)
  })
  if (exitCode !== 0) throw new Error(`CLI 退出码 ${exitCode}: ${stderr || stdout}`)
}

async function inspectDxf(path) {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Number.POSITIVE_INFINITY })
  let codeLine
  let section = ''
  let awaitingSection = false
  let headerVariable = ''
  let insertionUnits
  let faceCount = 0
  let layerCount = 0
  let trueColorCount = 0
  let sawEof = false
  for await (const line of lines) {
    if (codeLine == null) {
      codeLine = line
      continue
    }
    const code = Number.parseInt(codeLine.replace(/^\uFEFF/, '').trim(), 10)
    const value = line.trim()
    assert(Number.isInteger(code), `无效 DXF 组码 ${codeLine}`)
    if (code === 0) {
      const type = value.toUpperCase()
      if (type === 'SECTION') awaitingSection = true
      else if (type === 'ENDSEC') section = ''
      else if (type === 'EOF') sawEof = true
      else if (section === 'ENTITIES' && type === '3DFACE') faceCount += 1
      else if (section === 'TABLES' && type === 'LAYER') layerCount += 1
    } else if (awaitingSection && code === 2) {
      section = value.toUpperCase()
      awaitingSection = false
    } else if (section === 'HEADER') {
      if (code === 9) headerVariable = value.toUpperCase()
      else if (headerVariable === '$INSUNITS' && code === 70) insertionUnits = Number.parseInt(value, 10)
    }
    if (code === 420) trueColorCount += 1
    codeLine = undefined
  }
  assert(codeLine == null, 'DXF 末尾存在无值组码')
  return {
    faceCount,
    layerCount: Math.max(0, layerCount - 1),
    trueColorCount,
    insertionUnits,
    sawEof,
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJsonAtomically(path, value) {
  const temporary = `${path}.partial-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
