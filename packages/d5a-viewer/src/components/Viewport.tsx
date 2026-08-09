import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { LoadedModelDocument } from '../core/model-document'
import type { D5aExportResult } from '../export/d5a-exporter'
import type { GlbExportResult } from '../export/glb-exporter'
import type { ConvertSceneResult } from '../interchange/scene-conversion'
import type { ModelBuildProgress } from '../render/model-builder'
import type { D5mMaterialDraft } from '../d5m/writer'
import {
  ViewportController,
  type D5mModelMaterialPreviewResult,
  type SceneItem,
  type ViewportLoadResult,
  type ViewportStats,
} from '../render/viewport-controller'

export interface ViewportHandle {
  fit(): void
  fitSelection(): void
  capture(): Promise<Blob>
  exportGlb(sourceName: string, selectedOnly?: boolean): Promise<GlbExportResult>
  exportD5a(
    sourceName: string,
    onProgress?: (label: string) => void,
    selectedOnly?: boolean,
  ): Promise<D5aExportResult>
  exportDxf(
    sourceName: string,
    onProgress?: (label: string) => void,
    selectedOnly?: boolean,
  ): Promise<ConvertSceneResult>
  setObjectVisible(id: string, visible: boolean): void
  setObjectsVisible(ids: string[], visible: boolean): void
  showAllObjects(): void
  setObjectsSelected(ids: string[], selected: boolean, replace?: boolean): void
  clearSelection(): void
  setIsolation(enabled: boolean): boolean
  loadEnvironment(file: File, signal?: AbortSignal): Promise<void>
  clearEnvironment(): void
  setEnvironmentIntensity(intensity: number): void
  setEnvironmentBackground(enabled: boolean): void
  applyD5mMaterialToSelection(
    draft: D5mMaterialDraft,
    familyKey: string,
    signal?: AbortSignal,
  ): Promise<D5mModelMaterialPreviewResult>
  clearD5mMaterialPreview(): void
}

interface ViewportProps {
  document?: LoadedModelDocument
  active: boolean
  wireframe: boolean
  grid: boolean
  autoRotate: boolean
  pixelRatio: number
  onProgress(progress: ModelBuildProgress): void
  onLoaded(result: ViewportLoadResult): void
  onItems(items: SceneItem[]): void
  onIsolationChange(isolated: boolean): void
  onD5mMaterialPreviewChange(active: boolean, objectCount: number): void
  onStats(stats: ViewportStats): void
  onError(error: Error): void
}

export const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ViewportController | undefined>(undefined)
  const callbacksRef = useRef(props)
  callbacksRef.current = props

  useImperativeHandle(ref, () => ({
    fit: () => controllerRef.current?.fit(),
    fitSelection: () => controllerRef.current?.fitSelection(),
    capture: () => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.capture()
    },
    exportGlb: (sourceName, selectedOnly) => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.exportGlb(sourceName, selectedOnly)
    },
    exportD5a: (sourceName, onProgress, selectedOnly) => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.exportD5a(sourceName, onProgress, selectedOnly)
    },
    exportDxf: (sourceName, onProgress, selectedOnly) => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.exportDxf(sourceName, onProgress, selectedOnly)
    },
    setObjectVisible: (id, visible) => {
      controllerRef.current?.setObjectVisible(id, visible)
    },
    setObjectsVisible: (ids, visible) => controllerRef.current?.setObjectsVisible(ids, visible),
    showAllObjects: () => controllerRef.current?.showAllObjects(),
    setObjectsSelected: (ids, selected, replace) => controllerRef.current?.setObjectsSelected(ids, selected, replace),
    clearSelection: () => controllerRef.current?.clearSelection(),
    setIsolation: (enabled) => controllerRef.current?.setIsolation(enabled) ?? false,
    loadEnvironment: (file, signal) => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.loadEnvironment(file, signal)
    },
    clearEnvironment: () => controllerRef.current?.clearEnvironment(),
    setEnvironmentIntensity: (intensity) => controllerRef.current?.setEnvironmentIntensity(intensity),
    setEnvironmentBackground: (enabled) => controllerRef.current?.setEnvironmentBackground(enabled),
    applyD5mMaterialToSelection: (draft, familyKey, signal) => {
      if (!controllerRef.current) return Promise.reject(new Error('视图尚未初始化'))
      return controllerRef.current.applyD5mMaterialToSelection(draft, familyKey, signal)
    },
    clearD5mMaterialPreview: () => controllerRef.current?.clearD5mMaterialPreview(),
  }), [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const controller = new ViewportController(host)
    controller.onStats = (stats) => callbacksRef.current.onStats(stats)
    controller.onItems = (items) => callbacksRef.current.onItems(items)
    controller.onIsolationChange = (isolated) => callbacksRef.current.onIsolationChange(isolated)
    controller.onD5mMaterialPreviewChange = (active, objectCount) => (
      callbacksRef.current.onD5mMaterialPreviewChange(active, objectCount)
    )
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller || !props.document) {
      controller?.clear()
      callbacksRef.current.onItems([])
      return
    }
    const abort = new AbortController()
    controller
      .load(props.document, abort.signal, (progress) => callbacksRef.current.onProgress(progress))
      .then((result) => {
        callbacksRef.current.onLoaded(result)
        callbacksRef.current.onItems(result.items)
        requestAnimationFrame(() => {
          if (!abort.signal.aborted) controller.fit()
        })
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) callbacksRef.current.onError(normalizeError(error))
      })
    return () => {
      abort.abort()
      controller.clear()
    }
  }, [props.document])

  useEffect(() => controllerRef.current?.setWireframe(props.wireframe), [props.wireframe])
  useEffect(() => controllerRef.current?.setActive(props.active), [props.active])
  useEffect(() => controllerRef.current?.setGrid(props.grid), [props.grid])
  useEffect(() => controllerRef.current?.setAutoRotate(props.autoRotate), [props.autoRotate])
  useEffect(() => controllerRef.current?.setPixelRatio(props.pixelRatio), [props.pixelRatio])

  return <div className="viewport-host" ref={hostRef} />
})

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
