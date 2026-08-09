import { describe, expect, it } from 'vitest'
import { describeD5mPreview } from './material-runtime'
import {
  parseD5mColor,
  parseD5mScalar,
  updateD5mColor,
  updateD5mScalar,
} from './parameters'
import type { D5mMaterialParameter } from './types'

describe('D5M parameter editing and preview semantics', () => {
  it('parses parameter ranges and preserves the source numeric precision', () => {
    const source = 'X=0.500000 Y=-1.000000 Z=1.000000'
    expect(parseD5mScalar(source)).toEqual({ current: 0.5, min: -1, max: 1 })
    expect(updateD5mScalar(source, 0.125)).toBe('X=0.125000 Y=-1.000000 Z=1.000000')
    expect(updateD5mScalar('X=1e+2 Y=0 Z=0', 25)).toBe('X=2.500000e+1 Y=0 Z=0')
  })

  it('edits D5 colors while retaining component order and precision', () => {
    const source = '(R=1.000000,G=0.500000,B=0.250000,A=1.000000)'
    expect(parseD5mColor(source)).toEqual({ r: 1, g: 0.5, b: 0.25, a: 1 })
    expect(updateD5mColor(source, { r: 0.25, g: 0.5, b: 0.75, a: 0.4 }))
      .toBe('(R=0.250000,G=0.500000,B=0.750000,A=0.400000)')
  })

  it('maps PBR slots and the correct global or per-slot UV transform', () => {
    const parameters: D5mMaterialParameter[] = [
      scalar('Utiling', 2, 0, 10),
      scalar('Vtiling', 3, 0, 10),
      scalar('Xmove', 0.1, 0, 1),
      scalar('Ymove', 0.2, 0, 1),
      scalar('UVAngle', 90, 0, 360),
      scalar('Local_UV_N', 1, 0, 2),
      scalar('Utiling_N', 4, 0, 10),
      scalar('Vtiling_N', 5, 0, 10),
      { name: 'Diffuse Map', type: 3, value: 'um/a/d.jpg' },
      { name: 'Normal Map One', type: 3, value: 'um/a/n.jpg' },
      { name: 'Roughness Map', type: 3, value: 'um/a/r.jpg' },
      scalar('DiffuseMap_GammaMode', 1, 0, 1),
      scalar('NormalMap_GammaMode', 0, 0, 1),
      scalar('RoughnessMap_GammaMode', 1, 0, 1),
      scalar('IsInverted_R', 1, 0, 1),
      scalar('Normal Map (opacity)', -0.8, 0, 1),
      scalar('Roughness Map (opacity)', 0.35, 0, 1),
      { name: 'Diffuse (Color)', type: 2, value: '(R=0.5,G=0.4,B=0.3,A=0)' },
    ]
    const preview = describeD5mPreview(parameters, 'standard-surface')
    expect(preview.roughness).toBe(0.35)
    expect(preview.normalScale).toEqual([0.8, -0.8])
    expect(preview.textures.find((texture) => texture.channel === 'color')?.uv).toEqual({
      repeat: [2, 3],
      offset: [0.1, 0.2],
      rotation: Math.PI / 2,
    })
    expect(preview.textures.find((texture) => texture.channel === 'normal')?.uv.repeat).toEqual([4, 5])
    expect(preview.textures.find((texture) => texture.channel === 'color')?.gammaEncoded).toBe(true)
    expect(preview.textures.find((texture) => texture.channel === 'normal')?.gammaEncoded).toBe(false)
    expect(preview.textures.find((texture) => texture.channel === 'roughness')?.gammaEncoded).toBe(true)
    expect(preview.textures.find((texture) => texture.channel === 'roughness')?.invert).toBe(true)
  })

  it('uses distinct physical previews for glass, water, fabric, and provisional families', () => {
    const glass = describeD5mPreview([], 'glass')
    const water = describeD5mPreview([scalar('Refraction', 1.33, 1, 3)], 'water')
    const fabric = describeD5mPreview([], 'fabric')
    const provisional = describeD5mPreview([], 'base-13')
    expect(glass.transmission).toBeGreaterThan(0.9)
    expect(water.ior).toBe(1.33)
    expect(water.clearcoat).toBe(1)
    expect(water.transmission).toBeGreaterThan(0.8)
    expect(water.attenuationDistance).toBeGreaterThan(0)
    expect(fabric.sheen).toBeGreaterThan(0)
    expect(provisional.notices[0]).toContain('原始制式仍完整写回')
  })
})

function scalar(name: string, current: number, min: number, max: number): D5mMaterialParameter {
  return { name, type: 1, value: `X=${current} Y=${min} Z=${max}` }
}
