import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Texture,
} from 'three'
import { describe, expect, it } from 'vitest'
import { createFidelityReport, inspectScene } from './fidelity'

describe('scene fidelity metrics', () => {
  it('counts shared geometry, materials, texture slots, UVs, and world transforms', () => {
    const root = new Group()
    const geometry = new BoxGeometry(2, 3, 4)
    const material = new MeshStandardMaterial({ map: new Texture() })
    const first = new Mesh(geometry, material)
    first.name = 'shared'
    first.position.set(1, 2, 3)
    const second = new Mesh(geometry, material)
    second.name = 'shared'
    second.position.set(-1, 0, 2)
    root.add(first, second)

    const metrics = inspectScene(root)

    expect(metrics.meshNodeCount).toBe(2)
    expect(metrics.uniqueGeometryCount).toBe(1)
    expect(metrics.materialCount).toBe(1)
    expect(metrics.textureCount).toBe(1)
    expect(metrics.primitivesWithNormals).toBe(12)
    expect(metrics.primitivesWithUv0).toBe(12)
    expect(metrics.triangleCount).toBe(24)
    expect(metrics.meshTransforms).toHaveLength(2)
  })

  it('passes an exact round trip and fails transformed geometry drift', () => {
    const root = new Group()
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    mesh.name = 'box'
    root.add(mesh)
    const source = inspectScene(root)
    const exact = createFidelityReport({
      sourceName: 'box.d5a',
      source,
      roundTrip: source,
      exportBytes: 1024,
      exportMs: 5,
    })
    expect(exact.status).toBe('pass')

    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(new Matrix4().makeTranslation(10, 0, 0))
    const drifted = inspectScene(root)
    const failed = createFidelityReport({
      sourceName: 'box.d5a',
      source,
      roundTrip: drifted,
      exportBytes: 1024,
      exportMs: 5,
    })
    expect(failed.status).toBe('fail')
    expect(failed.checks.find((check) => check.id === 'bounds')?.status).toBe('fail')
    expect(failed.checks.find((check) => check.id === 'transforms')?.status).toBe('fail')
  })

  it('fails a round trip when texture objects exist but their UV transforms drift', () => {
    const geometry = new BoxGeometry()
    const sourceTexture = new Texture()
    sourceTexture.repeat.set(0.1, 0.1)
    sourceTexture.offset.set(0, 0.29)
    sourceTexture.center.set(0.5, 0.5)
    sourceTexture.rotation = Math.PI / 2
    const sourceMaterial = new MeshStandardMaterial({ name: 'tray', map: sourceTexture })
    const sourceRoot = new Group()
    sourceRoot.add(new Mesh(geometry, sourceMaterial))

    const roundTripTexture = sourceTexture.clone()
    roundTripTexture.center.set(0, 0)
    const roundTripMaterial = new MeshStandardMaterial({ name: 'tray', map: roundTripTexture })
    const roundTripRoot = new Group()
    roundTripRoot.add(new Mesh(geometry, roundTripMaterial))

    const report = createFidelityReport({
      sourceName: 'tray.d5a',
      source: inspectScene(sourceRoot),
      roundTrip: inspectScene(roundTripRoot),
      exportBytes: 1024,
      exportMs: 5,
    })

    expect(report.status).toBe('fail')
    expect(report.checks.find((check) => check.id === 'texture-transforms')?.status).toBe('fail')
  })

  it('includes independent Khronos validation in the report status', () => {
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
    const metrics = inspectScene(root)

    const report = createFidelityReport({
      sourceName: 'box.d5a',
      source: metrics,
      roundTrip: metrics,
      exportBytes: 1024,
      exportMs: 5,
      validator: {
        version: 'test',
        errors: 0,
        warnings: 1,
        infos: 0,
        hints: 0,
        truncated: false,
        messages: [],
      },
    })

    expect(report.status).toBe('warning')
    expect(report.checks.find((check) => check.id === 'khronos-validator')?.status).toBe('warning')
  })

  it('treats a multi-material mesh split into equivalent primitives as a warning', () => {
    const attributes = {
      position: new Float32Array([
        0, 0, 0, 1, 0, 0, 0, 1, 0,
        1, 0, 0, 1, 1, 0, 0, 1, 0,
      ]),
      normal: new Float32Array([
        0, 0, 1, 0, 0, 1, 0, 0, 1,
        0, 0, 1, 0, 0, 1, 0, 0, 1,
      ]),
      uv: new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
    }
    const sourceGeometry = geometryFromAttributes(attributes)
    sourceGeometry.addGroup(0, 3, 0)
    sourceGeometry.addGroup(3, 3, 1)
    const firstMaterial = new MeshStandardMaterial({ name: 'first' })
    const secondMaterial = new MeshStandardMaterial({ name: 'second' })
    const sourceRoot = new Group()
    const sourceMesh = new Mesh(sourceGeometry, [firstMaterial, secondMaterial])
    sourceMesh.position.set(2, 3, 4)
    sourceRoot.add(sourceMesh)

    const targetRoot = new Group()
    const firstMesh = new Mesh(geometryFromAttributes(sliceAttributes(attributes, 0, 3)), firstMaterial)
    const secondMesh = new Mesh(geometryFromAttributes(sliceAttributes(attributes, 3, 6)), secondMaterial)
    firstMesh.position.copy(sourceMesh.position)
    secondMesh.position.copy(sourceMesh.position)
    targetRoot.add(firstMesh, secondMesh)

    const report = createFidelityReport({
      sourceName: 'grouped.fbx.d5a',
      source: inspectScene(sourceRoot),
      roundTrip: inspectScene(targetRoot),
      exportBytes: 1024,
      exportMs: 5,
    })

    expect(report.status).toBe('warning')
    expect(report.checks.some((check) => check.status === 'fail')).toBe(false)
    expect(report.checks.find((check) => check.id === 'primitives')?.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'transforms')?.status).toBe('pass')
  })

  it('normalizes glTF metallic-roughness packing when metalness is zero', () => {
    const sourceTexture = new Texture()
    sourceTexture.colorSpace = LinearSRGBColorSpace
    const sourceMaterial = new MeshStandardMaterial({
      name: 'leaf',
      metalness: 0,
      roughnessMap: sourceTexture,
    })
    const sourceRoot = new Group()
    sourceRoot.add(new Mesh(new BoxGeometry(), sourceMaterial))

    const packedTexture = sourceTexture.clone()
    packedTexture.colorSpace = NoColorSpace
    const targetMaterial = new MeshStandardMaterial({
      name: 'leaf',
      metalness: 0,
      roughnessMap: packedTexture,
      metalnessMap: packedTexture,
    })
    const targetRoot = new Group()
    targetRoot.add(new Mesh(new BoxGeometry(), targetMaterial))

    const report = createFidelityReport({
      sourceName: 'leaf.d5a',
      source: inspectScene(sourceRoot),
      roundTrip: inspectScene(targetRoot),
      exportBytes: 1024,
      exportMs: 5,
    })

    expect(report.checks.find((check) => check.id === 'material-structure')?.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'texture-transforms')?.status).toBe('pass')
  })

  it('matches D5 materials by logical key when sparse source slots are renumbered', () => {
    const sourceMaterial = new MeshStandardMaterial({ name: 'KK0167' })
    sourceMaterial.userData.d5Material = { index: 10, key: 'KK0167' }
    const targetMaterial = sourceMaterial.clone()
    targetMaterial.userData.d5Material = { index: 0, key: 'kk0167' }
    const sourceRoot = new Group()
    const targetRoot = new Group()
    const geometry = new BoxGeometry()
    sourceRoot.add(new Mesh(geometry, sourceMaterial))
    targetRoot.add(new Mesh(geometry, targetMaterial))

    const report = createFidelityReport({
      sourceName: 'sparse-v10.d5a',
      source: inspectScene(sourceRoot),
      roundTrip: inspectScene(targetRoot),
      exportBytes: 1024,
      exportMs: 5,
    })

    expect(report.checks.find((check) => check.id === 'material-structure')?.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'material-parameters')?.status).toBe('pass')
    expect(report.checks.find((check) => check.id === 'texture-transforms')?.status).toBe('pass')
  })
})

function geometryFromAttributes(attributes: {
  position: Float32Array
  normal: Float32Array
  uv: Float32Array
}): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(attributes.position, 3))
  geometry.setAttribute('normal', new BufferAttribute(attributes.normal, 3))
  geometry.setAttribute('uv', new BufferAttribute(attributes.uv, 2))
  return geometry
}

function sliceAttributes(
  attributes: { position: Float32Array; normal: Float32Array; uv: Float32Array },
  start: number,
  end: number,
): { position: Float32Array; normal: Float32Array; uv: Float32Array } {
  return {
    position: attributes.position.slice(start * 3, end * 3),
    normal: attributes.normal.slice(start * 3, end * 3),
    uv: attributes.uv.slice(start * 2, end * 2),
  }
}
