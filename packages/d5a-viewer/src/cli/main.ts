#!/usr/bin/env node
import { createWriteStream, openAsBlob } from 'node:fs'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import registryJson from '../../public/generated/d5m-profile-templates.json'
import { loadD5mDocument } from '../d5m/document'
import { assertD5mFidelity, verifyD5mOutput, type D5mFidelityReport } from '../d5m/fidelity'
import {
  applyD5mDraftChanges,
  inspectD5mTask,
  prepareD5mCreation,
  type D5mDraftChanges,
  type D5mParameterOverride,
  type D5mTextureOverride,
  type D5mTextureSelector,
} from '../d5m/tasks'
import {
  parseD5mTemplateRegistry,
  type D5mFamilyTemplate,
} from '../d5m/templates'
import {
  createD5mDraft,
  writeD5mArchiveToStream,
  type D5mMaterialDraft,
  type D5mWriteStats,
} from '../d5m/writer'
import {
  createAssetTaskReporter,
  type AssetTaskOperation,
  type AssetTaskContext,
  type AssetTaskEvent,
} from '../tasks/protocol'
import {
  parseD5mBatchManifest,
  type D5mBatchChanges,
  type D5mBatchJob,
  type D5mBatchManifest,
} from '../tasks/d5m-batch'
import {
  parseSceneBatchManifest,
  type SceneBatchJob,
  type SceneBatchManifest,
} from '../tasks/scene-batch'
import {
  runTaskQueue,
  type TaskQueueItem,
  type TaskQueueResult,
} from '../tasks/queue'
import { acquireFileLease, cleanupOrphanedStagedFiles } from './file-lease'
import { createSceneFileApi, CLI_SCENE_FILE_API_PATH } from './scene-file-server'
import { startStaticWebServer } from './static-server'
import { D5aArchive } from '../core/d5a-archive'
import {
  inspectSceneFile,
  validateSceneFile,
  type SceneInspectionReport,
} from '../interchange/scene-inspection'
import {
  convertSceneFile,
  type SceneConversionFormat,
  type SceneConversionReport,
} from '../interchange/scene-conversion'

const registry = parseD5mTemplateRegistry(registryJson)

void main(process.argv.slice(2)).catch((error) => {
  if (isAbortError(error)) {
    process.stderr.write('任务已取消\n')
    process.exitCode = 130
  } else {
    process.stderr.write(`错误: ${normalizeError(error)}\n`)
    process.exitCode = 1
  }
})

async function main(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage()
    return
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write('d5-tool 0.1.0\n')
    return
  }
  if (argv[0] === 'capabilities') {
    await capabilitiesCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'serve') {
    await serveCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'inspect') {
    await inspectSceneCommand(argv.slice(1), 'inspect')
    return
  }
  if (argv[0] === 'validate') {
    await inspectSceneCommand(argv.slice(1), 'validate')
    return
  }
  if (argv[0] === 'convert') {
    await convertSceneCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'extract') {
    await extractSceneCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'view') {
    await viewSceneCommand(argv.slice(1))
    return
  }
  if (argv[0] === 'batch') {
    await sceneBatchCommand(argv.slice(1))
    return
  }
  if (argv[0] !== 'd5m') throw new Error(`未知命令 ${argv[0]}`)
  const command = argv[1]
  if (command === 'profiles') await profilesCommand(argv.slice(2))
  else if (command === 'create') await createCommand(argv.slice(2))
  else if (command === 'edit') await editCommand(argv.slice(2))
  else if (command === 'batch') await d5mBatchCommand(argv.slice(2))
  else if (command === 'validate' || command === 'inspect') await validateCommand(argv.slice(2))
  else throw new Error(`未知 D5M 命令 ${command ?? ''}`)
}

async function capabilitiesCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, [], ['json'])
  if (args.positionals.length > 0) throw new Error('capabilities 不接受位置参数')
  const result = {
    schemaVersion: 1,
    host: 'node',
    runtime: process.version,
    webUi: { serve: true, localOnly: true },
    formats: [
      {
        format: 'd5a',
        documentKind: 'scene',
        operations: ['inspect', 'view', 'convert', 'validate', 'extract', 'batch'],
        streamingOutput: true,
        structuralReport: true,
      },
      {
        format: 'glb',
        documentKind: 'scene',
        operations: ['inspect', 'view', 'convert', 'validate', 'batch'],
        validator: 'Khronos glTF Validator',
      },
      {
        format: 'dxf',
        documentKind: 'scene',
        operations: ['convert', 'batch'],
        direction: 'write',
        geometry: 'ASCII DXF 3DFACE',
        units: 'meters',
        fidelityReport: true,
      },
      {
        format: 'd5m',
        documentKind: 'material',
        operations: ['inspect', 'validate', 'create', 'edit', 'batch'],
        familyCount: registry.familyCount,
        profileCount: registry.profileCount,
        streamingOutput: true,
        fidelityReport: true,
      },
    ],
  }
  if (args.flags.has('json')) printJson(result)
  else {
    process.stdout.write('D5A 场景: inspect, view, validate, extract, batch\n')
    process.stdout.write('GLB 场景: inspect, view, validate, batch（Khronos glTF Validator）\n')
    process.stdout.write('DXF 场景: convert, batch（写出 ASCII 3DFACE、图层与 True Color）\n')
    process.stdout.write('D5M 材质: inspect, validate, create, edit, batch\n')
    process.stdout.write(`${registry.familyCount} 个材质族 / ${registry.profileCount} 个精确制式 / 流式写出 / 往返报告\n`)
  }
}

async function inspectSceneCommand(
  argv: string[],
  operation: 'inspect' | 'validate',
): Promise<void> {
  const args = parseArguments(argv, ['input', 'report'], ['json', 'quiet'])
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error(`请提供待${operation === 'inspect' ? '检查' : '校验'}的 .d5a 或 .glb 文件`)
  if (args.positionals.length > 1) throw new Error(`${operation === 'inspect' ? '场景检查' : '场景校验'}只接受一个输入文件`)
  const resolvedInput = resolve(inputPath)
  const file = await openLocalFile(resolvedInput)
  const format = sceneFormatFromPath(resolvedInput)
  const termination = createProcessAbortHandle()
  const reporter = createAssetTaskReporter(operation, 'scene', format, cliTaskContext(args.flags.has('quiet'), termination.signal))
  const started = performance.now()
  try {
    reporter.emit('started', 'inspect', `${operation === 'inspect' ? '检查' : '校验'} ${file.name}`)
    const report = await (operation === 'inspect' ? inspectSceneFile(file, {
      signal: reporter.signal,
      onProgress: (progress) => reporter.emit('progress', progress.phase, progress.message, {
        completed: progress.completed,
        total: progress.total,
      }),
    }) : validateSceneFile(file, {
      signal: reporter.signal,
      onProgress: (progress) => reporter.emit('progress', progress.phase, progress.message, {
        completed: progress.completed,
        total: progress.total,
      }),
    }))
    const output = {
      ...report,
      runtime: sceneCliRuntime(started),
    }
    reporter.emit('completed', 'ready', `${format.toUpperCase()} ${report.status}`)
    const reportPath = args.one('report')
    if (reportPath) await writeJsonAtomically(resolve(reportPath), output)
    if (args.flags.has('json')) printJson(output)
    else printSceneInspection(report, resolvedInput, reportPath ? resolve(reportPath) : undefined)
    if (operation === 'validate' && (report.status === 'fail' || report.status === 'unsupported')) process.exitCode = 1
  } finally {
    termination.dispose()
  }
}

async function convertSceneCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['input', 'output', 'format', 'report'], ['overwrite', 'json', 'quiet'])
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error('请提供待转换的 .d5a 或 .glb 文件')
  if (args.positionals.length > 1) throw new Error('场景转换只接受一个输入文件')
  const resolvedInput = resolve(inputPath)
  const output = resolve(requireValue(args.one('output'), '--output'))
  const target = sceneTargetFormatFromPath(output)
  const requestedFormat = args.one('format')
  if (requestedFormat && requestedFormat.toLowerCase() !== target) {
    throw new Error(`--format ${requestedFormat} 与输出文件扩展名 ${target} 不一致`)
  }
  const sourceFormat = sceneFormatFromPath(resolvedInput)
  if (sourceFormat === target) throw new Error('输入与目标格式相同；请指定另一种场景格式')
  const reportPath = resolve(args.one('report') ?? `${output}.fidelity.json`)
  if (output.toLocaleLowerCase() === reportPath.toLocaleLowerCase()) {
    throw new Error('输出文件与保真报告路径必须不同')
  }
  const outputLease = await acquireFileLease(output, `convert scene ${target}`)
  try {
    await prepareSceneConversionOutputs(output, reportPath, args.flags.has('overwrite'))
    const termination = createProcessAbortHandle()
    const reporter = createAssetTaskReporter('convert', 'scene', target, cliTaskContext(args.flags.has('quiet'), termination.signal))
    const started = performance.now()
    try {
      const file = await openLocalFile(resolvedInput)
      reporter.emit('started', 'open', `转换 ${file.name} -> ${target.toUpperCase()}`)
      const result = await convertSceneFile(file, {
        targetFormat: target,
        signal: reporter.signal,
        onProgress: (progress) => reporter.emit('progress', progress.phase, progress.message, {
          completed: progress.completed,
          total: progress.total,
        }),
      })
      if (result.report.status === 'fail') {
        throw new Error('场景保真门禁失败，未提交输出文件')
      }
      await writeSceneBlobAtomically(output, result.output, args.flags.has('overwrite'), reporter.signal)
      const report: SceneConversionReport & { input: string; output: string; report: string; runtime: ReturnType<typeof sceneCliRuntime> } = {
        ...result.report,
        input: resolvedInput,
        output,
        report: reportPath,
        runtime: sceneCliRuntime(started),
      }
      await writeJsonAtomically(reportPath, report)
      reporter.emit('completed', 'ready', `${sourceFormat.toUpperCase()} -> ${target.toUpperCase()} ${result.report.status}`)
      if (args.flags.has('json')) printJson(report)
      else printSceneConversion(report)
      if (result.report.status === 'warning') process.stderr.write(`警告: 转换存在 ${result.report.warnings.length} 项保真提示，详见 ${reportPath}\n`)
    } finally {
      termination.dispose()
    }
  } finally {
    await outputLease.release()
  }
}

