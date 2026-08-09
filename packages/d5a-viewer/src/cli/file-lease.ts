import { randomUUID } from 'node:crypto'
import { open, readFile, rename, rm, stat } from 'node:fs/promises'

interface FileLeaseRecord {
  schemaVersion: 1
  token: string
  pid: number
  createdAt: string
  resource: string
  purpose?: string
}

export interface FileLease {
  path: string
  release(): Promise<void>
}

export async function acquireFileLease(resource: string, purpose?: string): Promise<FileLease> {
  const path = `${resource}.d5-tool.lock`
  const record: FileLeaseRecord = {
    schemaVersion: 1,
    token: randomUUID(),
    pid: process.pid,
    createdAt: new Date().toISOString(),
    resource,
    purpose,
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const handle = await open(path, 'wx', 0o600)
      try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`)
      } finally {
        await handle.close()
      }
      return {
        path,
        release: async () => {
          const current = await readLeaseRecord(path)
          if (current?.token === record.token) await rm(path, { force: true })
        },
      }
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) throw error
      const owner = await readLeaseRecordWithRetry(path)
      if (owner && isProcessAlive(owner.pid)) {
        throw new Error(`资源正由进程 ${owner.pid} 使用: ${resource}`)
      }
      if (!owner && !await isUnreadableLeaseStale(path)) {
        throw new Error(`资源锁正在建立，请稍后重试: ${resource}`)
      }
      const quarantine = `${path}.${process.pid}.${Date.now()}.stale`
      try {
        await rename(path, quarantine)
        await rm(quarantine, { force: true })
      } catch (renameError) {
        if (!hasErrorCode(renameError, 'ENOENT')) throw renameError
      }
    }
  }
  throw new Error(`资源锁竞争未结束: ${resource}`)
}

export async function cleanupOrphanedStagedFiles(resource: string): Promise<string[]> {
  const directory = resource.slice(0, Math.max(resource.lastIndexOf('/'), resource.lastIndexOf('\\')) + 1) || '.'
  const filename = resource.slice(directory === '.' ? 0 : directory.length)
  const { readdir } = await import('node:fs/promises')
  let names: string[]
  try {
    names = await readdir(directory)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return []
    throw error
  }
  const prefix = `${filename}.`
  const removed: string[] = []
  for (const name of names) {
    if (!name.startsWith(prefix) || !/\.partial(?:\.(?:d5m|json))?$/.test(name)) continue
    const marker = name.slice(prefix.length).match(/^(\d+)\.(\d+)\.partial(?:\.(?:d5m|json))?$/)
    if (!marker || isProcessAlive(Number(marker[1]))) continue
    const path = `${directory === '.' ? '' : directory}${name}`
    await rm(path, { force: true })
    removed.push(path)
  }
  return removed
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return hasErrorCode(error, 'EPERM')
  }
}

async function readLeaseRecordWithRetry(path: string): Promise<FileLeaseRecord | undefined> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const record = await readLeaseRecord(path)
    if (record) return record
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return undefined
}

async function readLeaseRecord(path: string): Promise<FileLeaseRecord | undefined> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<FileLeaseRecord>
    if (value.schemaVersion !== 1 || typeof value.token !== 'string' ||
        typeof value.pid !== 'number' || typeof value.resource !== 'string') return undefined
    return value as FileLeaseRecord
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || error instanceof SyntaxError) return undefined
    throw error
  }
}

async function isUnreadableLeaseStale(path: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(path)).mtimeMs >= 1_000
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return true
    throw error
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}
