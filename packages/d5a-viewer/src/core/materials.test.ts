import { describe, expect, it } from 'vitest'
import { normalizeTexturePath, parseD5Info } from './materials'

describe('D5 material metadata', () => {
  it('parses nested detailInfo and material parameters', () => {
    const matInfo = JSON.stringify([
      { name: 'Diffuse Map', type: 3, value: 'ModelTextures/A/albedo.jpg' },
      { name: 'Diffuse (Color)', type: 2, value: '(R=0.2,G=0.3,B=0.4,A=1.0)' },
      { name: 'Utiling', type: 1, value: 'X=2.0 Y=0 Z=0' },
      { name: 'Vtiling', type: 1, value: 'X=3.0 Y=0 Z=0' },
      { name: 'Umove', type: 1, value: 'X=0.25 Y=0 Z=0' },
      { name: 'Ymove', type: 1, value: 'X=-0.5 Y=0 Z=0' },
      { name: 'UVAngle', type: 1, value: 'X=90 Y=0 Z=0' },
      { name: 'Normal Map (opacity)', type: 1, value: 'X=0.8 Y=-0.8 Z=1' },
      { name: 'Normal Map One', type: 3, value: 'ModelTextures/A/normal.png' },
      { name: 'Roughness Map', type: 3, value: 'rough.png' },
      { name: 'Roughness Map (opacity)', type: 1, value: 'X=0.58 Y=0 Z=1' },
      { name: 'IsInverted_R', type: 1, value: 'X=1 Y=0 Z=1' },
    ])
    const detailInfo = JSON.stringify({
      styleDatas: [{ bActive: true, elements: [{ materialIndex: 0, materialData: {
        id: 'leaf-material-id',
        title: 'Leaf',
        uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
        appendColor: { x: 0, y: 0, z: 0 },
        fromPlugin: 0,
        matInfo,
      } }] }],
    })
    const parsed = parseD5Info(JSON.stringify({
      length: 3,
      depth: 2,
      height: 1,
      material_MapKey: ['leaf-key'],
      detailInfo,
    }))

    expect(parsed.dimensions).toEqual({ length: 3, depth: 2, height: 1 })
    expect(parsed.materials[0]?.diffuseMap).toBe('textures/ModelTextures/A/albedo.jpg')
    expect(parsed.materials[0]?.color).toEqual([0.2, 0.3, 0.4, 1])
    expect(parsed.materials[0]?.textureTransform).toEqual({
      repeat: [2, 3],
      offset: [0.25, -0.5],
      rotation: Math.PI / 2,
    })
    expect(parsed.materials[0]?.normalScale).toEqual([0.8, -0.8])
    expect(parsed.materials[0]?.normalMap).toBe('textures/ModelTextures/A/normal.png')
    expect(parsed.materials[0]?.roughnessMapStrength).toBe(0.58)
    expect(parsed.materials[0]?.roughnessMapInverted).toBe(true)
    expect(parsed.materials[0]?.roughness).toBeUndefined()
    expect(parsed.materials[0]?.id).toBe('leaf-material-id')
    expect(parsed.materials[0]?.uePath).toBe('/Game/MatLib2/Base/Base/Base_9/m.m')
    expect(parsed.materials[0]?.sourceData).toMatchObject({
      appendColor: { x: 0, y: 0, z: 0 },
      fromPlugin: 0,
    })
  })

  it('normalizes Windows and archive-relative texture paths', () => {
    expect(normalizeTexturePath('ModelTextures\\A\\x.png')).toBe('textures/ModelTextures/A/x.png')
    expect(normalizeTexturePath('textures/x.png')).toBe('textures/x.png')
    expect(normalizeTexturePath('ModelTextures/A/x.png', 'BUNDLE_A')).toBe(
      'BUNDLE_A/textures/ModelTextures/A/x.png',
    )
  })

  it('skips scalar opacity controls while resolving texture aliases', () => {
    const matInfo = JSON.stringify([
      { name: 'Normal Map (opacity)', type: 1, value: 'X=1 Y=-1 Z=1' },
      { name: 'Normal Map One', type: 3, value: 'normal-one.png' },
    ])
    const detailInfo = JSON.stringify({
      styleDatas: [{ elements: [{ materialIndex: 0, materialData: { matInfo } }] }],
    })

    const parsed = parseD5Info(JSON.stringify({
      material_MapKey: ['material'],
      detailInfo,
    }))

    expect(parsed.materials[0]?.normalMap).toBe('textures/normal-one.png')
  })
})
