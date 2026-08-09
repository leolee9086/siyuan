import {
  CanvasTexture,
  CompressedTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader.js'
import UTIF from 'utif'
import type { D5mPreviewTexture } from './material-runtime'
import { readD5mColorAdjustments } from './material-runtime'
import { resolveD5mDraftResource } from './resources'
import type { D5mMaterialDraft } from './writer'

const MAX_PREVIEW_TEXTURE_EDGE = 2048

export interface LoadedD5mPreviewTexture {
  texture: Texture
  path: string
  width: number
  height: number
  normalMode?: 'tangent' | 'height'
  notice?: string
  dispose(): void
}

export class D5mPreviewTextureNotice extends Error {}

export async function loadD5mPreviewTexture(
  draft: D5mMaterialDraft,
  definition: D5mPreviewTexture,
  anisotropy: number,
  signal?: AbortSignal,
): Promise<LoadedD5mPreviewTexture> {
  const resource = await resolveD5mDraftResource(draft, definition.parameterIndex, signal)
  if (!resource) throw new Error(`${definition.slot} 引用的纹理 ${definition.value} 不存在`)
  if (await hasProtectedPayloadMarker(resource.blob)) {
    throw new D5mPreviewTextureNotice(`${definition.slot} 是受保护纹理载荷；资源原样保留，标准预览使用标量参数`)
  }
  const extension = resource.path.split('.').at(-1)?.toLowerCase()
  const adjustment = definition.channel === 'color'
    ? readD5mColorAdjustments(draft.parameters)
    : { hue: 0, saturation: 0, brightness: 0, contrast: 0 }
  const needsAdjustment = definition.invert || Object.values(adjustment).some((value) => Math.abs(value) > 1e-6)
  const needsRasterProcessing = needsAdjustment || definition.channel === 'specular'
  if (extension === 'dds') {
    const texture = await loadDdsTexture(resource.blob, signal)
    configureTexture(texture, definition, anisotropy)
    return {
      texture,
      path: resource.path,
      width: texture.image?.width ?? 0,
      height: texture.image?.height ?? 0,
      notice: needsRasterProcessing ? `${definition.slot} 为 DDS，预览保留贴图但未执行像素级反转、颜色调整或通道重排` : undefined,
      dispose: () => texture.dispose(),
    }
  }

  const decoded = extension === 'tif' || extension === 'tiff'
    ? await decodeTiff(resource.blob, signal)
    : await decodeBrowserImage(resource.blob, signal)
  throwIfAborted(signal)
  const normalMode = definition.channel === 'normal'
    ? detectNormalMode(decoded.source)
    : undefined
  const prepared = prepareRaster(decoded.source, decoded.width, decoded.height, definition, adjustment)
  // An unmodified ImageBitmap is handed directly to Three.js. Keep it alive
  // until the texture is disposed; closing it here leaves a valid texture
  // object backed by invalid pixels.
  if ('close' in decoded && prepared !== decoded.source) decoded.close()
  const texture = prepared instanceof HTMLCanvasElement
    ? new CanvasTexture(prepared)
    : new Texture(prepared)
  texture.needsUpdate = true
  texture.userData.d5ImageBitmap = prepared instanceof ImageBitmap ? prepared : undefined
  configureTexture(texture, definition, anisotropy)
  return {
    texture,
    path: resource.path,
    width: prepared.width,
    height: prepared.height,
    normalMode,
    notice: normalMode === 'height'
      ? `${definition.slot} 是单通道灰度图，标准预览按凹凸高度解释`
      : undefined,
    dispose() {
      texture.dispose()
      if (prepared instanceof ImageBitmap) prepared.close()
    },
  }
}

function detectNormalMode(source: CanvasImageSource): 'tangent' | 'height' {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return 'tangent'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return isGrayscaleRgba(context.getImageData(0, 0, canvas.width, canvas.height).data)
    ? 'height'
    : 'tangent'
}

export function isGrayscaleRgba(
  pixels: Uint8ClampedArray,
  tolerance = 3,
  maximumColorRatio = 0.02,
): boolean {
  let visible = 0
  let colored = 0
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    if (pixels[offset + 3]! <= 16) continue
    visible += 1
    const red = pixels[offset]!
    const green = pixels[offset + 1]!
    const blue = pixels[offset + 2]!
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > tolerance) colored += 1
  }
  return visible > 0 && colored / visible <= maximumColorRatio
}

async function hasProtectedPayloadMarker(blob: Blob): Promise<boolean> {
  const prefix = new Uint8Array(await blob.slice(0, 64).arrayBuffer())
  return new TextDecoder('ascii').decode(prefix).startsWith('All those moments')
}

