import { describe, expect, it } from 'vitest'
import registryJson from '../../public/generated/d5m-profile-templates.json'
import { assertD5mFidelity, verifyD5mOutput } from './fidelity'
import { describeD5mPreview } from './material-runtime'
import {
  createDraftFromTemplate,
  setDraftTexture,
  type D5mTemplateRegistry,
} from './templates'
import { writeD5mArchive } from './writer'

const registry = registryJson as D5mTemplateRegistry
const validationTexture = new File([
  Uint8Array.from(atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV+XWQAAAABJRU5ErkJggg==',
  ), (character) => character.charCodeAt(0)),
], 'validation.png', { type: 'image/png' })

describe('D5M observed profile registry', () => {
  it('creates and round-trips every observed profile with all declared texture slots', async () => {
    expect(registry.familyCount).toBe(10)
    expect(registry.profileCount).toBe(272)
    expect(registry.profiles).toHaveLength(registry.profileCount)

    const verifiedByFamily = new Map<string, number>()
    for (const profile of registry.profiles) {
      const draft = createDraftFromTemplate(profile, `Validation ${profile.id}`)
      const textureParameters = draft.parameters
        .map((parameter, index) => ({ parameter, index }))
        .filter(({ parameter }) => parameter.type === 3)
      expect(textureParameters.map(({ parameter }) => parameter.name)).toEqual(profile.textureSlots)
      for (const { index } of textureParameters) {
        setDraftTexture(draft, index, validationTexture)
      }

      const written = await writeD5mArchive(draft)
      const output = new File([written.blob], `${profile.id}.d5m`, { type: 'application/zip' })
      const report = await verifyD5mOutput(draft, output)
      assertD5mFidelity(report)
      expect(report.status).toBe('pass')
      expect(report.checks.find((check) => check.id === 'material-profile')?.status).toBe('pass')
      verifiedByFamily.set(profile.familyId, (verifiedByFamily.get(profile.familyId) ?? 0) + 1)
    }

    expect(Object.fromEntries(verifiedByFamily)).toEqual(Object.fromEntries(
      registry.families.map((family) => [family.id, family.profileCount]),
    ))
  }, 60_000)

  it('maps every observed texture slot into the preview descriptor', () => {
    const families = new Map(registry.families.map((family) => [family.id, family]))
    const observedSlots = new Set<string>()
    const mappedSlots = new Set<string>()

    for (const profile of registry.profiles) {
      const family = families.get(profile.familyId)
      expect(family).toBeDefined()
      const draft = createDraftFromTemplate(profile, `Preview ${profile.id}`)
      for (const [index, parameter] of draft.parameters.entries()) {
        if (parameter.type !== 3) continue
        observedSlots.add(parameter.name)
        parameter.value = `textures/preview/${profile.id}-${index}.png`
      }

      const descriptor = describeD5mPreview(draft.parameters, family!.key)
      for (const texture of descriptor.textures) {
        mappedSlots.add(texture.slot)
        expect(texture.value).toContain(`textures/preview/${profile.id}-`)
        expect(texture.uv.repeat.every(Number.isFinite)).toBe(true)
        expect(texture.uv.offset.every(Number.isFinite)).toBe(true)
        expect(Number.isFinite(texture.uv.rotation)).toBe(true)
      }
      expect(descriptor.textures.map((texture) => texture.slot).sort()).toEqual([...profile.textureSlots].sort())
    }

    expect([...mappedSlots].sort()).toEqual([...observedSlots].sort())
  })

  it('sanitizes the ordinary grass matInfo2 slots and round-trips their new resources', async () => {
    const profile = registry.profiles.find((candidate) => candidate.id === '33606f14d08434f8')
    expect(profile).toBeDefined()
    const draft = createDraftFromTemplate(profile!, 'Secondary grass validation')
    expect(draft.secondaryParameters?.map((parameter) => parameter.name)).toEqual([
      'CustomTexBlend',
      'OpacityMap',
      'sscolor2',
      'Normal Map One',
      'Roughness Map',
      'DiffuseGrass Map',
      'Diffuse Map',
    ])
    const textureParameters = draft.secondaryParameters
      ?.map((parameter, index) => ({ parameter, index }))
      .filter(({ parameter }) => parameter.type === 3) ?? []
    expect(textureParameters.every(({ parameter }) => parameter.value === '')).toBe(true)
    for (const { index } of textureParameters) {
      setDraftTexture(draft, index, validationTexture, undefined, 'matInfo2')
    }

    const written = await writeD5mArchive(draft)
    const output = new File([written.blob], 'secondary-grass.d5m', { type: 'application/zip' })
    const report = await verifyD5mOutput(draft, output)
    assertD5mFidelity(report)
    expect(report.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'secondary-parameter-signature')?.status).toBe('pass')
  })
})
