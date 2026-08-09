export interface D5mBatchParameterOverride {
  name?: string
  index?: number
  value: string
}

export interface D5mBatchTextureOverride {
  slot?: string
  index?: number
  file: string
}

export interface D5mBatchTextureSelector {
  slot?: string
  index?: number
}

export interface D5mBatchChanges {
  title?: string
  summary?: string
  icon?: string
  parameters?: D5mBatchParameterOverride[]
  textures?: D5mBatchTextureOverride[]
  clearTextures?: D5mBatchTextureSelector[]
}

interface D5mBatchJobBase {
  id: string
  estimatedBytes?: number
  dependsOn?: string[]
}

export interface D5mBatchCreateJob extends D5mBatchJobBase, D5mBatchChanges {
  operation: 'd5m.create'
  profile?: string
  family?: string
  output: string
  report?: string
  overwrite?: boolean
}

export interface D5mBatchEditJob extends D5mBatchJobBase, D5mBatchChanges {
  operation: 'd5m.edit'
  input: string
  output: string
  report?: string
  overwrite?: boolean
}

export interface D5mBatchValidateJob extends D5mBatchJobBase {
  operation: 'd5m.validate'
  input: string
  report?: string
}

export type D5mBatchJob = D5mBatchCreateJob | D5mBatchEditJob | D5mBatchValidateJob

export interface D5mBatchManifest {
  schemaVersion: 1
  jobs: D5mBatchJob[]
}

export function parseD5mBatchManifest(value: unknown): D5mBatchManifest {
  const manifest = record(value, '批处理清单')
  if (manifest.schemaVersion !== 1) throw new Error(`不支持的批处理清单版本 ${String(manifest.schemaVersion)}`)
  if (!Array.isArray(manifest.jobs)) throw new Error('批处理清单缺少 jobs 数组')
  const jobs = manifest.jobs.map(parseJob)
  const ids = new Set<string>()
  for (const job of jobs) {
    if (ids.has(job.id)) throw new Error(`批处理任务 ID 重复: ${job.id}`)
    ids.add(job.id)
  }
  assertManifestDependencies(jobs, ids)
  return { schemaVersion: 1, jobs }
}

function parseJob(value: unknown, index: number): D5mBatchJob {
  const job = record(value, `jobs[${index}]`)
  const id = nonEmptyString(job.id, `jobs[${index}].id`)
  const operation = nonEmptyString(job.operation, `jobs[${index}].operation`)
  const estimatedBytes = optionalPositiveNumber(job.estimatedBytes, `jobs[${index}].estimatedBytes`)
  const dependsOn = optionalArray(job.dependsOn, `jobs[${index}].dependsOn`, (dependency, dependencyIndex) =>
    nonEmptyString(dependency, `jobs[${index}].dependsOn[${dependencyIndex}]`))
  const base = {
    id,
    ...(estimatedBytes == null ? {} : { estimatedBytes }),
    ...(dependsOn == null ? {} : { dependsOn }),
  }
  if (operation === 'd5m.validate') {
    return {
      ...base,
      operation,
      input: nonEmptyString(job.input, `${id}.input`),
      report: optionalString(job.report, `${id}.report`),
    }
  }
  if (operation === 'd5m.create') {
    const profile = optionalString(job.profile, `${id}.profile`)
    const family = optionalString(job.family, `${id}.family`)
    if (profile && family) throw new Error(`${id} 的 profile 与 family 只能选择一个`)
    return {
      ...base,
      operation,
      profile,
      family,
      output: nonEmptyString(job.output, `${id}.output`),
      report: optionalString(job.report, `${id}.report`),
      overwrite: optionalBoolean(job.overwrite, `${id}.overwrite`),
      ...parseChanges(job, id),
    }
  }
  if (operation === 'd5m.edit') {
    return {
      ...base,
      operation,
      input: nonEmptyString(job.input, `${id}.input`),
      output: nonEmptyString(job.output, `${id}.output`),
      report: optionalString(job.report, `${id}.report`),
      overwrite: optionalBoolean(job.overwrite, `${id}.overwrite`),
      ...parseChanges(job, id),
    }
  }
  throw new Error(`${id} 使用未知操作 ${operation}`)
}

function parseChanges(job: Record<string, unknown>, id: string): D5mBatchChanges {
  return {
    title: optionalString(job.title, `${id}.title`),
    summary: optionalString(job.summary, `${id}.summary`, true),
    icon: optionalString(job.icon, `${id}.icon`),
    parameters: optionalArray(job.parameters, `${id}.parameters`, (value, index) => {
      const override = record(value, `${id}.parameters[${index}]`)
      const selector = parseSelector(override, `${id}.parameters[${index}]`, 'name')
      return { ...selector, value: stringValue(override.value, `${id}.parameters[${index}].value`) }
    }),
    textures: optionalArray(job.textures, `${id}.textures`, (value, index) => {
      const override = record(value, `${id}.textures[${index}]`)
      const selector = parseSelector(override, `${id}.textures[${index}]`, 'slot')
      return { ...selector, file: nonEmptyString(override.file, `${id}.textures[${index}].file`) }
    }),
    clearTextures: optionalArray(job.clearTextures, `${id}.clearTextures`, (value, index) =>
      parseSelector(record(value, `${id}.clearTextures[${index}]`), `${id}.clearTextures[${index}]`, 'slot')),
  }
}

function parseSelector(
  value: Record<string, unknown>,
  label: string,
  nameKey: 'name' | 'slot',
): { name?: string; slot?: string; index?: number } {
  const name = optionalString(value[nameKey], `${label}.${nameKey}`)
  const index = optionalNonNegativeInteger(value.index, `${label}.index`)
  if ((name ? 1 : 0) + (index == null ? 0 : 1) !== 1) {
    throw new Error(`${label} 必须且只能提供 ${nameKey} 或 index`)
  }
  return name ? { [nameKey]: name } : { index }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`)
  return value as Record<string, unknown>
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} 必须是非空字符串`)
  return value
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} 必须是字符串`)
  return value
}

function optionalString(value: unknown, label: string, allowEmpty = false): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error(`${label} 必须是字符串`)
  return value
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

function optionalNonNegativeInteger(value: unknown, label: string): number | undefined {
  if (value == null) return undefined
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`${label} 必须是非负整数`)
  return Number(value)
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

function assertManifestDependencies(jobs: D5mBatchJob[], ids: Set<string>): void {
  for (const job of jobs) {
    const dependencies = new Set(job.dependsOn ?? [])
    if (dependencies.has(job.id)) throw new Error(`任务 ${job.id} 不能依赖自身`)
    if (dependencies.size !== (job.dependsOn?.length ?? 0)) throw new Error(`任务 ${job.id} 的依赖重复`)
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) throw new Error(`任务 ${job.id} 引用了缺失依赖 ${dependency}`)
    }
  }
  const byId = new Map(jobs.map((job) => [job.id, job]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`任务依赖存在循环: ${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const job of jobs) visit(job.id)
}
