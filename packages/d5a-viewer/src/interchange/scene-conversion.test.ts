import { describe, expect, it } from 'vitest'
import { writeD5aArchive } from '../export/d5a-exporter'
import type { SceneDocument } from './scene-document'
import {
  convertSceneFile,
  inspectSceneDocument,
  readSceneDocument,
  writeGlbScene,
} from './scene-conversion'

const PIXEL_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 240,
  31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
])

function fixtureScene(): SceneDocument {
  return {
    schemaVersion: 1,
    name: 'conversion fixture',
    sourceFormat: 'test',
    coordinateSystem: { handedness: 'right', upAxis: 'Y', metersPerUnit: 1 },
    roots: ['node-root'],
    nodes: [
      { id: 'node-root', name: 'root', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], children: ['node-mesh'], visible: true, extras: {} },
      { id: 'node-mesh', name: 'triangle', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1], children: [], mesh: 'mesh-0', visible: true, extras: {} },
    ],
    meshes: [{
      id: 'mesh-0', name: 'triangle', primitives: [{
        id: 'primitive-0', mode: 'triangles',
        attributes: { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv0' },
        indices: 'indices', material: 'material-0', morphTargets: [], start: 0, count: 3,
      }],
    }],
    accessors: [
      { id: 'position', sourceName: 'position', array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), itemSize: 3, count: 3, normalized: false, offset: 0, stride: 3, usage: 35044 },
      { id: 'normal', sourceName: 'normal', array: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), itemSize: 3, count: 3, normalized: false, offset: 0, stride: 3, usage: 35044 },
      { id: 'uv0', sourceName: 'uv', array: new Float32Array([0, 0, 1, 0, 0, 1]), itemSize: 2, count: 3, normalized: false, offset: 0, stride: 2, usage: 35044 },
      { id: 'indices', sourceName: 'index', array: new Uint16Array([0, 1, 2]), itemSize: 1, count: 3, normalized: false, offset: 0, stride: 1, usage: 35044 },
    ],
    materials: [{
      id: 'material-0', name: 'textured material', model: 'PBR',
      pbr: { baseColor: [0.8, 0.7, 0.6, 1], emissive: [0, 0, 0], metalness: 0.1, roughness: 0.55, opacity: 1, alphaMode: 'opaque', alphaCutoff: 0.5, doubleSided: true },
      textures: [{ slot: 'map', texture: 'texture-0', texCoord: 0 }],
      extras: {},
    }],
    textures: [{
      id: 'texture-0', name: 'pixel', image: 'image-0',
      sampler: { wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987, anisotropy: 1 },
      colorSpace: 'srgb', offset: [0, 0], repeat: [1, 1], center: [0, 0], rotation: 0,
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], extras: {},
    }],
    images: [{
      id: 'image-0', name: 'pixel.png', mimeType: 'image/png', width: 1, height: 1, depth: 1,
      payload: { kind: 'encoded', data: PIXEL_PNG, mimeType: 'image/png', extension: 'png' },
    }],
    skins: [],
    animations: [],
    extras: {},
  }
}

