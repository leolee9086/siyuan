import { describe, expect, it } from 'vitest'
import { parseD5GroupInfo } from './group-info'

describe('D5A groupinfo parser', () => {
  it('keeps a model transform only when all spatial fields are finite', () => {
    const parsed = parseD5GroupInfo(JSON.stringify({
      models: [{
        id: 'BUNDLE_A',
        title: 'Blueberry',
        parent: 'GROUP_A',
        transform: {
          rotation: { x: 0, y: 1, z: 0, w: 0 },
          translation: { x: 7, y: 0, z: -6 },
          scale3D: { x: 1, y: 2, z: 1 },
        },
      }],
      groups: [{ id: 'GROUP_A', title: 'Display' }],
    }))

    expect(parsed?.groups).toEqual([{ id: 'GROUP_A', title: 'Display', parent: undefined }])
    expect(parsed?.models[0]).toMatchObject({
      id: 'BUNDLE_A',
      title: 'Blueberry',
      transform: {
        rotation: { x: 0, y: 1, z: 0, w: 0 },
        translation: { x: 7, y: 0, z: -6 },
        scale3D: { x: 1, y: 2, z: 1 },
      },
    })
  })

  it('rejects malformed JSON without treating it as a valid group hierarchy', () => {
    expect(parseD5GroupInfo('{broken')).toBeUndefined()
  })
})
