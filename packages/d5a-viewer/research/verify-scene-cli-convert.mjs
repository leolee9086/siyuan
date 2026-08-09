import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(root, '.artifacts', `scene-cli-convert-${process.pid}`)
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-cli-convert-verification.json')
const d5aPath = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/_1.d5a')
const glbPath = resolve(process.argv[3] ?? 'C:/Users/al765/Downloads/_1-selection.glb')
const highPolyPath = resolve(process.argv[4] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a')

await mkdir(artifactDirectory, { recursive: true })

const d5aToGlb = await convertAndValidate('d5a-to-glb', d5aPath, 'ordinary.d5a.glb')
const glbToD5a = await convertAndValidate('glb-to-d5a', glbPath, 'external.glb.d5a')
const highPolyToGlb = await convertAndValidate('highpoly-d5a-to-glb', highPolyPath, 'highpoly.d5a.glb')

if (highPolyToGlb.conversion.source.triangleCount < 1_000_000) {
  throw new Error(`高面数样例三角面不足：${highPolyToGlb.conversion.source.triangleCount}`)
}
if (!Number.isFinite(highPolyToGlb.conversion.runtime?.maxRssBytes) || highPolyToGlb.conversion.runtime.maxRssBytes <= 0) {
  throw new Error('高面数转换报告没有进程 RSS 峰值')
}

const report = {
  schemaVersion: 1,
  command: 'verify:cli-convert',
  conversions: [d5aToGlb, glbToD5a, highPolyToGlb],
}
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`D5A -> GLB: ${d5aToGlb.conversion.source.triangleCount.toLocaleString()} 面 / ${d5aToGlb.conversion.status}\n`)
process.stdout.write(`GLB -> D5A: ${glbToD5a.conversion.source.triangleCount.toLocaleString()} 面 / ${glbToD5a.conversion.status}\n`)
process.stdout.write(`高面数 D5A -> GLB: ${highPolyToGlb.conversion.source.triangleCount.toLocaleString()} 面 / RSS ${(highPolyToGlb.conversion.runtime.maxRssBytes / 1024 / 1024).toFixed(1)} MB\n`)
process.stdout.write(`报告: ${reportPath}\n`)

async function convertAndValidate(id, input, outputName) {
  const output = resolve(artifactDirectory, outputName)
  const conversionReport = resolve(artifactDirectory, `${id}.fidelity.json`)
  const conversion = await runCli([
    'convert', input, '--output', output, '--report', conversionReport, '--quiet', '--json',
  ])
  if (conversion.status !== 'pass' && conversion.status !== 'warning') {
    throw new Error(`${id} 转换状态异常：${conversion.status}`)
  }
  if (conversion.checks.some((check) => check.status === 'fail')) {
    throw new Error(`${id} 存在保真门禁失败`)
  }
  if (conversion.source.triangleCount !== conversion.roundTrip.triangleCount) {
    throw new Error(`${id} 三角面数不一致`)
  }
  if (conversion.source.primitivesWithUv0 !== conversion.roundTrip.primitivesWithUv0) {
    throw new Error(`${id} UV0 primitive 数量不一致`)
  }
  if (conversion.targetFormat === 'glb' && (conversion.validator?.errors ?? -1) !== 0) {
    throw new Error(`${id} 的 GLB Validator 错误数异常：${conversion.validator?.errors}`)
  }
  if (conversion.targetFormat === 'glb' && (conversion.validator?.warnings ?? -1) !== 0) {
    throw new Error(`${id} 的 GLB Validator 警告数异常：${conversion.validator?.warnings}`)
  }
  const written = JSON.parse(await readFile(conversionReport, 'utf8'))
  if (written.output !== output || written.report !== conversionReport) {
    throw new Error(`${id} 写入的保真报告路径不一致`)
  }
  const validation = await runCli(['validate', output, '--quiet', '--json'])
  if (validation.status === 'fail' || validation.status === 'unsupported') {
    throw new Error(`${id} 输出文件检查失败：${validation.status}`)
  }
  return {
    id,
    input,
    output,
    conversion: {
      status: conversion.status,
      sourceFormat: conversion.sourceFormat,
      targetFormat: conversion.targetFormat,
      outputBytes: conversion.outputBytes,
      elapsedMs: conversion.elapsedMs,
      source: conversion.source,
      roundTrip: conversion.roundTrip,
      warnings: conversion.warnings,
      validator: conversion.validator,
      runtime: conversion.runtime,
    },
    validation: {
      status: validation.status,
      validation: validation.validation,
    },
  }
}

async function runCli(args) {
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
  if (result.code !== 0) throw new Error(`d5-tool ${args[0]} 失败：${result.stderr || result.stdout}`)
  return JSON.parse(result.stdout)
}