describe('node scene conversion', () => {
  it('writes a validator-compatible GLB while preserving encoded image bytes', async () => {
    const written = await writeGlbScene(fixtureScene())
    const file = new File([written.bytes], 'fixture.glb', { type: 'model/gltf-binary' })
    const loaded = await readSceneDocument(file)
    expect(written.diagnostics).toEqual([])
    expect(inspectSceneDocument(loaded.scene)).toMatchObject({
      triangleCount: 1,
      meshNodeCount: 1,
      textureCount: 1,
      primitivesWithNormals: 1,
      primitivesWithUv0: 1,
    })
    expect(loaded.scene.images[0]?.payload).toMatchObject({ kind: 'encoded', mimeType: 'image/png' })
    const payload = loaded.scene.images[0]?.payload
    expect(payload?.kind === 'encoded' ? payload.data : []).toEqual(PIXEL_PNG)
  })

  it('round-trips GLB to D5A without requiring Canvas image encoding', async () => {
    const glb = await writeGlbScene(fixtureScene())
    const source = new File([glb.bytes], 'fixture.glb', { type: 'model/gltf-binary' })
    const result = await convertSceneFile(source, { targetFormat: 'd5a' })
    expect(result.report.status).toBe('warning')
    expect(result.report.checks.find((check) => check.id === 'triangleCount')?.status).toBe('pass')
    expect(result.report.checks.find((check) => check.id === 'primitivesWithUv0')?.status).toBe('pass')
    const output = await readSceneDocument(new File([result.output], 'fixture.d5a', { type: 'application/zip' }))
    const payload = output.scene.images[0]?.payload
    expect(payload?.kind === 'encoded' ? payload.data : []).toEqual(PIXEL_PNG)
  })

  it('reads ordinary D5A directly and converts it to GLB', async () => {
    const d5a = await writeD5aArchive(fixtureScene(), 'fixture.glb')
    const source = new File([d5a.d5a], 'fixture.d5a', { type: 'application/zip' })
    const result = await convertSceneFile(source, { targetFormat: 'glb' })
    expect(result.report.status).toBe('pass')
    expect(result.report.validator?.errors).toBe(0)
    expect(result.report.checks.find((check) => check.id === 'triangleCount')?.status).toBe('pass')
  })

  it('exports GLB to structurally verified DXF with explicit fidelity limits', async () => {
    const glb = await writeGlbScene(fixtureScene())
    const source = new File([glb.bytes], 'fixture.glb', { type: 'model/gltf-binary' })
    const result = await convertSceneFile(source, { targetFormat: 'dxf' })
    const text = await result.output.text()

    expect(result.report.status).toBe('warning')
    expect(result.report.targetFormat).toBe('dxf')
    expect(result.report.roundTrip.triangleCount).toBe(1)
    expect(result.report.checks.find((check) => check.id === 'triangleCount')?.status).toBe('pass')
    expect(result.report.checks.find((check) => check.id === 'primitivesWithUv0')?.status).toBe('warning')
    expect(result.report.warnings.some((warning) => warning.code === 'dxf-textures-not-representable')).toBe(true)
    expect(text).toContain('0\r\n3DFACE')
  })

  it('generates MikkTSpace tangents for an unindexed primitive using a normal map', async () => {
    const scene = fixtureScene()
    scene.meshes[0]!.primitives[0] = {
      ...scene.meshes[0]!.primitives[0]!,
      indices: undefined,
      count: 3,
    }
    scene.materials[0]!.textures.push({ slot: 'normalMap', texture: 'texture-0', texCoord: 0, scale: 1 })
    const written = await writeGlbScene(scene)
    const validator = await import('gltf-validator')
    const validation = await validator.validateBytes(new Uint8Array(written.bytes), { uri: 'normal-map.glb', format: 'glb' })
    const loaded = await readSceneDocument(new File([written.bytes], 'normal-map.glb', { type: 'model/gltf-binary' }))
    const tangentId = loaded.scene.meshes[0]!.primitives[0]!.attributes.TANGENT
    const tangent = tangentId ? loaded.scene.accessors.find((accessor) => accessor.id === tangentId) : undefined

    expect(written.diagnostics).toEqual([])
    expect(validation.issues.numErrors).toBe(0)
    expect(validation.issues.numWarnings).toBe(0)
    expect(tangent).toMatchObject({ itemSize: 4, count: 3 })
  })

  it('generates unit tangents without de-indexing an indexed normal-map primitive', async () => {
    const scene = fixtureScene()
    scene.materials[0]!.textures.push({ slot: 'normalMap', texture: 'texture-0', texCoord: 0, scale: 1 })
    const written = await writeGlbScene(scene)
    const validator = await import('gltf-validator')
    const validation = await validator.validateBytes(new Uint8Array(written.bytes), { uri: 'indexed-normal-map.glb', format: 'glb' })
    const loaded = await readSceneDocument(new File([written.bytes], 'indexed-normal-map.glb', { type: 'model/gltf-binary' }))

    expect(validation.issues.numErrors).toBe(0)
    expect(validation.issues.numWarnings).toBe(0)
    expect(loaded.scene.meshes[0]!.primitives[0]!.indices).toBeDefined()
    expect(loaded.scene.meshes[0]!.primitives[0]!.attributes.TANGENT).toBeDefined()
  })
})
