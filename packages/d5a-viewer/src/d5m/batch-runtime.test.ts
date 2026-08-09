import registryJson from '../../public/generated/d5m-profile-templates.json'
import { describe, expect, it } from 'vitest'
import { parseD5mBatchManifest } from '../tasks/d5m-batch'
import { executeD5mBatchArtifactJob, type D5mBatchArtifactStorage } from './batch-runtime'
import { parseD5mTemplateRegistry } from './templates'

const registry = parseD5mTemplateRegistry(registryJson)

describe('host-neutral D5M batch runtime', () => {
  it('creates, edits and validates through an injected artifact store', async () => {
    const files = new Map<string, File>()
    const storage: D5mBatchArtifactStorage = {
      async read(path) {
        const file = files.get(path)
        if (!file) throw new Error(`missing ${path}`)
        return file
      },
      async write(path, blob, options) {
        if (!options.overwrite && files.has(path)) throw new Error(`occupied ${path}`)
        files.set(path, new File([blob], path.split('/').at(-1)!, { type: blob.type }))
      },
    }
    const manifest = parseD5mBatchManifest({
      schemaVersion: 1,
      jobs: [
        { id: 'create', operation: 'd5m.create', family: 'standard-surface', output: 'created.d5m' },
        {
          id: 'edit',
          operation: 'd5m.edit',
          dependsOn: ['create'],
          input: 'created.d5m',
          output: 'edited.d5m',
          title: 'Batch glass',
        },
        { id: 'validate', operation: 'd5m.validate', dependsOn: ['edit'], input: 'edited.d5m' },
      ],
    })

    for (const job of manifest.jobs) {
      const output = await executeD5mBatchArtifactJob(job, registry, storage)
      expect(output.status).not.toBe('warning')
    }
    expect(files.has('created.d5m')).toBe(true)
    expect(files.has('created.d5m.fidelity.json')).toBe(true)
    expect(files.has('edited.d5m')).toBe(true)
    expect(files.has('edited.d5m.fidelity.json')).toBe(true)
  })
})
