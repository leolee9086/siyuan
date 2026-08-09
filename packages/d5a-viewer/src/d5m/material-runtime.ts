import type { D5mMaterialParameter } from './types'
import {
  d5mColorByName,
  d5mScalarByName,
  findD5mParameter,
} from './parameters'

export type D5mPreviewChannel =
  | 'color'
  | 'normal'
  | 'roughness'
  | 'metalness'
  | 'specular'
  | 'ao'
  | 'alpha'
  | 'emissive'
  | 'height'
  | 'subsurface'
  | 'landscape-color'

export interface D5mUvTransform {
  repeat: [number, number]
  offset: [number, number]
  rotation: number
}

export interface D5mPreviewTexture {
  channel: D5mPreviewChannel
  parameterIndex: number
  slot: string
  value: string
  color: boolean
  gammaEncoded: boolean
  invert: boolean
  uv: D5mUvTransform
}

export interface D5mPreviewMaterial {
  familyKey: string
  color: [number, number, number]
  opacity: number
  roughness: number
  metalness: number
  specularIntensity: number
  normalScale: [number, number]
  aoIntensity: number
  emissive: [number, number, number]
  emissiveIntensity: number
  transmission: number
  ior: number
  thickness: number
  attenuationColor: [number, number, number]
  attenuationDistance: number
  clearcoat: number
  clearcoatRoughness: number
  sheen: number
  sheenColor: [number, number, number]
  sheenRoughness: number
  alphaTest: number
  transparent: boolean
  displacementScale: number
  landscapeBlend: number
  textures: D5mPreviewTexture[]
  mappedParameterIndices: Set<number>
  notices: string[]
}

const SLOT_DEFINITIONS: Array<{
  aliases: string[]
  channel: D5mPreviewChannel
  suffix: string
  color: boolean
  gammaParameter: string
}> = [
  { aliases: ['Diffuse Map'], channel: 'color', suffix: 'D', color: true, gammaParameter: 'DiffuseMap_GammaMode' },
  { aliases: ['DiffuseLandscape Map'], channel: 'landscape-color', suffix: 'D', color: true, gammaParameter: 'DiffuseMap_GammaMode' },
  { aliases: ['Normal Map One'], channel: 'normal', suffix: 'N', color: false, gammaParameter: 'NormalMap_GammaMode' },
  { aliases: ['Roughness Map'], channel: 'roughness', suffix: 'R', color: false, gammaParameter: 'RoughnessMap_GammaMode' },
  { aliases: ['MetallicMap'], channel: 'metalness', suffix: 'M', color: false, gammaParameter: 'MetallicMap_GammaMode' },
  { aliases: ['SpecularMap'], channel: 'specular', suffix: 'S', color: false, gammaParameter: 'SpecularMap_GammaMode' },
  { aliases: ['AOMap'], channel: 'ao', suffix: 'A', color: false, gammaParameter: 'AOMap_GammaMode' },
  { aliases: ['OpacityMap'], channel: 'alpha', suffix: 'T', color: false, gammaParameter: 'OpacityMap_GammaMode' },
  { aliases: ['EmissiveMask'], channel: 'emissive', suffix: 'EM', color: true, gammaParameter: 'EmissiveMap_GammaMode' },
  { aliases: ['Height Map'], channel: 'height', suffix: 'H', color: false, gammaParameter: 'HeightMap_GammaMode' },
  { aliases: ['sscolor2'], channel: 'subsurface', suffix: 'SS', color: true, gammaParameter: 'SubsurfaceMap_GammaMode' },
]

