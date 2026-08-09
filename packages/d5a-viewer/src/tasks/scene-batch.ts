export type SceneBatchOperation = 'scene.inspect' | 'scene.validate' | 'scene.convert' | 'scene.extract'

interface SceneBatchJobBase {
  id: string
  estimatedBytes?: number
  dependsOn?: string[]
}

export interface SceneBatchInspectJob extends SceneBatchJobBase {
  operation: 'scene.inspect' | 'scene.validate'
  input: string
  report?: string
}

export interface SceneBatchExtractJob extends SceneBatchJobBase {
  operation: 'scene.extract'
  input: string
  output: string
  entries?: string[]
  report?: string
  overwrite?: boolean
}

export interface SceneBatchConvertJob extends SceneBatchJobBase {
  operation: 'scene.convert'
  input: string
  output: string
  report?: string
  overwrite?: boolean
}

export type SceneBatchJob = SceneBatchInspectJob | SceneBatchExtractJob | SceneBatchConvertJob

export interface SceneBatchManifest {
  schemaVersion: 1
  jobs: SceneBatchJob[]
}

export function parseSceneBatchManifest(value: unknown): SceneBatchManifest {
  const manifest = record(value, '场景批处理清单')
  if (manifest.schemaVersion !== 1) throw new Error(`不支持的场景批处理清单版本 ${String(manifest.schemaVersion)}`)
  if (!Array.isArray(manifest.jobs)) throw new Error('场景批处理清单缺少 jobs 数组')
  const jobs = manifest.jobs.map(parseJob)
  const ids = new Set<string>()
  for (const job of jobs) {
    if (ids.has(job.id)) throw new Error(`场景批处理任务 ID 重复: ${job.id}`)
    ids.add(job.id)
  }
  assertManifestDependencies(jobs, ids)
  return { schemaVersion: 1, jobs }
}

function parseJob(value: unknown, index: number): SceneBatchJob {
  const job = record(value, `jobs[${index}]`)
  const id = nonEmptyString(job.id, `jobs[${index}].id`)
  const operation = nonEmptyString(job.operation, `jobs[${index}].operation`)
  const estimatedBytes = optionalPositiveNumber(job.estimatedBytes, `${id}.estimatedBytes`)
  const dependsOn = optionalArray(job.dependsOn, `${id}.dependsOn`, (dependency, dependencyIndex) =>
    nonEmptyString(dependency, `${id}.dependsOn[${dependencyIndex}]`))
  const base = {
    id,
    ...(estimatedBytes == null ? {} : { estimatedBytes }),
    ...(dependsOn == null ? {} : { dependsOn }),
  }
  if (operation === 'scene.inspect' || operation === 'scene.validate') {
    return {
      ...base,
      operation,
      input: nonEmptyString(job.input, `${id}.input`),
      report: optionalString(job.report, `${id}.report`),
    }
  }
  if (operation === 'scene.extract') {
    return {
      ...base,
      operation,
      input: nonEmptyString(job.input, `${id}.input`),
      output: nonEmptyString(job.output, `${id}.output`),
      entries: optionalArray(job.entries, `${id}.entries`, (entry, entryIndex) =>
        nonEmptyString(entry, `${id}.entries[${entryIndex}]`)),
      report: optionalString(job.report, `${id}.report`),
      overwrite: optionalBoolean(job.overwrite, `${id}.overwrite`),
    }
  }
  if (operation === 'scene.convert') {
    return {
      ...base,
      operation,
      input: nonEmptyString(job.input, `${id}.input`),
      output: nonEmptyString(job.output, `${id}.output`),
      report: optionalString(job.report, `${id}.report`),
      overwrite: optionalBoolean(job.overwrite, `${id}.overwrite`),
    }
  }
  throw new Error(`${id} 使用未知场景操作 ${operation}`)
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`)
  return value as Record<string, unknown>
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} 必须是非空字符串`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value == null) return undefined
  return nonEmptyString(value, label)
}

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value == null) return undefined
  if (typeof value !== 'boolean') throw new Error(`${label} 必须是布尔值`)
  return value
}

function optionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} 必须是正数`)
  return value
}

function optionalArray<Result>(
  value: unknown,
  label: string,
  parse: (value: unknown, index: number) => Result,
): Result[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组`)
  return value.map(parse)
}

function assertManifestDependencies(jobs: SceneBatchJob[], ids: Set<string>): void {
  for (const job of jobs) {
    const dependencies = new Set(job.dependsOn ?? [])
    if (dependencies.has(job.id)) throw new Error(`场景任务 ${job.id} 不能依赖自身`)
    if (dependencies.size !== (job.dependsOn?.length ?? 0)) throw new Error(`场景任务 ${job.id} 的依赖重复`)
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) throw new Error(`场景任务 ${job.id} 引用了缺失依赖 ${dependency}`)
    }
  }
  const byId = new Map(jobs.map((job) => [job.id, job]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`场景任务依赖存在循环: ${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const job of jobs) visit(job.id)
}
