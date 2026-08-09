import { describe, expect, it } from 'vitest'
import { createDraftFromTemplate, clearDraftTexture, setDraftTexture, type D5mProfileTemplate } from './templates'

const profile: D5mProfileTemplate = {
  id: 'profile',
  familyId: 'family',
  count: 10,
  label: '通用表面',
  parameterCount: 2,
  textureSlots: ['Diffuse Map'],
  encoding: 'utf-16le',
  material: {
    id: '',
    title: 'Template',
    uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
    matInfo: JSON.stringify([
      { name: 'Diffuse Map', type: 3, value: '', unknown: 'kept' },
      { name: 'Roughness', type: 1, value: 'X=0.5 Y=0 Z=0' },
    ]),
    unknownTopLevel: { kept: true },
  },
  provenance: { source: 'material/example.d5m', observedExamples: 8 },
}

describe('D5M creation templates', () => {
  it('creates a new draft while preserving the exact profile structure', () => {
    const draft = createDraftFromTemplate(profile, 'My material')
    expect(draft.material.title).toBe('My material')
    expect(draft.material.id).toMatch(/^[A-F0-9]{32}$/)
    expect(draft.material.unknownTopLevel).toEqual({ kept: true })
    expect(draft.parameters[0]?.unknown).toBe('kept')
    expect(draft.encoding).toBe('utf-16le')
    expect(draft.bom).toBe(true)
  })

  it('binds and clears generated texture resources without changing the slot name', () => {
    const draft = createDraftFromTemplate(profile)
    const value = setDraftTexture(
      draft,
      0,
      new File([new Uint8Array([1, 2, 3])], 'albedo.TIFF'),
    )
    expect(value).toMatch(/^um\/[A-F0-9]{32}\/[A-F0-9]{32}\.tiff$/)
    expect(draft.parameters[0]?.name).toBe('Diffuse Map')
    expect(draft.resources.get(`textures/${value}`)?.size).toBe(3)
    clearDraftTexture(draft, 0)
    expect(draft.parameters[0]?.value).toBe('')
    expect(draft.resources.size).toBe(0)
  })
})
