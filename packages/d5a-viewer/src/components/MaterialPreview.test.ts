import { describe, expect, it } from 'vitest'
import { materialPreviewFovForAspect } from './MaterialPreview'

describe('materialPreviewFovForAspect', () => {
  it('preserves the desktop framing', () => {
    expect(materialPreviewFovForAspect(16 / 9)).toBe(35)
  })

  it('widens the view for a portrait material workspace', () => {
    expect(materialPreviewFovForAspect(390 / 688)).toBeGreaterThan(45)
    expect(materialPreviewFovForAspect(390 / 688)).toBeLessThanOrEqual(52)
  })
})
