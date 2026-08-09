import {
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
} from 'three'
import { describe, expect, it } from 'vitest'
import { D5aArchive } from '../core/d5a-archive'
import { parseD5Mesh } from '../core/d5mesh'
import { createSceneDocumentFromObject } from '../interchange/scene-document'
import {
  compileD5MeshV11,
  d5DescriptorCoverageCheck,
  d5TextureTransform,
  writeD5aArchive,
} from './d5a-exporter'

describe('D5Mesh v11 writer', () => {
  it('preserves interleaved attributes and expands instance transforms without duplicating geometry', () => {
    const vertices = new Float32Array([
      0, 0, 0, 0, 1, 0, 0, 0,
      1, 0, 0, 0, 1, 0, 1, 0,
      0, 0, 1, 0, 1, 0, 0, 1,
    ])
    const interleaved = new InterleavedBuffer(vertices, 8)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
    geometry.setAttribute('normal', new InterleavedBufferAttribute(interleaved, 3, 3))
    geometry.setAttribute('uv', new InterleavedBufferAttribute(interleaved, 2, 6))
    geometry.setIndex(new BufferAttribute(new Uint16Array([0, 2, 1]), 1))
    const instances = new InstancedMesh(geometry, new MeshStandardMaterial({ name: 'metal' }), 2)
    instances.name = 'shared-part'
    instances.setMatrixAt(0, new Matrix4().makeTranslation(2, 0, 0))
    instances.setMatrixAt(1, new Matrix4().makeTranslation(-3, 1, 4))
    instances.position.set(0, 5, 0)
    const root = new Group()
    root.position.set(7, 0, -2)
    root.add(instances)

    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'test' })
    const compiled = compileD5MeshV11(scene)
    const parsed = parseD5Mesh(compiled.mesh)

    expect(compiled.groups).toHaveLength(1)
    expect(compiled.descriptors).toHaveLength(2)
    expect(parsed.triangleCount).toBe(2)
    expect(parsed.vertexCount).toBe(6)
    expect(parsed.groups[0]!.positions).toEqual(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 0, 1,
    ]))
    expect(parsed.groups[0]!.normals).toEqual(new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]))
    expect(parsed.groups[0]!.uvs).toEqual(new Float32Array([0, 0, 1, 0, 0, 1]))
    expect(parsed.groups[0]!.indices).toEqual(new Uint32Array([0, 2, 1]))
    expect(compiled.diagnostics).toEqual([])

    root.updateMatrixWorld(true)
    const instance = new Matrix4()
    const expectedD5Root = new Matrix4().makeRotationX(Math.PI / 2)
    for (let index = 0; index < 2; index += 1) {
      instances.getMatrixAt(index, instance)
      const expected = expectedD5Root.clone().multiply(instances.matrixWorld).multiply(instance).toArray()
      parsed.descriptors[index]!.transform.forEach((value, component) => {
        expect(value).toBeCloseTo(expected[component]!, 5)
      })
    }
  })

  it('generates required normals and UV0 for an unindexed triangle', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]), 3))
    const root = new Group()
    root.add(new Mesh(geometry, new MeshStandardMaterial()))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'test' })

    const compiled = compileD5MeshV11(scene)
    const parsed = parseD5Mesh(compiled.mesh)

    expect(parsed.groups[0]!.normals).toEqual(new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]))
    expect(parsed.groups[0]!.uvs).toEqual(new Float32Array(6))
    expect(parsed.groups[0]!.indices).toBeNull()
    expect(compiled.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'normal-generated',
      'uv0-generated',
    ])
  })

  it('writes a ZIP D5A that the existing archive and D5Mesh readers reopen', async () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
    const root = new Group()
    root.name = 'triangle'
    root.add(new Mesh(geometry, new MeshStandardMaterial({ name: 'plain' })))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' })

    const result = await writeD5aArchive(scene, 'triangle.glb')
    expect(Object.values(result.timings).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    expect(result.timings.archiveMs).toBeGreaterThanOrEqual(result.timings.compileMs)
    const file = new File([result.d5a], 'triangle.d5a', { type: 'application/zip' })
    const archive = await D5aArchive.open(file)
    try {
      expect(archive.inspection.variant).toBe('d5mesh')
      expect(archive.inspection.entries.map((entry) => entry.filename).sort()).toEqual([
        '1.d5mesh',
        'info.json',
        'summary.txt',
      ])
      const mesh = parseD5Mesh(await archive.arrayBuffer('1.d5mesh'))
      expect(mesh.version).toBe(11)
      expect(mesh.triangleCount).toBe(1)
      const info = JSON.parse(await archive.text('info.json')) as Record<string, unknown>
      expect(info.infoVersion).toBe(19)
      expect(info.material_MapKey).toEqual(['material-0'])
      expect(JSON.parse(String(info.detailInfo)).styleDatas[0].elements).toHaveLength(1)
      expect(await archive.text('summary.txt')).toBe('triangle.glb')
    } finally {
      await archive.close()
    }
  })

  it('orders D5 materials by their original materialIndex rather than traversal order', async () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
    const later = new MeshStandardMaterial({ name: 'later' })
    later.userData.d5Material = { index: 1, key: 'material-one', title: 'One' }
    const first = new MeshStandardMaterial({ name: 'first' })
    first.userData.d5Material = { index: 0, key: 'material-zero', title: 'Zero' }
    const root = new Group()
    root.add(new Mesh(geometry, later), new Mesh(geometry, first))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'd5a-d5mesh-v11' })

    const result = await writeD5aArchive(scene, 'ordered.d5a')
    const archive = await D5aArchive.open(new File([result.d5a], 'ordered.d5a'))
    try {
      const info = JSON.parse(await archive.text('info.json')) as Record<string, unknown>
      expect(info.material_MapKey).toEqual(['material-zero', 'material-one'])
    } finally {
      await archive.close()
    }
  })

  it('retains D5 material template metadata while refreshing material parameters', async () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
    const material = new MeshStandardMaterial({ name: 'Source PBR', roughness: 0.42, metalness: 0.16 })
    material.userData.d5Material = {
      index: 0,
      key: 'source-pbr',
      id: 'ORIGINAL_MATERIAL_ID',
      title: 'Source PBR',
      uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
      parameters: [{ name: 'CustomSwitch', type: 1, value: 'X=1.000000 Y=0.000000 Z=0.000000', group: 'Custom', default: false }],
      sourceData: {
        id: 'ORIGINAL_MATERIAL_ID',
        uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
        appendColor: { x: 0, y: 0, z: 0 },
        matInfo2: 'secondary-parameters',
        fromPlugin: 0,
        thumbnailUrl: 'ModelTextures/old-thumbnail.png',
        dependent_pak_lists: ['ModelTextures/old-thumbnail.png'],
      },
    }
    const root = new Group()
    root.add(new Mesh(geometry, material))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'd5a-d5mesh-v11' })

    const result = await writeD5aArchive(scene, 'source.d5a')
    const archive = await D5aArchive.open(new File([result.d5a], 'source.d5a'))
    try {
      const info = JSON.parse(await archive.text('info.json')) as { detailInfo: string }
      const output = JSON.parse(info.detailInfo).styleDatas[0].elements[0].materialData
      expect(output).toMatchObject({
        id: 'ORIGINAL_MATERIAL_ID',
        uePath: '/Game/MatLib2/Base/Base/Base_9/m.m',
        appendColor: { x: 0, y: 0, z: 0 },
        matInfo2: 'secondary-parameters',
        fromPlugin: 0,
        thumbnailUrl: '',
        dependent_pak_lists: [],
      })
      expect(JSON.parse(output.matInfo)).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'CustomSwitch' }),
        expect.objectContaining({ name: 'Roughness', value: 'X=0.420000 Y=0.000000 Z=0.000000' }),
      ]))
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'material-template-fallback')).toBe(false)
    } finally {
      await archive.close()
    }
  })

  it('selects the Base_9 template for scene materials without D5 source metadata', async () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2))
    const root = new Group()
    root.add(new Mesh(geometry, new MeshStandardMaterial({ name: 'Generic PBR' })))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' })

    const result = await writeD5aArchive(scene, 'generic.glb')
    const archive = await D5aArchive.open(new File([result.d5a], 'generic.d5a'))
    try {
      const info = JSON.parse(await archive.text('info.json')) as { detailInfo: string }
      const output = JSON.parse(info.detailInfo).styleDatas[0].elements[0].materialData
      expect(output.uePath).toBe('/Game/MatLib2/Base/Base/Base_9/m.m')
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'material-template-fallback' }),
      ]))
    } finally {
      await archive.close()
    }
  })

  it('preserves source D5 dimensions and maps generic Y-up bounds to D5 Z/X/Y axes', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      -2, -3, -5,
      2, -3, -5,
      -2, 3, 5,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(6), 2))
    const root = new Group()
    root.add(new Mesh(geometry, new MeshStandardMaterial()))

    const generic = createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' })
    expect(compileD5MeshV11(generic).dimensions).toEqual({ length: 10, depth: 4, height: 6 })

    const d5 = createSceneDocumentFromObject(root, {
      sourceFormat: 'd5a-d5mesh-v11',
      extras: { dimensions: { length: 10.25, depth: 4.5, height: 6.75 } },
    })
    expect(compileD5MeshV11(d5).dimensions).toEqual({ length: 10.25, depth: 4.5, height: 6.75 })
  })

  it('writes one descriptor per primitive when splitting a multi-material mesh', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1,
      1, 0, 1, 1, 0, 1,
    ]), 2))
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const first = new MeshStandardMaterial({ name: 'first' })
    first.userData.d5Material = { index: 0, key: 'first', title: 'first' }
    const second = new MeshStandardMaterial({ name: 'second' })
    second.userData.d5Material = { index: 1, key: 'second', title: 'second' }
    const root = new Group()
    root.add(new Mesh(geometry, [first, second]))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'd5a-legacy-fbx' })

    const result = compileD5MeshV11(scene)
    const parsed = parseD5Mesh(result.mesh)
    const coverage = d5DescriptorCoverageCheck(2, result.descriptors.length)

    expect(result.descriptors).toHaveLength(2)
    expect(result.groups.map((group) => group.vertexCount)).toEqual([3, 3])
    expect(parsed.vertexCount).toBe(6)
    expect(parsed.groups[0]!.positions).toEqual(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]))
    expect(parsed.groups[1]!.positions).toEqual(new Float32Array([
      1, 0, 0, 1, 1, 0, 0, 1, 0,
    ]))
    expect(parsed.groups.map((group) => group.indices)).toEqual([null, null])
    expect(coverage).toMatchObject({
      status: 'pass',
      expected: 2,
      actual: 2,
    })
    expect(d5DescriptorCoverageCheck(2, 1).status).toBe('fail')
  })

  it('compacts sparse indexed vertices and remaps triangle order locally', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      100, 100, 100,
      1, 0, 0,
      0, 1, 0,
      50, 50, 50,
      1, 1, 0,
      0, 0, 0,
      -100, -100, -100,
    ]), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([
      9, 9, 1, 0, 0, 1, 8, 8, 1, 1, 0, 0, -9, -9,
    ]), 2))
    geometry.setIndex(new BufferAttribute(new Uint16Array([5, 1, 4, 4, 1, 2]), 1))
    const root = new Group()
    root.add(new Mesh(geometry, new MeshStandardMaterial()))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'test' })

    const compiled = compileD5MeshV11(scene)
    const parsed = parseD5Mesh(compiled.mesh)

    expect(compiled.groups[0]!.vertexCount).toBe(4)
    expect(parsed.groups[0]!.positions).toEqual(new Float32Array([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ]))
    expect(parsed.groups[0]!.uvs).toEqual(new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
    ]))
    expect(parsed.groups[0]!.indices).toEqual(new Uint32Array([0, 1, 2, 2, 1, 3]))
    expect(compiled.dimensions).toEqual({ length: 0, depth: 1, height: 1 })
  })
})

describe('D5 texture transform writer', () => {
  it('recovers center-based D5 offsets from an equivalent GLB origin transform', () => {
    const texture = new Texture()
    texture.repeat.set(0.1, 0.1)
    texture.offset.set(0.45, 0.84)
    texture.center.set(0, 0)
    texture.rotation = Math.PI / 2
    texture.updateMatrix()
    const root = new Group()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    root.add(new Mesh(geometry, new MeshStandardMaterial({ map: texture })))
    const scene = createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' })

    const transform = d5TextureTransform(scene.textures[0]!)

    expect(transform.repeat[0]).toBeCloseTo(0.1, 12)
    expect(transform.repeat[1]).toBeCloseTo(0.1, 12)
    expect(transform.offset[0]).toBeCloseTo(0, 12)
    expect(transform.offset[1]).toBeCloseTo(0.29, 12)
    expect(transform.rotation).toBeCloseTo(Math.PI / 2, 12)
  })
})
