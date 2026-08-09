import { Mesh, MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { describeD5mPreview } from './material-runtime'
import type { LoadedD5mPreviewTexture } from './preview-textures'
import { createD5mDraft } from './writer'
import {
  applyD5mMaterialOverride,
  assignD5mTexture,
  clearD5mMaterialTextures,
  createD5mPhysicalMaterial,
  disposeD5mPhysicalMaterial,
  loadD5mThreeMaterial,
} from './three-material'

const previewTextureLoader = vi.hoisted(() => vi.fn())
vi.mock('./preview-textures', async (importOriginal) => ({
  ...await importOriginal<typeof import('./preview-textures')>(),
  loadD5mPreviewTexture: previewTextureLoader,
}))

describe('D5M Three.js material runtime', () => {
  it('uses the same physical material mapping and texture channels outside the standard preview', () => {
    const descriptor = describeD5mPreview([
      { name: 'Diffuse (Color)', type: 2, value: '(R=0.25,G=0.5,B=0.75,A=1)' },
      { name: 'Roughness', type: 1, value: 'X=0.35 Y=0 Z=1' },
      { name: 'Metallic', type: 1, value: 'X=0.8 Y=0 Z=1' },
    ], 'standard-surface')
    const material = createD5mPhysicalMaterial(descriptor)
    expect(material.color.toArray()).toEqual([0.25, 0.5, 0.75])
    expect(material.roughness).toBe(0.35)
    expect(material.metalness).toBe(0.8)

    const color = loadedTexture()
    const height = loadedTexture('height')
    const subsurface = loadedTexture()
    const landscape = loadedTexture()
    assignD5mTexture(material, 'color', color)
    assignD5mTexture(material, 'normal', height)
    assignD5mTexture(material, 'subsurface', subsurface)
    assignD5mTexture(material, 'landscape-color', landscape)
    expect(material.map).toBe(color.texture)
    expect(material.normalMap).toBeNull()
    expect(material.bumpMap).toBe(height.texture)
    expect(material.sheenColorMap).toBe(subsurface.texture)
    expect(material.userData.d5SubsurfaceColorMap).toBe(subsurface.texture)
    expect(material.userData.d5LandscapeColorMap).toBe(landscape.texture)
    expect(material.customProgramCacheKey()).toBe('d5m-landscape-blend-v1')
    clearD5mMaterialTextures(material)
    expect(material.map).toBeNull()
    expect(material.bumpMap).toBeNull()
    expect(material.sheenColorMap).toBeNull()
    expect(material.userData.d5SubsurfaceColorMap).toBeUndefined()
    expect(material.userData.d5LandscapeColorMap).toBeUndefined()
    disposeD5mPhysicalMaterial(material)
  })

  it('restores every mesh material exactly once without changing geometry ownership', () => {
    const firstOriginal = new MeshStandardMaterial({ name: 'first' })
    const secondOriginal = new MeshStandardMaterial({ name: 'second' })
    const first = new Mesh(undefined, firstOriginal)
    const second = new Mesh(undefined, [firstOriginal, secondOriginal])
    const firstGeometry = first.geometry
    const secondGeometry = second.geometry
    const preview = new MeshStandardMaterial({ name: 'preview' })

    const override = applyD5mMaterialOverride([first, second, first], preview)
    expect(override.objectCount).toBe(2)
    expect(first.material).toBe(preview)
    expect(second.material).toEqual([preview, preview])
    expect(first.geometry).toBe(firstGeometry)
    expect(second.geometry).toBe(secondGeometry)

    override.restore()
    override.restore()
    expect(first.material).toBe(firstOriginal)
    expect(second.material).toEqual([firstOriginal, secondOriginal])
  })

  it('disposes every loaded preview texture once when an applied runtime is released', async () => {
    previewTextureLoader.mockReset()
    const color = loadedTexture()
    previewTextureLoader.mockResolvedValue(color)
    const draft = createD5mDraft()
    draft.material.title = 'lifecycle'
    draft.parameters = [{ name: 'Diffuse Map', type: 3, value: 'um/test/color.png' }]

    const runtime = await loadD5mThreeMaterial(draft, 'standard-surface', 4)
    expect(runtime.loadedTextureCount).toBe(1)
    expect(runtime.material.map).toBe(color.texture)

    runtime.dispose()
    runtime.dispose()
    expect(color.dispose).toHaveBeenCalledTimes(1)
  })
})

function loadedTexture(normalMode?: 'tangent' | 'height'): LoadedD5mPreviewTexture {
  return {
    texture: new Texture(),
    path: 'texture.png',
    width: 1,
    height: 1,
    normalMode,
    dispose: vi.fn(),
  }
}
