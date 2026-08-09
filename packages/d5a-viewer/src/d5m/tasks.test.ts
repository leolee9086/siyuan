import { describe, expect, it } from 'vitest'
import registryJson from '../../public/generated/d5m-profile-templates.json'
import { loadD5mDocument } from './document'
import { verifyD5mOutput } from './fidelity'
import {
  applyD5mDraftChanges,
  createD5mBlobArtifact,
  inspectD5mTask,
  prepareD5mCreation,
} from './tasks'
import { parseD5mTemplateRegistry } from './templates'
import { createD5mDraft, writeD5mArchiveToStream } from './writer'
import type { AssetTaskEvent } from '../tasks/protocol'

const registry = parseD5mTemplateRegistry(registryJson)
const png = new Blob([
  new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00,
  ]),
], { type: 'image/png' })

describe('D5M shared creation tasks', () => {
  it('prepares an observed profile with parameter and texture overrides', () => {
    const prepared = prepareD5mCreation(registry, {
      family: 'standard-surface',
      title: 'Task material',
      parameters: [{ name: 'Utiling', value: 'X=2.000000 Y=0.000000 Z=0.000000' }],
      textures: [{ slot: 'Diffuse Map', blob: png, filename: 'albedo.png' }],
    })

    expect(prepared.family.key).toBe('standard-surface')
    expect(prepared.profile.id).toBe('2bf583c6dc71338a')
    expect(prepared.draft.material.title).toBe('Task material')
    expect(prepared.draft.parameters.find((parameter) => parameter.name === 'Utiling')?.value).toContain('X=2.000000')
    expect(prepared.draft.parameters.find((parameter) => parameter.name === 'Diffuse Map')?.value).toMatch(/\.png$/)
    expect([...prepared.draft.resources.keys()]).toHaveLength(1)
  })

  it('uses the same event and fidelity pipeline for browser artifacts', async () => {
    const prepared = prepareD5mCreation(registry, { family: 'water', title: 'Task water' })
    const events: AssetTaskEvent[] = []
    const artifact = await createD5mBlobArtifact(prepared.draft, 'task-water.d5m', {
      taskId: 'task-water',
      onEvent: (event) => events.push(event),
    })

    expect(artifact.file.name).toBe('task-water.d5m')
    expect(artifact.report.status).toBe('pass')
    expect(events[0]).toMatchObject({ taskId: 'task-water', type: 'started', phase: 'write' })
    expect(events.at(-1)).toMatchObject({ type: 'completed', phase: 'verify' })

    const inspection = await inspectD5mTask(artifact.file, registry)
    expect(inspection.status).toBe('pass')
    expect(inspection.material).toMatchObject({
      familyKey: 'water',
      registeredFamily: true,
      registeredProfile: true,
    })
  })

  it('writes directly to a supplied stream and passes a fresh disk-style readback', async () => {
    const prepared = prepareD5mCreation(registry, {
      profile: '2bf583c6dc71338a',
      textures: [{ slot: 'Diffuse Map', blob: png, filename: 'stream.png' }],
    })
    const chunks: ArrayBuffer[] = []
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        const copy = new Uint8Array(chunk.byteLength)
        copy.set(chunk)
        chunks.push(copy.buffer)
      },
    })
    const stats = await writeD5mArchiveToStream(prepared.draft, writable)
    const output = new File(chunks, 'streamed.d5m', { type: 'application/zip' })
    const report = await verifyD5mOutput(prepared.draft, output)

    expect(stats.entryCount).toBe(3)
    expect(output.size).toBeGreaterThan(png.size)
    expect(report.status).toBe('pass')
  })

  it('edits a loaded D5M while preserving untouched source resources', async () => {
    const created = prepareD5mCreation(registry, {
      profile: '2bf583c6dc71338a',
      textures: [{ slot: 'Diffuse Map', blob: png, filename: 'source.png' }],
    })
    const sourceArtifact = await createD5mBlobArtifact(created.draft, 'source.d5m')
    const source = await loadD5mDocument(sourceArtifact.file)
    try {
      const draft = createD5mDraft(source)
      applyD5mDraftChanges(draft, {
        title: 'Edited material',
        summary: 'Edited summary',
        clearTextures: [{ slot: 'Diffuse Map' }],
        icon: png,
      })
      const chunks: ArrayBuffer[] = []
      const stats = await writeD5mArchiveToStream(draft, new WritableStream<Uint8Array>({
        write(chunk) {
          const copy = new Uint8Array(chunk.byteLength)
          copy.set(chunk)
          chunks.push(copy.buffer)
        },
      }))
      const output = new File(chunks, 'edited.d5m', { type: 'application/zip' })
      const report = await verifyD5mOutput(draft, output)
      const inspection = await inspectD5mTask(output, registry)

      expect(stats.copiedEntryCount).toBe(1)
      expect(report.status).toBe('pass')
      expect(inspection.material.title).toBe('Edited material')
      expect(inspection.material.textureReferences).toBe(0)
      expect(inspection.material.registeredProfile).toBe(true)
    } finally {
      await source.close()
    }
  })
})