function configureTexture(texture: Texture, definition: D5mPreviewTexture, anisotropy: number): void {
  texture.name = definition.slot
  texture.colorSpace = definition.gammaEncoded ? SRGBColorSpace : NoColorSpace
  texture.flipY = false
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(definition.uv.repeat[0], definition.uv.repeat[1])
  texture.offset.set(definition.uv.offset[0], definition.uv.offset[1])
  texture.center.set(0.5, 0.5)
  texture.rotation = definition.uv.rotation
  texture.anisotropy = Math.max(1, Math.min(8, anisotropy))
  texture.magFilter = LinearFilter
  if (!(texture instanceof CompressedTexture) || texture.mipmaps.length > 1) {
    texture.minFilter = LinearMipmapLinearFilter
  }
  texture.userData.d5Path = definition.value
  texture.needsUpdate = true
}

async function loadDdsTexture(blob: Blob, signal?: AbortSignal): Promise<CompressedTexture> {
  throwIfAborted(signal)
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<CompressedTexture>((resolve, reject) => {
      const onAbort = () => reject(new DOMException('DDS 加载已取消', 'AbortError'))
      signal?.addEventListener('abort', onAbort, { once: true })
      new DDSLoader().load(
        url,
        (texture) => {
          signal?.removeEventListener('abort', onAbort)
          if (signal?.aborted) {
            texture.dispose()
            reject(new DOMException('DDS 加载已取消', 'AbortError'))
          } else {
            resolve(texture)
          }
        },
        undefined,
        (error) => {
          signal?.removeEventListener('abort', onAbort)
          reject(error instanceof Error ? error : new Error('DDS 纹理解码失败'))
        },
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeBrowserImage(blob: Blob, signal?: AbortSignal): Promise<{
  source: ImageBitmap
  width: number
  height: number
  close(): void
}> {
  throwIfAborted(signal)
  const bitmap = await createImageBitmap(blob)
  if (signal?.aborted) {
    bitmap.close()
    throw new DOMException('图像加载已取消', 'AbortError')
  }
  return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
}

async function decodeTiff(blob: Blob, signal?: AbortSignal): Promise<{
  source: HTMLCanvasElement
  width: number
  height: number
}> {
  throwIfAborted(signal)
  const buffer = await blob.arrayBuffer()
  throwIfAborted(signal)
  const ifd = UTIF.decode(buffer)[0]
  if (!ifd) throw new Error('TIF 中没有可解码图像')
  UTIF.decodeImage(buffer, ifd)
  const rgba = UTIF.toRGBA8(ifd)
  const canvas = document.createElement('canvas')
  canvas.width = ifd.width
  canvas.height = ifd.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器未提供 2D 图像上下文')
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height), 0, 0)
  return { source: canvas, width: ifd.width, height: ifd.height }
}

function prepareRaster(
  source: CanvasImageSource,
  width: number,
  height: number,
  definition: D5mPreviewTexture,
  adjustment: { hue: number; saturation: number; brightness: number; contrast: number },
): HTMLCanvasElement | ImageBitmap {
  const adjusted = definition.invert || definition.channel === 'specular' ||
    Object.values(adjustment).some((value) => Math.abs(value) > 1e-6)
  const scale = Math.min(1, MAX_PREVIEW_TEXTURE_EDGE / Math.max(width, height))
  if (!adjusted && scale === 1 && source instanceof ImageBitmap) return source
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: definition.invert || definition.channel === 'specular' })
  if (!context) throw new Error('浏览器未提供 2D 图像上下文')
  context.filter = `hue-rotate(${adjustment.hue}deg) saturate(${Math.max(0, 1 + adjustment.saturation)}) brightness(${Math.max(0, 1 + adjustment.brightness)}) contrast(${Math.max(0, 1 + adjustment.contrast)})`
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  context.filter = 'none'
  if (definition.invert || definition.channel === 'specular') {
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    if (definition.invert) {
      const channels = definition.channel === 'color' ? [0, 1, 2] : [1]
      for (let offset = 0; offset < image.data.length; offset += 4) {
        for (const channel of channels) image.data[offset + channel] = 255 - image.data[offset + channel]!
      }
    }
    if (definition.channel === 'specular') packSpecularAlpha(image.data)
    context.putImageData(image, 0, 0)
  }
  return canvas
}

export function packSpecularAlpha(pixels: Uint8ClampedArray): void {
  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    pixels[offset + 3] = Math.round(
      pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 + pixels[offset + 2]! * 0.0722,
    )
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('纹理加载已取消', 'AbortError')
}
