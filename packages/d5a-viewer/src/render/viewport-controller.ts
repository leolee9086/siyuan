import {
  Box3,
  Box3Helper,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LoadedModelDocument } from '../core/model-document'
import type {
  D5mMeshMaterialOverride,
  LoadedD5mThreeMaterial,
} from '../d5m/three-material'
import type { D5mMaterialDraft } from '../d5m/writer'
import { exportD5a as serializeD5a, type D5aExportResult } from '../export/d5a-exporter'
import { exportGlb as serializeGlb, type GlbExportResult } from '../export/glb-exporter'
import { createGltfRuntime, type GltfRuntime } from '../interchange/gltf-runtime'
import { exportSceneDocumentToDxf, type ConvertSceneResult } from '../interchange/scene-conversion'
import {
  createCompleteSceneProjection,
  createSceneSelectionProjection,
} from '../interchange/scene-selection'
import {
  buildModel,
  geometryDrawElementCount,
  type BuiltModel,
  type ModelBuildProgress,
} from './model-builder'

export interface ViewportStats {
  frameMs: number
  calls: number
  triangles: number
  geometries: number
  textures: number
}

export interface SceneItem {
  id: string
  name: string
  material: string
  materialIds: string[]
  triangles: number
  visible: boolean
  selected: boolean
}

export interface SceneMaterialInfo {
  id: string
  index: number
  title: string
  color: string
  textured: boolean
  objectIds: string[]
}

export interface ViewportLoadResult {
  model: BuiltModel
  items: SceneItem[]
  materials: SceneMaterialInfo[]
  maxTextureSize: number
}

export interface D5mModelMaterialPreviewResult {
  objectCount: number
  loadedTextureCount: number
  mappedParameterCount: number
  totalParameterCount: number
  notices: string[]
  errors: string[]
}

export class ViewportController {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(42, 1, 0.01, 10_000)
  private readonly renderer: WebGLRenderer
  private readonly controls: OrbitControls
  private readonly modelPivot = new Group()
  private readonly selectionBounds = new Box3()
  private readonly selectionHelper = new Box3Helper(this.selectionBounds, '#18785b')
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly grid: GridHelper
  private readonly defaultBackground = new Color('#e8ebe9')
  private readonly hemisphere: HemisphereLight
  private readonly keyLight: DirectionalLight
  private readonly fillLight: DirectionalLight
  private readonly resizeObserver: ResizeObserver
  private built?: BuiltModel
  private environmentSource?: Texture
  private environmentTarget?: WebGLRenderTarget
  private environmentRequest = 0
  private environmentIntensity = 1
  private environmentBackground = false
  private frameId = 0
  private lastFrameAt = performance.now()
  private active = true
  private autoRotate = false
  private wireframeEnabled = false
  private disposed = false
  private gltfRuntime?: GltfRuntime
  private gltfRuntimeLoading?: Promise<GltfRuntime>
  private readonly selectedObjectIds = new Set<string>()
  private isolationSnapshot?: Map<string, boolean>
  private pointerDown?: { x: number; y: number }
  private d5mMaterialAbort?: AbortController
  private d5mMaterialRuntime?: LoadedD5mThreeMaterial
  private d5mMaterialOverride?: D5mMeshMaterialOverride

  onStats?: (stats: ViewportStats) => void
  onItems?: (items: SceneItem[]) => void
  onIsolationChange?: (isolated: boolean) => void
  onD5mMaterialPreviewChange?: (active: boolean, objectCount: number) => void

  constructor(private readonly container: HTMLElement) {
    this.scene.background = this.defaultBackground
    this.renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = 'srgb'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.domElement.className = 'viewport-canvas'
    this.renderer.domElement.setAttribute('aria-label', 'D5A 三维模型视图')
    this.container.append(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = true
    this.controls.addEventListener('change', this.invalidate)
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp)

    this.scene.add(this.modelPivot)
    this.selectionHelper.visible = false
    const selectionMaterial = materialsOf(this.selectionHelper.material)[0]!
    selectionMaterial.depthTest = false
    selectionMaterial.transparent = true
    selectionMaterial.opacity = 0.92
    this.selectionHelper.renderOrder = 1000
    this.scene.add(this.selectionHelper)
    this.hemisphere = new HemisphereLight('#ffffff', '#788078', 2.35)
    this.scene.add(this.hemisphere)
    this.keyLight = new DirectionalLight('#fff6e8', 3.2)
    this.keyLight.position.set(4, 7, 5)
    this.scene.add(this.keyLight)
    this.fillLight = new DirectionalLight('#dcecff', 1.25)
    this.fillLight.position.set(-5, 3, -4)
    this.scene.add(this.fillLight)
    this.grid = new GridHelper(20, 40, '#8e9892', '#c8ceca')
    this.grid.material.opacity = 0.52
    this.grid.material.transparent = true
    this.scene.add(this.grid)

    this.camera.position.set(4, 3, 5)
    this.camera.lookAt(0, 0, 0)
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(this.container)
    this.resize()
  }

