import { describe, expect, it } from 'vitest'
import type { D5Info, D5Material, D5aInspection, D5aEntryInfo } from './types'
import { calculateResourceBudget, declaredTexturePaths } from './document-loader'

function inspection(entries: D5aEntryInfo[]): D5aInspection {
  return {
    variant: 'd5mesh',
    entries,
    totalUncompressedBytes: 0,
    bundles: [],
    warnings: [],
  }
}

function entry(filename: string, directory = false): D5aEntryInfo {
  return {
    filename,
    compressedSize: 0,
    uncompressedSize: 0,
    encrypted: false,
    directory,
  }
}

function material(paths: Partial<Pick<D5Material, 'diffuseMap' | 'normalMap'>>): D5Material {
  return {
    index: 0,
    key: 'surface',
    title: 'Surface',
    color: [1, 1, 1, 1],
    textureTransform: { repeat: [1, 1], offset: [0, 0], rotation: 0 },
    parameters: [],
    ...paths,
  }
}

function info(paths: Partial<Pick<D5Material, 'diffuseMap' | 'normalMap'>>): D5Info {
  return { title: 'Sample', materialKeys: ['surface'], materials: [material(paths)], raw: {} }
}

describe('D5A declared texture accounting', () => {
  it('only accounts for texture paths declared by parsed material metadata', () => {
    const paths = declaredTexturePaths([info({ diffuseMap: 'BUNDLE/textures/albedo.jpg' })])
    expect(paths).toEqual(new Set(['bundle/textures/albedo.jpg']))
  })

  it('excludes thumbnails and unrelated archive images from the source texture budget', () => {
    const entries = [
      entry('icon.png'),
      entry('BUNDLE/icon.png'),
      entry('BUNDLE/textures/albedo.jpg'),
      entry('BUNDLE/textures/unrelated.jpg'),
    ]
    entries[0]!.uncompressedSize = 100
    entries[1]!.uncompressedSize = 200
    entries[2]!.uncompressedSize = 300
    entries[3]!.uncompressedSize = 400

    const budget = calculateResourceBudget(
      { size: 1_000 } as File,
      inspection(entries),
      [],
      undefined,
      [info({ diffuseMap: 'bundle/textures/albedo.jpg' })],
    )

    expect(budget.textureSourceBytes).toBe(300)
  })
})
