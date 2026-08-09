import {
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  type ColorSpace,
} from 'three'
import type { D5aArchive } from '../core/d5a-archive'
import type { D5TextureTransform } from '../core/types'

export interface TextureLoadStats {
  count: number
  gpuBytes: number
}

export interface TextureDecodeOptions {
  flipY: boolean
  transform?: D5TextureTransform
  invert?: boolean
}

export class ProtectedD5TextureError extends Error {
  constructor(readonly path: string) {
    super(`${path} 是官方素材库保护载荷，当前版本原样保留且不解码`)
    this.name = 'ProtectedD5TextureError'
  }
}

export class ArchiveTextureCache {
  readonly stats: TextureLoadStats = { count: 0, gpuBytes: 0 }
  private readonly promises = new Map<string, Promise<Texture>>()
  private readonly textures = new Set<Texture>()

  constructor(
    private readonly archive: D5aArchive,
    private readonly maxTextureSize = 4096,
  ) {}

  load(
    path: string,
    colorSpace: ColorSpace,
    options: TextureDecodeOptions,
    signal?: AbortSignal,
  ): Promise<Texture> {
    const key = textureKey(path, colorSpace, options)
    const existing = this.promises.get(key)
    if (existing) return existing
    const promise = this.loadUncached(path, colorSpace, options, signal)
    this.promises.set(key, promise)
    promise.catch(() => this.promises.delete(key))
    return promise
  }

  loadColor(path: string, options: TextureDecodeOptions, signal?: AbortSignal): Promise<Texture> {
    return this.load(path, SRGBColorSpace, options, signal)
  }

  dispose(): void {
    for (const texture of this.textures) texture.dispose()
    this.textures.clear()
    this.promises.clear()
  }

  private async loadUncached(
    path: string,
    colorSpace: ColorSpace,
    options: TextureDecodeOptions,
    signal?: AbortSignal,
  ): Promise<Texture> {
    throwIfAborted(signal)
    const blob = await this.archive.blob(path, undefined, signal)
    throwIfAborted(signal)
    await assertDecodableD5TexturePayload(blob, path)
    const bitmapOptions: ImageBitmapOptions = { premultiplyAlpha: 'none' }
    if (options.flipY) bitmapOptions.imageOrientation = 'flipY'
    const bitmap = await createImageBitmap(blob, bitmapOptions)
    throwIfAborted(signal)
    let source: ImageBitmap | HTMLCanvasElement = bitmap
    let width = bitmap.width
    let height = bitmap.height
    const scale = Math.min(1, this.maxTextureSize / Math.max(width, height))
    if (scale < 1 || options.invert) {
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) throw new Error('浏览器未提供 2D 纹理缩放能力')
      context.drawImage(bitmap, 0, 0, width, height)
      if (options.invert) invertRgb(context, width, height)
      bitmap.close()
      source = canvas
    }

    const texture = new Texture(source)
    texture.colorSpace = colorSpace
    texture.flipY = false
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    applyTextureTransform(texture, options.transform)
    texture.needsUpdate = true
    if (source instanceof ImageBitmap) {
      texture.addEventListener('dispose', () => source.close())
    }
    this.stats.count += 1
    this.stats.gpuBytes += Math.ceil(width * height * 4 * (4 / 3))
    this.textures.add(texture)
    return texture
  }
}

export async function assertDecodableD5TexturePayload(blob: Blob, path: string): Promise<void> {
  const header = new TextDecoder().decode(await blob.slice(0, 32).arrayBuffer())
  if (header.startsWith('All those moments')) throw new ProtectedD5TextureError(path)
}

export function applyTextureTransform(texture: Texture, transform?: D5TextureTransform): void {
  if (!transform) return
  texture.repeat.set(transform.repeat[0], transform.repeat[1])
  texture.offset.set(transform.offset[0], transform.offset[1])
  texture.center.set(0.5, 0.5)
  texture.rotation = transform.rotation
  texture.updateMatrix()
}

function invertRgb(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height)
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = 255 - image.data[index]!
    image.data[index + 1] = 255 - image.data[index + 1]!
    image.data[index + 2] = 255 - image.data[index + 2]!
  }
  context.putImageData(image, 0, 0)
}

function textureKey(path: string, colorSpace: ColorSpace, options: TextureDecodeOptions): string {
  const transform = options.transform
  return [
    canonical(path),
    colorSpace,
    options.flipY ? 'flip' : 'native',
    options.invert ? 'invert' : 'plain',
    transform?.repeat.join(',') ?? '',
    transform?.offset.join(',') ?? '',
    transform?.rotation ?? '',
  ].join('|')
}

function canonical(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('加载已取消', 'AbortError')
}
