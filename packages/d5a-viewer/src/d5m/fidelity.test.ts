import { describe, expect, it } from 'vitest'
import { assertD5mFidelity, verifyD5mOutput } from './fidelity'
import { createD5mDraft, writeD5mArchive } from './writer'

describe('D5M fidelity gate', () => {
  it('reopens output and verifies structure, references, and exact override bytes', async () => {
    const draft = createD5mDraft()
    draft.material = {
      id: 'NEW-MATERIAL',
      title: 'Round trip',
      uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
      type: 0,
      unknown: { remains: true },
    }
    draft.parameters = [
      { name: 'Diffuse Map', type: 3, value: 'um/new/albedo.tif', unknown: 'kept' },
      { name: 'AoIntensity', type: 1, value: 'X=0.25 Y=0 Z=1' },
      { name: 'AOIntensity', type: 1, value: 'X=0.75 Y=0 Z=1' },
    ]
    draft.resources.set(
      'textures/um/new/albedo.tif',
      new Blob([new Uint8Array([1, 3, 5, 7, 9])], { type: 'image/tiff' }),
    )
    draft.summary = 'Round trip'
    const result = await writeD5mArchive(draft)
    const file = new File([result.blob], 'round-trip.d5m')
    const report = await verifyD5mOutput(draft, file)
    expect(report.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'resource-bytes')?.detail)
      .toContain('2 个新增或替换资源字节一致')
    expect(() => assertD5mFidelity(report)).not.toThrow()

    draft.parameters[1]!.value = 'X=0.5 Y=0 Z=1'
    const mismatch = await verifyD5mOutput(draft, file)
    expect(mismatch.status).toBe('fail')
    expect(() => assertD5mFidelity(mismatch)).toThrow('参数签名、顺序与大小写')
  })
})
