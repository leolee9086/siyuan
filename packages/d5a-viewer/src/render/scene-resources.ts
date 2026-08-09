import { Mesh, type BufferGeometry, type Material, type Object3D, type Texture } from 'three'

export interface TextureResourceStats {
  count: number
  gpuBytes: number
}

export function inspectTextureResources(root: Object3D): TextureResourceStats {
  const textures = collectTextures(root)
  let gpuBytes = 0
  for (const texture of textures) gpuBytes += estimateTextureGpuBytes(texture)
  return { count: textures.size, gpuBytes }
}

export function estimateTextureGpuBytes(texture: Texture): number {
  const mipBytes = texture.mipmaps.reduce((total, mipmap) => {
    const data = (mipmap as { data?: ArrayBufferView }).data
    return total + (data?.byteLength ?? 0)
  }, 0)
  if (mipBytes > 0) return mipBytes

  const image = texture.image as {
    data?: ArrayBufferView
    width?: number
    height?: number
    depth?: number
  } | undefined
  if (image?.data?.byteLength) return image.data.byteLength
  const width = image?.width ?? 0
  const height = image?.height ?? 0
  const depth = image?.depth ?? 1
  return width > 0 && height > 0
    ? Math.ceil(width * height * depth * 4 * (texture.generateMipmaps ? 4 / 3 : 1))
    : 0
}

export function disposeSceneResources(root: Object3D): void {
  disposeTextureResources(root)
  disposeObject(root)
}

export function disposeObject(root: Object3D): void {
  const disposedGeometries = new Set<BufferGeometry>()
  const disposedMaterials = new Set<Material>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (!disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry)
      object.geometry.dispose()
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!disposedMaterials.has(material)) {
        disposedMaterials.add(material)
        material.dispose()
      }
    }
  })
  root.removeFromParent()
}

export function disposeTextureResources(root: Object3D): void {
  const sources = new Set<unknown>()
  for (const texture of collectTextures(root)) {
    sources.add(texture.source.data)
    texture.dispose()
  }
  for (const source of sources) {
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close()
  }
}

export function collectTextures(root: Object3D): Set<Texture> {
  const textures = new Set<Texture>()
  const materials = new Set<Material>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of objectMaterials) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (isTexture(value)) textures.add(value)
    }
  }
  return textures
}

function isTexture(value: unknown): value is Texture {
  return typeof value === 'object' && value !== null && 'isTexture' in value && value.isTexture === true
}
