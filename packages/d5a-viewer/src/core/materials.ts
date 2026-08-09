import type { D5Info, D5Material, D5MaterialParameter, D5TextureTransform } from './types'

interface RawMaterialData extends Record<string, unknown> {
  id?: string
  title?: string
  uePath?: string
  matInfo?: string
  roughness?: number
  metallic?: number
}

interface RawElement {
  materialIndex?: number
  materialData?: RawMaterialData
}

interface RawStyle {
  bActive?: boolean
  elements?: RawElement[]
}

interface RawDetail {
  styleDatas?: RawStyle[]
}

export function parseD5Info(text: string, fallbackTitle = '', resourcePrefix = ''): D5Info {
  const raw = JSON.parse(text) as Record<string, unknown>
  const title = fallbackTitle
  const materialKeys = Array.isArray(raw.material_MapKey)
    ? raw.material_MapKey.filter((value): value is string => typeof value === 'string')
    : []
  const materials = new Map<number, D5Material>()

  const detail = parseNestedJson<RawDetail>(raw.detailInfo)
  for (const style of detail?.styleDatas ?? []) {
    if (style.bActive === false) continue
    for (const element of style.elements ?? []) {
      const index = element.materialIndex
      if (!Number.isInteger(index) || index == null || index < 0 || materials.has(index)) continue
      materials.set(index, materialFromData(index, materialKeys[index] ?? '', element.materialData, resourcePrefix))
    }
  }

  for (let index = 0; index < materialKeys.length; index += 1) {
    if (!materials.has(index)) {
      materials.set(index, materialFromData(index, materialKeys[index]!, undefined, resourcePrefix))
    }
  }

  const length = finiteNumber(raw.length)
  const depth = finiteNumber(raw.depth)
  const height = finiteNumber(raw.height)

  return {
    title,
    productId: typeof raw.productId === 'string' ? raw.productId : undefined,
    dimensions:
      length != null && depth != null && height != null ? { length, depth, height } : undefined,
    infoVersion: finiteNumber(raw.infoVersion),
    materialKeys,
    materials: [...materials.values()].sort((left, right) => left.index - right.index),
    raw,
  }
}

function materialFromData(
  index: number,
  key: string,
  data: RawMaterialData | undefined,
  resourcePrefix: string,
): D5Material {
  const parameters = parseNestedJson<D5MaterialParameter[]>(data?.matInfo) ?? []
  const byName = new Map(parameters.map((parameter) => [parameter.name.toLowerCase(), parameter]))
  const roughnessMap = textureValue(byName, resourcePrefix, 'roughness map', 'roughness map one')
  return {
    index,
    key,
    id: typeof data?.id === 'string' && data.id ? data.id : undefined,
    title: data?.title || key || `Material ${index + 1}`,
    uePath: typeof data?.uePath === 'string' && data.uePath ? data.uePath : undefined,
    sourceData: data ? structuredClone(data) : undefined,
    color: parseColor(byName.get('diffuse (color)')?.value),
    diffuseMap: textureValue(byName, resourcePrefix, 'diffuse map', 'diffuse map one', 'base color map'),
    normalMap: textureValue(byName, resourcePrefix, 'normal map', 'normal map one', 'normal map 1', 'bump map'),
    roughnessMap,
    metallicMap: textureValue(byName, resourcePrefix, 'metallic map', 'metallic map one'),
    opacityMap: textureValue(byName, resourcePrefix, 'opacity map', 'opacity map one'),
    emissiveMap: textureValue(byName, resourcePrefix, 'emissive map', 'emissive map one'),
    roughness: roughnessMap ? undefined : scalarValue(byName.get('roughness')?.value) ?? data?.roughness,
    roughnessMapStrength: scalarValue(byName.get('roughness map (opacity)')?.value),
    roughnessMapInverted: scalarValue(byName.get('isinverted_r')?.value) === 1,
    metallic: scalarValue(byName.get('metallic')?.value) ?? data?.metallic,
    opacity: scalarValue(byName.get('opacity')?.value),
    normalScale: vector2Value(byName.get('normal map (opacity)')?.value),
    textureTransform: parseTextureTransform(byName),
    parameters,
  }
}

function parseTextureTransform(parameters: Map<string, D5MaterialParameter>): D5TextureTransform {
  const repeatU = scalarByAliases(parameters, ['utiling', 'u tiling']) ?? 1
  const repeatV = scalarByAliases(parameters, ['vtiling', 'v tiling']) ?? 1
  const offsetU = scalarByAliases(parameters, ['umove', 'u move', 'xmove', 'x move']) ?? 0
  const offsetV = scalarByAliases(parameters, ['vmove', 'v move', 'ymove', 'y move']) ?? 0
  const angleDegrees = scalarByAliases(parameters, ['uvangle', 'uv angle']) ?? 0
  return {
    repeat: [repeatU, repeatV],
    offset: [offsetU, offsetV],
    rotation: angleDegrees * Math.PI / 180,
  }
}

function scalarByAliases(
  parameters: Map<string, D5MaterialParameter>,
  aliases: string[],
): number | undefined {
  for (const alias of aliases) {
    const value = scalarValue(parameters.get(alias)?.value)
    if (value != null) return value
  }
  return undefined
}

function textureValue(
  parameters: Map<string, D5MaterialParameter>,
  resourcePrefix: string,
  ...aliases: string[]
): string | undefined {
  for (const alias of aliases) {
    for (const name of [alias, `${alias} (opacity)`]) {
      const parameter = parameters.get(name)
      if (parameter?.type === 3 && parameter.value) return normalizeTexturePath(parameter.value, resourcePrefix)
    }
  }
  return undefined
}

export function normalizeTexturePath(value: string, resourcePrefix = ''): string {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '')
  const resourcePath = normalized.toLowerCase().startsWith('textures/') ? normalized : `textures/${normalized}`
  const prefix = resourcePrefix.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+|\/+$/g, '')
  if (!prefix || resourcePath.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)) return resourcePath
  return `${prefix}/${resourcePath}`
}

function parseNestedJson<T>(value: unknown): T | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

function parseColor(value?: string): [number, number, number, number] {
  if (!value) return [0.72, 0.72, 0.72, 1]
  const match = value.match(/R=([\d.+-]+),G=([\d.+-]+),B=([\d.+-]+),A=([\d.+-]+)/i)
  if (!match) return [0.72, 0.72, 0.72, 1]
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
}

function scalarValue(value?: string): number | undefined {
  if (!value) return undefined
  const match = value.match(/X=([\d.+-]+)/i)
  return match ? finiteNumber(Number(match[1])) : undefined
}

function vector2Value(value?: string): [number, number] | undefined {
  if (!value) return undefined
  const x = value.match(/X=([\d.+-]+)/i)
  const y = value.match(/Y=([\d.+-]+)/i)
  const parsedX = x ? finiteNumber(Number(x[1])) : undefined
  const parsedY = y ? finiteNumber(Number(y[1])) : undefined
  return parsedX != null && parsedY != null ? [parsedX, parsedY] : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
