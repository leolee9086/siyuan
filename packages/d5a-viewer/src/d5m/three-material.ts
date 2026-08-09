import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  Vector2,
  type Material,
  type Texture,
} from 'three'
import { describeD5mPreview, type D5mPreviewMaterial } from './material-runtime'
import {
  D5mPreviewTextureNotice,
  loadD5mPreviewTexture,
  type LoadedD5mPreviewTexture,
} from './preview-textures'
import type { D5mMaterialDraft } from './writer'

export interface LoadedD5mThreeMaterial {
  material: MeshPhysicalMaterial
  descriptor: D5mPreviewMaterial
  loadedTextureCount: number
  notices: string[]
  errors: string[]
  dispose(): void
}

export interface D5mMeshMaterialOverride {
  objectCount: number
  restore(): void
}

export async function loadD5mThreeMaterial(
  draft: D5mMaterialDraft,
  familyKey: string,
  anisotropy: number,
  signal?: AbortSignal,
): Promise<LoadedD5mThreeMaterial> {
  const descriptor = describeD5mPreview(draft.parameters, familyKey)
  const material = createD5mPhysicalMaterial(descriptor)
  const loadedByChannel = new Map<string, LoadedD5mPreviewTexture>()
  const notices = [...descriptor.notices]
  const errors: string[] = []
  try {
    for (const definition of descriptor.textures) {
      throwIfAborted(signal)
      try {
        const loaded = await loadD5mPreviewTexture(draft, definition, anisotropy, signal)
        const previous = loadedByChannel.get(definition.channel)
        previous?.dispose()
        loadedByChannel.set(definition.channel, loaded)
        assignD5mTexture(material, definition.channel, loaded)
        if (loaded.notice) notices.push(loaded.notice)
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) throw error
        if (error instanceof D5mPreviewTextureNotice) notices.push(error.message)
        else errors.push(`${definition.slot}: ${normalizeError(error)}`)
      }
    }
    throwIfAborted(signal)
  } catch (error) {
    loadedByChannel.forEach((loaded) => loaded.dispose())
    disposeD5mPhysicalMaterial(material)
    throw error
  }
  material.needsUpdate = true
  let disposed = false
  return {
    material,
    descriptor,
    loadedTextureCount: loadedByChannel.size,
    notices,
    errors,
    dispose() {
      if (disposed) return
      disposed = true
      loadedByChannel.forEach((loaded) => loaded.dispose())
      loadedByChannel.clear()
      disposeD5mPhysicalMaterial(material)
    },
  }
}

export function createD5mPhysicalMaterial(descriptor: D5mPreviewMaterial): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: new Color(...descriptor.color),
    roughness: descriptor.roughness,
    metalness: descriptor.metalness,
    specularIntensity: descriptor.specularIntensity,
    opacity: descriptor.opacity,
    transparent: descriptor.transparent,
    depthWrite: !descriptor.transparent,
    alphaTest: descriptor.alphaTest,
    side: DoubleSide,
    transmission: descriptor.transmission,
    ior: descriptor.ior,
    thickness: descriptor.thickness,
    attenuationColor: new Color(...descriptor.attenuationColor),
    attenuationDistance: descriptor.attenuationDistance,
    clearcoat: descriptor.clearcoat,
    clearcoatRoughness: descriptor.clearcoatRoughness,
    sheen: descriptor.sheen,
    sheenColor: new Color(...descriptor.sheenColor),
    sheenRoughness: descriptor.sheenRoughness,
    emissive: new Color(...descriptor.emissive),
    emissiveIntensity: descriptor.emissiveIntensity,
    aoMapIntensity: descriptor.aoIntensity,
    displacementScale: descriptor.displacementScale,
  })
  material.userData.d5LandscapeBlend = descriptor.landscapeBlend
  material.normalScale = new Vector2(...descriptor.normalScale)
  material.bumpScale = Math.abs(descriptor.normalScale[0]) * 0.06
  if (descriptor.familyKey === 'water') {
    const waterNormal = waterNormalTexture()
    material.normalMap = waterNormal
    material.normalScale.multiplyScalar(0.32)
    material.userData.d5OwnedTextures = [waterNormal]
  }
  return material
}

