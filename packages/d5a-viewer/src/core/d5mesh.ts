import { BinaryReader, D5ParseError } from './binary-reader'
import type { D5MeshDescriptor, D5MeshGroup, D5MeshMetadata, D5MeshModel } from './types'

const SUPPORTED_VERSIONS = new Set([9, 10, 11])
const PROTECTED_CONTAINER_MARKER = 0x206c6c41
const MAX_GROUPS = 100_000
const LEGACY_VERTEX_STRIDE = 8

export function parseD5Mesh(buffer: ArrayBuffer): D5MeshModel {
  const reader = new BinaryReader(buffer)
  const version = reader.uint32()
  if (version === PROTECTED_CONTAINER_MARKER) {
    throw new D5ParseError('D5Mesh uses the protected official-library "All those moments" container', 0)
  }
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new D5ParseError(
      `D5Mesh version ${version} is not mapped yet; supported versions: ${[...SUPPORTED_VERSIONS].join(', ')}`,
      0,
    )
  }

  return version <= 10
    ? parseInterleavedMesh(reader, version, buffer.byteLength)
    : parseSeparatedMesh(reader, version, buffer.byteLength)
}

function parseSeparatedMesh(reader: BinaryReader, version: number, sourceBytes: number): D5MeshModel {
  const metadataText = reader.countedUtf16()
  const metadata = parseMetadata(metadataText)

  const warnings: string[] = []
  const reserved = reader.uint32()
  if (reserved !== 0) warnings.push(`Header reserved field is ${reserved}, expected 0`)

  const descriptorCount = readBoundedCount(reader, 'descriptor')
  const descriptors: D5MeshDescriptor[] = []
  const descriptorsByKey = new Map<string, number[]>()
  for (let index = 0; index < descriptorCount; index += 1) {
    const key = reader.countedUtf16()
    const materialName = reader.countedUtf16()
    const transform = reader.float32Array(16, `descriptor ${index} transform`)
    descriptors.push({ key, materialName, groupIndex: -1, transform })
    const matching = descriptorsByKey.get(key) ?? []
    matching.push(index)
    descriptorsByKey.set(key, matching)
  }

  const groupCount = readBoundedCount(reader, 'geometry group')
  const groups: D5MeshGroup[] = []
  let triangleCount = 0
  let vertexCount = 0
  for (let index = 0; index < groupCount; index += 1) {
    const key = reader.countedUtf16()
    const positions = reader.countedFloat32Array(`group ${index} positions`)
    const normals = reader.countedFloat32Array(`group ${index} normals`)
    const uvs = reader.countedFloat32Array(`group ${index} UVs`)
    const extra = reader.countedFloat32Array(`group ${index} extra attribute`)
    const rawIndices = reader.countedUint32Array(`group ${index} indices`)

    validateAttributes(index, positions, normals, uvs, rawIndices)
    const localVertexCount = positions.length / 3
    const localTriangleCount = rawIndices.length / 3
    // An identity prefix is not an unindexed geometry when the shared vertex
    // buffer contains vertices outside this primitive.  Multi-material FBX
    // meshes commonly keep the full vertex buffer while each D5 group stores
    // only its own index range.
    const indices = rawIndices.length === localVertexCount && isIdentityIndex(rawIndices) ? null : rawIndices
    const descriptorIndices = descriptorsByKey.get(key) ?? []
    const descriptorIndex = descriptorIndices[0] ?? -1
    for (const matchingIndex of descriptorIndices) descriptors[matchingIndex]!.groupIndex = index
    if (descriptorIndex < 0) warnings.push(`Geometry group ${index} has no descriptor for key ${key}`)

    groups.push({
      key,
      descriptorIndex,
      positions,
      normals,
      uvs,
      extra,
      indices,
      triangleCount: localTriangleCount,
    })
    vertexCount += localVertexCount
    triangleCount += localTriangleCount
  }

  for (const [index, descriptor] of descriptors.entries()) {
    if (descriptor.groupIndex < 0) warnings.push(`Descriptor ${index} has no geometry group for key ${descriptor.key}`)
  }
  const rendered = renderedTotals(groups, descriptors)
  appendFinalWarnings(reader, metadata, rendered.triangleCount, warnings)

  return {
    version,
    metadata,
    descriptors,
    groups,
    triangleCount: rendered.triangleCount,
    vertexCount: rendered.vertexCount,
    sourceBytes,
    warnings,
  }
}