async function prepareSceneConversionOutputs(output: string, reportPath: string, overwrite: boolean): Promise<void> {
  await Promise.all([
    cleanupOrphanedStagedFiles(output),
    cleanupOrphanedStagedFiles(reportPath),
  ])
  await assertOutputAvailable(output, overwrite)
  await assertOutputAvailable(reportPath, overwrite)
}

async function writeSceneBlobAtomically(
  output: string,
  blob: Blob,
  overwrite: boolean,
  signal?: AbortSignal,
): Promise<void> {
  throwIfTaskAborted(signal)
  await mkdir(dirname(output), { recursive: true })
  const partial = `${output}.${process.pid}.${Date.now()}.partial`
  const stream = createWriteStream(partial, { flags: 'wx' })
  try {
    await pipeline(Readable.fromWeb(blob.stream() as ReadableStream<Uint8Array>), stream, { signal })
    throwIfTaskAborted(signal)
    await replaceStagedFile(partial, output, overwrite)
  } catch (error) {
    stream.destroy()
    await rm(partial, { force: true }).catch(() => undefined)
    throw error
  }
}

function printSceneConversion(report: SceneConversionReport & { input: string; output: string; report: string }): void {
  process.stdout.write(`${basename(report.input)} -> ${basename(report.output)}: ${report.status}\n`)
  process.stdout.write(`${report.sourceFormat.toUpperCase()} -> ${report.targetFormat.toUpperCase()} / ${formatBytes(report.outputBytes)} / ${report.elapsedMs.toFixed(1)} ms\n`)
  for (const check of report.checks) {
    if (check.status === 'pass') continue
    process.stdout.write(`${check.status === 'fail' ? '失败' : '提示'}: ${check.label} ${check.expected} -> ${check.actual}${check.detail ? ` (${check.detail})` : ''}\n`)
  }
  for (const warning of report.warnings) process.stdout.write(`警告: ${warning.message}\n`)
  process.stdout.write(`保真报告 ${report.report}\n`)
}

function sceneCliRuntime(started: number) {
  const memory = process.memoryUsage()
  const resource = process.resourceUsage()
  return {
    elapsedMs: performance.now() - started,
    maxRssBytes: resource.maxRSS > 0 ? resource.maxRSS * 1024 : undefined,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  }
}

interface SceneExtractionReport {
  schemaVersion: 1
  documentKind: 'scene'
  operation: 'extract'
  status: 'pass'
  format: 'd5a'
  input: string
  outputDirectory: string
  elapsedMs: number
  entries: Array<{
    path: string
    output: string
    bytes: number
  }>
}

async function extractSceneCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['input', 'output', 'entry', 'report'], ['overwrite', 'json', 'quiet'])
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error('请提供待解包的 .d5a 文件')
  if (args.positionals.length > 1) throw new Error('场景解包只接受一个输入文件')
  const outputDirectory = resolve(requireValue(args.one('output'), '--output'))
  const resolvedInput = resolve(inputPath)
  const termination = createProcessAbortHandle()
  const reporter = createAssetTaskReporter('extract', 'scene', 'd5a', cliTaskContext(args.flags.has('quiet'), termination.signal))
  try {
    reporter.emit('started', 'extract', `解包 ${basename(resolvedInput)}`)
    const report = await extractD5aArchive({
      input: resolvedInput,
      outputDirectory,
      entries: args.many('entry'),
      overwrite: args.flags.has('overwrite'),
      signal: reporter.signal,
      onProgress: (phase, completed, total, message) => reporter.emit('progress', phase, message, { completed, total }),
    })
    reporter.emit('completed', 'ready', `已解包 ${report.entries.length} 个条目`)
    const reportPath = args.one('report')
    if (reportPath) await writeJsonAtomically(resolve(reportPath), report)
    if (args.flags.has('json')) printJson(report)
    else {
      process.stdout.write(`${basename(resolvedInput)}: 解包 ${report.entries.length} 项到 ${outputDirectory}\n`)
      process.stdout.write(`用时 ${report.elapsedMs.toFixed(1)} ms\n`)
      if (reportPath) process.stdout.write(`报告 ${resolve(reportPath)}\n`)
    }
  } finally {
    termination.dispose()
  }
}

interface SceneExtractionOptions {
  input: string
  outputDirectory: string
  entries?: readonly string[]
  overwrite?: boolean
  signal?: AbortSignal
  onProgress?: (phase: 'inspect' | 'extract', completed: number, total: number, message: string) => void
}

async function extractD5aArchive(options: SceneExtractionOptions): Promise<SceneExtractionReport> {
  if (sceneFormatFromPath(options.input) !== 'd5a') throw new Error('extract 当前只支持 .d5a 容器')
  const source = await openLocalFile(options.input)
  const started = performance.now()
  const archive = await D5aArchive.open(source, {
    signal: options.signal,
    onprogress: (completed, total) => options.onProgress?.('inspect', completed, total, '读取 D5A 文件目录'),
  })
  try {
    throwIfTaskAborted(options.signal)
    const files = archive.inspection.entries.filter((entry) => !entry.directory)
    const selected = selectArchiveEntries(files, options.entries ?? [])
    if (selected.length === 0) throw new Error('D5A 容器中没有可解包的文件条目')
    await mkdir(options.outputDirectory, { recursive: true })
    const destinations = new Set<string>()
    for (const entry of selected) {
      const destination = archiveEntryOutputPath(options.outputDirectory, entry.filename)
      const key = destination.toLocaleLowerCase()
      if (destinations.has(key)) throw new Error(`D5A 包含冲突的输出路径 ${entry.filename}`)
      destinations.add(key)
    }
    const entries: SceneExtractionReport['entries'] = []
    for (const [index, entry] of selected.entries()) {
      throwIfTaskAborted(options.signal)
      const output = archiveEntryOutputPath(options.outputDirectory, entry.filename)
      await mkdir(dirname(output), { recursive: true })
      await assertOutputAvailable(output, Boolean(options.overwrite))
      const partial = `${output}.${process.pid}.${Date.now()}.partial`
      let stream: ReturnType<typeof createWriteStream> | undefined
      try {
        stream = createWriteStream(partial, { flags: 'wx' })
        await archive.writeTo(entry.filename, Writable.toWeb(stream), {
          signal: options.signal,
          onprogress: (completed, total) => options.onProgress?.('extract', completed, total, `写入 ${entry.filename}`),
        })
        await finished(stream)
        await replaceStagedFile(partial, output, Boolean(options.overwrite))
      } catch (error) {
        stream?.destroy()
        await rm(partial, { force: true }).catch(() => undefined)
        throw error
      }
      entries.push({ path: entry.filename, output, bytes: entry.uncompressedSize })
      options.onProgress?.('extract', index + 1, selected.length, `已解包 ${entry.filename}`)
    }
    return {
      schemaVersion: 1,
      documentKind: 'scene',
      operation: 'extract',
      status: 'pass',
      format: 'd5a',
      input: options.input,
      outputDirectory: options.outputDirectory,
      elapsedMs: performance.now() - started,
      entries,
    }
  } finally {
    await archive.close()
  }
}

async function viewSceneCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['input', 'host', 'port', 'root'], ['open', 'json'])
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error('请提供待查看的 .d5a 或 .glb 文件')
  if (args.positionals.length > 1) throw new Error('场景查看只接受一个输入文件')
  const resolvedInput = resolve(inputPath)
  const format = sceneFormatFromPath(resolvedInput)
  const host = args.one('host') ?? '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('--host 只接受 127.0.0.1、localhost 或 ::1')
  }
  const port = parsePositiveInteger(args.one('port') ?? '5329', '--port')
  if (port > 65_535) throw new Error('--port 必须小于或等于 65535')
  const root = resolve(args.one('root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist'))
  const token = randomUUID()
  const sceneFile = await createSceneFileApi(resolvedInput, token)
  const web = await startStaticWebServer({
    root,
    host,
    port,
    portAttempts: 20,
    apiHandler: sceneFile.handler,
  })
  const viewUrl = new URL(web.url)
  viewUrl.searchParams.set('scene', `${CLI_SCENE_FILE_API_PATH}?token=${encodeURIComponent(token)}`)
  const output = {
    schemaVersion: 1,
    status: 'ready',
    operation: 'view',
    format,
    input: sceneFile.input,
    bytes: sceneFile.bytes,
    host: web.host,
    port: web.port,
    url: viewUrl.toString(),
  }
  if (args.flags.has('json')) printJson(output)
  else {
    process.stdout.write(`D5 本地查看器已启动: ${output.url}\n`)
    process.stdout.write(`${basename(sceneFile.input)} / ${format.toUpperCase()} / ${formatBytes(sceneFile.bytes)}\n`)
  }
  if (args.flags.has('open')) openBrowser(output.url)
  const termination = createProcessAbortHandle()
  try {
    await new Promise<void>((resolveAbort) => {
      termination.signal.addEventListener('abort', () => resolveAbort(), { once: true })
    })
  } finally {
    termination.dispose()
    await web.close()
  }
}

