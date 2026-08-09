import type {
  D5aGroupInfo,
  D5aGroupModel,
  D5aQuaternion,
  D5aTransform,
  D5aVector3,
} from './types'

export function parseD5GroupInfo(text: string): D5aGroupInfo | undefined {
  let raw: Record<string, unknown>
  try {
    const parsed = JSON.parse(text)
    if (!isRecord(parsed)) return undefined
    raw = parsed
  } catch {
    return undefined
  }

  const models = arrayOfRecords(raw.models)
    .map(parseModel)
    .filter((model): model is D5aGroupModel => Boolean(model))
  const groups = arrayOfRecords(raw.groups)
    .flatMap((group) => {
      const id = stringValue(group.id)
      return id ? [{ id, title: stringValue(group.title), parent: stringValue(group.parent) }] : []
    })

  return {
    models,
    groups,
    originTrans: parseTransform(raw.originTrans),
    raw,
  }
}

function parseModel(value: Record<string, unknown>): D5aGroupModel | undefined {
  const id = stringValue(value.id)
  if (!id) return undefined
  return {
    id,
    title: stringValue(value.title),
    parent: stringValue(value.parent),
    transform: parseTransform(value.transform),
    autoAlignToWorld: typeof value.autoAlignToWorld === 'boolean' ? value.autoAlignToWorld : undefined,
  }
}

function parseTransform(value: unknown): D5aTransform | undefined {
  if (!isRecord(value)) return undefined
  const rotation = parseQuaternion(value.rotation)
  const translation = parseVector3(value.translation)
  const scale3D = parseVector3(value.scale3D)
  return rotation && translation && scale3D ? { rotation, translation, scale3D } : undefined
}

function parseVector3(value: unknown): D5aVector3 | undefined {
  if (!isRecord(value)) return undefined
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const z = finiteNumber(value.z)
  return x != null && y != null && z != null ? { x, y, z } : undefined
}

function parseQuaternion(value: unknown): D5aQuaternion | undefined {
  if (!isRecord(value)) return undefined
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const z = finiteNumber(value.z)
  const w = finiteNumber(value.w)
  return x != null && y != null && z != null && w != null ? { x, y, z, w } : undefined
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