  async load(
    document: LoadedModelDocument,
    signal?: AbortSignal,
    onProgress?: (progress: ModelBuildProgress) => void,
  ): Promise<ViewportLoadResult> {
    this.clear()
    const gltfRuntime = document.kind === 'glb' ? await this.getGltfRuntime() : undefined
    const built = await buildModel(document, {
      signal,
      maxTextureSize: Math.min(2048, this.renderer.capabilities.maxTextureSize),
      gltfRuntime,
      onProgress,
      onChange: this.invalidate,
    })
    if (signal?.aborted) {
      built.dispose()
      throw new DOMException('加载已取消', 'AbortError')
    }
    this.built = built
    this.modelPivot.add(built.root)
    this.fit()
    this.invalidate()
    return {
      model: built,
      items: this.sceneItems(),
      materials: this.sceneMaterials(),
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
    }
  }

  clear(): void {
    this.clearD5mMaterialPreview()
    this.built?.dispose()
    this.built = undefined
    this.selectedObjectIds.clear()
    this.isolationSnapshot = undefined
    this.selectionBounds.makeEmpty()
    this.selectionHelper.visible = false
    this.modelPivot.clear()
    this.renderer.renderLists.dispose()
    this.onItems?.([])
    this.onIsolationChange?.(false)
    this.invalidate()
  }

  fit = (): void => {
    if (!this.built) return
    this.modelPivot.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(this.modelPivot)
    this.frameBounds(bounds)
  }

  fitSelection(): void {
    if (this.selectedObjectIds.size === 0) {
      this.fit()
      return
    }
    this.frameBounds(this.boundsForObjects(this.selectedObjectIds, false))
  }

  private frameBounds(bounds: Box3): void {
    if (bounds.isEmpty()) return
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const maximum = Math.max(size.x, size.y, size.z, 0.01)
    const distance = framingDistance(size, this.camera.fov, this.camera.aspect)
    const direction = new Vector3(1, 0.72, 1).normalize()
    this.camera.position.copy(center).addScaledVector(direction, distance)
    this.camera.near = Math.max(maximum / 10_000, 0.001)
    this.camera.far = Math.max(maximum * 100, 100)
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(center)
    this.controls.maxDistance = maximum * 30
    this.controls.minDistance = maximum * 0.02
    this.controls.update()
    const gridSize = Math.pow(10, Math.ceil(Math.log10(maximum * 1.6)))
    this.grid.scale.setScalar(gridSize / 20)
    this.grid.position.set(center.x, bounds.min.y, center.z)
    this.invalidate()
  }

  setWireframe(enabled: boolean): void {
    this.wireframeEnabled = enabled
    this.applyWireframeToScene()
    this.invalidate()
  }

  private applyWireframeToScene(): void {
    this.modelPivot.traverse((object) => {
      if (!(object instanceof Mesh)) return
      for (const material of materialsOf(object.material)) {
        if ('wireframe' in material) {
          (material as Material & { wireframe: boolean }).wireframe = this.wireframeEnabled
        }
      }
    })
  }

  setGrid(enabled: boolean): void {
    this.grid.visible = enabled
    this.invalidate()
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled
    this.lastFrameAt = performance.now()
    this.invalidate()
  }

  setActive(active: boolean): void {
    if (this.active === active) {
      if (active) this.resize()
      return
    }
    this.active = active
    if (!active) {
      cancelAnimationFrame(this.frameId)
      this.frameId = 0
      return
    }
    this.lastFrameAt = performance.now()
    this.resize()
  }

  setPixelRatio(ratio: number): void {
    this.renderer.setPixelRatio(Math.min(ratio, this.renderer.capabilities.maxTextureSize > 0 ? 2 : 1))
    this.resize()
  }