async function serveCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['host', 'port', 'root', 'state'], ['open', 'json'])
  if (args.positionals.length > 0) throw new Error('serve 不接受位置参数')
  const host = args.one('host') ?? '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('--host 只接受 127.0.0.1、localhost 或 ::1')
  }
  const port = parsePositiveInteger(args.one('port') ?? '5329', '--port')
  if (port > 65_535) throw new Error('--port 必须小于或等于 65535')
  const root = resolve(args.one('root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist'))
  const statePath = args.one('state') ? resolve(args.one('state')!) : undefined
  const web = await startStaticWebServer({
    root,
    host,
    port,
    portAttempts: 20,
    apiHandler: statePath ? createBatchStateApi(statePath) : undefined,
  })
  if (args.flags.has('json')) printJson({
    schemaVersion: 1,
    status: 'ready',
    host: web.host,
    port: web.port,
    url: web.url,
    root,
    state: statePath,
  })
  else {
    process.stdout.write(`D5 本地 WebUI 已启动: ${web.url}\n`)
    process.stdout.write(`静态资源: ${root}\n`)
    if (statePath) process.stdout.write(`批处理状态: ${statePath}\n`)
  }
  if (args.flags.has('open')) openBrowser(web.url)
  const termination = createProcessAbortHandle()
  try {
    await new Promise<void>((resolveAbort) => {
      termination.signal.addEventListener('abort', () => resolveAbort(), { once: true })
    })
  } finally {
    termination.dispose()
    await web.close()
  }
}

function createBatchStateApi(statePath: string) {
  return async (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse): Promise<boolean> => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/d5m-batch/state') return false
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET', 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: 'Method Not Allowed' }))
      return true
    }
    try {
      const state = JSON.parse(await readFile(statePath, 'utf8')) as unknown
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(JSON.stringify({ schemaVersion: 1, state }))
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (code === 'ENOENT') {
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ schemaVersion: 1, error: 'state-not-found' }))
      } else {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ schemaVersion: 1, error: normalizeError(error) }))
      }
    }
    return true
  }
}

function openBrowser(url: string): void {
  const [command, commandArgs] = process.platform === 'win32'
    ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]]
  spawn(command, commandArgs, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

async function profilesCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['family'], ['json'])
  if (args.positionals.length > 0) throw new Error('profiles 不接受位置参数')
  const familyValue = args.one('family')
  const family = familyValue ? resolveFamily(familyValue) : undefined
  if (args.flags.has('json')) {
    printJson(family
      ? {
          schemaVersion: 1,
          family,
          profiles: profilesForFamily(family),
        }
      : { schemaVersion: 1, families: registry.families })
    return
  }
  if (!family) {
    process.stdout.write(`已观察 ${registry.observedMaterialCount} 份普通 D5M，共 ${registry.familyCount} 个材质族 / ${registry.profileCount} 个精确制式\n`)
    for (const item of registry.families) {
      process.stdout.write(`${item.key.padEnd(18)} ${item.label.padEnd(16)} ${item.status.padEnd(11)} ${String(item.observedCount).padStart(4)} 份 / ${String(item.profileCount).padStart(3)} 制式\n`)
    }
    return
  }
  process.stdout.write(`${family.label} (${family.key})：${family.profileCount} 个精确制式\n`)
  for (const profile of profilesForFamily(family)) {
    process.stdout.write(`${profile.id}  ${String(profile.count).padStart(4)}  ${profile.parameterCount.toString().padStart(3)} 参数  ${profile.label}\n`)
  }
}

async function createCommand(argv: string[]): Promise<void> {
  const args = parseArguments(
    argv,
    [
      'profile', 'family', 'output', 'title', 'summary', 'icon', 'set', 'set-index',
      'set-secondary', 'set-secondary-index', 'texture', 'texture-index',
      'texture-secondary', 'texture-secondary-index', 'clear-texture', 'clear-texture-index',
      'clear-texture-secondary', 'clear-texture-secondary-index', 'report',
    ],
    ['overwrite', 'json', 'quiet'],
  )
  if (args.positionals.length > 0) throw new Error('d5m create 不接受位置参数')
  if (args.one('profile') && args.one('family')) throw new Error('--profile 与 --family 只能选择一个')
  const output = resolveD5mOutput(args)
  const changes = await parseD5mDraftChanges(args)
  const prepared = prepareD5mCreation(registry, {
    profile: args.one('profile'),
    family: args.one('family'),
    ...changes,
  })
  const result = await writeD5mDraftToDisk({
    operation: 'create',
    draft: prepared.draft,
    ...output,
    quiet: args.flags.has('quiet'),
    startedMessage: `按 ${prepared.family.label} / ${prepared.profile.id} 制作 D5M`,
    reportFields: {
      sourceKind: 'new',
      family: {
        id: prepared.family.id,
        key: prepared.family.key,
        label: prepared.family.label,
        status: prepared.family.status,
      },
      profile: {
        id: prepared.profile.id,
        label: prepared.profile.label,
        parameterCount: prepared.profile.parameterCount,
      },
      textureOverrides: changes.textures?.length ?? 0,
    },
  })
  if (args.flags.has('json')) printJson(result)
  else {
    process.stdout.write(`已创建 ${result.output}\n`)
    process.stdout.write(`${prepared.family.label} / ${prepared.profile.id} / ${result.outputBytes.toLocaleString()} 字节 / ${result.status}\n`)
    process.stdout.write(`保真报告 ${result.report}\n`)
  }
}

async function editCommand(argv: string[]): Promise<void> {
  const args = parseArguments(
    argv,
    [
      'input', 'output', 'title', 'summary', 'icon', 'set', 'set-index',
      'set-secondary', 'set-secondary-index', 'texture', 'texture-index',
      'texture-secondary', 'texture-secondary-index', 'clear-texture', 'clear-texture-index',
      'clear-texture-secondary', 'clear-texture-secondary-index', 'report',
    ],
    ['overwrite', 'json', 'quiet'],
  )
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error('请提供待编辑的 .d5m 文件')
  if (args.positionals.length > 1) throw new Error('D5M 编辑只接受一个输入文件')
  const resolvedInput = resolve(inputPath)
  const output = resolveD5mOutput(args)
  const sourceFile = await openLocalFile(resolvedInput)
  const source = await loadD5mDocument(sourceFile)
  let sourceClosed = false
  try {
    const draft = createD5mDraft(source)
    const changes = await parseD5mDraftChanges(args)
    applyD5mDraftChanges(draft, changes)
    const family = registry.families.find((candidate) => candidate.id === source.profile.familyId)
    const profile = registry.profiles.find((candidate) => candidate.id === source.profile.profileId)
    const result = await writeD5mDraftToDisk({
      operation: 'edit',
      draft,
      ...output,
      quiet: args.flags.has('quiet'),
      startedMessage: `编辑 ${sourceFile.name}`,
      reportFields: {
        sourceKind: 'edited',
        source: resolvedInput,
        family: {
          id: source.profile.familyId,
          key: family?.key,
          label: family?.label,
          status: family?.status,
        },
        profile: {
          id: source.profile.profileId,
          label: profile?.label,
          parameterCount: source.parameters.length,
        },
        textureOverrides: changes.textures?.length ?? 0,
        clearedTextures: changes.clearTextures?.length ?? 0,
      },
      beforeCommit: async () => {
        await source.close()
        sourceClosed = true
      },
    })
    if (args.flags.has('json')) printJson(result)
    else {
      process.stdout.write(`已编辑 ${result.output}\n`)
      process.stdout.write(`${family?.label ?? source.profile.familyId} / ${source.profile.profileId} / ${result.outputBytes.toLocaleString()} 字节 / ${result.status}\n`)
      process.stdout.write(`保真报告 ${result.report}\n`)
    }
  } finally {
    if (!sourceClosed) await source.close().catch(() => undefined)
  }
}

interface D5mOutputPaths {
  outputPath: string
  reportPath: string
  overwrite: boolean
}

interface D5mDiskWriteOptions extends D5mOutputPaths {
  operation: Extract<AssetTaskOperation, 'create' | 'edit'>
  draft: D5mMaterialDraft
  quiet: boolean
  startedMessage: string
  reportFields: Record<string, unknown>
  beforeCommit?: () => Promise<void>
  signal?: AbortSignal
  onEvent?: (event: AssetTaskEvent) => void
}

interface D5mDiskWriteResult {
  schemaVersion: 1
  status: D5mFidelityReport['status']
  format: 'd5m'
  operation: 'create' | 'edit'
  output: string
  report: string
  outputBytes: number
  write: D5mWriteStats
  fidelity: D5mFidelityReport
  [key: string]: unknown
}

function resolveD5mOutput(args: ParsedArguments): D5mOutputPaths {
  const outputValue = requireValue(args.one('output'), '--output')
  if (!outputValue.toLowerCase().endsWith('.d5m')) throw new Error('--output 必须使用 .d5m 扩展名')
  const outputPath = resolve(outputValue)
  const reportPath = resolve(args.one('report') ?? `${outputPath}.fidelity.json`)
  if (outputPath.toLowerCase() === reportPath.toLowerCase()) throw new Error('D5M 输出与保真报告路径必须不同')
  return { outputPath, reportPath, overwrite: args.flags.has('overwrite') }
}

