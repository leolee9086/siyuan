import { describe, expect, it } from 'vitest'
import { parseSceneBatchManifest } from './scene-batch'

describe('scene batch manifest', () => {
  it('parses inspect, validate, convert and extract jobs', () => {
    const manifest = parseSceneBatchManifest({
      schemaVersion: 1,
      jobs: [
        { id: 'inspect', operation: 'scene.inspect', input: 'source.d5a', report: 'reports/source.json' },
        { id: 'validate', operation: 'scene.validate', input: 'source.glb', dependsOn: ['inspect'] },
        {
          id: 'convert',
          operation: 'scene.convert',
          input: 'source.d5a',
          output: 'converted/source.glb',
          report: 'reports/conversion.json',
          overwrite: true,
          dependsOn: ['inspect'],
        },
        {
          id: 'extract',
          operation: 'scene.extract',
          input: 'source.d5a',
          output: 'extract',
          entries: ['info.json', 'textures/base.png'],
          overwrite: true,
        },
      ],
    })

    expect(manifest.jobs).toHaveLength(4)
    expect(manifest.jobs[0]).toMatchObject({ operation: 'scene.inspect', input: 'source.d5a' })
    expect(manifest.jobs[1]).toMatchObject({ operation: 'scene.validate', dependsOn: ['inspect'] })
    expect(manifest.jobs[2]).toMatchObject({ operation: 'scene.convert', output: 'converted/source.glb', overwrite: true })
    expect(manifest.jobs[3]).toMatchObject({ operation: 'scene.extract', entries: ['info.json', 'textures/base.png'] })
  })

  it('rejects malformed operations and dependency graphs', () => {
    expect(() => parseSceneBatchManifest({
      schemaVersion: 1,
      jobs: [{ id: 'convert', operation: 'scene.convert', input: 'source.d5a' }],
    })).toThrow('convert.output')

    expect(() => parseSceneBatchManifest({
      schemaVersion: 1,
      jobs: [{ id: 'unknown', operation: 'scene.transcode', input: 'source.d5a' }],
    })).toThrow('未知场景操作')

    expect(() => parseSceneBatchManifest({
      schemaVersion: 1,
      jobs: [
        { id: 'a', operation: 'scene.inspect', input: 'a.d5a', dependsOn: ['b'] },
        { id: 'b', operation: 'scene.extract', input: 'b.d5a', output: 'out', dependsOn: ['a'] },
      ],
    })).toThrow('循环')
  })
})
