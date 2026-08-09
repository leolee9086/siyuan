import { describe, expect, it } from 'vitest'
import { isGrayscaleRgba, packSpecularAlpha } from './preview-textures'

describe('D5M normal texture channel detection', () => {
  it('recognizes opaque grayscale pixels with small encoding noise', () => {
    expect(isGrayscaleRgba(new Uint8ClampedArray([
      32, 32, 32, 255,
      128, 130, 129, 255,
      240, 240, 240, 255,
    ]))).toBe(true)
  })

  it('keeps tangent-space normal colors on the normal-map path', () => {
    expect(isGrayscaleRgba(new Uint8ClampedArray([
      128, 128, 255, 255,
      114, 142, 248, 255,
    ]))).toBe(false)
  })

  it('does not classify a fully transparent sample as grayscale', () => {
    expect(isGrayscaleRgba(new Uint8ClampedArray([90, 90, 90, 0]))).toBe(false)
  })

  it('packs RGB specular intensity into the alpha channel used by Three.js', () => {
    const pixels = new Uint8ClampedArray([100, 100, 100, 255, 255, 0, 0, 255])
    packSpecularAlpha(pixels)
    expect([...pixels]).toEqual([100, 100, 100, 100, 255, 0, 0, 54])
  })
})
