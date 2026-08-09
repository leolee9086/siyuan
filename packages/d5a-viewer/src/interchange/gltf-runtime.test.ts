import type { WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'
import { createGltfRuntime, recommendedDecoderWorkers } from './gltf-runtime'

describe('GLB decoder runtime', () => {
  it('bounds decoder workers for interactive use', () => {
    expect(recommendedDecoderWorkers(1)).toBe(1)
    expect(recommendedDecoderWorkers(8)).toBe(4)
    expect(recommendedDecoderWorkers(64)).toBe(4)
    expect(recommendedDecoderWorkers(Number.NaN)).toBe(2)
  })

  it('registers Draco and Meshopt for renderer-independent parsing', async () => {
    const runtime = await createGltfRuntime({ workerLimit: 2 })

    expect(runtime.workerLimit).toBe(2)
    expect(runtime.loader.dracoLoader).not.toBeNull()
    expect(runtime.loader.meshoptDecoder).not.toBeNull()
    expect(runtime.loader.ktx2Loader).toBeNull()
    expect(runtime.supportsKtx2).toBe(false)

    runtime.dispose()
    expect(runtime.loader.dracoLoader).toBeNull()
    await expect(runtime.parseGlb(new ArrayBuffer(0))).rejects.toThrow('GLB 解码运行时已释放')
  })

  it('registers KTX2 after probing the active renderer', async () => {
    const renderer = {
      extensions: {
        has: () => false,
        get: () => ({ getSupportedProfiles: () => [] }),
      },
    } as unknown as WebGLRenderer
    const runtime = await createGltfRuntime({ renderer, workerLimit: 1 })

    expect(runtime.loader.ktx2Loader).not.toBeNull()
    expect(runtime.supportsKtx2).toBe(true)

    runtime.dispose()
    expect(runtime.loader.ktx2Loader).toBeNull()
  })
})
