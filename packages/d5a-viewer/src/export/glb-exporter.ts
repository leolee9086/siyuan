import { Mesh, type Material, type Object3D, type Texture } from 'three'
import type { GltfValidationReport } from 'gltf-validator'
import {
  createFidelityReport,
  inspectScene,
  type FidelityReport,
  type GltfValidatorSummary,
} from '../interchange/fidelity'
import { createGltfRuntime, type GltfRuntime } from '../interchange/gltf-runtime'
import { disposeSceneResources } from '../render/scene-resources'

export interface GlbExportResult {
  glb: Blob
  report: FidelityReport
}

export class GlbFidelityError extends Error {
  constructor(readonly report: FidelityReport) {
    const failures = report.checks
      .filter((check) => check.status === 'fail')
      .map((check) => `${check.label} (${check.expected} -> ${check.actual})`)
    super(`GLB 回读保真检查失败: ${failures.join('、')}`)
    this.name = 'GlbFidelityError'
  }
}

export async function exportGlb(
  root: Object3D,
  sourceName: string,
  maxTextureSize = 2048,
  gltfRuntime?: GltfRuntime,
): Promise<GlbExportResult> {
  const source = inspectScene(root)
  const started = performance.now()
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const prepared = prepareExportScene(root)
  let output: ArrayBuffer | Record<string, unknown>
  try {
    output = await new GLTFExporter().parseAsync(prepared.root, {
      binary: true,
      embedImages: true,
      forceIndices: false,
      includeCustomExtensions: true,
      maxTextureSize,
      onlyVisible: true,
      truncateDrawRange: true,
      trs: false,
    })
  } finally {
    prepared.dispose()
  }
  if (!(output instanceof ArrayBuffer)) throw new Error('GLTFExporter 未返回二进制 GLB')

  const [ownedRuntime, validator] = await Promise.all([
    gltfRuntime ? Promise.resolve(undefined) : createGltfRuntime(),
    import('gltf-validator'),
  ])
  const runtime = gltfRuntime ?? ownedRuntime!
  let roundTripScene: Object3D | undefined
  let report: FidelityReport
  try {
    const [roundTripGltf, validatorReport] = await Promise.all([
      runtime.parseGlb(output).then((gltf) => {
        roundTripScene = gltf.scene
        return gltf
      }),
      validator.validateBytes(new Uint8Array(output), {
        uri: sourceName.replace(/\.(?:d5a|glb)$/i, '.glb'),
        format: 'glb',
        maxIssues: 100,
        writeTimestamp: false,
      }),
    ])
    const roundTrip = inspectScene(roundTripGltf.scene)
    report = createFidelityReport({
      sourceName,
      source,
      roundTrip,
      exportBytes: output.byteLength,
      exportMs: performance.now() - started,
      validator: summarizeValidatorReport(validatorReport),
      notes: [
        'GLB 已由 Three.js GLTFLoader 从内存回读，并由 Khronos glTF Validator 独立校验。',
        'D5 专有着色参数保存在 glTF extras 中；目标查看器不识别时按 metallic-roughness PBR 近似。',
        '纹理中心旋转已换算为 KHR_texture_transform 可表达的等价偏移。',
      ],
    })
  } finally {
    if (roundTripScene) disposeSceneResources(roundTripScene)
    ownedRuntime?.dispose()
  }
  if (report.status === 'fail') throw new GlbFidelityError(report)
  return {
    glb: new Blob([output], { type: 'model/gltf-binary' }),
    report,
  }
}

interface PreparedExportScene {
  root: Object3D
  dispose(): void
}

function prepareExportScene(source: Object3D): PreparedExportScene {
  const root = source.clone(true)
  const materialClones = new Map<Material, Material>()
  const textureClones = new Map<Texture, Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    const materials = sourceMaterials.map((material) => {
      const existing = materialClones.get(material)
      if (existing) return existing
      const clone = material.clone()
      for (const [key, value] of Object.entries(material)) {
        if (!isTexture(value)) continue
        let texture = textureClones.get(value)
        if (!texture) {
          texture = cloneTextureForGlb(value)
          textureClones.set(value, texture)
        }
        ;(clone as unknown as Record<string, unknown>)[key] = texture
      }
      materialClones.set(material, clone)
      return clone
    })
    object.material = Array.isArray(object.material) ? materials : materials[0]!
  })
  return {
    root,
    dispose() {
      for (const texture of textureClones.values()) texture.dispose()
      for (const material of materialClones.values()) material.dispose()
      root.removeFromParent()
    },
  }
}

export function cloneTextureForGlb(source: Texture): Texture {
  const texture = source.clone()
  const { x: centerX, y: centerY } = source.center
  if (centerX !== 0 || centerY !== 0) {
    const cosine = Math.cos(source.rotation)
    const sine = Math.sin(source.rotation)
    texture.offset.set(
      -source.repeat.x * (cosine * centerX + sine * centerY) + centerX + source.offset.x,
      -source.repeat.y * (-sine * centerX + cosine * centerY) + centerY + source.offset.y,
    )
    texture.center.set(0, 0)
  }
  if (texture.matrixAutoUpdate) texture.updateMatrix()
  return texture
}

function summarizeValidatorReport(report: GltfValidationReport): GltfValidatorSummary {
  return {
    version: report.validatorVersion,
    errors: report.issues.numErrors,
    warnings: report.issues.numWarnings,
    infos: report.issues.numInfos,
    hints: report.issues.numHints,
    truncated: report.issues.truncated,
    messages: report.issues.messages.map((message) => ({
      code: message.code,
      message: message.message,
      severity: message.severity,
      pointer: message.pointer,
    })),
  }
}

function isTexture(value: unknown): value is Texture {
  return typeof value === 'object' && value !== null && 'isTexture' in value && value.isTexture === true
}
