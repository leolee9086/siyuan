import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { D5aArchive } from '../core/d5a-archive'
import { writeD5aArchive } from '../export/d5a-exporter'
import { createSceneDocumentFromObject } from './scene-document'
import { inspectSceneFile, parseGlbContainer, validateSceneFile } from './scene-inspection'

describe('scene container inspection', () => {
  it('reports GLB topology from the JSON chunk without creating a renderer', async () => {
    const file = new File([glbFile({
      asset: { version: '2.0' },
      accessors: [{ count: 3 }, { count: 6 }],
      meshes: [{ primitives: [
        { attributes: { POSITION: 0 }, mode: 4 },
        { attributes: { POSITION: 0 }, indices: 1, mode: 5 },
      ] }],
      materials: [{ name: 'fixture' }],
    })], 'fixture.glb')

    const report = await inspectSceneFile(file)

    expect(report.status).toBe('pass')
    expect(report.glb).toMatchObject({
      meshCount: 1,
      primitiveCount: 2,
      triangleCount: 5,
      materialCount: 1,
    })
  })

  it('hands a valid minimal GLB to the Khronos validator', async () => {
    const report = await validateSceneFile(new File([glbFile({ asset: { version: '2.0' } })], 'valid.glb'))

    expect(report.status).toBe('pass')
    expect(report.validation).toMatchObject({ engine: 'gltf-validator', errorCount: 0, warningCount: 0 })
  })

  it('reuses D5Mesh and D5A archive core for inspection and stream extraction', async () => {
    const file = await d5aFixture()
    const inspection = await inspectSceneFile(file)
    const validation = await validateSceneFile(file)

    expect(inspection.status).toBe('pass')
    expect(inspection.d5a?.bundles[0]).toMatchObject({
      status: 'parsed',
      mesh: { version: 11, triangleCount: 1, vertexCount: 3, descriptorCount: 1 },
      material: { materialCount: 1 },
    })
    expect(validation.validation).toMatchObject({ engine: 'd5mesh-parser', errorCount: 0 })

    const archive = await D5aArchive.open(file)
    try {
      const chunks: Uint8Array[] = []
      await archive.writeTo('summary.txt', new WritableStream({
        write(chunk) {
          chunks.push(new Uint8Array(chunk))
        },
      }))
      expect(new TextDecoder().decode(joinChunks(chunks))).toBe('fixture.glb')
    } finally {
      await archive.close()
    }
  })

  it('rejects GLB chunks that exceed the declared container boundary', () => {
    const invalid = glbFile({ asset: { version: '2.0' } })
    new DataView(invalid).setUint32(12, invalid.byteLength, true)

    expect(() => parseGlbContainer(invalid)).toThrow(/GLB JSON 块无效/)
  })
})

async function d5aFixture(): Promise<File> {
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
  root.add(new Mesh(geometry, new MeshStandardMaterial({ name: 'plain' })))
  const result = await writeD5aArchive(createSceneDocumentFromObject(root, { sourceFormat: 'glb-2.0' }), 'fixture.glb')
  return new File([result.d5a], 'fixture.d5a', { type: 'application/zip' })
}

function glbFile(json: Record<string, unknown>): ArrayBuffer {
  const source = new TextEncoder().encode(JSON.stringify(json))
  const jsonLength = Math.ceil(source.byteLength / 4) * 4
  const buffer = new ArrayBuffer(20 + jsonLength)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, jsonLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  const bytes = new Uint8Array(buffer, 20, jsonLength)
  bytes.fill(0x20)
  bytes.set(source)
  return buffer
}

function joinChunks(chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
