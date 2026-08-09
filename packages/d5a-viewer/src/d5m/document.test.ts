import {
  BlobWriter,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'
import { loadD5mDocument } from './document'
import { encodeD5mText } from './text'
import type { D5mMaterialData, D5mMaterialParameter } from './types'
import { createD5mDraft, writeD5mArchive } from './writer'

const parameters: D5mMaterialParameter[] = [
  {
    name: 'Diffuse Map',
    type: 3,
    value: 'um/example/albedo.tif',
    group: 'Base Color',
    default: false,
    fromPlugin: 0,
  },
  { name: 'AoIntensity', type: 1, value: 'X=0.500000 Y=0.000000 Z=0.000000' },
  { name: 'AOIntensity', type: 1, value: 'X=0.750000 Y=0.000000 Z=0.000000' },
]

describe('D5M material documents', () => {
  it('decodes UTF-16LE material data, preserves parameter case, and resolves TIFF textures', async () => {
    const file = await fixtureFile('utf-16le', true)
    const document = await loadD5mDocument(file)
    try {
      expect(document.encoding).toBe('utf-16le')
      expect(document.bom).toBe(true)
      expect(document.parameters.map((parameter) => parameter.name)).toEqual([
        'Diffuse Map',
        'AoIntensity',
        'AOIntensity',
      ])
      expect(document.textureReferences).toEqual([{
        parameterSet: 'matInfo',
        parameterIndex: 0,
        slot: 'Diffuse Map',
        value: 'um/example/albedo.tif',
        resolvedPath: 'textures/um/example/albedo.tif',
      }])
      expect(document.material.unknownTopLevel).toEqual({ preserved: true })
      expect(document.profile.uePath).toBe('/Game/MatLib2/Base/Base/Base_9/m.m')
      expect(document.profile.profileId).toBe('7f62fccbdd220f67')
    } finally {
      await document.close()
    }
  })

  it('streams source resources while rewriting material data and keeps unknown fields', async () => {
    const source = await loadD5mDocument(await fixtureFile('utf-16le', true))
    try {
      const draft = createD5mDraft(source)
      draft.material.title = 'Edited material'
      draft.parameters[1]!.value = 'X=0.250000 Y=0.000000 Z=0.000000'
      draft.parameters.push({ name: 'FutureParameter', type: 1, value: 'X=1.000000' })
      const result = await writeD5mArchive(draft)
      expect(result.copiedEntryCount).toBe(3)
      const roundTrip = await loadD5mDocument(new File([result.blob], 'round-trip.d5m'))
      try {
        expect(roundTrip.encoding).toBe('utf-16le')
        expect(roundTrip.material.title).toBe('Edited material')
        expect(roundTrip.material.unknownTopLevel).toEqual({ preserved: true })
        expect(roundTrip.parameters.find((parameter) => parameter.name === 'AoIntensity')?.value)
          .toBe('X=0.250000 Y=0.000000 Z=0.000000')
        expect(roundTrip.parameters.at(-1)?.name).toBe('FutureParameter')
        expect([...await roundTrip.archive.bytes('custom.bin')]).toEqual([9, 8, 7, 6])
        expect([...await roundTrip.archive.bytes('textures/um/example/albedo.tif')]).toEqual([1, 2, 3, 4])
      } finally {
        await roundTrip.close()
      }
    } finally {
      await source.close()
    }
  })

  it('creates a new D5M and rejects unresolved texture slots', async () => {
    const draft = createD5mDraft()
    draft.material = materialData()
    draft.parameters = structuredClone(parameters)
    await expect(writeD5mArchive(draft)).rejects.toThrow('缺少 1 个纹理资源')

    draft.resources.set('textures/um/example/albedo.tif', new Blob([new Uint8Array([4, 3, 2, 1])]))
    draft.summary = 'Created material'
    const result = await writeD5mArchive(draft)
    const document = await loadD5mDocument(new File([result.blob], 'created.d5m'))
    try {
      expect(document.parameters).toEqual(parameters)
      expect(document.textureReferences[0]?.resolvedPath).toBe('textures/um/example/albedo.tif')
      expect(new TextDecoder().decode(await document.archive.bytes('summary.txt'))).toBe('Created material')
    } finally {
      await document.close()
    }
  })

  it('reads, writes, and closes texture references from a structured matInfo2 parameter set', async () => {
    const secondaryParameters: D5mMaterialParameter[] = [
      { name: 'DiffuseGrass Map', type: 3, value: 'um/grass/albedo.png' },
      { name: 'GrassDensity', type: 1, value: 'X=1.25 Y=0 Z=2' },
    ]
    const draft = createD5mDraft()
    draft.material = {
      ...materialData(),
      matInfo: '[]',
      matInfo2: JSON.stringify(secondaryParameters),
    }
    draft.parameters = []
    draft.secondaryParameters = structuredClone(secondaryParameters)
    draft.matInfo2Storage = 'string'

    await expect(writeD5mArchive(draft)).rejects.toThrow('matInfo2.DiffuseGrass Map')
    draft.resources.set('textures/um/grass/albedo.png', new Blob([new Uint8Array([7, 6, 5, 4])]))
    const result = await writeD5mArchive(draft)
    const document = await loadD5mDocument(new File([result.blob], 'secondary.d5m'))
    try {
      expect(document.secondaryParameters).toEqual(secondaryParameters)
      expect(document.matInfo2Storage).toBe('string')
      expect(document.textureReferences).toEqual([{
        parameterSet: 'matInfo2',
        parameterIndex: 0,
        slot: 'DiffuseGrass Map',
        value: 'um/grass/albedo.png',
        resolvedPath: 'textures/um/grass/albedo.png',
      }])
    } finally {
      await document.close()
    }
  })
})

async function fixtureFile(encoding: 'utf-8' | 'utf-16le', bom: boolean): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false })
  const materialBytes = encodeD5mText(JSON.stringify(materialData()), encoding, bom)
  await writer.add('material.json', new Uint8ArrayReader(materialBytes), { level: 6 })
  await writer.add(
    'textures/um/example/albedo.tif',
    new Uint8ArrayReader(new Uint8Array([1, 2, 3, 4])),
    { level: 0 },
  )
  await writer.add('summary.txt', new Uint8ArrayReader(new TextEncoder().encode('Fixture')), { level: 0 })
  await writer.add('custom.bin', new Uint8ArrayReader(new Uint8Array([9, 8, 7, 6])), { level: 6 })
  return new File([await writer.close()], 'fixture.d5m')
}

function materialData(): D5mMaterialData {
  return {
    id: 'fixture-id',
    title: 'Fixture material',
    uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
    type: 0,
    matInfo: JSON.stringify(parameters),
    matInfo2: 'preserve-me',
    unknownTopLevel: { preserved: true },
  }
}
