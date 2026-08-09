import { describe, expect, it } from 'vitest'
import { parseD5mBatchManifest } from './d5m-batch'

describe('D5M batch manifest', () => {
  it('parses structured create, edit and validate jobs', () => {
    const manifest = parseD5mBatchManifest({
      schemaVersion: 1,
      jobs: [
        {
          id: 'create',
          operation: 'd5m.create',
          family: 'glass',
          output: 'out/glass.d5m',
          parameters: [{ name: 'Utiling', value: 'X=2 Y=0 Z=0' }],
          textures: [{ slot: 'Normal Map One', file: 'normal.png' }],
        },
        {
          id: 'edit',
          operation: 'd5m.edit',
          dependsOn: ['create'],
          input: 'out/glass.d5m',
          output: 'out/glass-edited.d5m',
          clearTextures: [{ index: 3 }],
        },
        { id: 'validate', operation: 'd5m.validate', dependsOn: ['edit'], input: 'out/glass-edited.d5m' },
      ],
    })

    expect(manifest.jobs).toHaveLength(3)
    expect(manifest.jobs[0]).toMatchObject({ operation: 'd5m.create', family: 'glass' })
    expect(manifest.jobs[1]).toMatchObject({ operation: 'd5m.edit', input: 'out/glass.d5m' })
    expect(manifest.jobs[2]).toMatchObject({ operation: 'd5m.validate' })
  })

  it('rejects duplicate IDs and ambiguous selectors', () => {
    expect(() => parseD5mBatchManifest({
      schemaVersion: 1,
      jobs: [
        { id: 'same', operation: 'd5m.validate', input: 'a.d5m' },
        { id: 'same', operation: 'd5m.validate', input: 'b.d5m' },
      ],
    })).toThrow('ID 重复')

    expect(() => parseD5mBatchManifest({
      schemaVersion: 1,
      jobs: [{
        id: 'bad',
        operation: 'd5m.create',
        output: 'bad.d5m',
        parameters: [{ name: 'Utiling', index: 0, value: 'x' }],
      }],
    })).toThrow('必须且只能提供 name 或 index')

    expect(() => parseD5mBatchManifest({
      schemaVersion: 1,
      jobs: [
        { id: 'a', operation: 'd5m.validate', input: 'a.d5m', dependsOn: ['b'] },
        { id: 'b', operation: 'd5m.validate', input: 'b.d5m', dependsOn: ['a'] },
      ],
    })).toThrow('循环')
  })
})