  async applyD5mMaterialToSelection(
    draft: D5mMaterialDraft,
    familyKey: string,
    signal?: AbortSignal,
  ): Promise<D5mModelMaterialPreviewResult> {
    if (!this.built) throw new Error('视图中没有可应用材质的模型')
    const targets = this.meshObjects().filter((object) => this.selectedObjectIds.has(object.uuid))
    if (targets.length === 0) throw new Error('请先在模型检查器中选择至少一个部件')
    this.clearD5mMaterialPreview()

    const abort = new AbortController()
    this.d5mMaterialAbort = abort
    const forwardAbort = () => abort.abort()
    if (signal?.aborted) abort.abort()
    else signal?.addEventListener('abort', forwardAbort, { once: true })
    let materialRuntime: typeof import('../d5m/three-material')
    let runtime: LoadedD5mThreeMaterial
    try {
      materialRuntime = await import('../d5m/three-material')
      runtime = await materialRuntime.loadD5mThreeMaterial(
        draft,
        familyKey,
        this.renderer.capabilities.getMaxAnisotropy(),
        abort.signal,
      )
    } catch (error) {
      if (this.d5mMaterialAbort === abort) this.d5mMaterialAbort = undefined
      throw error
    } finally {
      signal?.removeEventListener('abort', forwardAbort)
    }
    if (this.disposed || abort.signal.aborted || this.d5mMaterialAbort !== abort || !this.built) {
      runtime.dispose()
      throw new DOMException('D5M 材质应用已取消', 'AbortError')
    }

    runtime.material.name = `D5M 预览 · ${String(draft.material.title || '未命名材质')}`
    runtime.material.wireframe = this.wireframeEnabled
    const override = materialRuntime.applyD5mMaterialOverride(targets, runtime.material)
    if (override.objectCount === 0) {
      runtime.dispose()
      throw new Error('选中内容中没有可应用材质的网格')
    }
    this.d5mMaterialAbort = undefined
    this.d5mMaterialRuntime = runtime
    this.d5mMaterialOverride = override
    this.emitItems()
    this.onD5mMaterialPreviewChange?.(true, override.objectCount)
    this.invalidate()
    return {
      objectCount: override.objectCount,
      loadedTextureCount: runtime.loadedTextureCount,
      mappedParameterCount: runtime.descriptor.mappedParameterIndices.size,
      totalParameterCount: draft.parameters.length,
      notices: runtime.notices,
      errors: runtime.errors,
    }
  }

  clearD5mMaterialPreview(): void {
    const hadPreview = Boolean(this.d5mMaterialAbort || this.d5mMaterialOverride || this.d5mMaterialRuntime)
    this.d5mMaterialAbort?.abort()
    this.d5mMaterialAbort = undefined
    this.d5mMaterialOverride?.restore()
    this.d5mMaterialOverride = undefined
    this.d5mMaterialRuntime?.dispose()
    this.d5mMaterialRuntime = undefined
    if (!hadPreview) return
    this.applyWireframeToScene()
    if (this.built) this.emitItems()
    this.onD5mMaterialPreviewChange?.(false, 0)
    this.invalidate()
  }

  async loadEnvironment(file: File, signal?: AbortSignal): Promise<void> {
    const request = ++this.environmentRequest
    const url = URL.createObjectURL(file)
    let source: Texture | undefined
    let target: WebGLRenderTarget | undefined
    try {
      throwIfAborted(signal)
      const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js')
      source = await new HDRLoader().loadAsync(url)
      throwIfAborted(signal)
      source.mapping = EquirectangularReflectionMapping
      const generator = new PMREMGenerator(this.renderer)
      try {
        generator.compileEquirectangularShader()
        target = generator.fromEquirectangular(source)
      } finally {
        generator.dispose()
      }
      throwIfAborted(signal)
      if (this.disposed || request !== this.environmentRequest) throw new DOMException('环境加载已取消', 'AbortError')

      this.releaseEnvironment()
      this.environmentSource = source
      this.environmentTarget = target
      source = undefined
      target = undefined
      this.scene.environment = this.environmentTarget.texture
      this.setEnvironmentLighting(true)
      this.applyEnvironmentSettings()
      this.invalidate()
    } finally {
      URL.revokeObjectURL(url)
      source?.dispose()
      target?.dispose()
    }
  }

  clearEnvironment(): void {
    this.environmentRequest += 1
    this.releaseEnvironment()
    this.scene.environment = null
    this.scene.background = this.defaultBackground
    this.setEnvironmentLighting(false)
    this.invalidate()
  }

