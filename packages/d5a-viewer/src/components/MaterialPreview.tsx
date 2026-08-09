import { useEffect, useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type BufferGeometry,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { describeD5mPreview } from '../d5m/material-runtime'
import {
  D5mPreviewTextureNotice,
  loadD5mPreviewTexture,
  type LoadedD5mPreviewTexture,
} from '../d5m/preview-textures'
import {
  assignD5mTexture,
  clearD5mMaterialTextures,
  createD5mPhysicalMaterial,
  disposeD5mPhysicalMaterial,
} from '../d5m/three-material'
import type { D5mMaterialDraft } from '../d5m/writer'

export type MaterialPreviewShape = 'sphere' | 'cube' | 'plane'

export interface MaterialPreviewDiagnostics {
  mappedParameters: number
  totalParameters: number
  loadedTextures: number
  notices: string[]
  errors: string[]
}

interface PreviewRuntime {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  controls: OrbitControls
  mesh: Mesh
  backdrop: Mesh
  geometries: Record<MaterialPreviewShape, BufferGeometry>
  material: MeshPhysicalMaterial
  render(): void
  setActive(active: boolean): void
}

export function MaterialPreview({
  draft,
  familyKey,
  shape,
  autoRotate,
  active,
  onDiagnostics,
}: {
  draft: D5mMaterialDraft
  familyKey: string
  shape: MaterialPreviewShape
  autoRotate: boolean
  active: boolean
  onDiagnostics?: (diagnostics: MaterialPreviewDiagnostics) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<PreviewRuntime | undefined>(undefined)
  const loadedRef = useRef(new Map<string, LoadedD5mPreviewTexture>())
  const descriptor = useMemo(
    () => describeD5mPreview(draft.parameters, familyKey),
    [draft.parameters, familyKey],
  )
  const textureKey = useMemo(() => JSON.stringify({
    source: draft.source ? [draft.source.file.name, draft.source.file.size, draft.source.file.lastModified] : null,
    resources: [...draft.resources].map(([path, blob]) => [path, blob.size, blob instanceof File ? blob.lastModified : 0]),
    textures: descriptor.textures,
    adjustment: draft.parameters
      .filter((parameter) => /^(?:HueShift|Saturation|Brightness|Contrast)_Tex$/i.test(parameter.name))
      .map((parameter) => [parameter.name, parameter.value]),
  }), [draft.resources, draft.source, draft.parameters, descriptor.textures])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.setClearColor(0x161b22, 1)
    host.append(renderer.domElement)
    renderer.domElement.className = 'material-preview-canvas'

    const scene = new Scene()
    const camera = new PerspectiveCamera(35, 1, 0.05, 100)
    camera.position.set(3.15, 2.25, 3.85)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 2.4
    controls.maxDistance = 8
    controls.target.set(0, 0, 0)

    const pmrem = new PMREMGenerator(renderer)
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    scene.environmentIntensity = 0.78
    pmrem.dispose()
    scene.add(new HemisphereLight(0xe7eef1, 0x1d2730, 0.72))
    const keyLight = new DirectionalLight(0xffffff, 1.35)
    keyLight.position.set(4, 5, 3)
    scene.add(keyLight)

    const geometries = createGeometries()
    const material = new MeshPhysicalMaterial({ color: 0xb8bfbb, roughness: 0.5, side: DoubleSide })
    const mesh = new Mesh(geometries.sphere, material)
    scene.add(mesh)
    const backdrop = new Mesh(
      new PlaneGeometry(4.8, 4.8),
      new MeshBasicMaterial({ map: checkerTexture('#27313a', '#1c242c', 4), toneMapped: false }),
    )
    backdrop.position.set(0, 0.15, -1.55)
    backdrop.visible = false
    scene.add(backdrop)
    const floor = new Mesh(
      new PlaneGeometry(10, 10),
      new MeshBasicMaterial({ map: checkerTexture(), toneMapped: false }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.28
    scene.add(floor)
    const grid = new GridHelper(10, 20, 0x5c6b75, 0x35424c)
    grid.position.y = -1.275
    scene.add(grid)

    let frame = 0
    let mounted = true
    let previewActive = active
    const renderFrame = () => {
      renderer.render(scene, camera)
    }
    const scheduleFrame = () => {
      if (mounted && previewActive && !frame) frame = requestAnimationFrame(tick)
    }
    const tick = () => {
      frame = 0
      if (!mounted || !previewActive) return
      controls.autoRotateSpeed = 1.25
      controls.update()
      renderFrame()
      scheduleFrame()
    }
    const render = () => {
      if (!mounted || !previewActive) return
      renderFrame()
      scheduleFrame()
    }
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.fov = materialPreviewFovForAspect(camera.aspect)
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    const setActive = (next: boolean) => {
      previewActive = next
      if (!next) {
        cancelAnimationFrame(frame)
        frame = 0
        return
      }
      resize()
      render()
    }
    runtimeRef.current = { renderer, scene, camera, controls, mesh, backdrop, geometries, material, render, setActive }
    render()

    return () => {
      mounted = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      if (runtimeRef.current) disposeD5mPhysicalMaterial(runtimeRef.current.material)
      Object.values(geometries).forEach((geometry) => geometry.dispose())
      backdrop.geometry.dispose()
      const backdropMaterial = backdrop.material as MeshBasicMaterial
      backdropMaterial.map?.dispose()
      backdropMaterial.dispose()
      floor.geometry.dispose()
      const floorMaterial = floor.material as MeshBasicMaterial
      floorMaterial.map?.dispose()
      floorMaterial.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      runtimeRef.current = undefined
    }
  }, [])

  useEffect(() => runtimeRef.current?.setActive(active), [active])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    runtime.mesh.geometry = runtime.geometries[shape]
    runtime.controls.autoRotate = autoRotate
    runtime.render()
  }, [shape, autoRotate])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const previous = runtime.material
    const material = createD5mPhysicalMaterial(descriptor)
    for (const [channel, loaded] of loadedRef.current) assignD5mTexture(material, channel, loaded)
    runtime.material = material
    runtime.mesh.material = material
    runtime.backdrop.visible = descriptor.transparent
    disposeD5mPhysicalMaterial(previous)
    runtime.render()
    onDiagnostics?.({
      mappedParameters: descriptor.mappedParameterIndices.size,
      totalParameters: draft.parameters.length,
      loadedTextures: loadedRef.current.size,
      notices: descriptor.notices,
      errors: [],
    })
  }, [descriptor, draft.parameters.length, onDiagnostics])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const abort = new AbortController()
    let disposed = false
    const previous = loadedRef.current
    loadedRef.current = new Map()
    previous.forEach((loaded) => loaded.dispose())
    clearD5mMaterialTextures(runtime.material)
    const load = async () => {
      const errors: string[] = []
      const notices = [...descriptor.notices]
      let loadedCount = 0
      for (const definition of descriptor.textures) {
        try {
          const loaded = await loadD5mPreviewTexture(
            draft,
            definition,
            runtime.renderer.capabilities.getMaxAnisotropy(),
            abort.signal,
          )
          if (disposed) {
            loaded.dispose()
            return
          }
          const existing = loadedRef.current.get(definition.channel)
          existing?.dispose()
          loadedRef.current.set(definition.channel, loaded)
          assignD5mTexture(runtime.material, definition.channel, loaded)
          loadedCount += 1
          if (loaded.notice) notices.push(loaded.notice)
          runtime.material.needsUpdate = true
          runtime.render()
        } catch (error) {
          if (!abort.signal.aborted) {
            if (error instanceof D5mPreviewTextureNotice) notices.push(error.message)
            else errors.push(`${definition.slot}: ${normalizeError(error)}`)
          }
        }
      }
      if (!disposed) {
        onDiagnostics?.({
          mappedParameters: descriptor.mappedParameterIndices.size,
          totalParameters: draft.parameters.length,
          loadedTextures: loadedCount,
          notices,
          errors,
        })
      }
    }
    void load()
    return () => {
      disposed = true
      abort.abort()
    }
  }, [textureKey])

  useEffect(() => () => {
    loadedRef.current.forEach((loaded) => loaded.dispose())
    loadedRef.current.clear()
  }, [])

  return <div ref={hostRef} className="material-preview-host" aria-label="D5M 材质标准几何预览" />
}

// Keep the standard object inside a portrait mobile preview instead of clipping its sides.
export function materialPreviewFovForAspect(aspect: number): number {
  const normalizedAspect = Number.isFinite(aspect) ? Math.max(0.25, aspect) : 1
  return Math.min(52, 35 + Math.max(0, 0.86 - normalizedAspect) * 36)
}

function createGeometries(): Record<MaterialPreviewShape, BufferGeometry> {
  const geometries: Record<MaterialPreviewShape, BufferGeometry> = {
    sphere: new SphereGeometry(1.18, 128, 64),
    cube: new BoxGeometry(1.85, 1.85, 1.85, 48, 48, 48),
    plane: new PlaneGeometry(2.45, 2.45, 160, 160),
  }
  for (const geometry of Object.values(geometries)) {
    const uv = geometry.getAttribute('uv')
    if (uv) geometry.setAttribute('uv1', uv)
  }
  return geometries
}

function checkerTexture(dark = '#27313a', light = '#1c242c', repeat = 5): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = dark
  context.fillRect(0, 0, 128, 128)
  context.fillStyle = light
  context.fillRect(0, 0, 64, 64)
  context.fillRect(64, 64, 64, 64)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  return texture
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
