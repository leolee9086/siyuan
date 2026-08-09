import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Texture,
} from 'three'
import { describe, expect, it } from 'vitest'
import { createSceneDocumentFromObject, validateSceneDocument } from './scene-document'

describe('format-neutral scene document', () => {
  it('borrows shared interleaved geometry while preserving hierarchy, UV sets, tangents, and D5 extras', () => {
    const data = new Float32Array(3 * 12)
    const interleaved = new InterleavedBuffer(data, 12)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3))
    geometry.setAttribute('tangent', new InterleavedBufferAttribute(interleaved, 4, 6))
    geometry.setAttribute('uv', new InterleavedBufferAttribute(interleaved, 2, 10))
    geometry.setAttribute('uv1', new BufferAttribute(new Float32Array(6), 2))
    geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1))
    const texture = new Texture({ width: 8, height: 4 })
    texture.offset.set(0.25, 0.5)
    texture.repeat.set(2, 3)
    const material = new MeshStandardMaterial({ name: 'D5 material', map: texture })
    material.userData.d5Material = { key: 'material-key', parameters: [{ name: 'UVAngle', value: 'X=90' }] }
    const root = new Group()
    root.name = 'asset'
    const parent = new Group()
    parent.name = 'assembly'
    const first = new Mesh(geometry, material)
    first.name = 'part-a'
    const second = new Mesh(geometry, material)
    second.name = 'part-b'
    parent.add(first, second)
    root.add(parent)

    const document = createSceneDocumentFromObject(root, { sourceFormat: 'd5a-d5mesh' })

    expect(document.meshes).toHaveLength(1)
    expect(document.nodes.filter((node) => node.mesh)).toHaveLength(2)
    expect(new Set(document.nodes.filter((node) => node.mesh).map((node) => node.mesh)).size).toBe(1)
    const primitive = document.meshes[0]!.primitives[0]!
    expect(Object.keys(primitive.attributes)).toEqual([
      'POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1',
    ])
    const position = document.accessors.find((accessor) => accessor.id === primitive.attributes.POSITION)!
    expect(position.array).toBe(data)
    expect(position.stride).toBe(12)
    expect(position.offset).toBe(0)
    expect(document.materials[0]!.extras.d5Material).toEqual(material.userData.d5Material)
    expect(document.textures[0]!.offset).toEqual([0.25, 0.5])
    expect(validateSceneDocument(document)).toEqual([])
  })

  it('retains instance matrices and animation arrays without geometry copies', () => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array(9)
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    const instances = new InstancedMesh(geometry, new MeshStandardMaterial(), 3)
    const root = new Group()
    root.add(instances)
    const times = new Float32Array([0, 1])
    const values = new Float32Array([0, 1])
    const track = new NumberKeyframeTrack('.rotation[x]', times, values)
    const clip = { name: 'turn', duration: 1, tracks: [track] } as import('three').AnimationClip

    const document = createSceneDocumentFromObject(root, {
      sourceFormat: 'glb-2.0',
      animations: [clip],
    })

    const position = document.accessors.find((accessor) => accessor.sourceName === 'position')!
    const matrices = document.accessors.find((accessor) => accessor.sourceName === 'instanceMatrix')!
    expect(position.array).toBe(positions)
    expect(matrices.array).toBe(instances.instanceMatrix.array)
    expect(document.nodes.find((node) => node.instances)?.instances?.count).toBe(3)
    expect(document.animations[0]!.tracks[0]!.times).toBe(times)
    expect(document.animations[0]!.tracks[0]!.values).toBe(values)
  })

  it('reports broken cross-references and accessor bounds', () => {
    const root = new Group()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    root.add(new Mesh(geometry, new MeshStandardMaterial()))
    const document = createSceneDocumentFromObject(root, { sourceFormat: 'test' })
    document.nodes[0]!.children.push('missing-node')
    document.accessors[0]!.count = 10

    const issues = validateSceneDocument(document)

    expect(issues.some((issue) => issue.code === 'missing-child')).toBe(true)
    expect(issues.some((issue) => issue.code === 'accessor-bounds')).toBe(true)
  })
})