export function describeD5mPreview(
  parameters: D5mMaterialParameter[],
  familyKey: string,
): D5mPreviewMaterial {
  const mapped = new Set<number>()
  const colorValue = readColor(parameters, mapped, ['Diffuse (Color)']) ?? { r: 0.72, g: 0.72, b: 0.72, a: 1 }
  const strength = readScalar(parameters, mapped, ['DiffuseColorStrength']) ?? 1
  const color: [number, number, number] = [
    Math.max(0, colorValue.r * strength),
    Math.max(0, colorValue.g * strength),
    Math.max(0, colorValue.b * strength),
  ]
  const roughness = clamp(readScalar(parameters, mapped, ['Roughness Map (opacity)', 'Roughness']) ?? 0.55, 0.01, 1)
  const metalness = clamp(readScalar(parameters, mapped, ['Metallic']) ?? 0, 0, 1)
  const specularIntensity = clamp(readScalar(parameters, mapped, ['Specular']) ?? 0.5, 0, 1)
  const normalStrength = readScalar(parameters, mapped, ['Normal Map (opacity)']) ?? 1
  const aoIntensity = clamp(readScalar(parameters, mapped, ['AoIntensity', 'AOIntensity']) ?? 1, 0, 2)
  const emissiveEnabled = (readScalar(parameters, mapped, ['EmissiveSwitcher']) ?? 0) > 0.5
  const emissiveColorValue = readColor(parameters, mapped, ['Emissive Color'])
  const emissive: [number, number, number] = emissiveEnabled
    ? emissiveColorValue
      ? [emissiveColorValue.r, emissiveColorValue.g, emissiveColorValue.b]
      : color
    : [0, 0, 0]
  const emissiveIntensity = emissiveEnabled
    ? Math.max(0, readScalar(parameters, mapped, ['Light']) ?? 1)
    : 0
  const opacityIntensity = clamp(readScalar(parameters, mapped, ['Opacity Intensity', 'Opacity']) ?? 1, 0, 1)
  const isGlass = familyKey === 'glass'
  const isWater = familyKey === 'water'
  const isSheer = familyKey === 'sheer-fabric'
  const isFabric = familyKey === 'fabric' || isSheer
  const isGlazed = familyKey === 'glazed'
  const isProvisional = familyKey === 'base-7' || familyKey === 'base-13'
  const clearcoat = clamp(readScalar(parameters, mapped, ['Clear Coat']) ?? (isGlazed ? 1 : 0), 0, 1)
  const clearcoatRoughness = clamp(readScalar(parameters, mapped, ['Clear Coat Roughness']) ?? roughness, 0, 1)
  const ior = clamp(readScalar(parameters, mapped, ['Refraction']) ?? (isWater ? 1.33 : 1.5), 1, 3)
  const depth = clamp(readScalar(parameters, mapped, ['Depth']) ?? 0.2, 0, 10)
  const waterTint = normalizedTint(color)
  const previewColor = isWater
    ? mixColor([1, 1, 1], waterTint, 0.28)
    : color
  const displacementScale = clamp(readScalar(parameters, mapped, ['Height Ratio']) ?? 0, -2, 2)
  const landscapeBlend = clamp(readScalar(parameters, mapped, ['CustomTexBlend']) ?? 1, 0, 1)
  const textures = SLOT_DEFINITIONS.flatMap((definition) => {
    const match = findD5mParameter(parameters, ...definition.aliases)
    if (!match || match.parameter.type !== 3 || !match.parameter.value) return []
    mapped.add(match.index)
    const gammaMode = readScalar(parameters, mapped, [definition.gammaParameter])
    const inverted = definition.channel === 'roughness'
      ? (readScalar(parameters, mapped, ['IsInverted_R']) ?? 0) > 0.5
      : definition.channel === 'alpha'
        ? (readScalar(parameters, mapped, ['IsInverted_T']) ?? 0) > 0.5
        : definition.channel === 'color'
          ? (readScalar(parameters, mapped, ['IsInverted_D']) ?? 0) > 0.5
          : false
    return [{
      channel: definition.channel,
      parameterIndex: match.index,
      slot: match.parameter.name,
      value: match.parameter.value,
      color: definition.color,
      gammaEncoded: gammaMode == null ? definition.color : gammaMode > 0.5,
      invert: inverted,
      uv: readUvTransform(parameters, definition.suffix, mapped),
    } satisfies D5mPreviewTexture]
  })
  const alphaTexture = textures.some((texture) => texture.channel === 'alpha')
  const notices: string[] = []
  if (isProvisional) notices.push('该族样本较少，预览仅映射通用 PBR；原始制式仍完整写回')
  if (isGlass) notices.push('玻璃使用标准物理透射近似 D5 运行时效果')
  if (isWater) notices.push('水体波速与动态波形保留写回，静态预览映射颜色、折射率和深度')
  if (textures.some((texture) => texture.channel === 'landscape-color')) {
    notices.push(`地形基础色与用户漫反射图按 CustomTexBlend=${landscapeBlend.toFixed(3)} 混合预览`)
  }
  if (textures.some((texture) => texture.channel === 'subsurface')) {
    notices.push('sscolor2 已识别为次表面颜色贴图；标准预览使用薄织物透光与绒光近似，原始贴图完整保留')
  }
  if (hasColorAdjustment(parameters)) notices.push('色调、饱和度、亮度和对比度在预览纹理阶段近似应用')

  return {
    familyKey,
    color: previewColor,
    opacity: isSheer ? opacityIntensity : isWater ? 0.86 : 1,
    roughness,
    metalness,
    specularIntensity,
    normalScale: [Math.abs(normalStrength), -Math.abs(normalStrength)],
    aoIntensity,
    emissive,
    emissiveIntensity,
    transmission: isGlass ? 0.96 : isWater ? 0.82 : 0,
    ior,
    thickness: isGlass ? 0.35 : isWater ? Math.max(0.05, depth * 2) : 0,
    attenuationColor: isWater ? waterTint : [1, 1, 1],
    attenuationDistance: isWater ? Math.max(0.25, depth * 8) : Infinity,
    clearcoat: isWater ? 1 : clearcoat,
    clearcoatRoughness: isWater ? Math.min(roughness, 0.16) : clearcoatRoughness,
    sheen: isFabric ? 0.65 : 0,
    sheenColor: color,
    sheenRoughness: Math.max(0.25, roughness),
    alphaTest: alphaTexture && !isSheer ? 0.35 : 0,
    transparent: isGlass || isWater || isSheer,
    displacementScale,
    landscapeBlend,
    textures,
    mappedParameterIndices: mapped,
    notices,
  }
}