function parseInterleavedMesh(reader: BinaryReader, version: number, sourceBytes: number): D5MeshModel {
  const metadata = parseMetadata(reader.countedUtf8())
  const warnings: string[] = []
  const groupCount = readBoundedCount(reader, 'geometry group')
  const groups: D5MeshGroup[] = []
  let triangleCount = 0
  let vertexCount = 0

  for (let index = 0; index < groupCount; index += 1) {
    const key = reader.countedUtf8()
    const localVertexCount = reader.uint32()
    const interleaved = reader.float32Array(
      localVertexCount * LEGACY_VERTEX_STRIDE,
      `group ${index} interleaved vertices`,
    )
    const rawIndices = reader.countedUint32Array(`group ${index} indices`)
    validateInterleaved(index, localVertexCount, interleaved, rawIndices)
    const localTriangleCount = rawIndices.length / 3
    groups.push({
      key,
      descriptorIndex: -1,
      positions: new Float32Array(),
      normals: new Float32Array(),
      uvs: new Float32Array(),
      extra: new Float32Array(),
      interleaved,
      indices: rawIndices.length === localVertexCount && isIdentityIndex(rawIndices) ? null : rawIndices,
      triangleCount: localTriangleCount,
    })
    vertexCount += localVertexCount
    triangleCount += localTriangleCount
  }

  const descriptors = parseInterleavedDescriptors(reader, version, groups, warnings)
  const rendered = renderedTotals(groups, descriptors)
  appendFinalWarnings(reader, metadata, rendered.triangleCount, warnings)
  return {
    version,
    metadata,
    descriptors,
    groups,
    triangleCount: rendered.triangleCount,
    vertexCount: rendered.vertexCount,
    sourceBytes,
    warnings,
  }
}

function parseInterleavedDescriptors(
  reader: BinaryReader,
  version: number,
  groups: D5MeshGroup[],
  warnings: string[],
): D5MeshDescriptor[] {
  if (reader.remaining === 0) return []
  const descriptorCount = readBoundedCount(reader, 'instance descriptor')
  const descriptors: D5MeshDescriptor[] = []
  const firstGroupByKey = new Map(groups.map((group, index) => [group.key, index]))

  for (let index = 0; index < descriptorCount; index += 1) {
    const key = reader.countedUtf8()
    const trailingName = reader.countedUtf8()
    if (version === 9) {
      const groupIndex = index < groups.length ? index : -1
      descriptors.push({
        key,
        meshName: trailingName,
        materialName: groupIndex >= 0 ? groups[groupIndex]!.key : trailingName,
        groupIndex,
        transform: reader.float32Array(16, `descriptor ${index} transform`),
      })
    } else {
      const groupIndex = firstGroupByKey.get(key) ?? -1
      descriptors.push({
        key,
        materialName: trailingName,
        groupIndex,
        transform: legacyTrsToMatrix(reader.float32Array(9, `descriptor ${index} transform`)),
      })
    }
  }

  if (version === 9 && descriptorCount !== groups.length) {
    warnings.push(`Version 9 has ${descriptorCount} descriptors for ${groups.length} geometry groups`)
  }
  if (version === 10 && reader.remaining >= 4) {
    const terminal = reader.uint32()
    if (terminal !== 0) warnings.push(`Version 10 terminal field is ${terminal}, expected 0`)
  }
  for (const [index, descriptor] of descriptors.entries()) {
    if (descriptor.groupIndex < 0) warnings.push(`Descriptor ${index} has no geometry group for key ${descriptor.key}`)
    else if (groups[descriptor.groupIndex]!.descriptorIndex < 0) {
      groups[descriptor.groupIndex]!.descriptorIndex = index
    }
  }
  return descriptors
}

export function legacyTrsToMatrix(values: Float32Array): Float32Array {
  if (values.length !== 9) throw new D5ParseError(`Legacy transform has ${values.length} values, expected 9`, 0)
  const [tx, ty, tz, pitchDegrees, yawDegrees, rollDegrees, sx, sy, sz] = values as unknown as [
    number, number, number, number, number, number, number, number, number,
  ]
  const pitch = pitchDegrees * Math.PI / 180
  const yaw = yawDegrees * Math.PI / 180
  const roll = rollDegrees * Math.PI / 180
  const sp = Math.sin(pitch)
  const cp = Math.cos(pitch)
  const syaw = Math.sin(yaw)
  const cyaw = Math.cos(yaw)
  const sr = Math.sin(roll)
  const cr = Math.cos(roll)

  // Unreal uses row vectors; Three.js reads this row-major payload as a transposed column-vector matrix.
  return new Float32Array([
    cp * cyaw * sx,
    cp * syaw * sx,
    sp * sx,
    0,
    (sr * sp * cyaw - cr * syaw) * sy,
    (sr * sp * syaw + cr * cyaw) * sy,
    -sr * cp * sy,
    0,
    -(cr * sp * cyaw + sr * syaw) * sz,
    (cyaw * sr - cr * sp * syaw) * sz,
    cr * cp * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ])
}

