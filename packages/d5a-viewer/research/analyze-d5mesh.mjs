import { promises as fs } from 'node:fs'
import path from 'node:path'

async function main() {
  const filenames = process.argv.slice(2)
  if (filenames.length === 0) {
    console.error('Usage: node research/analyze-d5mesh.mjs FILE.d5mesh [...]')
    process.exitCode = 1
    return
  }

  for (const filename of filenames) {
    const bytes = await fs.readFile(filename)
    const reader = new Reader(bytes)
    const version = reader.uint32()
    if (version === 0x206c6c41) {
      console.log(JSON.stringify({
        file: path.resolve(filename),
        bytes: bytes.byteLength,
        protectedContainer: true,
        marker: bytes.subarray(0, 72).toString('utf8').replaceAll('\0', ''),
      }, null, 2))
      continue
    }

    const legacy = version <= 10
    const metadata = parseJson(legacy ? reader.countedUtf8() : reader.countedUtf16())
    const reserved = legacy ? null : reader.uint32()
    let descriptors = legacy ? [] : Array.from({ length: reader.uint32() }, () => ({
      key: reader.countedUtf16(),
      material: reader.countedUtf16(),
      transform: reader.float32Array(16).values,
    }))
    const descriptorByKey = new Map(descriptors.map((descriptor, index) => [descriptor.key, index]))
    const groupCount = reader.uint32()
    const groups = []

    for (let index = 0; index < groupCount; index += 1) {
      const key = legacy ? reader.countedUtf8() : reader.countedUtf16()
      if (legacy) {
        const vertices = reader.uint32()
        const interleaved = reader.float32Array(vertices * 8, 8)
        const indices = reader.countedUint32Array()
        groups.push({
          index,
          key,
          layout: 'position.xyz + uv.xy + normal.xyz',
          vertices,
          triangles: indices.count / 3,
          interleaved,
          indices,
        })
      } else {
        const positions = reader.countedFloat32Array(3)
        const normals = reader.countedFloat32Array(3)
        const uvs = reader.countedFloat32Array(2)
        const extra = reader.countedFloat32Array()
        const indices = reader.countedUint32Array()
        groups.push({
          index,
          key,
          descriptorIndex: descriptorByKey.get(key) ?? -1,
          vertices: positions.count / 3,
          triangles: indices.count / 3,
          positions,
          normals,
          uvs,
          extra,
          indices,
        })
      }
    }

    if (legacy && reader.remaining >= 4) {
      const descriptorCount = reader.uint32()
      descriptors = Array.from({ length: descriptorCount }, (_, index) => {
        const key = reader.countedUtf8()
        const material = reader.countedUtf8()
        return version === 9
          ? { index, key, material, transform: reader.float32Array(16).values }
          : { index, key, material, trs: reader.float32Array(9).values }
      })
    }

    console.log(JSON.stringify({
      file: path.resolve(filename),
      bytes: bytes.byteLength,
      version,
      metadata,
      reserved,
      descriptors,
      groups,
      trailingBytes: reader.remaining,
    }, null, 2))
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

class Reader {
  constructor(buffer) {
    this.buffer = buffer
    this.offset = 0
  }

  get remaining() {
    return this.buffer.byteLength - this.offset
  }

  uint32() {
    this.ensure(4)
    const value = this.buffer.readUInt32LE(this.offset)
    this.offset += 4
    return value
  }

  countedUtf16() {
    const characters = this.uint32()
    const bytes = characters * 2
    this.ensure(bytes)
    const value = this.buffer.toString('utf16le', this.offset, this.offset + bytes)
    this.offset += bytes
    return value
  }

  countedUtf8() {
    const bytes = this.uint32()
    this.ensure(bytes)
    const value = this.buffer.toString('utf8', this.offset, this.offset + bytes)
    this.offset += bytes
    return value
  }

  countedFloat32Array(components) {
    return this.float32Array(this.uint32(), components)
  }

  float32Array(count, components) {
    const bytes = count * 4
    this.ensure(bytes)
    const start = this.offset
    const min = components ? new Array(components).fill(Number.POSITIVE_INFINITY) : []
    const max = components ? new Array(components).fill(Number.NEGATIVE_INFINITY) : []
    const outsideUnit = components ? new Array(components).fill(0) : []
    let nonFinite = 0
    const sample = []
    for (let index = 0; index < count; index += 1) {
      const value = this.buffer.readFloatLE(start + index * 4)
      if (sample.length < 16) sample.push(value)
      if (!Number.isFinite(value)) {
        nonFinite += 1
        continue
      }
      if (components) {
        const component = index % components
        min[component] = Math.min(min[component], value)
        max[component] = Math.max(max[component], value)
        if (value < 0 || value > 1) outsideUnit[component] += 1
      }
    }
    this.offset += bytes
    return {
      count,
      components: components ?? null,
      tuples: components ? count / components : null,
      min: components ? min : undefined,
      max: components ? max : undefined,
      outsideUnit: components ? outsideUnit : undefined,
      nonFinite,
      values: sample,
    }
  }

  countedUint32Array() {
    const count = this.uint32()
    const bytes = count * 4
    this.ensure(bytes)
    const start = this.offset
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let identity = true
    const sample = []
    for (let index = 0; index < count; index += 1) {
      const value = this.buffer.readUInt32LE(start + index * 4)
      if (sample.length < 16) sample.push(value)
      min = Math.min(min, value)
      max = Math.max(max, value)
      if (value !== index) identity = false
    }
    this.offset += bytes
    return { count, min, max, identity, values: sample }
  }

  ensure(bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.remaining) {
      throw new Error(`Read of ${bytes} bytes exceeds buffer at 0x${this.offset.toString(16)}`)
    }
  }
}

await main()
