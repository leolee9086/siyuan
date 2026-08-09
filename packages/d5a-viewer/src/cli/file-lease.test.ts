import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireFileLease, cleanupOrphanedStagedFiles } from './file-lease'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('CLI file leases', () => {
  it('blocks a second live owner and releases only its own lease', async () => {
    const directory = await temporaryDirectory()
    const resource = join(directory, 'batch.state.json')
    const first = await acquireFileLease(resource, 'first')

    await expect(acquireFileLease(resource, 'second')).rejects.toThrow(`进程 ${process.pid}`)
    const record = JSON.parse(await readFile(first.path, 'utf8')) as { purpose: string }
    expect(record.purpose).toBe('first')

    await first.release()
    const second = await acquireFileLease(resource, 'second')
    await second.release()
  })

  it('reclaims a lease whose owner process has exited', async () => {
    const directory = await temporaryDirectory()
    const resource = join(directory, 'output.d5m')
    const path = `${resource}.d5-tool.lock`
    await writeFile(path, JSON.stringify({
      schemaVersion: 1,
      token: 'stale',
      pid: 2_147_483_647,
      createdAt: new Date(0).toISOString(),
      resource,
    }))

    const lease = await acquireFileLease(resource, 'replacement')
    const record = JSON.parse(await readFile(path, 'utf8')) as { pid: number; purpose: string }
    expect(record).toMatchObject({ pid: process.pid, purpose: 'replacement' })
    await lease.release()
  })

  it('removes only staged files owned by exited processes', async () => {
    const directory = await temporaryDirectory()
    const resource = join(directory, 'material.d5m')
    const stale = `${resource}.2147483647.100.partial.d5m`
    const live = `${resource}.${process.pid}.101.partial.d5m`
    await writeFile(stale, 'stale')
    await writeFile(live, 'live')

    expect(await cleanupOrphanedStagedFiles(resource)).toEqual([stale])
    expect(await readFile(live, 'utf8')).toBe('live')
  })

  it('reclaims an interrupted scene conversion partial only after its owner exits', async () => {
    const directory = await temporaryDirectory()
    const resource = join(directory, 'scene.glb')
    const stale = `${resource}.2147483647.100.partial`
    const live = `${resource}.${process.pid}.101.partial`
    await writeFile(stale, 'stale')
    await writeFile(live, 'live')

    expect(await cleanupOrphanedStagedFiles(resource)).toEqual([stale])
    expect(await readFile(live, 'utf8')).toBe('live')
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'd5-tool-lease-'))
  directories.push(directory)
  return directory
}
