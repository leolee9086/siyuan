import { describe, expect, it } from 'vitest'
import { Matrix4, Vector3 } from 'three'
import { legacyTrsToMatrix, parseD5Mesh } from './d5mesh'

class FixtureWriter {
  bytes: number[] = []

  u32(value: number): void {
    this.raw(new Uint8Array(new Uint32Array([value]).buffer))
  }

  f32(value: number): void {
    this.raw(new Uint8Array(new Float32Array([value]).buffer))
  }

  string(value: string): void {
    this.u32(value.length)
    const encoded = new Uint8Array(value.length * 2)
    const view = new DataView(encoded.buffer)
    for (let index = 0; index < value.length; index += 1) view.setUint16(index * 2, value.charCodeAt(index), true)
    this.raw(encoded)
  }

  utf8(value: string): void {
    const encoded = new TextEncoder().encode(value)
    this.u32(encoded.length)
    this.raw(encoded)
  }

  array(values: number[], write: (value: number) => void): void {
    this.u32(values.length)
    values.forEach(write)
  }

  raw(values: Uint8Array): void {
    this.bytes.push(...values)
  }

  buffer(): ArrayBuffer {
    return Uint8Array.from(this.bytes).buffer
  }
}

function fixture(): ArrayBuffer {
  const writer = new FixtureWriter()
  writer.u32(11)
  writer.string('{"triangleCount":1,"upVector":3}')
  writer.u32(0)
  writer.u32(1)
  writer.string('mesh-key')
  writer.string('material-key')
  ;[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1].forEach((value) => writer.f32(value))
  writer.u32(1)
  writer.string('mesh-key')
  writer.array([0, 0, 0, 1, 0, 0, 0, 1, 0], (value) => writer.f32(value))
  writer.array([0, 0, 1, 0, 0, 1, 0, 0, 1], (value) => writer.f32(value))
  writer.array([0, 0, 1, 0, 0, 1], (value) => writer.f32(value))
  writer.array([], (value) => writer.f32(value))
  writer.array([0, 1, 2], (value) => writer.u32(value))
  return writer.buffer()
}

function separatedIdentityPrefixFixture(): ArrayBuffer {
  const writer = new FixtureWriter()
  writer.u32(11)
  writer.string('{"triangleCount":1,"upVector":3}')
  writer.u32(0)
  writer.u32(1)
  writer.string('mesh-key')
  writer.string('material-key')
  ;[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1].forEach((value) => writer.f32(value))
  writer.u32(1)
  writer.string('mesh-key')
  writer.array([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    2, 0, 0, 2, 1, 0, 3, 0, 0,
  ], (value) => writer.f32(value))
  writer.array(new Array(18).fill(0), (value) => writer.f32(value))
  writer.array(new Array(12).fill(0), (value) => writer.f32(value))
  writer.array([], (value) => writer.f32(value))
  writer.array([0, 1, 2], (value) => writer.u32(value))
  return writer.buffer()
}

function interleavedIdentityPrefixFixture(): ArrayBuffer {
  const writer = new FixtureWriter()
  writer.u32(10)
  writer.utf8('{"triangleCount":1,"upVector":3}')
  writer.u32(1)
  writer.utf8('legacy-material')
  writer.u32(6)
  for (let vertex = 0; vertex < 6; vertex += 1) {
    ;[vertex, 0, 0, 0, 0, 0, 0, 1].forEach((value) => writer.f32(value))
  }
  writer.array([0, 1, 2], (value) => writer.u32(value))
  writer.u32(1)
  writer.utf8('legacy-material')
  writer.utf8('legacy-material')
  ;[0, 0, 0, 0, 0, 0, 1, 1, 1].forEach((value) => writer.f32(value))
  writer.u32(0)
  return writer.buffer()
}

