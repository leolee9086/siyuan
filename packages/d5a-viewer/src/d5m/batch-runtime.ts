import type { AssetTaskEvent } from '../tasks/protocol'
import type {
  D5mBatchChanges,
  D5mBatchJob,
} from '../tasks/d5m-batch'
import { loadD5mDocument } from './document'
import {
  applyD5mDraftChanges,
  createD5mBlobArtifact,
  inspectD5mTask,
  prepareD5mCreation,
  type D5mDraftChanges,
} from './tasks'
import type { D5mTemplateRegistry } from './templates'
import { createD5mDraft } from './writer'

export interface D5mBatchArtifactStorage {
  read(path: string): Promise<File>
  write(path: string, blob: Blob, options: { overwrite: boolean; signal?: AbortSignal }): Promise<void>
}

export interface D5mBatchRuntimeOptions {
  signal?: AbortSignal
  overwrite?: boolean
  onTaskEvent?: (event: AssetTaskEvent) => void
}

export interface D5mBatchArtifactSummary {
  operation: D5mBatchJob['operation']
  status: 'pass' | 'warning'
  input?: string
  output?: string
  report?: string
  outputBytes?: number
  familyKey?: string
  profileId?: string
}

export async function executeD5mBatchArtifactJob(
  job: D5mBatchJob,
  registry: D5mTemplateRegistry,
  storage: D5mBatchArtifactStorage,
  options: D5mBatchRuntimeOptions = {},
): Promise<{ status?: 'pass' | 'warning'; result: D5mBatchArtifactSummary }> {
  throwIfAborted(options.signal)
  if (job.operation === 'd5m.validate') {
    const file = await storage.read(job.input)
    const report = await inspectD5mTask(file, registry, {
      taskId: job.id,
      signal: options.signal,
      onEvent: options.onTaskEvent,
    })
    if (job.report) {
      await writeJson(storage, job.report, report, Boolean(options.overwrite), options.signal)
    }
    return {
      status: report.status,
      result: {
        operation: job.operation,
        status: report.status,
        input: job.input,
        report: job.report,
        outputBytes: file.size,
        familyKey: report.material.familyKey,
        profileId: report.material.profileId,
      },
    }
  }

  const changes = await materializeChanges(job, storage)
  if (job.operation === 'd5m.create') {
    const prepared = prepareD5mCreation(registry, {
      profile: job.profile,
      family: job.family,
      ...changes,
    })
    const artifact = await createD5mBlobArtifact(prepared.draft, filename(job.output), {
      taskId: job.id,
      signal: options.signal,
      onEvent: options.onTaskEvent,
    })
    const overwrite = Boolean(options.overwrite || job.overwrite)
    const reportPath = job.report ?? `${job.output}.fidelity.json`
    await storage.write(job.output, artifact.file, { overwrite, signal: options.signal })
    await writeJson(storage, reportPath, artifact.report, overwrite, options.signal)
    const status = artifact.report.status === 'warning' ? 'warning' : 'pass'
    return {
      status,
      result: {
        operation: job.operation,
        status,
        output: job.output,
        report: reportPath,
        outputBytes: artifact.file.size,
        familyKey: prepared.family.key,
        profileId: prepared.profile.id,
      },
    }
  }

  const sourceFile = await storage.read(job.input)
  const source = await loadD5mDocument(sourceFile, { signal: options.signal })
  try {
    const draft = createD5mDraft(source)
    applyD5mDraftChanges(draft, changes)
    const artifact = await createD5mBlobArtifact(draft, filename(job.output), {
      taskId: job.id,
      signal: options.signal,
      onEvent: options.onTaskEvent,
    }, 'edit')
    const overwrite = Boolean(options.overwrite || job.overwrite)
    const reportPath = job.report ?? `${job.output}.fidelity.json`
    await storage.write(job.output, artifact.file, { overwrite, signal: options.signal })
    await writeJson(storage, reportPath, artifact.report, overwrite, options.signal)
    const family = registry.families.find((candidate) => candidate.id === source.profile.familyId)
    const status = artifact.report.status === 'warning' ? 'warning' : 'pass'
    return {
      status,
      result: {
        operation: job.operation,
        status,
        input: job.input,
        output: job.output,
        report: reportPath,
        outputBytes: artifact.file.size,
        familyKey: family?.key,
        profileId: source.profile.profileId,
      },
    }
  } finally {
    await source.close().catch(() => undefined)
  }
}

export async function estimateD5mBatchArtifactBytes(
  job: D5mBatchJob,
  storage: Pick<D5mBatchArtifactStorage, 'read'>,
): Promise<number> {
  if (job.estimatedBytes) return job.estimatedBytes
  const baseBytes = 16 * 1024 * 1024
  const paths = [
    ...(job.operation === 'd5m.create' ? [] : [job.input]),
    ...(job.operation === 'd5m.validate' ? [] : [
      ...(job.textures ?? []).map((texture) => texture.file),
      ...(job.icon ? [job.icon] : []),
    ]),
  ]
  const sizes = await Promise.all(paths.map(async (path) => {
    try {
      return (await storage.read(path)).size
    } catch {
      return 0
    }
  }))
  return baseBytes + sizes.reduce((total, size) => total + size, 0)
}

async function materializeChanges(
  changes: D5mBatchChanges,
  storage: D5mBatchArtifactStorage,
): Promise<D5mDraftChanges> {
  return {
    title: changes.title,
    summary: changes.summary,
    parameters: changes.parameters,
    clearTextures: changes.clearTextures,
    textures: await Promise.all((changes.textures ?? []).map(async (texture) => {
      const file = await storage.read(texture.file)
      return { slot: texture.slot, index: texture.index, blob: file, filename: file.name }
    })),
    icon: changes.icon ? await storage.read(changes.icon) : undefined,
  }
}

async function writeJson(
  storage: D5mBatchArtifactStorage,
  path: string,
  value: unknown,
  overwrite: boolean,
  signal?: AbortSignal,
): Promise<void> {
  await storage.write(path, new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  }), { overwrite, signal })
}

function filename(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) || 'material.d5m'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('D5M 批处理已取消', 'AbortError')
}
