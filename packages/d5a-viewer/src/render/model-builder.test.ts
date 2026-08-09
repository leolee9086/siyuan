import {
  BufferAttribute,
  BufferGeometry,
  CompressedTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
} from 'three'
import { describe, expect, it } from 'vitest'
import type { D5Material } from '../core/types'
import {
  applyD5aTransform,
  batchGeometryGroups,
  createLegacyMaterial,
  indexMaterialsByKey,
  inspectObject,
  sameArchiveTexture,
  settleMaterialTextureAssignments,
  splitStaticMeshesByMaterialGroups,
} from './model-builder'
import {
  disposeObject,
  disposeSceneResources,
  inspectTextureResources,
} from './scene-resources'
import { applyTextureTransform } from './texture-cache'

describe('legacy material batching', () => {
  it('reorders non-indexed triangles into one group per material', () => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array(4 * 3 * 3)
    for (let triangle = 0; triangle < 4; triangle += 1) {
      positions.fill(triangle, triangle * 9, triangle * 9 + 9)
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.addGroup(0, 3, 1)
    geometry.addGroup(3, 3, 0)
    geometry.addGroup(6, 3, 1)
    geometry.addGroup(9, 3, 0)

    batchGeometryGroups(geometry)

    expect(geometry.groups).toEqual([
      { start: 0, count: 6, materialIndex: 0 },
      { start: 6, count: 6, materialIndex: 1 },
    ])
    expect([...geometry.getAttribute('position').array]).toEqual([
      ...new Array(9).fill(1),
      ...new Array(9).fill(3),
      ...new Array(9).fill(0),
      ...new Array(9).fill(2),
    ])
    expect(geometry.getAttribute('position').count / 3).toBe(4)
  })

  it('exposes material groups as selectable meshes without copying geometry buffers', () => {
    const root = new Group()
    const geometry = new BufferGeometry()
    const position = new BufferAttribute(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      10, 0, 0, 11, 0, 0, 10, 1, 0,
    ]), 3)
    const index = new BufferAttribute(new Uint16Array([0, 1, 2, 3, 4, 5]), 1)
    geometry.setAttribute('position', position)
    geometry.setIndex(index)
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const mesh = new Mesh(geometry, [
      new MeshStandardMaterial({ name: 'left' }),
      new MeshStandardMaterial({ name: 'right' }),
    ])
    mesh.name = 'two-part mesh'
    root.add(mesh)

    expect(splitStaticMeshesByMaterialGroups(root)).toBe(2)
    const holder = root.children[0] as Group
    const [left, right] = holder.children as Mesh[]
    const stats = inspectObject(root)

    expect(mesh.parent).toBeNull()
    expect(left!.geometry.getAttribute('position')).toBe(position)
    expect(right!.geometry.getAttribute('position')).toBe(position)
    expect(left!.geometry.getIndex()).toBe(index)
    expect(right!.geometry.getIndex()).toBe(index)
    expect(left!.geometry.drawRange).toEqual({ start: 0, count: 3 })
    expect(right!.geometry.drawRange).toEqual({ start: 3, count: 3 })
    expect(left!.geometry.boundingBox?.min.x).toBe(0)
    expect(left!.geometry.boundingBox?.max.x).toBe(1)
    expect(right!.geometry.boundingBox?.min.x).toBe(10)
    expect(right!.geometry.boundingBox?.max.x).toBe(11)
    expect(stats).toEqual({
      triangleCount: 2,
      vertexCount: 6,
      drawCalls: 2,
      geometryGpuBytes: position.array.byteLength + index.array.byteLength,
    })
  })
})

describe('D5 texture coordinates', () => {
  it('applies D5 tiling, offset, and rotation around the texture center', () => {
    const texture = new Texture()
    applyTextureTransform(texture, {
      repeat: [2, 3],
      offset: [0.25, -0.5],
      rotation: Math.PI / 2,
    })

    expect(texture.repeat.toArray()).toEqual([2, 3])
    expect(texture.offset.toArray()).toEqual([0.25, -0.5])
    expect(texture.center.toArray()).toEqual([0.5, 0.5])
    expect(texture.rotation).toBe(Math.PI / 2)
  })
})

describe('D5A bundle transforms', () => {
  it('applies groupinfo position, quaternion, and scale without changing local geometry', () => {
    const target = new Group()
    applyD5aTransform(target, {
      rotation: { x: 0, y: 1, z: 0, w: 0 },
      translation: { x: 7, y: 0, z: -6 },
      scale3D: { x: 1, y: 2, z: 1 },
    })

    expect(target.position.toArray()).toEqual([7, 0, -6])
    expect(target.scale.toArray()).toEqual([1, 2, 1])
    expect(target.quaternion.toArray()).toEqual([0, 1, 0, 0])
  })
})