async function parseD5mDraftChanges(args: ParsedArguments): Promise<D5mDraftChanges> {
  const parameters: D5mParameterOverride[] = [
    ...args.many('set').map((value) => parseNamedOverride(value, '参数')),
    ...args.many('set-index').map((value) => parseIndexedOverride(value, '参数')),
    ...args.many('set-secondary').map((value) => ({
      ...parseNamedOverride(value, 'matInfo2 参数'),
      parameterSet: 'matInfo2' as const,
    })),
    ...args.many('set-secondary-index').map((value) => ({
      ...parseIndexedOverride(value, 'matInfo2 参数'),
      parameterSet: 'matInfo2' as const,
    })),
  ]
  const textures: D5mTextureOverride[] = await Promise.all([
    ...args.many('texture').map((value) => parseNamedTexture(value)),
    ...args.many('texture-index').map((value) => parseIndexedTexture(value)),
    ...args.many('texture-secondary').map(async (value) => ({
      ...await parseNamedTexture(value),
      parameterSet: 'matInfo2' as const,
    })),
    ...args.many('texture-secondary-index').map(async (value) => ({
      ...await parseIndexedTexture(value),
      parameterSet: 'matInfo2' as const,
    })),
  ])
  const clearTextures: D5mTextureSelector[] = [
    ...args.many('clear-texture').map((slot) => ({ slot })),
    ...args.many('clear-texture-index').map((value) => ({ index: parseIndex(value, '纹理索引') })),
    ...args.many('clear-texture-secondary').map((slot) => ({ slot, parameterSet: 'matInfo2' as const })),
    ...args.many('clear-texture-secondary-index').map((value) => ({
      index: parseIndex(value, 'matInfo2 纹理索引'),
      parameterSet: 'matInfo2' as const,
    })),
  ]
  const iconPath = args.one('icon')
  return {
    title: args.one('title'),
    summary: args.one('summary'),
    parameters,
    textures,
    clearTextures,
    icon: iconPath ? await openLocalFile(iconPath) : undefined,
  }
}