  setEnvironmentIntensity(intensity: number): void {
    this.environmentIntensity = Math.min(3, Math.max(0, intensity))
    this.applyEnvironmentSettings()
    this.invalidate()
  }

  setEnvironmentBackground(enabled: boolean): void {
    this.environmentBackground = enabled
    this.applyEnvironmentSettings()
    this.invalidate()
  }

  setObjectVisible(id: string, visible: boolean): SceneItem[] {
    return this.setObjectsVisible([id], visible)
  }

  setObjectsVisible(ids: Iterable<string>, visible: boolean): SceneItem[] {
    this.restoreIsolation()
    const targetIds = new Set(ids)
    for (const object of this.meshObjects()) {
      if (targetIds.has(object.uuid)) object.visible = visible
    }
    this.updateSelectionHelper()
    this.invalidate()
    return this.emitItems()
  }

  showAllObjects(): SceneItem[] {
    this.isolationSnapshot = undefined
    this.onIsolationChange?.(false)
    for (const object of this.meshObjects()) object.visible = true
    this.updateSelectionHelper()
    this.invalidate()
    return this.emitItems()
  }

  setObjectsSelected(ids: Iterable<string>, selected: boolean, replace = false): SceneItem[] {
    this.clearD5mMaterialPreview()
    const available = new Set(this.meshObjects().map((object) => object.uuid))
    if (replace) this.selectedObjectIds.clear()
    for (const id of ids) {
      if (!available.has(id)) continue
      if (selected) this.selectedObjectIds.add(id)
      else this.selectedObjectIds.delete(id)
    }
    if (this.isolationSnapshot) {
      if (this.selectedObjectIds.size === 0) this.restoreIsolation()
      else this.applyIsolation()
    }
    this.updateSelectionHelper()
    this.invalidate()
    return this.emitItems()
  }

  clearSelection(): SceneItem[] {
    this.clearD5mMaterialPreview()
    this.selectedObjectIds.clear()
    this.restoreIsolation()
    this.updateSelectionHelper()
    this.invalidate()
    return this.emitItems()
  }

  setIsolation(enabled: boolean): boolean {
    if (!enabled) {
      this.restoreIsolation()
      this.updateSelectionHelper()
      this.invalidate()
      this.emitItems()
      return false
    }
    if (this.selectedObjectIds.size === 0) return false
    this.isolationSnapshot ??= new Map(this.meshObjects().map((object) => [object.uuid, object.visible]))
    this.applyIsolation()
    this.onIsolationChange?.(true)
    this.updateSelectionHelper()
    this.invalidate()
    this.emitItems()
    return true
  }

