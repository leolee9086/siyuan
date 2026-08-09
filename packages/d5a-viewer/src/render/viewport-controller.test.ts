import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { framingDistance } from './viewport-controller'

describe('viewport framing', () => {
  it('moves farther away when the viewport is narrower', () => {
    const size = new Vector3(1, 1, 1)

    expect(framingDistance(size, 42, 0.68)).toBeGreaterThan(
      framingDistance(size, 42, 1.6),
    )
  })

  it('keeps the bounding sphere inside both horizontal and vertical fields of view', () => {
    const size = new Vector3(8, 2, 1)
    const aspect = 0.68
    const distance = framingDistance(size, 42, aspect)
    const halfVerticalFov = (42 * Math.PI) / 360
    const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * aspect)
    const radius = size.length() / 2

    expect(distance * Math.sin(halfVerticalFov)).toBeGreaterThan(radius)
    expect(distance * Math.sin(halfHorizontalFov)).toBeGreaterThan(radius)
  })
})
