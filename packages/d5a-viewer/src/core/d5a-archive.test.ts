import { describe, expect, it } from 'vitest'
import { inspectEntries } from './d5a-archive'

function entry(filename: string, encrypted = false) {
  return {
    filename,
    directory: false,
    compressedSize: 10,
    uncompressedSize: 20,
    encrypted,
  } as never
}

describe('D5A archive bundle inspection', () => {
  it('keeps every sibling D5Mesh bundle and its local metadata together', () => {
    const inspection = inspectEntries([
      entry('A/1.d5mesh'),
      entry('A/info.json'),
      entry('A/icon.png'),
      entry('A/textures/albedo.jpg'),
      entry('B/1.d5mesh'),
      entry('B/info.json'),
      entry('B/textures/albedo.jpg'),
      entry('groupinfo.json'),
      entry('icon.png'),
    ])

    expect(inspection.variant).toBe('d5mesh')
    expect(inspection.bundles).toEqual([
      {
        id: 'A',
        prefix: 'A',
        meshEntry: 'A/1.d5mesh',
        infoEntry: 'A/info.json',
        iconEntry: 'A/icon.png',
        materialXmlEntry: undefined,
      },
      {
        id: 'B',
        prefix: 'B',
        meshEntry: 'B/1.d5mesh',
        infoEntry: 'B/info.json',
        iconEntry: undefined,
        materialXmlEntry: undefined,
      },
    ])
    expect(inspection.groupInfoEntry).toBe('groupinfo.json')
    expect(inspection.iconEntry).toBe('icon.png')
    expect(inspection.warnings).toContain('检测到 2 个 D5Mesh 子包，将按根分组信息合并加载')
  })

  it('marks a nested encrypted mesh as an encrypted container', () => {
    const inspection = inspectEntries([
      entry('A/1.d5mesh'),
      entry('A/info.json'),
      entry('B/1.d5mesh', true),
      entry('B/info.json'),
    ])

    expect(inspection.variant).toBe('encrypted')
  })
})
