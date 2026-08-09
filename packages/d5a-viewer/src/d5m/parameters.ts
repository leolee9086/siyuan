import type { D5mMaterialParameter } from './types'

const NUMBER_SOURCE = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'

export interface D5mScalarValue {
  current: number
  min?: number
  max?: number
}

export interface D5mColorValue {
  r: number
  g: number
  b: number
  a: number
}

export function parseD5mScalar(value: string): D5mScalarValue | undefined {
  const current = component(value, 'X')
  if (current == null) return undefined
  return {
    current,
    min: component(value, 'Y'),
    max: component(value, 'Z'),
  }
}

export function updateD5mScalar(source: string, current: number): string {
  if (!Number.isFinite(current)) return source
  const matcher = new RegExp(`(X\\s*=\\s*)(${NUMBER_SOURCE})`, 'i')
  const match = source.match(matcher)
  if (!match) return `X=${formatNumber(current, 6)} Y=0.000000 Z=0.000000`
  return source.replace(matcher, `${match[1]}${formatLike(current, match[2] ?? '')}`)
}

export function parseD5mColor(value: string): D5mColorValue | undefined {
  const r = component(value, 'R')
  const g = component(value, 'G')
  const b = component(value, 'B')
  const a = component(value, 'A')
  if (r == null || g == null || b == null || a == null) return undefined
  return { r, g, b, a }
}

export function updateD5mColor(source: string, color: D5mColorValue): string {
  if (![color.r, color.g, color.b, color.a].every(Number.isFinite)) return source
  let next = source
  for (const [name, value] of Object.entries(color)) {
    const matcher = new RegExp(`(${name}\\s*=\\s*)(${NUMBER_SOURCE})`, 'i')
    const match = next.match(matcher)
    if (!match) return `(R=${formatNumber(color.r, 6)},G=${formatNumber(color.g, 6)},B=${formatNumber(color.b, 6)},A=${formatNumber(color.a, 6)})`
    next = next.replace(matcher, `${match[1]}${formatLike(value, match[2] ?? '')}`)
  }
  return next
}

export function findD5mParameter(
  parameters: D5mMaterialParameter[],
  ...aliases: string[]
): { parameter: D5mMaterialParameter; index: number } | undefined {
  for (const alias of aliases) {
    const exact = parameters.findIndex((parameter) => parameter.name === alias)
    if (exact >= 0) return { parameter: parameters[exact]!, index: exact }
  }
  for (const alias of aliases) {
    const lower = alias.toLowerCase()
    const index = parameters.findIndex((parameter) => parameter.name.toLowerCase() === lower)
    if (index >= 0) return { parameter: parameters[index]!, index }
  }
  return undefined
}

export function d5mScalarByName(
  parameters: D5mMaterialParameter[],
  ...aliases: string[]
): number | undefined {
  const match = findD5mParameter(parameters, ...aliases)
  return match ? parseD5mScalar(match.parameter.value)?.current : undefined
}

export function d5mColorByName(
  parameters: D5mMaterialParameter[],
  ...aliases: string[]
): D5mColorValue | undefined {
  const match = findD5mParameter(parameters, ...aliases)
  return match ? parseD5mColor(match.parameter.value) : undefined
}

function component(value: string, name: string): number | undefined {
  const match = value.match(new RegExp(`${name}\\s*=\\s*(${NUMBER_SOURCE})`, 'i'))
  if (!match) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatLike(value: number, source: string): string {
  const exponent = source.match(/[eE]([+-]?\d+)$/)
  if (exponent) {
    const decimals = source.split(/[eE]/)[0]?.split('.')[1]?.length ?? 6
    return value.toExponential(decimals)
  }
  const decimals = source.split('.')[1]?.length
  return decimals == null ? String(Math.round(value)) : formatNumber(value, decimals)
}

function formatNumber(value: number, decimals: number): string {
  const normalized = Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value
  return normalized.toFixed(decimals)
}