function interleavedFixture(version: 9 | 10): ArrayBuffer {
  const writer = new FixtureWriter()
  writer.u32(version)
  writer.utf8('{"triangleCount":1,"upVector":3}')
  writer.u32(1)
  writer.utf8('legacy-material')
  writer.u32(3)
  ;[
    0, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 1, 0, 0, 0, 1,
    0, 1, 0, 0, 1, 0, 0, 1,
  ].forEach((value) => writer.f32(value))
  writer.array([0, 1, 2], (value) => writer.u32(value))
  writer.u32(1)
  if (version === 9) {
    writer.utf8('/0/legacy-material')
    writer.utf8('UniqueMesh0_legacy-material')
    ;[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1].forEach((value) => writer.f32(value))
  } else {
    writer.utf8('legacy-material')
    writer.utf8('legacy-material')
    ;[2, 3, 4, 0, 0, 0, 1, 1, 1].forEach((value) => writer.f32(value))
    writer.u32(0)
  }
  return writer.buffer()
}

describe('parseD5Mesh', () => {
  it('parses a complete version 11 mesh and removes identity indices', () => {
    const model = parseD5Mesh(fixture())
    expect(model.version).toBe(11)
    expect(model.triangleCount).toBe(1)
    expect(model.vertexCount).toBe(3)
    expect(model.groups[0]?.indices).toBeNull()
    expect(model.groups[0]?.descriptorIndex).toBe(0)
    expect(model.descriptors[0]?.transform[12]).toBe(2)
    expect(model.warnings).toEqual([])
  })

  it.each([9, 10] as const)('parses version %s interleaved position/UV/normal vertices', (version) => {
    const model = parseD5Mesh(interleavedFixture(version))
    expect(model.version).toBe(version)
    expect(model.vertexCount).toBe(3)
    expect(model.triangleCount).toBe(1)
    expect(model.groups[0]?.interleaved).toEqual(new Float32Array([
      0, 0, 0, 0, 0, 0, 0, 1,
      1, 0, 0, 1, 0, 0, 0, 1,
      0, 1, 0, 0, 1, 0, 0, 1,
    ]))
    expect(model.groups[0]?.indices).toBeNull()
    expect(model.descriptors[0]?.groupIndex).toBe(0)
    expect(model.descriptors[0]?.transform.slice(12, 15)).toEqual(new Float32Array([2, 3, 4]))
  })

  it('retains a separated identity index prefix that covers only part of the vertex buffer', () => {
    const model = parseD5Mesh(separatedIdentityPrefixFixture())

    expect(model.groups[0]?.indices).toEqual(new Uint32Array([0, 1, 2]))
    expect(model.groups[0]?.positions.length).toBe(18)
    expect(model.triangleCount).toBe(1)
  })

  it('retains an interleaved identity index prefix that covers only part of the vertex buffer', () => {
    const model = parseD5Mesh(interleavedIdentityPrefixFixture())

    expect(model.groups[0]?.indices).toEqual(new Uint32Array([0, 1, 2]))
    expect(model.groups[0]?.interleaved?.length).toBe(48)
    expect(model.triangleCount).toBe(1)
  })

  it('converts Unreal Pitch/Yaw/Roll transforms into Three.js matrices', () => {
    const transform = legacyTrsToMatrix(new Float32Array([2, 3, 4, 0, 90, 0, 2, 1, 1]))
    const point = new Vector3(1, 0, 0).applyMatrix4(new Matrix4().fromArray(transform))

    expect(point.x).toBeCloseTo(2)
    expect(point.y).toBeCloseTo(5)
    expect(point.z).toBeCloseTo(4)
  })

  it('rejects unsupported versions with an actionable diagnostic', () => {
    const buffer = new Uint32Array([8]).buffer
    expect(() => parseD5Mesh(buffer)).toThrow(/version 8 is not mapped yet/i)
  })

  it('identifies the protected D5Mesh container marker', () => {
    const buffer = new Uint32Array([0x206c6c41]).buffer
    expect(() => parseD5Mesh(buffer)).toThrow(/protected official-library "All those moments" container/i)
  })

  it('rejects truncated array payloads', () => {
    const bytes = new Uint8Array(fixture())
    expect(() => parseD5Mesh(bytes.slice(0, -8).buffer)).toThrow(/only .* remain|cannot read/i)
  })
})