export function assignD5mTexture(
  material: MeshPhysicalMaterial,
  channel: string,
  loaded: LoadedD5mPreviewTexture,
): void {
  const texture = loaded.texture
  if (channel === 'color') {
    material.map = texture
    const landscape = material.userData.d5LandscapeColorMap as Texture | undefined
    if (landscape) configureLandscapeBlend(material, landscape)
  }
  else if (channel === 'normal' && loaded.normalMode === 'height') {
    material.normalMap = null
    material.bumpMap = texture
  } else if (channel === 'normal') {
    material.bumpMap = null
    material.normalMap = texture
  } else if (channel === 'roughness') material.roughnessMap = texture
  else if (channel === 'metalness') material.metalnessMap = texture
  else if (channel === 'specular') material.specularIntensityMap = texture
  else if (channel === 'ao') material.aoMap = texture
  else if (channel === 'alpha') material.alphaMap = texture
  else if (channel === 'emissive') material.emissiveMap = texture
  else if (channel === 'height') material.displacementMap = texture
  else if (channel === 'subsurface') {
    // D5's sscolor2 is a subsurface-color input. Three.js has no matching
    // per-pixel channel, so thin fabrics use its sheen color as the closest
    // static preview while retaining the source texture for diagnostics.
    material.sheenColorMap = texture
    material.userData.d5SubsurfaceColorMap = texture
  } else if (channel === 'landscape-color') {
    if (material.map) configureLandscapeBlend(material, texture)
    else material.map = texture
  }
}

export function clearD5mMaterialTextures(material: MeshPhysicalMaterial): void {
  material.map = null
  material.normalMap = null
  material.bumpMap = null
  material.roughnessMap = null
  material.metalnessMap = null
  material.specularIntensityMap = null
  material.aoMap = null
  material.alphaMap = null
  material.emissiveMap = null
  material.displacementMap = null
  material.sheenColorMap = null
  material.onBeforeCompile = () => undefined
  material.customProgramCacheKey = () => ''
  delete material.userData.d5SubsurfaceColorMap
  delete material.userData.d5LandscapeColorMap
  material.needsUpdate = true
}

export function disposeD5mPhysicalMaterial(material: MeshPhysicalMaterial): void {
  const ownedTextures = material.userData.d5OwnedTextures as Array<{ dispose(): void }> | undefined
  ownedTextures?.forEach((texture) => texture.dispose())
  material.dispose()
}

function configureLandscapeBlend(material: MeshPhysicalMaterial, texture: Texture): void {
  material.userData.d5LandscapeColorMap = texture
  material.onBeforeCompile = (shader) => {
    shader.uniforms.d5LandscapeColorMap = { value: texture }
    shader.uniforms.d5LandscapeBlend = { value: Number(material.userData.d5LandscapeBlend) || 0 }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        '#include <map_pars_fragment>\nuniform sampler2D d5LandscapeColorMap;\nuniform float d5LandscapeBlend;',
      )
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n#ifdef USE_MAP\n  vec4 d5LandscapeColor = texture2D( d5LandscapeColorMap, vMapUv );\n  diffuseColor.rgb = mix( d5LandscapeColor.rgb, diffuseColor.rgb, d5LandscapeBlend );\n#endif',
      )
  }
  material.customProgramCacheKey = () => 'd5m-landscape-blend-v1'
  material.needsUpdate = true
}

export function applyD5mMaterialOverride(
  meshes: Iterable<Mesh>,
  material: Material,
): D5mMeshMaterialOverride {
  const originals = new Map<Mesh, Material | Material[]>()
  for (const mesh of meshes) {
    if (originals.has(mesh)) continue
    originals.set(mesh, mesh.material)
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(() => material)
      : material
  }
  let restored = false
  return {
    objectCount: originals.size,
    restore() {
      if (restored) return
      restored = true
      for (const [mesh, original] of originals) mesh.material = original
      originals.clear()
    },
  }
}

function waterNormalTexture(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const first = Math.cos(u * 4 + v * 2)
      const second = Math.cos(u * 7 - v * 3)
      const dx = (4 * first + 3.5 * second) * 0.035
      const dy = (2 * first - 1.5 * second) * 0.035
      const length = Math.hypot(dx, dy, 1)
      const offset = (y * size + x) * 4
      image.data[offset] = Math.round((-dx / length * 0.5 + 0.5) * 255)
      image.data[offset + 1] = Math.round((-dy / length * 0.5 + 0.5) * 255)
      image.data[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255)
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('D5M 材质预览已取消', 'AbortError')
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
