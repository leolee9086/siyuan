import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { cloneTextureForGlb } from './glb-exporter'

describe('GLB texture transform normalization', () => {
  it('converts center-based D5 rotation to an equivalent origin-based transform', () => {
    const source = new Texture()
    source.repeat.set(0.1, 0.1)
    source.offset.set(0, 0.29)
    source.center.set(0.5, 0.5)
    source.rotation = Math.PI / 2
    source.updateMatrix()

    const clone = cloneTextureForGlb(source)

    expect(clone).not.toBe(source)
    expect(source.center.toArray()).toEqual([0.5, 0.5])
    expect(clone.center.toArray()).toEqual([0, 0])
    expect(clone.offset.x).toBeCloseTo(0.45, 12)
    expect(clone.offset.y).toBeCloseTo(0.84, 12)
    clone.matrix.toArray().forEach((value, index) => {
      expect(value).toBeCloseTo(source.matrix.toArray()[index]!, 12)
    })
  })

  it('preserves scaling around a non-zero center without copying image data', () => {
    const source = new Texture({ width: 4, height: 4 })
    source.repeat.set(3, 2)
    source.center.set(0.5, 0.5)
    source.updateMatrix()

    const clone = cloneTextureForGlb(source)

    expect(clone.image).toBe(source.image)
    expect(clone.offset.toArray()).toEqual([-1, -0.5])
    expect(clone.matrix.toArray()).toEqual(source.matrix.toArray())
  })
})