async function writeD5mDraftToDisk(options: D5mDiskWriteOptions): Promise<D5mDiskWriteResult> {
  await mkdir(dirname(options.outputPath), { recursive: true })
  await mkdir(dirname(options.reportPath), { recursive: true })
  const outputLease = await acquireFileLease(options.outputPath, `${options.operation} D5M`)
  const marker = `${process.pid}.${Date.now()}`
  const temporaryOutput = `${options.outputPath}.${marker}.partial.d5m`
  const temporaryReport = `${options.reportPath}.${marker}.partial.json`
  const termination = options.signal ? undefined : createProcessAbortHandle()
  const signal = options.signal ?? termination?.signal
  const reporter = createAssetTaskReporter(
    options.operation,
    'material',
    'd5m',
    options.onEvent
      ? { signal, onEvent: options.onEvent }
      : cliTaskContext(options.quiet, signal),
  )
  let nodeStream: ReturnType<typeof createWriteStream> | undefined
  try {
    await Promise.all([
      cleanupOrphanedStagedFiles(options.outputPath),
      cleanupOrphanedStagedFiles(options.reportPath),
    ])
    await assertOutputAvailable(options.outputPath, options.overwrite)
    await assertOutputAvailable(options.reportPath, options.overwrite)
    reporter.emit('started', 'write', options.startedMessage)
    nodeStream = createWriteStream(temporaryOutput, { flags: 'wx' })
    const writable = Writable.toWeb(nodeStream) as WritableStream<Uint8Array>
    const write = await writeD5mArchiveToStream(options.draft, writable, {
      signal: reporter.signal,
      onProgress: (completed, total, label) => reporter.emit(
        'progress',
        'write',
        `写入 ${label}`,
        { completed, total },
      ),
    })
    await finished(nodeStream)
    reporter.emit('progress', 'verify', '从磁盘回读并核对材质与纹理', { completed: 0, total: 1 })
    const temporaryFile = await openLocalFile(temporaryOutput)
    const fidelity = await verifyD5mOutput(options.draft, temporaryFile, reporter.signal)
    assertD5mFidelity(fidelity)
    const result: D5mDiskWriteResult = {
      ...options.reportFields,
      schemaVersion: 1,
      status: fidelity.status,
      format: 'd5m',
      operation: options.operation,
      output: options.outputPath,
      report: options.reportPath,
      outputBytes: fidelity.outputBytes,
      write,
      fidelity,
    }
    await options.beforeCommit?.()
    await writeFile(temporaryReport, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
    await replaceStagedFile(temporaryOutput, options.outputPath, options.overwrite)
    await replaceStagedFile(temporaryReport, options.reportPath, options.overwrite)
    reporter.emit('completed', 'verify', 'D5M 写入与往返检查通过', { completed: 1, total: 1 })
    return result
  } catch (error) {
    nodeStream?.destroy()
    await rm(temporaryOutput, { force: true }).catch(() => undefined)
    await rm(temporaryReport, { force: true }).catch(() => undefined)
    throw error
  } finally {
    termination?.dispose()
    await outputLease.release()
  }
}

type BatchStateStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed' | 'blocked' | 'cancelled'

interface BatchStateJob<Result> {
  status: BatchStateStatus
  attempts: number
  startedAt?: string
  completedAt?: string
  elapsedMs?: number
  error?: string
  result?: Result
}

interface BatchStateEvent {
  timestamp: string
  type: 'started' | 'completed'
  id: string
  status?: BatchStateStatus
  message: string
  error?: string
}

interface BatchState<Result> {
  schemaVersion: 1
  manifest: string
  manifestSha256: string
  createdAt: string
  updatedAt: string
  jobs: Record<string, BatchStateJob<Result>>
  events: BatchStateEvent[]
}

interface BatchManifestJob {
  id: string
  operation: string
  dependsOn?: string[]
}

interface D5mBatchJobSummary {
  operation: D5mBatchJob['operation']
  status: 'pass' | 'warning'
  input?: string
  output?: string
  report?: string
  outputBytes?: number
  familyKey?: string
  profileId?: string
}

async function d5mBatchCommand(argv: string[]): Promise<void> {
  const args = parseArguments(
    argv,
    ['manifest', 'state', 'report', 'concurrency', 'memory-mb'],
    ['resume', 'retry-failed', 'restart', 'overwrite', 'json', 'quiet'],
  )
  if (args.positionals.length > 0) throw new Error('d5m batch 不接受位置参数')
  if (args.flags.has('resume') && args.flags.has('restart')) throw new Error('--resume 与 --restart 只能选择一个')
  if (args.flags.has('retry-failed') && !args.flags.has('resume')) throw new Error('--retry-failed 需要同时使用 --resume')
  const manifestPath = resolve(requireValue(args.one('manifest'), '--manifest'))
  const manifestText = await readFile(manifestPath, 'utf8')
  const manifest = parseD5mBatchManifest(JSON.parse(manifestText) as unknown)
  const manifestSha256 = createHash('sha256').update(manifestText).digest('hex')
  const statePath = resolve(args.one('state') ?? `${manifestPath}.state.json`)
  const reportPath = resolve(args.one('report') ?? `${manifestPath}.report.json`)
  const concurrency = parsePositiveInteger(args.one('concurrency') ?? '2', '--concurrency')
  const memoryMb = parsePositiveNumber(args.one('memory-mb') ?? '1024', '--memory-mb')
  const memoryBudgetBytes = Math.max(1, Math.floor(memoryMb * 1024 * 1024))
  const resume = args.flags.has('resume')
  const restart = args.flags.has('restart')
  const retryFailed = args.flags.has('retry-failed')
  const globalOverwrite = args.flags.has('overwrite')
  const quiet = args.flags.has('quiet')
  await mkdir(dirname(statePath), { recursive: true })
  const batchLease = await acquireFileLease(statePath, `D5M batch ${basename(manifestPath)}`)
  try {
  const state = await loadOrCreateBatchState<D5mBatchJobSummary>({
    statePath,
    manifestPath,
    manifest,
    manifestSha256,
    resume,
    restart,
  })
  propagateBlockedBatchJobs(manifest, state, retryFailed)
  const manifestDirectory = dirname(manifestPath)
  const jobsToRun = manifest.jobs.filter((job) => {
    const entry = state.jobs[job.id]!
    if (entry.status === 'passed' || entry.status === 'warning') return false
    if ((entry.status === 'failed' || entry.status === 'blocked') && !retryFailed) return false
    return true
  })
  await saveBatchState(statePath, state)

  const queueItems: TaskQueueItem<D5mBatchJobSummary>[] = await Promise.all(jobsToRun.map(async (job) => {
    const stateEntry = state.jobs[job.id]!
    const estimatedBytes = job.estimatedBytes ?? await estimateBatchJobBytes(job, manifestDirectory)
    return {
      id: job.id,
      estimatedBytes,
      dependsOn: (job.dependsOn ?? []).filter((dependency) => {
        const dependencyStatus = state.jobs[dependency]?.status
        return dependencyStatus !== 'passed' && dependencyStatus !== 'warning'
      }),
      run: (signal) => executeBatchJob(
        job,
        manifestDirectory,
        globalOverwrite || stateEntry.attempts > 0,
        signal,
      ),
    }
  }))

  const termination = createProcessAbortHandle()
  const startedAt = performance.now()
  try {
    const queue = await runTaskQueue(queueItems, {
      concurrency,
      memoryBudgetBytes,
      signal: termination.signal,
      onEvent: async (event) => {
        const entry = state.jobs[event.id]
        if (!entry) throw new Error(`批处理状态缺少 ${event.id}`)
        if (event.type === 'started') {
          entry.status = 'running'
          entry.attempts += 1
          entry.startedAt = new Date().toISOString()
          entry.completedAt = undefined
          entry.error = undefined
          if (!quiet) process.stderr.write(`[batch] 启动 ${event.id} · ${formatBytes(event.estimatedBytes)}\n`)
          appendBatchEvent(state, {
            type: 'started',
            id: event.id,
            status: 'running',
            message: `启动 ${event.id} · ${formatBytes(event.estimatedBytes)}`,
          })
        } else {
          entry.status = event.status ?? 'failed'
          entry.completedAt = new Date().toISOString()
          entry.elapsedMs = event.elapsedMs
          entry.error = event.error
          entry.result = event.result
          if (!quiet) process.stderr.write(`[batch] ${entry.status} ${event.id}${event.error ? ` · ${event.error}` : ''}\n`)
          appendBatchEvent(state, {
            type: 'completed',
            id: event.id,
            status: entry.status,
            message: `${entry.status} ${event.id}`,
            error: event.error,
          })
        }
        state.updatedAt = new Date().toISOString()
        await saveBatchState(statePath, state)
      },
    })
    finalizeCancelledBatchJobs(state, queue)
    state.updatedAt = new Date().toISOString()
    await saveBatchState(statePath, state)
    const report = createBatchReport({
      format: 'd5m-batch',
      manifestPath,
      statePath,
      manifestSha256,
      manifest,
      state,
      concurrency,
      memoryBudgetBytes,
      elapsedMs: performance.now() - startedAt,
      queue,
      resumed: resume,
    })
    await writeJsonAtomically(reportPath, report)
    if (args.flags.has('json')) printJson(report)
    else {
      process.stdout.write(`D5M 批处理 ${report.status}: ${report.counts.passed} 通过 / ${report.counts.warning} 警告 / ${report.counts.failed} 失败 / ${report.counts.blocked} 依赖阻止 / ${report.counts.pending} 待运行\n`)
      process.stdout.write(`峰值活动作业 ${report.peakActiveCount}，估算活动内存 ${formatBytes(report.peakActiveBytes)}\n`)
      process.stdout.write(`状态 ${statePath}\n报告 ${reportPath}\n`)
    }
    if (report.status === 'fail') process.exitCode = 1
    else if (report.status === 'cancelled') process.exitCode = 130
  } finally {
    termination.dispose()
  }
  } finally {
    await batchLease.release()
  }
}

interface SceneBatchJobSummary {
  operation: SceneBatchJob['operation']
  status: 'pass' | 'warning'
  input: string
  report?: string
  output?: string
  outputDirectory?: string
  outputBytes?: number
  extractedEntryCount?: number
  sceneStatus?: SceneInspectionReport['status']
  targetFormat?: SceneConversionFormat
}

async function sceneBatchCommand(argv: string[]): Promise<void> {
  const args = parseArguments(
    argv,
    ['manifest', 'state', 'report', 'concurrency', 'memory-mb'],
    ['resume', 'retry-failed', 'restart', 'overwrite', 'json', 'quiet'],
  )
  if (args.positionals.length > 0) throw new Error('场景 batch 不接受位置参数')
  if (args.flags.has('resume') && args.flags.has('restart')) throw new Error('--resume 与 --restart 只能选择一个')
  if (args.flags.has('retry-failed') && !args.flags.has('resume')) throw new Error('--retry-failed 需要同时使用 --resume')
  const manifestPath = resolve(requireValue(args.one('manifest'), '--manifest'))
  const manifestText = await readFile(manifestPath, 'utf8')
  const manifest = parseSceneBatchManifest(JSON.parse(manifestText) as unknown)
  const manifestSha256 = createHash('sha256').update(manifestText).digest('hex')
  const statePath = resolve(args.one('state') ?? `${manifestPath}.state.json`)
  const reportPath = resolve(args.one('report') ?? `${manifestPath}.report.json`)
  const concurrency = parsePositiveInteger(args.one('concurrency') ?? '2', '--concurrency')
  const memoryMb = parsePositiveNumber(args.one('memory-mb') ?? '1024', '--memory-mb')
  const memoryBudgetBytes = Math.max(1, Math.floor(memoryMb * 1024 * 1024))
  const resume = args.flags.has('resume')
  const restart = args.flags.has('restart')
  const retryFailed = args.flags.has('retry-failed')
  const globalOverwrite = args.flags.has('overwrite')
  const quiet = args.flags.has('quiet')
  await mkdir(dirname(statePath), { recursive: true })
  const batchLease = await acquireFileLease(statePath, `scene batch ${basename(manifestPath)}`)
  try {
    const state = await loadOrCreateBatchState<SceneBatchJobSummary>({
      statePath,
      manifestPath,
      manifest,
      manifestSha256,
      resume,
      restart,
    })
    propagateBlockedBatchJobs(manifest, state, retryFailed)
    const manifestDirectory = dirname(manifestPath)
    const jobsToRun = manifest.jobs.filter((job) => {
      const entry = state.jobs[job.id]!
      if (entry.status === 'passed' || entry.status === 'warning') return false
      if ((entry.status === 'failed' || entry.status === 'blocked') && !retryFailed) return false
      return true
    })
    await saveBatchState(statePath, state)

    const queueItems: TaskQueueItem<SceneBatchJobSummary>[] = await Promise.all(jobsToRun.map(async (job) => {
      const stateEntry = state.jobs[job.id]!
      const estimatedBytes = job.estimatedBytes ?? await estimateSceneBatchJobBytes(job, manifestDirectory)
      return {
        id: job.id,
        estimatedBytes,
        dependsOn: (job.dependsOn ?? []).filter((dependency) => {
          const dependencyStatus = state.jobs[dependency]?.status
          return dependencyStatus !== 'passed' && dependencyStatus !== 'warning'
        }),
        run: (signal) => executeSceneBatchJob(
          job,
          manifestDirectory,
          globalOverwrite || stateEntry.attempts > 0,
          signal,
          quiet ? undefined : (phase, completed, total, message) => {
            process.stderr.write(`[batch:${job.id}:${phase}] ${completed}/${total} ${message}\n`)
          },
        ),
      }
    }))

    const termination = createProcessAbortHandle()
    const startedAt = performance.now()
    try {
      const queue = await runTaskQueue(queueItems, {
        concurrency,
        memoryBudgetBytes,
        signal: termination.signal,
        onEvent: async (event) => {
          const entry = state.jobs[event.id]
          if (!entry) throw new Error(`场景批处理状态缺少 ${event.id}`)
          if (event.type === 'started') {
            entry.status = 'running'
            entry.attempts += 1
            entry.startedAt = new Date().toISOString()
            entry.completedAt = undefined
            entry.error = undefined
            if (!quiet) process.stderr.write(`[batch] 启动 ${event.id} · ${formatBytes(event.estimatedBytes)}\n`)
            appendBatchEvent(state, {
              type: 'started',
              id: event.id,
              status: 'running',
              message: `启动 ${event.id} · ${formatBytes(event.estimatedBytes)}`,
            })
          } else {
            entry.status = event.status ?? 'failed'
            entry.completedAt = new Date().toISOString()
            entry.elapsedMs = event.elapsedMs
            entry.error = event.error
            entry.result = event.result
            if (!quiet) process.stderr.write(`[batch] ${entry.status} ${event.id}${event.error ? ` · ${event.error}` : ''}\n`)
            appendBatchEvent(state, {
              type: 'completed',
              id: event.id,
              status: entry.status,
              message: `${entry.status} ${event.id}`,
              error: event.error,
            })
          }
          state.updatedAt = new Date().toISOString()
          await saveBatchState(statePath, state)
        },
      })
      finalizeCancelledBatchJobs(state, queue)
      state.updatedAt = new Date().toISOString()
      await saveBatchState(statePath, state)
      const report = createBatchReport({
        format: 'scene-batch',
        manifestPath,
        statePath,
        manifestSha256,
        manifest,
        state,
        concurrency,
        memoryBudgetBytes,
        elapsedMs: performance.now() - startedAt,
        queue,
        resumed: resume,
      })
      await writeJsonAtomically(reportPath, report)
      if (args.flags.has('json')) printJson(report)
      else {
        process.stdout.write(`场景批处理 ${report.status}: ${report.counts.passed} 通过 / ${report.counts.warning} 警告 / ${report.counts.failed} 失败 / ${report.counts.blocked} 依赖阻止 / ${report.counts.pending} 待运行\n`)
        process.stdout.write(`峰值活动作业 ${report.peakActiveCount}，估算活动内存 ${formatBytes(report.peakActiveBytes)}\n`)
        process.stdout.write(`状态 ${statePath}\n报告 ${reportPath}\n`)
      }
      if (report.status === 'fail') process.exitCode = 1
      else if (report.status === 'cancelled') process.exitCode = 130
    } finally {
      termination.dispose()
    }
  } finally {
    await batchLease.release()
  }
}

async function executeSceneBatchJob(
  job: SceneBatchJob,
  baseDirectory: string,
  resumeOverwrite: boolean,
  signal?: AbortSignal,
  onProgress?: (phase: string, completed: number, total: number, message: string) => void,
): Promise<{ status?: 'pass' | 'warning'; result: SceneBatchJobSummary }> {
  const input = resolveBatchPath(baseDirectory, job.input)
  if (job.operation === 'scene.convert') {
    const output = resolveBatchPath(baseDirectory, job.output)
    const sourceFormat = sceneFormatFromPath(input)
    const targetFormat = sceneTargetFormatFromPath(output)
    if (sourceFormat === targetFormat) throw new Error(`${job.id} 的输入与输出格式相同`)
    const reportPath = resolveBatchPath(baseDirectory, job.report ?? `${job.output}.fidelity.json`)
    if (output.toLocaleLowerCase() === reportPath.toLocaleLowerCase()) {
      throw new Error(`${job.id} 的输出与保真报告路径必须不同`)
    }
    const overwrite = resumeOverwrite || Boolean(job.overwrite)
    const outputLease = await acquireFileLease(output, `batch scene.convert ${job.id}`)
    try {
      await prepareSceneConversionOutputs(output, reportPath, overwrite)
      const started = performance.now()
      const file = await openLocalFile(input)
      const conversion = await convertSceneFile(file, {
        targetFormat,
        signal,
        onProgress: (progress) => onProgress?.(progress.phase, progress.completed, progress.total, progress.message),
      })
      if (conversion.report.status === 'fail') throw new Error(`${job.id} 场景保真门禁失败`)
      await writeSceneBlobAtomically(output, conversion.output, overwrite, signal)
      const report: SceneConversionReport & {
        input: string
        output: string
        report: string
        runtime: ReturnType<typeof sceneCliRuntime>
      } = {
        ...conversion.report,
        input,
        output,
        report: reportPath,
        runtime: sceneCliRuntime(started),
      }
      await writeJsonAtomically(reportPath, report)
      return {
        status: conversion.report.status,
        result: {
          operation: job.operation,
          status: conversion.report.status,
          input,
          output,
          report: reportPath,
          outputBytes: conversion.report.outputBytes,
          targetFormat,
        },
      }
    } finally {
      await outputLease.release()
    }
  }
  if (job.operation === 'scene.extract') {
    const outputDirectory = resolveBatchPath(baseDirectory, job.output)
    const report = await extractD5aArchive({
      input,
      outputDirectory,
      entries: job.entries,
      overwrite: resumeOverwrite || Boolean(job.overwrite),
      signal,
      onProgress,
    })
    const reportPath = job.report ? resolveBatchPath(baseDirectory, job.report) : undefined
    if (reportPath) await writeJsonAtomically(reportPath, report)
    return {
      result: {
        operation: job.operation,
        status: 'pass',
        input,
        report: reportPath,
        outputDirectory,
        extractedEntryCount: report.entries.length,
        outputBytes: report.entries.reduce((total, entry) => total + entry.bytes, 0),
      },
    }
  }

  const started = performance.now()
  const file = await openLocalFile(input)
  const report = await (job.operation === 'scene.inspect'
    ? inspectSceneFile(file, {
        signal,
        onProgress: (progress) => onProgress?.(progress.phase, progress.completed, progress.total, progress.message),
      })
    : validateSceneFile(file, {
        signal,
        onProgress: (progress) => onProgress?.(progress.phase, progress.completed, progress.total, progress.message),
      }))
  const reportPath = job.report ? resolveBatchPath(baseDirectory, job.report) : undefined
  if (reportPath) await writeJsonAtomically(reportPath, { ...report, runtime: sceneCliRuntime(started) })
  if (report.status === 'fail') throw new Error(`${job.id} ${job.operation} 失败`)
  const status = report.status === 'warning' || report.status === 'unsupported' ? 'warning' : 'pass'
  return {
    status,
    result: {
      operation: job.operation,
      status,
      input,
      report: reportPath,
      outputBytes: file.size,
      sceneStatus: report.status,
    },
  }
}

async function estimateSceneBatchJobBytes(job: SceneBatchJob, baseDirectory: string): Promise<number> {
  const inputBytes = await safeFileSize(resolveBatchPath(baseDirectory, job.input))
  const baseBytes = job.operation === 'scene.convert'
    ? 256 * 1024 * 1024
    : job.operation === 'scene.validate'
      ? 64 * 1024 * 1024
      : 32 * 1024 * 1024
  const multiplier = job.operation === 'scene.convert'
    ? 12
    : job.operation === 'scene.validate'
      ? 2
      : 1
  return baseBytes + inputBytes * multiplier
}

async function executeBatchJob(
  job: D5mBatchJob,
  baseDirectory: string,
  resumeOverwrite: boolean,
  signal?: AbortSignal,
): Promise<{ status?: 'pass' | 'warning'; result: D5mBatchJobSummary }> {
  if (job.operation === 'd5m.validate') {
    const input = resolveBatchPath(baseDirectory, job.input)
    const file = await openLocalFile(input)
    const report = await inspectD5mTask(file, registry, { signal })
    const reportPath = job.report ? resolveBatchPath(baseDirectory, job.report) : undefined
    if (reportPath) await writeJsonAtomically(reportPath, report)
    return {
      status: report.status,
      result: {
        operation: job.operation,
        status: report.status,
        input,
        report: reportPath,
        outputBytes: file.size,
        familyKey: report.material.familyKey,
        profileId: report.material.profileId,
      },
    }
  }

  const changes = await materializeBatchChanges(job, baseDirectory)
  const outputPath = resolveBatchPath(baseDirectory, job.output)
  const reportPath = resolveBatchPath(baseDirectory, job.report ?? `${job.output}.fidelity.json`)
  if (job.operation === 'd5m.create') {
    const prepared = prepareD5mCreation(registry, {
      profile: job.profile,
      family: job.family,
      ...changes,
    })
    const output = await writeD5mDraftToDisk({
      operation: 'create',
      draft: prepared.draft,
      outputPath,
      reportPath,
      overwrite: resumeOverwrite || Boolean(job.overwrite),
      quiet: true,
      signal,
      startedMessage: `批处理创建 ${job.id}`,
      reportFields: {
        sourceKind: 'new',
        batchJobId: job.id,
        family: { id: prepared.family.id, key: prepared.family.key, label: prepared.family.label },
        profile: { id: prepared.profile.id, label: prepared.profile.label },
      },
    })
    return {
      status: output.status === 'warning' ? 'warning' : 'pass',
      result: {
        operation: job.operation,
        status: output.status === 'warning' ? 'warning' : 'pass',
        output: output.output,
        report: output.report,
        outputBytes: output.outputBytes,
        familyKey: prepared.family.key,
        profileId: prepared.profile.id,
      },
    }
  }

  const input = resolveBatchPath(baseDirectory, job.input)
  const sourceFile = await openLocalFile(input)
  const source = await loadD5mDocument(sourceFile, { signal })
  let sourceClosed = false
  try {
    const draft = createD5mDraft(source)
    applyD5mDraftChanges(draft, changes)
    const family = registry.families.find((candidate) => candidate.id === source.profile.familyId)
    const output = await writeD5mDraftToDisk({
      operation: 'edit',
      draft,
      outputPath,
      reportPath,
      overwrite: resumeOverwrite || Boolean(job.overwrite),
      quiet: true,
      signal,
      startedMessage: `批处理编辑 ${job.id}`,
      reportFields: {
        sourceKind: 'edited',
        batchJobId: job.id,
        source: input,
        family: { id: source.profile.familyId, key: family?.key, label: family?.label },
        profile: { id: source.profile.profileId },
      },
      beforeCommit: async () => {
        await source.close()
        sourceClosed = true
      },
    })
    return {
      status: output.status === 'warning' ? 'warning' : 'pass',
      result: {
        operation: job.operation,
        status: output.status === 'warning' ? 'warning' : 'pass',
        input,
        output: output.output,
        report: output.report,
        outputBytes: output.outputBytes,
        familyKey: family?.key,
        profileId: source.profile.profileId,
      },
    }
  } finally {
    if (!sourceClosed) await source.close().catch(() => undefined)
  }
}

async function materializeBatchChanges(
  changes: D5mBatchChanges,
  baseDirectory: string,
): Promise<D5mDraftChanges> {
  return {
    title: changes.title,
    summary: changes.summary,
    parameters: changes.parameters,
    clearTextures: changes.clearTextures,
    textures: await Promise.all((changes.textures ?? []).map(async (texture) => {
      const file = await openLocalFile(resolveBatchPath(baseDirectory, texture.file))
      return { slot: texture.slot, index: texture.index, blob: file, filename: file.name }
    })),
    icon: changes.icon ? await openLocalFile(resolveBatchPath(baseDirectory, changes.icon)) : undefined,
  }
}

async function estimateBatchJobBytes(job: D5mBatchJob, baseDirectory: string): Promise<number> {
  const baseBytes = 16 * 1024 * 1024
  if (job.operation === 'd5m.validate') {
    return baseBytes + await safeFileSize(resolveBatchPath(baseDirectory, job.input))
  }
  const inputBytes = job.operation === 'd5m.edit'
    ? await safeFileSize(resolveBatchPath(baseDirectory, job.input))
    : 0
  const textureBytes = await Promise.all((job.textures ?? []).map((texture) =>
    safeFileSize(resolveBatchPath(baseDirectory, texture.file))))
  const iconBytes = job.icon ? await safeFileSize(resolveBatchPath(baseDirectory, job.icon)) : 0
  return baseBytes + inputBytes + iconBytes + textureBytes.reduce((total, size) => total + size, 0)
}

async function safeFileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

function resolveBatchPath(baseDirectory: string, path: string): string {
  return resolve(baseDirectory, path)
}

function propagateBlockedBatchJobs<Job extends BatchManifestJob, Result>(
  manifest: { jobs: Job[] },
  state: BatchState<Result>,
  retryFailed: boolean,
): void {
  if (retryFailed) return
  let changed = true
  while (changed) {
    changed = false
    for (const job of manifest.jobs) {
      const entry = state.jobs[job.id]
      if (!entry || entry.status !== 'pending') continue
      const dependency = (job.dependsOn ?? []).find((id) => {
        const status = state.jobs[id]?.status
        return status === 'failed' || status === 'blocked'
      })
      if (!dependency) continue
      entry.status = 'blocked'
      entry.error = `依赖任务 ${dependency} 未通过`
      entry.completedAt = new Date().toISOString()
      changed = true
    }
  }
}

function finalizeCancelledBatchJobs<Result>(
  state: BatchState<Result>,
  queue: TaskQueueResult<Result>,
): void {
  for (const item of queue.items) {
    const entry = state.jobs[item.id]
    if (!entry || item.status !== 'cancelled' || entry.status !== 'running') continue
    entry.status = 'cancelled'
    entry.completedAt = new Date().toISOString()
    entry.elapsedMs = item.elapsedMs
    entry.error = item.error
    appendBatchEvent(state, {
      type: 'completed',
      id: item.id,
      status: 'cancelled',
      message: `cancelled ${item.id}`,
      error: item.error,
    })
  }
}

async function loadOrCreateBatchState<Result>(options: {
  statePath: string
  manifestPath: string
  manifest: { jobs: BatchManifestJob[] }
  manifestSha256: string
  resume: boolean
  restart: boolean
}): Promise<BatchState<Result>> {
  const exists = await pathExists(options.statePath)
  if (exists && !options.resume && !options.restart) {
    throw new Error(`状态文件 ${options.statePath} 已存在；继续执行使用 --resume，重新开始使用 --restart`)
  }
  if (exists && options.resume) {
    const state = JSON.parse(await readFile(options.statePath, 'utf8')) as BatchState<Result>
    if (state.schemaVersion !== 1) throw new Error(`不支持的批处理状态版本 ${String(state.schemaVersion)}`)
    if (state.manifestSha256 !== options.manifestSha256) throw new Error('批处理清单已变化，状态文件与当前清单不匹配')
    for (const job of options.manifest.jobs) {
      if (!state.jobs[job.id]) throw new Error(`批处理状态缺少任务 ${job.id}`)
      if (state.jobs[job.id]!.status === 'running' || state.jobs[job.id]!.status === 'cancelled') {
        state.jobs[job.id]!.status = 'pending'
      }
    }
    state.events ??= []
    state.updatedAt = new Date().toISOString()
    return state
  }
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    manifest: options.manifestPath,
    manifestSha256: options.manifestSha256,
    createdAt: now,
    updatedAt: now,
    jobs: Object.fromEntries(options.manifest.jobs.map((job) => [job.id, { status: 'pending', attempts: 0 }])),
    events: [],
  }
}

