import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const outputRoot = resolve(root, 'research/output')
const workDirectory = resolve(outputRoot, 'phase7-d5m-profile-matrix')
if (!workDirectory.startsWith(`${outputRoot}${sep}`)) throw new Error('D5M profile matrix directory escapes research/output')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const registry = JSON.parse(await readFile(resolve(root, 'public/generated/d5m-profile-templates.json'), 'utf8'))
const families = new Map(registry.families.map((family) => [family.id, family]))

await rm(workDirectory, { recursive: true, force: true })
await mkdir(workDirectory, { recursive: true })

const manifest = {
  schemaVersion: 1,
  jobs: registry.profiles.flatMap((profile) => {
    const id = profile.id
    const create = `create-${id}`
    const edit = `edit-${id}`
    return [
      {
        id: create,
        operation: 'd5m.create',
        profile: id,
        title: `Profile ${id}`,
        output: `created/${id}.d5m`,
      },
      {
        id: edit,
        operation: 'd5m.edit',
        dependsOn: [create],
        input: `created/${id}.d5m`,
        output: `edited/${id}.d5m`,
        title: `Profile ${id} edited`,
      },
      {
        id: `validate-${id}`,
        operation: 'd5m.validate',
        dependsOn: [edit],
        input: `edited/${id}.d5m`,
      },
    ]
  }),
}
const manifestPath = resolve(workDirectory, 'profile-matrix-manifest.json')
await writeJson(manifestPath, manifest)

const startedAt = performance.now()
const batch = await runBatch([
  '--manifest', manifestPath,
  '--restart',
  '--overwrite',
  '--concurrency', '4',
  '--memory-mb', '128',
])
const elapsedMs = performance.now() - startedAt
const expectedJobCount = registry.profiles.length * 3
if (batch.jobs.length !== expectedJobCount) {
  throw new Error(`profile matrix has ${batch.jobs.length}/${expectedJobCount} jobs`)
}
if (batch.counts.failed || batch.counts.blocked || batch.counts.cancelled || batch.counts.pending) {
  throw new Error(`profile matrix did not finish cleanly: ${JSON.stringify(batch.counts)}`)
}
if (batch.counts.passed + batch.counts.warning !== expectedJobCount) {
  throw new Error(`profile matrix completed ${batch.counts.passed + batch.counts.warning}/${expectedJobCount} jobs`)
}
if (batch.peakActiveCount > 4 || batch.peakActiveBytes > 128 * 1024 * 1024) {
  throw new Error(`profile matrix exceeded its batch budget: ${batch.peakActiveCount} jobs / ${batch.peakActiveBytes} bytes`)
}

const jobs = new Map(batch.jobs.map((job) => [job.id, job]))
const profiles = registry.profiles.map((profile) => {
  const family = families.get(profile.familyId)
  if (!family) throw new Error(`profile ${profile.id} references a missing family`)
  const entries = [
    ['create', jobs.get(`create-${profile.id}`)],
    ['edit', jobs.get(`edit-${profile.id}`)],
    ['validate', jobs.get(`validate-${profile.id}`)],
  ]
  const operations = Object.fromEntries(entries.map(([operation, entry]) => {
    if (!entry) throw new Error(`profile ${profile.id} is missing ${operation}`)
    if (!['passed', 'warning'].includes(entry.status)) {
      throw new Error(`profile ${profile.id} ${operation} ended as ${entry.status}`)
    }
    if (entry.attempts !== 1) throw new Error(`profile ${profile.id} ${operation} ran ${entry.attempts} times`)
    if (entry.result?.profileId !== profile.id) {
      throw new Error(`profile ${profile.id} ${operation} round-tripped as ${entry.result?.profileId ?? 'unknown'}`)
    }
    if (entry.result?.familyKey !== family.key) {
      throw new Error(`profile ${profile.id} ${operation} round-tripped as family ${entry.result?.familyKey ?? 'unknown'}`)
    }
    return [operation, entry.status]
  }))
  return {
    id: profile.id,
    familyId: profile.familyId,
    familyKey: family.key,
    parameterCount: profile.parameterCount,
    textureSlots: profile.textureSlots,
    operations,
  }
})

const resultsByFamily = registry.families.map((family) => {
  const matching = profiles.filter((profile) => profile.familyId === family.id)
  return {
    id: family.id,
    key: family.key,
    status: family.status,
    profileCount: matching.length,
    operations: countOperations(matching),
  }
})
const report = {
  schemaVersion: 1,
  command: 'verify:d5m-profiles',
  status: 'pass',
  registry: {
    observedMaterialCount: registry.observedMaterialCount,
    familyCount: registry.familyCount,
    profileCount: registry.profileCount,
  },
  elapsedMs,
  batch: {
    status: batch.status,
    elapsedMs: batch.elapsedMs,
    peakActiveCount: batch.peakActiveCount,
    peakActiveBytes: batch.peakActiveBytes,
    counts: batch.counts,
  },
  families: resultsByFamily,
  profiles,
}
const reportPath = resolve(outputRoot, 'phase7-d5m-full-profile-matrix.json')
await writeJson(reportPath, report)
process.stdout.write(`${registry.profiles.length}/${registry.profiles.length} exact D5M profiles created, edited, and validated\n`)
process.stdout.write(`${reportPath}\n`)

async function runBatch(args) {
  const result = await run(process.execPath, [cli, 'd5m', 'batch', ...args, '--quiet', '--json'], {
    cwd: root,
    maxBuffer: 128 * 1024 * 1024,
  })
  return JSON.parse(result.stdout)
}

function countOperations(profiles) {
  const result = { create: { passed: 0, warning: 0 }, edit: { passed: 0, warning: 0 }, validate: { passed: 0, warning: 0 } }
  for (const profile of profiles) {
    for (const [operation, status] of Object.entries(profile.operations)) result[operation][status] += 1
  }
  return result
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