describe('D5 texture assignment failures', () => {
  it('waits for successful slots before reporting a failed slot', async () => {
    let finishGoodTexture!: () => void
    let goodTextureCompleted = false
    const goodTexture = new Promise<void>((resolve) => {
      finishGoodTexture = () => {
        goodTextureCompleted = true
        resolve()
      }
    })
    const result = settleMaterialTextureAssignments('Robot', [
      { slot: '漫反射', path: 'textures/good.png', promise: goodTexture },
      { slot: '法线', path: 'textures/bad.png', promise: Promise.reject(new Error('decode failed')) },
    ])
    let settled = false
    void result.then(
      () => { settled = true },
      () => { settled = true },
    )

    await Promise.resolve()
    expect(settled).toBe(false)
    finishGoodTexture()
    await expect(result).rejects.toThrow('Robot / 法线 / textures/bad.png: decode failed')
    expect(goodTextureCompleted).toBe(true)
  })
})

describe('D5 material lookup', () => {
  it('prefers the populated material when old meshes repeat a material key', () => {
    const base: Omit<D5Material, 'index' | 'key'> = {
      title: 'compost_bags',
      color: [1, 1, 1, 1] as [number, number, number, number],
      textureTransform: { repeat: [1, 1], offset: [0, 0], rotation: 0 },
      parameters: [],
    }
    const materials: D5Material[] = [
      { ...base, index: 0, key: 'compost_bags', diffuseMap: 'textures/bag.jpg' },
      { ...base, index: 1, key: 'compost_bags' },
    ]

    expect(indexMaterialsByKey(materials).get('compost_bags')?.index).toBe(0)
  })

  it('assigns legacy XML materials stable D5 keys and source-order indices', () => {
    const material = createLegacyMaterial({
      name: 'Leaf_A',
      color: '#ffffff',
      opacity: 1,
      roughness: 0.7,
      metallic: 0,
      diffuseMap: 'textures/leaf.png',
    }, 3)

    expect(material.userData.d5Material).toMatchObject({
      index: 3,
      key: 'Leaf_A',
      title: 'Leaf_A',
      source: 'd5material.xml',
    })
    expect(material.alphaTest).toBe(0.35)
  })

  it('recognizes equivalent diffuse and opacity archive paths', () => {
    expect(sameArchiveTexture('textures\\Leaves\\A.PNG', './textures/Leaves/A.png')).toBe(true)
    expect(sameArchiveTexture('textures/a.png', 'textures/b.png')).toBe(false)
  })
})

describe('shared D5 geometry disposal', () => {
  it('disposes a prototype geometry only once when instances share it', () => {
    const root = new Group()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    const material = new MeshStandardMaterial()
    let geometryDisposals = 0
    geometry.addEventListener('dispose', () => { geometryDisposals += 1 })
    root.add(new Mesh(geometry, material), new Mesh(geometry, material))

    disposeObject(root)

    expect(geometryDisposals).toBe(1)
  })

  it('releases round-trip textures together with geometry and materials', () => {
    const root = new Group()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    const texture = new Texture()
    const material = new MeshStandardMaterial({ map: texture })
    let textureDisposals = 0
    let materialDisposals = 0
    texture.addEventListener('dispose', () => { textureDisposals += 1 })
    material.addEventListener('dispose', () => { materialDisposals += 1 })
    root.add(new Mesh(geometry, material), new Mesh(geometry, material))

    disposeSceneResources(root)

    expect(textureDisposals).toBe(1)
    expect(materialDisposals).toBe(1)
  })
})

describe('shared GLB attribute accounting', () => {
  it('counts shared primitive attributes once while retaining both index buffers', () => {
    const position = new BufferAttribute(new Float32Array(9), 3)
    const normal = new BufferAttribute(new Float32Array(9), 3)
    const firstGeometry = new BufferGeometry()
    firstGeometry.setAttribute('position', position)
    firstGeometry.setAttribute('normal', normal)
    firstGeometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1))
    const secondGeometry = new BufferGeometry()
    secondGeometry.setAttribute('position', position)
    secondGeometry.setAttribute('normal', normal)
    secondGeometry.setIndex(new BufferAttribute(new Uint16Array([0, 2, 1]), 1))
    const material = new MeshStandardMaterial()
    const root = new Group()
    root.add(new Mesh(firstGeometry, material), new Mesh(secondGeometry, material))

    const stats = inspectObject(root)

    expect(stats.vertexCount).toBe(3)
    expect(stats.triangleCount).toBe(2)
    expect(stats.geometryGpuBytes).toBe(
      position.array.byteLength + normal.array.byteLength + 2 * 3 * Uint16Array.BYTES_PER_ELEMENT,
    )
  })
})

describe('compressed GLB texture accounting', () => {
  it('uses uploaded mip byte lengths instead of uncompressed RGBA dimensions', () => {
    const texture = new CompressedTexture([
      { data: new Uint8Array(64), width: 8, height: 8 },
      { data: new Uint8Array(16), width: 4, height: 4 },
    ], 8, 8)
    const root = new Group()
    root.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial({ map: texture })))

    expect(inspectTextureResources(root)).toEqual({ count: 1, gpuBytes: 80 })
  })
})