  async capture(): Promise<Blob> {
    this.render(performance.now())
    return new Promise((resolve, reject) => {
      this.renderer.domElement.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('截图生成失败'))
      }, 'image/png')
    })
  }

  async exportGlb(sourceName: string, selectedOnly = false): Promise<GlbExportResult> {
    if (!this.built) throw new Error('视图中没有可导出的模型')
    if (this.d5mMaterialOverride) throw new Error('临时 D5M 材质只用于视觉检查；请恢复原材质后导出模型')
    const selectionProjection = selectedOnly
      ? createSceneSelectionProjection(this.built.root, this.built.scene, this.selectedObjectIds)
      : undefined
    const projection = selectionProjection
      ?? createCompleteSceneProjection(this.built.root, this.built.scene)
    try {
      const result = await serializeGlb(
        projection.root,
        sourceName,
        Math.min(2048, this.renderer.capabilities.maxTextureSize),
        this.gltfRuntime,
      )
      if (selectionProjection) {
        result.report.notes.unshift(`仅导出 ${selectionProjection.sourceObjectIds.length} 个选中网格；几何、材质和纹理资源从原场景借用。`)
      } else {
        result.report.notes.unshift('完整模型导出包含全部场景节点；检查器隐藏与隔离状态不写入结果。')
      }
      return result
    } finally {
      projection.dispose()
    }
  }

  async exportD5a(
    sourceName: string,
    onProgress?: (label: string) => void,
    selectedOnly = false,
  ): Promise<D5aExportResult> {
    if (!this.built) throw new Error('视图中没有可导出的模型')
    if (this.d5mMaterialOverride) throw new Error('临时 D5M 材质只用于视觉检查；请恢复原材质后导出模型')
    const selectionProjection = selectedOnly
      ? createSceneSelectionProjection(this.built.root, this.built.scene, this.selectedObjectIds)
      : undefined
    const projection = selectionProjection
      ?? createCompleteSceneProjection(this.built.root, this.built.scene)
    try {
      const result = await serializeD5a(
        projection.root,
        projection.scene,
        sourceName,
        {
          maxTextureSize: Math.min(2048, this.renderer.capabilities.maxTextureSize),
          onProgress,
        },
      )
      if (selectionProjection) {
        result.report.notes.unshift(`仅导出 ${selectionProjection.sourceObjectIds.length} 个选中网格；D5A 尺寸由选中部件包围盒重新计算。`)
      } else {
        result.report.notes.unshift('完整模型导出包含全部场景节点；检查器隐藏与隔离状态不写入结果。')
      }
      return result
    } finally {
      projection.dispose()
    }
  }

  async exportDxf(
    sourceName: string,
    onProgress?: (label: string) => void,
    selectedOnly = false,
  ): Promise<ConvertSceneResult> {
    if (!this.built) throw new Error('视图中没有可导出的模型')
    if (this.d5mMaterialOverride) throw new Error('临时 D5M 材质只用于视觉检查；请恢复原材质后导出模型')
    const selectionProjection = selectedOnly
      ? createSceneSelectionProjection(this.built.root, this.built.scene, this.selectedObjectIds)
      : undefined
    const projection = selectionProjection
      ?? createCompleteSceneProjection(this.built.root, this.built.scene)
    try {
      return await exportSceneDocumentToDxf(projection.scene, sourceName, {
        onProgress: (progress) => onProgress?.(progress.message),
      })
    } finally {
      projection.dispose()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener('change', this.invalidate)
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp)
    this.controls.dispose()
    this.clear()
    this.clearEnvironment()
    this.gltfRuntime?.dispose()
    this.gltfRuntime = undefined
    void this.gltfRuntimeLoading?.then((runtime) => runtime.dispose())
    this.gltfRuntimeLoading = undefined
    this.grid.geometry.dispose()
    this.grid.material.dispose()
    this.selectionHelper.geometry.dispose()
    for (const material of materialsOf(this.selectionHelper.material)) material.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private sceneItems(): SceneItem[] {
    const items: SceneItem[] = []
    this.modelPivot.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = materialsOf(object.material)
      items.push({
        id: object.uuid,
        name: object.name || `网格 ${items.length + 1}`,
        material: materials.map((material) => material.name || '默认材质').join(', '),
        materialIds: materials.map((material) => material.uuid),
        triangles: Math.floor(geometryDrawElementCount(object.geometry) / 3),
        visible: object.visible,
        selected: this.selectedObjectIds.has(object.uuid),
      })
    })
    return items
  }

  private async getGltfRuntime(): Promise<GltfRuntime> {
    if (this.gltfRuntime) return this.gltfRuntime
    this.gltfRuntimeLoading ??= createGltfRuntime({ renderer: this.renderer })
    const runtime = await this.gltfRuntimeLoading
    if (this.disposed) {
      runtime.dispose()
      throw new DOMException('视口已释放', 'AbortError')
    }
    this.gltfRuntime = runtime
    return runtime
  }

  private sceneMaterials(): SceneMaterialInfo[] {
    const materials = new Map<string, { material: Material; objectIds: Set<string> }>()
    this.modelPivot.traverse((object) => {
      if (!(object instanceof Mesh)) return
      for (const material of materialsOf(object.material)) {
        const entry = materials.get(material.uuid) ?? { material, objectIds: new Set<string>() }
        entry.objectIds.add(object.uuid)
        materials.set(material.uuid, entry)
      }
    })
    return [...materials.values()].map(({ material, objectIds }, index) => {
      const color = 'color' in material && material.color instanceof Color
        ? `#${material.color.getHexString()}`
        : '#b7bbb8'
      const textured = Object.values(material).some(
        (value) => typeof value === 'object' && value !== null && 'isTexture' in value && value.isTexture === true,
      )
      return {
        id: material.uuid,
        index,
        title: material.name || `Material ${index + 1}`,
        color,
        textured,
        objectIds: [...objectIds],
      }
    })
  }

  private emitItems(): SceneItem[] {
    const items = this.sceneItems()
    this.onItems?.(items)
    return items
  }

  private meshObjects(): Mesh[] {
    const objects: Mesh[] = []
    this.built?.root.traverse((object) => {
      if (object instanceof Mesh) objects.push(object)
    })
    return objects
  }

  private restoreIsolation(): void {
    if (!this.isolationSnapshot) return
    for (const object of this.meshObjects()) {
      const visible = this.isolationSnapshot.get(object.uuid)
      if (visible != null) object.visible = visible
    }
    this.isolationSnapshot = undefined
    this.onIsolationChange?.(false)
  }

  private applyIsolation(): void {
    for (const object of this.meshObjects()) object.visible = this.selectedObjectIds.has(object.uuid)
  }

  private boundsForObjects(ids: Iterable<string>, visibleOnly: boolean): Box3 {
    const targets = new Set(ids)
    const bounds = new Box3()
    this.modelPivot.updateMatrixWorld(true)
    for (const object of this.meshObjects()) {
      if (!targets.has(object.uuid)) continue
      if (visibleOnly && !objectVisibleInHierarchy(object)) continue
      bounds.union(new Box3().setFromObject(object))
    }
    return bounds
  }

  private updateSelectionHelper(): void {
    const bounds = this.boundsForObjects(this.selectedObjectIds, true)
    if (bounds.isEmpty()) {
      this.selectionHelper.visible = false
      this.selectionBounds.makeEmpty()
      return
    }
    this.selectionBounds.copy(bounds)
    this.selectionHelper.visible = true
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private handlePointerUp = (event: PointerEvent): void => {
    const started = this.pointerDown
    this.pointerDown = undefined
    if (!started || event.button !== 0 || !this.built) return
    if (Math.hypot(event.clientX - started.x, event.clientY - started.y) > 5) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const object = this.raycaster
      .intersectObject(this.built.root, true)
      .map((intersection) => intersection.object)
      .find((candidate): candidate is Mesh => candidate instanceof Mesh && objectVisibleInHierarchy(candidate))
    const additive = event.ctrlKey || event.metaKey || event.shiftKey
    if (!object) {
      if (!additive) this.clearSelection()
      return
    }
    const selected = additive ? !this.selectedObjectIds.has(object.uuid) : true
    this.setObjectsSelected([object.uuid], selected, !additive)
  }

  private applyEnvironmentSettings(): void {
    this.scene.environmentIntensity = this.environmentIntensity
    this.scene.backgroundIntensity = this.environmentIntensity
    this.scene.background = this.environmentBackground && this.environmentSource
      ? this.environmentSource
      : this.defaultBackground
  }

  private releaseEnvironment(): void {
    this.environmentSource?.dispose()
    this.environmentTarget?.dispose()
    this.environmentSource = undefined
    this.environmentTarget = undefined
  }

  private setEnvironmentLighting(active: boolean): void {
    this.hemisphere.intensity = active ? 0.45 : 2.35
    this.keyLight.intensity = active ? 0.35 : 3.2
    this.fillLight.intensity = active ? 0.2 : 1.25
  }

  private resize = (): void => {
    if (this.disposed) return
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.invalidate()
  }

  private invalidate = (): void => {
    if (this.disposed || !this.active || this.frameId) return
    this.frameId = requestAnimationFrame(this.render)
  }

  private render = (timestamp: number): void => {
    this.frameId = 0
    if (this.disposed || !this.active) return
    const elapsed = Math.min(100, timestamp - this.lastFrameAt)
    this.lastFrameAt = timestamp
    if (this.autoRotate && this.built) {
      this.modelPivot.rotation.y += elapsed * 0.00024
      this.updateSelectionHelper()
    }
    const started = performance.now()
    this.renderer.render(this.scene, this.camera)
    this.onStats?.({
      frameMs: performance.now() - started,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    })
    if (this.autoRotate) this.invalidate()
  }
}

export function framingDistance(
  size: Vector3,
  verticalFovDegrees: number,
  aspect: number,
  margin = 1.15,
): number {
  const halfVerticalFov = (verticalFovDegrees * Math.PI) / 360
  const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * Math.max(aspect, 0.01))
  const limitingHalfFov = Math.max(0.001, Math.min(halfVerticalFov, halfHorizontalFov))
  const radius = Math.max(size.length() / 2, 0.005)
  return (radius / Math.sin(limitingHalfFov)) * margin
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('环境加载已取消', 'AbortError')
}

function materialsOf(material: Material | Material[]): Material[] {
  return Array.isArray(material) ? material : [material]
}

function objectVisibleInHierarchy(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}
