import type { WebGLRenderer } from 'three'
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface GltfRuntimeOptions {
  renderer?: WebGLRenderer
  workerLimit?: number
}

export interface GltfRuntime {
  readonly loader: GLTFLoader
  readonly workerLimit: number
  readonly supportsKtx2: boolean
  parseGlb(data: ArrayBuffer, path?: string): Promise<GLTF>
  dispose(): void
}

export async function createGltfRuntime(
  options: GltfRuntimeOptions = {},
): Promise<GltfRuntime> {
  const [{ GLTFLoader }, { DRACOLoader, DRACO_GLTF_CONFIG }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ])
  const workerLimit = options.workerLimit ?? recommendedDecoderWorkers()
  const draco = new DRACOLoader()
    .setDecoderPath(DRACO_GLTF_CONFIG)
    .setWorkerLimit(workerLimit)
  const loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setMeshoptDecoder(MeshoptDecoder)
  let ktx2: import('three/examples/jsm/loaders/KTX2Loader.js').KTX2Loader | undefined

  if (options.renderer) {
    const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js')
    ktx2 = new KTX2Loader()
      .setWorkerLimit(workerLimit)
      .detectSupport(options.renderer)
    loader.setKTX2Loader(ktx2)
  }

  let disposed = false
  return {
    loader,
    workerLimit,
    supportsKtx2: Boolean(ktx2),
    parseGlb(data, path = '') {
      if (disposed) return Promise.reject(new Error('GLB 解码运行时已释放'))
      return loader.parseAsync(data, path)
    },
    dispose() {
      if (disposed) return
      disposed = true
      loader.setDRACOLoader(null)
      loader.setKTX2Loader(null)
      loader.setMeshoptDecoder(null)
      draco.dispose()
      ktx2?.dispose()
    },
  }
}

export function recommendedDecoderWorkers(
  hardwareConcurrency = typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency,
): number {
  if (!Number.isFinite(hardwareConcurrency)) return 2
  return Math.max(1, Math.min(4, Math.floor(hardwareConcurrency / 2)))
}