function renderedTotals(
  groups: D5MeshGroup[],
  descriptors: D5MeshDescriptor[],
): { triangleCount: number; vertexCount: number } {
  const instancesByGroup = new Uint32Array(groups.length)
  for (const descriptor of descriptors) {
    if (descriptor.groupIndex >= 0 && descriptor.groupIndex < groups.length) {
      instancesByGroup[descriptor.groupIndex] = (instancesByGroup[descriptor.groupIndex] ?? 0) + 1
    }
  }
  let triangleCount = 0
  let vertexCount = 0
  for (const [index, group] of groups.entries()) {
    const instances = Math.max(1, instancesByGroup[index] ?? 0)
    triangleCount += group.triangleCount * instances
    vertexCount += vertexCountOf(group) * instances
  }
  return { triangleCount, vertexCount }
}

function vertexCountOf(group: D5MeshGroup): number {
  return group.interleaved ? group.interleaved.length / LEGACY_VERTEX_STRIDE : group.positions.length / 3
}

function parseMetadata(text: string): D5MeshMetadata {
  try {
    return JSON.parse(text) as D5MeshMetadata
  } catch {
    throw new D5ParseError('Invalid D5Mesh metadata JSON', 4)
  }
}

function appendFinalWarnings(
  reader: BinaryReader,
  metadata: D5MeshMetadata,
  triangleCount: number,
  warnings: string[],
): void {
  if (reader.remaining !== 0) warnings.push(`${reader.remaining.toLocaleString()} trailing bytes were not parsed`)
  if (Number.isFinite(metadata.triangleCount) && metadata.triangleCount !== triangleCount) {
    warnings.push(
      `Metadata reports ${metadata.triangleCount.toLocaleString()} triangles; geometry contains ${triangleCount.toLocaleString()}`,
    )
  }
}

function readBoundedCount(reader: BinaryReader, label: string): number {
  const offset = reader.offset
  const count = reader.uint32()
  if (count > MAX_GROUPS) {
    throw new D5ParseError(`${label} count ${count} exceeds ${MAX_GROUPS}`, offset)
  }
  return count
}

function validateAttributes(
  group: number,
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
): void {
  if (positions.length % 3 !== 0) {
    throw new D5ParseError(`Group ${group} position float count is not divisible by 3`, 0)
  }
  if (normals.length !== positions.length) {
    throw new D5ParseError(`Group ${group} normal count does not match positions`, 0)
  }
  const vertices = positions.length / 3
  if (uvs.length !== vertices * 2) {
    throw new D5ParseError(`Group ${group} UV count does not match positions`, 0)
  }
  if (indices.length % 3 !== 0) {
    throw new D5ParseError(`Group ${group} index count is not divisible by 3`, 0)
  }
  for (let index = 0; index < indices.length; index += 1) {
    if (indices[index]! >= vertices) {
      throw new D5ParseError(
        `Group ${group} index ${indices[index]} exceeds vertex count ${vertices}`,
        0,
      )
    }
  }
}

function validateInterleaved(
  group: number,
  vertices: number,
  interleaved: Float32Array,
  indices: Uint32Array,
): void {
  if (interleaved.length !== vertices * LEGACY_VERTEX_STRIDE) {
    throw new D5ParseError(`Group ${group} interleaved vertex count does not match payload`, 0)
  }
  if (indices.length % 3 !== 0) {
    throw new D5ParseError(`Group ${group} index count is not divisible by 3`, 0)
  }
  for (let index = 0; index < indices.length; index += 1) {
    if (indices[index]! >= vertices) {
      throw new D5ParseError(`Group ${group} index ${indices[index]} exceeds vertex count ${vertices}`, 0)
    }
  }
}

function isIdentityIndex(indices: Uint32Array): boolean {
  for (let index = 0; index < indices.length; index += 1) {
    if (indices[index] !== index) return false
  }
  return true
}