function appendBatchEvent<Result>(state: BatchState<Result>, event: Omit<BatchStateEvent, 'timestamp'>): void {
  state.events ??= []
  state.events.push({ ...event, timestamp: new Date().toISOString() })
  if (state.events.length > 1_000) state.events.splice(0, state.events.length - 1_000)
}

async function saveBatchState<Result>(path: string, state: BatchState<Result>): Promise<void> {
  await writeJsonAtomically(path, state)
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.partial.json`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
  try {
    await replaceStagedFile(temporaryPath, path, true)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

function createBatchReport<Job extends BatchManifestJob, Result>(options: {
  format: string
  manifestPath: string
  statePath: string
  manifestSha256: string
  manifest: { jobs: Job[] }
  state: BatchState<Result>
  concurrency: number
  memoryBudgetBytes: number
  elapsedMs: number
  queue: TaskQueueResult<Result>
  resumed: boolean
}) {
  const entries = options.manifest.jobs.map((job) => ({ id: job.id, operation: job.operation, ...options.state.jobs[job.id] }))
  const counts = {
    passed: entries.filter((entry) => entry.status === 'passed').length,
    warning: entries.filter((entry) => entry.status === 'warning').length,
    failed: entries.filter((entry) => entry.status === 'failed').length,
    blocked: entries.filter((entry) => entry.status === 'blocked').length,
    cancelled: entries.filter((entry) => entry.status === 'cancelled').length,
    pending: entries.filter((entry) => entry.status === 'pending' || entry.status === 'running').length,
  }
  const status = counts.cancelled > 0 || options.queue.status === 'cancelled'
    ? 'cancelled'
    : counts.failed > 0 || counts.blocked > 0 || counts.pending > 0
      ? 'fail'
      : counts.warning > 0
        ? 'warning'
        : 'pass'
  return {
    schemaVersion: 1,
    format: options.format,
    status,
    manifest: options.manifestPath,
    manifestSha256: options.manifestSha256,
    state: options.statePath,
    resumed: options.resumed,
    concurrency: options.concurrency,
    memoryBudgetBytes: options.memoryBudgetBytes,
    elapsedMs: options.elapsedMs,
    peakActiveCount: options.queue.peakActiveCount,
    peakActiveBytes: options.queue.peakActiveBytes,
    counts,
    jobs: entries,
  }
}

async function validateCommand(argv: string[]): Promise<void> {
  const args = parseArguments(argv, ['input', 'report'], ['json', 'quiet'])
  const inputPath = args.one('input') ?? args.positionals[0]
  if (!inputPath) throw new Error('请提供待检查的 .d5m 文件')
  if (args.positionals.length > 1) throw new Error('D5M 检查只接受一个输入文件')
  const termination = createProcessAbortHandle()
  try {
    const file = await openLocalFile(inputPath)
    const report = await inspectD5mTask(
      file,
      registry,
      cliTaskContext(args.flags.has('quiet'), termination.signal),
    )
    const reportPath = args.one('report')
    if (reportPath) {
      const resolvedReport = resolve(reportPath)
      await mkdir(dirname(resolvedReport), { recursive: true })
      await writeFile(resolvedReport, `${JSON.stringify(report, null, 2)}\n`)
    }
    if (args.flags.has('json')) printJson(report)
    else {
      process.stdout.write(`${report.file.name}: ${report.status}\n`)
      process.stdout.write(`${report.material.familyLabel ?? report.material.familyId} / ${report.material.profileLabel ?? report.material.profileId}\n`)
      process.stdout.write(`${report.material.parameterCount} 参数 / ${report.material.resolvedTextures}/${report.material.textureReferences} 纹理引用已解析\n`)
      for (const warning of report.warnings) process.stdout.write(`警告: ${warning}\n`)
    }
  } finally {
    termination.dispose()
  }
}

function cliTaskContext(quiet: boolean, signal?: AbortSignal): AssetTaskContext {
  return quiet ? { signal } : { signal, onEvent: printTaskEvent }
}

interface ProcessAbortHandle {
  signal: AbortSignal
  dispose(): void
}

function createProcessAbortHandle(): ProcessAbortHandle {
  const controller = new AbortController()
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  if (process.platform === 'win32') signals.push('SIGBREAK')
  const handleTermination = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException(`收到 ${signal}`, 'AbortError'))
    }
  }
  for (const signal of signals) process.once(signal, handleTermination)
  return {
    signal: controller.signal,
    dispose() {
      for (const signal of signals) process.off(signal, handleTermination)
    },
  }
}

function printTaskEvent(event: AssetTaskEvent): void {
  const progress = event.total != null && event.completed != null
    ? ` ${event.completed}/${event.total}`
    : ''
  process.stderr.write(`[${event.phase}]${progress} ${event.message}\n`)
}

function resolveFamily(value: string): D5mFamilyTemplate {
  const matches = registry.families.filter((family) =>
    family.id === value || family.key === value || family.label === value)
  if (matches.length !== 1) throw new Error(matches.length === 0
    ? `未找到 D5M 材质族 ${value}`
    : `D5M 材质族名称 ${value} 不唯一，请使用族 ID`)
  return matches[0]!
}

function profilesForFamily(family: D5mFamilyTemplate) {
  return registry.profiles
    .filter((profile) => profile.familyId === family.id)
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
}

async function parseNamedTexture(value: string): Promise<D5mTextureOverride> {
  const [slot, path] = splitAssignment(value, '纹理')
  const file = await openLocalFile(path)
  return { slot, blob: file, filename: file.name }
}

async function parseIndexedTexture(value: string): Promise<D5mTextureOverride> {
  const [rawIndex, path] = splitAssignment(value, '纹理索引')
  const index = parseIndex(rawIndex, '纹理索引')
  const file = await openLocalFile(path)
  return { index, blob: file, filename: file.name }
}

function parseNamedOverride(value: string, label: string): D5mParameterOverride {
  const [name, parameterValue] = splitAssignment(value, label)
  return { name, value: parameterValue }
}

function parseIndexedOverride(value: string, label: string): D5mParameterOverride {
  const [rawIndex, parameterValue] = splitAssignment(value, `${label}索引`)
  return { index: parseIndex(rawIndex, `${label}索引`), value: parameterValue }
}

function splitAssignment(value: string, label: string): [string, string] {
  const separator = value.indexOf('=')
  if (separator <= 0) throw new Error(`${label}覆盖必须使用 名称=值`)
  return [value.slice(0, separator), value.slice(separator + 1)]
}

function parseIndex(value: string, label: string): number {
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0) throw new Error(`${label}必须是非负整数`)
  return index
}

function parsePositiveInteger(value: string, label: string): number {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} 必须是正整数`)
  return number
}