function normalizedTint(color: [number, number, number]): [number, number, number] {
  const peak = Math.max(1e-6, ...color)
  return color.map((value) => clamp(value / peak, 0.02, 1)) as [number, number, number]
}

function mixColor(
  left: [number, number, number],
  right: [number, number, number],
  amount: number,
): [number, number, number] {
  return left.map((value, index) => value + (right[index]! - value) * amount) as [number, number, number]
}

export function readD5mColorAdjustments(parameters: D5mMaterialParameter[]): {
  hue: number
  saturation: number
  brightness: number
  contrast: number
} {
  return {
    hue: d5mScalarByName(parameters, 'HueShift_Tex') ?? 0,
    saturation: d5mScalarByName(parameters, 'Saturation_Tex') ?? 0,
    brightness: d5mScalarByName(parameters, 'Brightness_Tex') ?? 0,
    contrast: d5mScalarByName(parameters, 'Contrast_Tex') ?? 0,
  }
}

function readUvTransform(
  parameters: D5mMaterialParameter[],
  suffix: string,
  mapped: Set<number>,
): D5mUvTransform {
  const local = suffix !== 'H' ? readScalar(parameters, mapped, [`Local_UV_${suffix}`]) : 0
  const useLocal = local != null && local > 0
  const aliases = (base: string) => useLocal ? [`${base}_${suffix}`, base] : [base]
  return {
    repeat: [
      finiteRepeat(readScalar(parameters, mapped, aliases('Utiling'))),
      finiteRepeat(readScalar(parameters, mapped, aliases('Vtiling'))),
    ],
    offset: [
      finiteOffset(readScalar(parameters, mapped, aliases('Xmove'))),
      finiteOffset(readScalar(parameters, mapped, aliases('Ymove'))),
    ],
    rotation: (readScalar(parameters, mapped, aliases('UVAngle')) ?? 0) * Math.PI / 180,
  }
}

function readScalar(
  parameters: D5mMaterialParameter[],
  mapped: Set<number>,
  aliases: string[],
): number | undefined {
  const match = findD5mParameter(parameters, ...aliases)
  if (!match) return undefined
  mapped.add(match.index)
  return d5mScalarByName(parameters, match.parameter.name)
}

function readColor(
  parameters: D5mMaterialParameter[],
  mapped: Set<number>,
  aliases: string[],
) {
  const match = findD5mParameter(parameters, ...aliases)
  if (!match) return undefined
  mapped.add(match.index)
  return d5mColorByName(parameters, match.parameter.name)
}

function hasColorAdjustment(parameters: D5mMaterialParameter[]): boolean {
  const adjustment = readD5mColorAdjustments(parameters)
  return Math.abs(adjustment.hue) > 1e-6 || Math.abs(adjustment.saturation) > 1e-6 ||
    Math.abs(adjustment.brightness) > 1e-6 || Math.abs(adjustment.contrast) > 1e-6
}

function finiteRepeat(value?: number): number {
  return value != null && Number.isFinite(value) && Math.abs(value) > 1e-6 ? value : 1
}

function finiteOffset(value?: number): number {
  return value != null && Number.isFinite(value) ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