function parsePositiveNumber(value: string, label: string): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} 必须是正数`)
  return number
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

async function openLocalFile(path: string): Promise<File> {
  const resolvedPath = resolve(path)
  const info = await stat(resolvedPath)
  if (!info.isFile()) throw new Error(`${resolvedPath} 不是文件`)
  const blob = await openAsBlob(resolvedPath)
  return new File([blob], basename(resolvedPath), {
    type: mimeFromFilename(resolvedPath),
    lastModified: info.mtimeMs,
  })
}

async function assertOutputAvailable(path: string, overwrite: boolean): Promise<void> {
  if (overwrite) return
  try {
    await access(path)
  } catch {
    return
  }
  throw new Error(`${path} 已存在；确认替换时使用 --overwrite`)
}

async function replaceStagedFile(temporaryPath: string, targetPath: string, overwrite: boolean): Promise<void> {
  if (!overwrite) {
    await rename(temporaryPath, targetPath)
    return
  }
  const backupPath = `${targetPath}.${process.pid}.${Date.now()}.previous`
  await rm(backupPath, { force: true })
  let backedUp = false
  try {
    if (await pathExists(targetPath)) {
      await rename(targetPath, backupPath)
      backedUp = true
    }
    await rename(temporaryPath, targetPath)
    if (backedUp) await rm(backupPath, { force: true })
  } catch (error) {
    if (backedUp && !await pathExists(targetPath)) {
      await rename(backupPath, targetPath).catch(() => undefined)
    }
    throw error
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function mimeFromFilename(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'glb') return 'model/gltf-binary'
  if (extension === 'dxf') return 'application/dxf'
  if (extension === 'd5a') return 'application/zip'
  if (extension === 'd5m') return 'application/zip'
  return 'application/octet-stream'
}

function sceneFormatFromPath(path: string): 'd5a' | 'glb' {
  if (/\.d5a$/i.test(path)) return 'd5a'
  if (/\.glb$/i.test(path)) return 'glb'
  throw new Error('场景 CLI 当前只支持 .d5a 或 .glb 文件')
}

function sceneTargetFormatFromPath(path: string): SceneConversionFormat {
  if (/\.dxf$/i.test(path)) return 'dxf'
  return sceneFormatFromPath(path)
}

function selectArchiveEntries<T extends { filename: string }>(
  entries: readonly T[],
  requested: readonly string[],
): T[] {
  if (requested.length === 0) return [...entries]
  const byPath = new Map(entries.map((entry) => [canonicalArchiveEntryPath(entry.filename), entry]))
  const selected: T[] = []
  const selectedPaths = new Set<string>()
  for (const path of requested) {
    const canonical = canonicalArchiveEntryPath(path)
    const entry = byPath.get(canonical)
    if (!entry) throw new Error(`D5A 中未找到 ${path}`)
    if (selectedPaths.has(canonical)) continue
    selectedPaths.add(canonical)
    selected.push(entry)
  }
  return selected
}

function archiveEntryOutputPath(outputDirectory: string, archivePath: string): string {
  const normalized = archivePath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '')
  const segments = normalized.split('/')
  if (!normalized || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes(':'))) {
    throw new Error(`D5A 条目路径不安全：${archivePath}`)
  }
  const output = resolve(outputDirectory, ...segments)
  const outputRelative = relative(outputDirectory, output)
  if (!outputRelative || outputRelative === '..' || outputRelative.startsWith('../') || outputRelative.startsWith('..\\')) {
    throw new Error(`D5A 条目路径超出输出目录：${archivePath}`)
  }
  return output
}

function canonicalArchiveEntryPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').toLocaleLowerCase()
}

function printSceneInspection(report: SceneInspectionReport, input: string, reportPath?: string): void {
  process.stdout.write(`${basename(input)}: ${report.format.toUpperCase()} ${report.status}\n`)
  if (report.d5a) {
    process.stdout.write(`${report.d5a.variant} / ${report.d5a.fileEntryCount} 文件条目 / ${formatBytes(report.d5a.uncompressedBytes)} 解包体积\n`)
    for (const bundle of report.d5a.bundles) {
      if (bundle.mesh) {
        process.stdout.write(`${bundle.meshEntry}: v${bundle.mesh.version} / ${bundle.mesh.triangleCount.toLocaleString()} 面 / ${bundle.mesh.vertexCount.toLocaleString()} 顶点 / ${bundle.mesh.descriptorCount} 描述符\n`)
      } else {
        process.stdout.write(`${bundle.meshEntry}: 受保护载荷，仅保留容器记录\n`)
      }
    }
  }
  if (report.glb) {
    process.stdout.write(`GLB 2 / ${report.glb.meshCount} 网格 / ${report.glb.primitiveCount} primitive / ${report.glb.triangleCount.toLocaleString()} 面 / ${report.glb.materialCount} 材质\n`)
  }
  if (report.validation) {
    process.stdout.write(`${report.validation.engine}: ${report.validation.errorCount} 错误 / ${report.validation.warningCount} 警告\n`)
  }
  for (const warning of report.warnings) process.stdout.write(`警告: ${warning}\n`)
  if (reportPath) process.stdout.write(`报告 ${reportPath}\n`)
}

interface ParsedArguments {
  positionals: string[]
  flags: Set<string>
  values: Map<string, string[]>
  one(name: string): string | undefined
  many(name: string): string[]
}

function parseArguments(argv: string[], valueOptions: string[], flagOptions: string[]): ParsedArguments {
  const allowedValues = new Set(valueOptions)
  const allowedFlags = new Set(flagOptions)
  const values = new Map<string, string[]>()
  const flags = new Set<string>()
  const positionals: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const separator = token.indexOf('=')
    const name = token.slice(2, separator > 0 ? separator : undefined)
    if (allowedFlags.has(name)) {
      if (separator > 0) throw new Error(`--${name} 不接受值`)
      flags.add(name)
      continue
    }
    if (!allowedValues.has(name)) throw new Error(`未知选项 --${name}`)
    const value = separator > 0 ? token.slice(separator + 1) : argv[++index]
    if (value == null || (separator < 0 && value.startsWith('--'))) throw new Error(`--${name} 缺少值`)
    const items = values.get(name) ?? []
    items.push(value)
    values.set(name, items)
  }
  return {
    positionals,
    flags,
    values,
    one(name) {
      const items = values.get(name) ?? []
      if (items.length > 1 && ![
        'set', 'set-index', 'texture', 'texture-index', 'clear-texture', 'clear-texture-index',
      ].includes(name)) {
        throw new Error(`--${name} 只能提供一次`)
      }
      return items.at(-1)
    },
    many(name) {
      return values.get(name) ?? []
    },
  }
}

function requireValue(value: string | undefined, option: string): string {
  if (!value) throw new Error(`${option} 缺少值`)
  return value
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
}

function throwIfTaskAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('任务已取消', 'AbortError')
}

function printUsage(): void {
  process.stdout.write('d5-tool 0.1.0\n\n')
  process.stdout.write('用法:\n')
  process.stdout.write('  d5-tool capabilities [--json]\n')
  process.stdout.write('  d5-tool serve [--host 127.0.0.1] [--port 5329] [--state <状态.json>] [--open]\n')
  process.stdout.write('  d5-tool inspect <输入.d5a|输入.glb> [--report <报告.json>] [--json]\n')
  process.stdout.write('  d5-tool view <输入.d5a|输入.glb> [--host 127.0.0.1] [--port 5329] [--open] [--json]\n')
  process.stdout.write('  d5-tool validate <输入.d5a|输入.glb> [--report <报告.json>] [--json]\n')
  process.stdout.write('  d5-tool convert <输入.d5a|输入.glb> --output <输出.d5a|输出.glb|输出.dxf> [--report <报告.json>] [--overwrite] [--json]\n')
  process.stdout.write('  d5-tool extract <输入.d5a> --output <目录> [--entry <归档路径>] [--overwrite] [--json]\n')
  process.stdout.write('  d5-tool batch --manifest <场景任务.json> [--resume] [--retry-failed] [选项]\n')
  process.stdout.write('  d5-tool d5m profiles [--family <族 ID/键>] [--json]\n')
  process.stdout.write('  d5-tool d5m create (--profile <制式 ID> | --family <族 ID/键>) --output <文件.d5m> [选项]\n')
  process.stdout.write('  d5-tool d5m edit <输入.d5m> --output <文件.d5m> [选项]\n')
  process.stdout.write('  d5-tool d5m validate <文件.d5m> [--report <报告.json>] [--json]\n\n')
  process.stdout.write('  d5-tool d5m batch --manifest <任务.json> [--resume] [--retry-failed] [选项]\n\n')
  process.stdout.write('D5M 创建/编辑选项:\n')
  process.stdout.write('  --title <名称>                 设置材质名称\n')
  process.stdout.write('  --summary <文本>              设置 summary.txt\n')
  process.stdout.write('  --icon <图片>                 设置材质缩略图\n')
  process.stdout.write('  --set <参数名=值>              按名称覆盖参数，可重复\n')
  process.stdout.write('  --set-index <索引=值>          按索引覆盖参数，可重复\n')
  process.stdout.write('  --texture <纹理槽=文件>        绑定纹理，可重复\n')
  process.stdout.write('  --texture-index <索引=文件>    按索引绑定纹理，可重复\n')
  process.stdout.write('  --clear-texture <纹理槽>       清空纹理引用，可重复\n')
  process.stdout.write('  --clear-texture-index <索引>   按索引清空纹理引用，可重复\n')
  process.stdout.write('  --report <文件.json>           指定保真报告路径\n')
  process.stdout.write('  --overwrite                    替换已有输出\n')
  process.stdout.write('  --json                         将结果写为 JSON\n')
  process.stdout.write('  --quiet                        隐藏进度事件\n')
  process.stdout.write('\n场景批处理清单操作:\n')
  process.stdout.write('  scene.inspect                  检查 D5A 或 GLB 容器\n')
  process.stdout.write('  scene.validate                 校验 D5A 或 GLB；GLB 使用 Khronos Validator\n')
  process.stdout.write('  scene.convert                  D5A/GLB 互转或写出 DXF，并生成保真报告\n')
  process.stdout.write('  scene.extract                  流式解包 D5A，可指定 entries 数组\n')
  process.stdout.write('\n批处理共享选项:\n')
  process.stdout.write('  --state <文件.json>            指定可恢复状态文件\n')
  process.stdout.write('  --concurrency <数量>           最大并发作业数，默认 2\n')
  process.stdout.write('  --memory-mb <MiB>              活动作业估算内存预算，默认 1024\n')
  process.stdout.write('  --resume                       从状态文件继续并跳过已通过项\n')
  process.stdout.write('  --retry-failed                 继续时重试失败项\n')
  process.stdout.write('  --restart                      忽略已有状态重新执行\n')
}
