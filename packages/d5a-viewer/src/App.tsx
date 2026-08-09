import {
  Box,
  Camera,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileCheck2,
  FileOutput,
  Focus,
  FolderOpen,
  Grid3x3,
  Info,
  Layers,
  LoaderCircle,
  Palette,
  PanelRight,
  Rotate3d,
  ScanLine,
  Search,
  SunMedium,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { LoadedD5aDocument } from './core/document-loader'
import { loadModelDocument, type LoadedModelDocument } from './core/model-document'
import type { LoadProgress } from './core/types'
import type { D5aExportTimings } from './export/d5a-exporter'
import { Viewport, type ViewportHandle } from './components/Viewport'
import type { ModelBuildProgress } from './render/model-builder'
import type { SceneItem, ViewportLoadResult, ViewportStats } from './render/viewport-controller'
import { parseLegacyMaterials } from './render/legacy-materials'
import type {
  MaterialStudioApplicationState,
  MaterialStudioRequest,
} from './components/MaterialStudio'
import type { D5mMaterialDraft } from './d5m/writer'

const MaterialStudio = lazy(() => import('./components/MaterialStudio'))
const MaterialBatchWorkspace = lazy(() => import('./components/MaterialBatchWorkspace'))

type InspectorTab = 'meshes' | 'materials'
interface MaterialView {
  id: string
  index: number
  title: string
  color: string
  textured: boolean
  objectIds: string[]
}
type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string; loaded: number; total: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
type EnvironmentState =
  | { kind: 'idle' }
  | { kind: 'loading'; name: string }
  | { kind: 'ready'; name: string }
  | { kind: 'error'; message: string }
type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; format: 'glb' | 'd5a' | 'dxf'; label: string; selectedOnly: boolean }
  | {
      kind: 'ready'
      format: 'glb' | 'd5a' | 'dxf'
      selectedOnly: boolean
      bytes: number
      fidelity: 'pass' | 'warning'
      file: File
      timings?: D5aExportTimings
    }
  | { kind: 'error'; message: string }

const LARGE_FILE_BYTES = 250 * 1024 * 1024

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<'model' | 'material' | 'batch'>('model')
  const [materialWorkspaceMounted, setMaterialWorkspaceMounted] = useState(false)
  const [batchWorkspaceMounted, setBatchWorkspaceMounted] = useState(false)
  const materialNonceRef = useRef(0)
  const [materialRequest, setMaterialRequest] = useState<MaterialStudioRequest>({ kind: 'new', nonce: 0 })
  const [materialApplication, setMaterialApplication] = useState<MaterialStudioApplicationState>({ kind: 'idle' })
  const [document, setDocument] = useState<LoadedModelDocument>()
  const documentRef = useRef<LoadedModelDocument | undefined>(undefined)
  const [pendingFile, setPendingFile] = useState<File>()
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' })
  const [modelResult, setModelResult] = useState<ViewportLoadResult>()
  const [sceneItems, setSceneItems] = useState<SceneItem[]>([])
  const [stats, setStats] = useState<ViewportStats>({
    frameMs: 0,
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  })
  const [wireframe, setWireframe] = useState(false)
  const [grid, setGrid] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)
  const [pixelRatio, setPixelRatio] = useState(1)
  const [tab, setTab] = useState<InspectorTab>('meshes')
  const [filter, setFilter] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [isolationActive, setIsolationActive] = useState(false)
  const [environmentOpen, setEnvironmentOpen] = useState(false)
  const [environmentState, setEnvironmentState] = useState<EnvironmentState>({ kind: 'idle' })
  const [environmentIntensity, setEnvironmentIntensity] = useState(1)
  const [environmentBackground, setEnvironmentBackground] = useState(false)
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const environmentInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<ViewportHandle>(null)
  const loadAbortRef = useRef<AbortController | undefined>(undefined)
  const environmentAbortRef = useRef<AbortController | undefined>(undefined)
  const materialApplicationAbortRef = useRef<AbortController | undefined>(undefined)
  const modelExportBlocked = materialApplication.kind === 'applying' || materialApplication.kind === 'active'

  useEffect(() => () => {
    loadAbortRef.current?.abort()
    environmentAbortRef.current?.abort()
    materialApplicationAbortRef.current?.abort()
    void documentRef.current?.close()
  }, [])

  useEffect(() => {
    viewportRef.current?.setEnvironmentIntensity(environmentIntensity)
  }, [environmentIntensity])

  useEffect(() => {
    viewportRef.current?.setEnvironmentBackground(environmentBackground)
  }, [environmentBackground])

  const beginFile = (file?: File) => {
    if (!file) return
    if (/\.d5m$/i.test(file.name)) {
      loadAbortRef.current?.abort()
      materialNonceRef.current += 1
      setMaterialRequest({ kind: 'file', file, nonce: materialNonceRef.current })
      setMaterialWorkspaceMounted(true)
      setWorkspaceMode('material')
      setPendingFile(undefined)
      return
    }
    if (!/\.(?:d5a|glb)$/i.test(file.name)) {
      setLoadState({ kind: 'error', message: '请选择 .d5a、.glb 或 .d5m 文件' })
      return
    }
    if (file.size >= LARGE_FILE_BYTES) {
      setPendingFile(file)
      return
    }
    void loadFile(file)
  }

  const loadFile = async (file: File) => {
    setWorkspaceMode('model')
    materialApplicationAbortRef.current?.abort()
    materialApplicationAbortRef.current = undefined
    viewportRef.current?.clearD5mMaterialPreview()
    setMaterialApplication({ kind: 'idle' })
    loadAbortRef.current?.abort()
    const abort = new AbortController()
    loadAbortRef.current = abort
    setPendingFile(undefined)
    setLoadState({ kind: 'loading', label: '检查 D5A 容器', loaded: 0, total: file.size })
    try {
      const next = await loadModelDocument(file, {
        signal: abort.signal,
        onProgress: (progress) => setLoadState(progressState(progress)),
      })
      if (abort.signal.aborted) {
        await next.close()
        return
      }
      const previous = documentRef.current
      documentRef.current = next
      setDocument(next)
      setModelResult(undefined)
      setSceneItems([])
      setIsolationActive(false)
      setWireframe(false)
      setAutoRotate(false)
      setExportState({ kind: 'idle' })
      setLoadState({ kind: 'loading', label: '准备三维视图', loaded: 0, total: 1 })
      if (previous) window.setTimeout(() => void previous.close(), 0)
    } catch (error) {
      if (abort.signal.aborted) return
      setLoadState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  useEffect(() => {
    const source = cliSceneUrl()
    if (!source) return
    const abort = new AbortController()
    setLoadState({ kind: 'loading', label: '从本地查看器读取文件', loaded: 0, total: 1 })
    void fetch(source, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`本地查看器文件请求失败 (${response.status})`)
        const blob = await response.blob()
        if (abort.signal.aborted) return
        const lastModified = Number(response.headers.get('x-d5-scene-last-modified'))
        beginFile(new File([blob], filenameFromSceneResponse(response), {
          type: response.headers.get('content-type') ?? 'application/octet-stream',
          lastModified: Number.isFinite(lastModified) && lastModified > 0 ? lastModified : Date.now(),
        }))
      })
      .catch((error) => {
        if (!abort.signal.aborted) setLoadState({ kind: 'error', message: normalizeError(error).message })
      })
    return () => abort.abort()
  }, [])

  const onBuildProgress = (progress: ModelBuildProgress) => {
    setLoadState({ kind: 'loading', ...progress })
  }

  const onModelLoaded = (result: ViewportLoadResult) => {
    const activeDocument = documentRef.current
    if (
      activeDocument?.kind === 'd5a' &&
      result.model.declaredTextureCount > 0 &&
      result.model.textureCount === 0 &&
      result.model.textureFailureCount > 0
    ) {
      if (!activeDocument.warnings.some((warning) => warning.startsWith('材质纹理仍未绑定'))) {
        activeDocument.warnings.push('材质纹理仍未绑定；请查看纹理加载失败诊断中的材质、槽位和归档路径')
      }
    }
    const actualGpuBytes = result.model.geometryGpuBytes + result.model.textureGpuBytes
    if (
      activeDocument &&
      actualGpuBytes >= 256 * 1024 * 1024 &&
      !activeDocument.warnings.some((warning) => warning.startsWith('实际显存估算'))
    ) {
      activeDocument.warnings.push(`实际显存估算为 ${formatBytes(actualGpuBytes)}，建议使用节能质量并关闭自动旋转`)
    }
    setModelResult(result)
    setLoadState({ kind: 'ready' })
  }

  const onRenderError = (error: Error) => {
    setLoadState({ kind: 'error', message: error.message })
  }

  const loadEnvironment = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.hdr')) {
      setEnvironmentState({ kind: 'error', message: '请选择 .hdr 环境文件' })
      return
    }
    environmentAbortRef.current?.abort()
    const abort = new AbortController()
    environmentAbortRef.current = abort
    setEnvironmentState({ kind: 'loading', name: file.name })
    try {
      const viewport = viewportRef.current
      if (!viewport) throw new Error('视图尚未初始化')
      await viewport.loadEnvironment(file, abort.signal)
      if (!abort.signal.aborted) setEnvironmentState({ kind: 'ready', name: file.name })
    } catch (error) {
      if (!abort.signal.aborted) setEnvironmentState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  const clearEnvironment = () => {
    environmentAbortRef.current?.abort()
    environmentAbortRef.current = undefined
    viewportRef.current?.clearEnvironment()
    setEnvironmentState({ kind: 'idle' })
  }

  const filteredItems = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return sceneItems.filter((item) => !query || `${item.name} ${item.material}`.toLowerCase().includes(query))
  }, [sceneItems, filter])
  const materialViews = useMemo<MaterialView[]>(() => {
    if (!document) return []
    if (modelResult) return modelResult.materials
    if (document.kind === 'glb') return []
    if (document.bundles.length > 0) {
      return document.bundles.flatMap((bundle, bundleIndex) => (bundle.info?.materials ?? []).map((material) => ({
        id: `${bundle.id || bundleIndex}-${material.index}-${material.key}`,
        index: material.index,
        title: document.bundles.length > 1 ? `${bundle.title} · ${material.title}` : material.title,
        color: rgb(material.color),
        textured: Boolean(material.diffuseMap),
        objectIds: [],
      })))
    }
    return parseLegacyMaterials(document.legacyMaterialXml).map((material, index) => ({
      id: `${index}-${material.name}`,
      index,
      title: material.name,
      color: material.color,
      textured: Boolean(material.diffuseMap),
      objectIds: [],
    }))
  }, [document, modelResult])
  const materials = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return materialViews.filter(
      (material) => !query || material.title.toLowerCase().includes(query),
    )
  }, [materialViews, filter])
  const selectedIds = useMemo(
    () => sceneItems.filter((item) => item.selected).map((item) => item.id),
    [sceneItems],
  )
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectionTargetIds = useMemo(() => {
    if (tab === 'meshes') return filteredItems.map((item) => item.id)
    return [...new Set(materials.flatMap((material) => material.objectIds))]
  }, [filteredItems, materials, tab])
  const selectedTargetCount = selectionTargetIds.filter((id) => selectedIdSet.has(id)).length
  const allTargetsSelected = selectionTargetIds.length > 0 && selectedTargetCount === selectionTargetIds.length
  const someTargetsSelected = selectedTargetCount > 0 && !allTargetsSelected

  const saveScreenshot = async () => {
    if (!document) return
    try {
      const blob = await viewportRef.current?.capture()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `${document.file.name.replace(/\.(?:d5a|glb)$/i, '')}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setLoadState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  const saveGlb = async (selectedOnly = false) => {
    const activeDocument = documentRef.current
    if (!activeDocument || exportState.kind === 'running') return
    if (modelExportBlocked) {
      setExportState({ kind: 'error', message: '请先恢复模型原材质，再导出模型' })
      return
    }
    if (selectedOnly && selectedIds.length === 0) return
    setExportState({
      kind: 'running',
      format: 'glb',
      label: selectedOnly ? '正在导出选中部件 GLB' : '正在导出完整模型 GLB',
      selectedOnly,
    })
    try {
      const result = await viewportRef.current?.exportGlb(activeDocument.file.name, selectedOnly)
      if (!result) throw new Error('视图尚未初始化')
      const stem = activeDocument.file.name.replace(/\.(?:d5a|glb)$/i, '')
      const outputStem = `${stem}${selectedOnly ? '-selection' : ''}`
      downloadBlob(result.glb, `${outputStem}.glb`)
      downloadBlob(
        new Blob([JSON.stringify(result.report, null, 2)], { type: 'application/json' }),
        `${outputStem}.fidelity.json`,
      )
      setExportState({
        kind: 'ready',
        format: 'glb',
        selectedOnly,
        bytes: result.glb.size,
        fidelity: result.report.status === 'pass' ? 'pass' : 'warning',
        file: new File([result.glb], `${outputStem}.glb`, { type: 'model/gltf-binary' }),
      })
    } catch (error) {
      setExportState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  const saveD5a = async (selectedOnly = false) => {
    const activeDocument = documentRef.current
    if (!activeDocument || exportState.kind === 'running') return
    if (modelExportBlocked) {
      setExportState({ kind: 'error', message: '请先恢复模型原材质，再导出模型' })
      return
    }
    if (selectedOnly && selectedIds.length === 0) return
    setExportState({
      kind: 'running',
      format: 'd5a',
      label: selectedOnly ? '正在写入选中部件 D5A' : '正在写入完整模型 D5A',
      selectedOnly,
    })
    try {
      const result = await viewportRef.current?.exportD5a(activeDocument.file.name, (label) => {
        setExportState({ kind: 'running', format: 'd5a', label, selectedOnly })
      }, selectedOnly)
      if (!result) throw new Error('视图尚未初始化')
      const stem = activeDocument.file.name.replace(/\.(?:d5a|glb)$/i, '')
      const outputStem = `${stem}${selectedOnly ? '-selection' : ''}`
      downloadBlob(result.d5a, `${outputStem}.d5a`)
      downloadBlob(
        new Blob([JSON.stringify(result.report, null, 2)], { type: 'application/json' }),
        `${outputStem}.d5a.fidelity.json`,
      )
      setExportState({
        kind: 'ready',
        format: 'd5a',
        selectedOnly,
        bytes: result.d5a.size,
        fidelity: result.report.status === 'pass' ? 'pass' : 'warning',
        file: new File([result.d5a], `${outputStem}.d5a`, { type: 'application/zip' }),
        timings: result.timings,
      })
    } catch (error) {
      setExportState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  const saveDxf = async (selectedOnly = false) => {
    const activeDocument = documentRef.current
    if (!activeDocument || exportState.kind === 'running') return
    if (modelExportBlocked) {
      setExportState({ kind: 'error', message: '请先恢复模型原材质，再导出模型' })
      return
    }
    if (selectedOnly && selectedIds.length === 0) return
    setExportState({
      kind: 'running',
      format: 'dxf',
      label: selectedOnly ? '正在写入选中部件 DXF' : '正在写入完整模型 DXF',
      selectedOnly,
    })
    try {
      const result = await viewportRef.current?.exportDxf(activeDocument.file.name, (label) => {
        setExportState({ kind: 'running', format: 'dxf', label, selectedOnly })
      }, selectedOnly)
      if (!result) throw new Error('视图尚未初始化')
      const stem = activeDocument.file.name.replace(/\.(?:d5a|glb)$/i, '')
      const outputStem = `${stem}${selectedOnly ? '-selection' : ''}`
      downloadBlob(result.output, `${outputStem}.dxf`)
      downloadBlob(
        new Blob([JSON.stringify(result.report, null, 2)], { type: 'application/json' }),
        `${outputStem}.dxf.fidelity.json`,
      )
      setExportState({
        kind: 'ready',
        format: 'dxf',
        selectedOnly,
        bytes: result.output.size,
        fidelity: result.report.status === 'pass' ? 'pass' : 'warning',
        file: new File([result.output], `${outputStem}.dxf`, { type: 'application/dxf' }),
      })
    } catch (error) {
      setExportState({ kind: 'error', message: normalizeError(error).message })
    }
  }

  const progress = loadState.kind === 'loading'
    ? Math.max(0, Math.min(1, loadState.total > 0 ? loadState.loaded / loadState.total : 0))
    : 0
  const gpuBytes =
    (modelResult?.model.geometryGpuBytes ?? document?.budget.geometryGpuBytes ?? 0) +
    (modelResult?.model.textureGpuBytes ?? 0)

  const newMaterial = () => {
    materialNonceRef.current += 1
    setMaterialRequest({ kind: 'new', nonce: materialNonceRef.current })
    setMaterialWorkspaceMounted(true)
    setWorkspaceMode('material')
  }

  const openMaterialWorkspace = () => {
    setMaterialWorkspaceMounted(true)
    setWorkspaceMode('material')
  }

  const openBatchWorkspace = () => {
    setBatchWorkspaceMounted(true)
    setWorkspaceMode('batch')
  }

  const applyMaterialToSelection = async (draft: D5mMaterialDraft, familyKey: string) => {
    const viewport = viewportRef.current
    if (!viewport) {
      setMaterialApplication({ kind: 'error', message: '模型视图尚未初始化' })
      return
    }
    materialApplicationAbortRef.current?.abort()
    const abort = new AbortController()
    materialApplicationAbortRef.current = abort
    const materialTitle = String(draft.material.title || '未命名材质')
    setExportState({ kind: 'idle' })
    setMaterialApplication({ kind: 'applying', materialTitle })
    try {
      const result = await viewport.applyD5mMaterialToSelection(draft, familyKey, abort.signal)
      if (abort.signal.aborted || materialApplicationAbortRef.current !== abort) return
      setMaterialApplication({ kind: 'active', materialTitle, result })
      setWorkspaceMode('model')
    } catch (error) {
      if (abort.signal.aborted) return
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMaterialApplication({ kind: 'idle' })
        return
      }
      setMaterialApplication({ kind: 'error', message: normalizeError(error).message })
    } finally {
      if (materialApplicationAbortRef.current === abort) materialApplicationAbortRef.current = undefined
    }
  }

  const restoreModelMaterial = () => {
    materialApplicationAbortRef.current?.abort()
    materialApplicationAbortRef.current = undefined
    viewportRef.current?.clearD5mMaterialPreview()
    setMaterialApplication({ kind: 'idle' })
  }

  const onD5mMaterialPreviewChange = (active: boolean) => {
    if (active) return
    setMaterialApplication((current) => current.kind === 'applying' ? current : { kind: 'idle' })
  }

  return (
    <div
      className={`app-shell material-mode ${dragging ? 'is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        beginFile(event.dataTransfer.files[0])
      }}
    >
      <header className="topbar">
        <div className="brand" aria-label="D5 Asset Studio">
          <span className="brand-mark"><Box size={18} strokeWidth={2.2} /></span>
          <strong>D5 Asset Studio</strong>
          <span className="version">0.2</span>
        </div>
        <div className="toolbar" role="toolbar" aria-label="素材工具">
          <button className="command primary" type="button" title="打开素材" aria-label="打开素材" onClick={() => inputRef.current?.click()}>
            <FolderOpen size={17} />
            <span>打开素材</span>
          </button>
          <div className="workspace-switcher" role="tablist" aria-label="工作区">
            <button className={workspaceMode === 'model' ? 'active' : ''} type="button" role="tab" aria-selected={workspaceMode === 'model'} onClick={() => setWorkspaceMode('model')}>模型</button>
            <button className={workspaceMode === 'material' ? 'active' : ''} type="button" role="tab" aria-selected={workspaceMode === 'material'} onClick={openMaterialWorkspace}>材质</button>
            <button className={workspaceMode === 'batch' ? 'active' : ''} type="button" role="tab" aria-selected={workspaceMode === 'batch'} onClick={openBatchWorkspace}>批处理</button>
          </div>
          {workspaceMode === 'material' ? (
            <button className="command secondary material-new-command" type="button" title="新建材质" aria-label="新建材质" onClick={newMaterial}>
              <Palette size={16} /><span>新建材质</span>
            </button>
          ) : workspaceMode === 'model' ? <>
            <span className="toolbar-divider" />
          <IconToggle
            label="显示网格"
            className="model-view-command"
            active={grid}
            disabled={!document}
            onClick={() => setGrid((value) => !value)}
          ><Grid3x3 size={18} /></IconToggle>
          <IconToggle
            label="线框模式"
            className="model-view-command"
            active={wireframe}
            disabled={!document}
            onClick={() => setWireframe((value) => !value)}
          ><ScanLine size={18} /></IconToggle>
          <IconToggle
            label="自动旋转"
            className="model-view-command"
            active={autoRotate}
            disabled={!document}
            onClick={() => setAutoRotate((value) => !value)}
          ><Rotate3d size={18} /></IconToggle>
          <IconButton label="适配视图" className="model-view-command" disabled={!document} onClick={() => viewportRef.current?.fit()}>
            <Focus size={18} />
          </IconButton>
          <IconButton label="保存截图" className="model-view-command" disabled={!document} onClick={() => void saveScreenshot()}>
            <Camera size={18} />
          </IconButton>
          <IconButton
            label={exportState.kind === 'running' && exportState.format === 'glb' ? exportState.label : '导出完整模型为 GLB'}
            className="export-format-button"
            disabled={!modelResult || exportState.kind === 'running' || modelExportBlocked}
            onClick={() => void saveGlb()}
          >
            {exportState.kind === 'running' && exportState.format === 'glb'
              ? <LoaderCircle className="spin" size={18} />
              : <Download size={18} />}
            <span>GLB</span>
          </IconButton>
          <IconButton
            label={exportState.kind === 'running' && exportState.format === 'd5a' ? exportState.label : '导出完整模型为 D5A'}
            className="export-format-button"
            disabled={!modelResult || exportState.kind === 'running' || modelExportBlocked}
            onClick={() => void saveD5a()}
          >
            {exportState.kind === 'running' && exportState.format === 'd5a'
              ? <LoaderCircle className="spin" size={18} />
              : <FileArchive size={18} />}
            <span>D5A</span>
          </IconButton>
          <IconButton
            label={exportState.kind === 'running' && exportState.format === 'dxf' ? exportState.label : '导出完整模型为 DXF'}
            className="export-format-button"
            disabled={!modelResult || exportState.kind === 'running' || modelExportBlocked}
            onClick={() => void saveDxf()}
          >
            {exportState.kind === 'running' && exportState.format === 'dxf'
              ? <LoaderCircle className="spin" size={18} />
              : <FileOutput size={18} />}
            <span>DXF</span>
          </IconButton>
          <button
            className={`icon-button model-view-command ${environmentOpen || environmentState.kind === 'ready' ? 'active' : ''}`}
            type="button"
            title="HDR 环境"
            aria-label="HDR 环境"
            aria-expanded={environmentOpen}
            onClick={() => setEnvironmentOpen((value) => !value)}
          >
            <SunMedium size={18} />
          </button>
          <label className="quality-select model-view-command" title="渲染质量">
            <span className="sr-only">渲染质量</span>
            <select value={pixelRatio} onChange={(event) => setPixelRatio(Number(event.target.value))}>
              <option value="0.75">节能</option>
              <option value="1">标准</option>
              <option value="1.5">清晰</option>
            </select>
          </label>
          <IconButton label="检查面板" className="inspector-trigger" onClick={() => setInspectorOpen((value) => !value)}>
            <PanelRight size={18} />
          </IconButton>
          </> : null}
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".d5a,.glb,.d5m,application/zip,model/gltf-binary"
          onChange={(event) => {
            beginFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <input
          ref={environmentInputRef}
          className="sr-only"
          type="file"
          accept=".hdr,image/vnd.radiance"
          onChange={(event) => {
            void loadEnvironment(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {workspaceMode === 'model' && environmentOpen && (
          <section className="environment-popover" aria-label="HDR 环境设置">
            <div className="environment-heading">
              <strong>HDR 环境</strong>
              <button type="button" aria-label="关闭 HDR 设置" onClick={() => setEnvironmentOpen(false)}>
                <X size={15} />
              </button>
            </div>
            <div className={`environment-file ${environmentState.kind}`} title={environmentLabel(environmentState)}>
              {environmentState.kind === 'loading' && <LoaderCircle className="spin" size={14} />}
              <span>{environmentLabel(environmentState)}</span>
            </div>
            <div className="environment-actions">
              <button className="command secondary" type="button" onClick={() => environmentInputRef.current?.click()}>
                <FolderOpen size={16} />
                <span>{environmentState.kind === 'ready' ? '替换 HDR' : '打开 HDR'}</span>
              </button>
              <button
                className="icon-button"
                type="button"
                title="清除 HDR"
                aria-label="清除 HDR"
                disabled={environmentState.kind === 'idle'}
                onClick={clearEnvironment}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <label className="environment-slider">
              <span>强度</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={environmentIntensity}
                aria-label="HDR 强度"
                onChange={(event) => setEnvironmentIntensity(Number(event.target.value))}
              />
              <input
                className="environment-number"
                type="number"
                min="0"
                max="3"
                step="0.05"
                value={environmentIntensity}
                aria-label="HDR 强度数值"
                onChange={(event) => setEnvironmentIntensity(clamp(Number(event.target.value), 0, 3))}
              />
            </label>
            <label className="environment-toggle">
              <input
                type="checkbox"
                checked={environmentBackground}
                onChange={(event) => setEnvironmentBackground(event.target.checked)}
              />
              <span>显示背景</span>
            </label>
          </section>
        )}
      </header>

      <div className="workspace-pane" hidden={workspaceMode !== 'model'}>
      <main className="workbench">
        <aside className="sidebar asset-panel" aria-label="素材信息">
          {document ? <AssetPanel document={document} modelResult={modelResult} /> : <EmptyAssetPanel />}
        </aside>

        <section className={`viewport-panel ${materialApplication.kind !== 'idle' ? 'has-material-preview' : ''}`} aria-label="模型视图">
          <Viewport
            ref={viewportRef}
            document={document}
            active={workspaceMode === 'model'}
            wireframe={wireframe}
            grid={grid}
            autoRotate={autoRotate}
            pixelRatio={pixelRatio}
            onProgress={onBuildProgress}
            onLoaded={onModelLoaded}
            onItems={setSceneItems}
            onIsolationChange={setIsolationActive}
            onD5mMaterialPreviewChange={onD5mMaterialPreviewChange}
            onStats={setStats}
            onError={onRenderError}
          />
          <ModelMaterialPreviewBar
            state={materialApplication}
            onEdit={openMaterialWorkspace}
            onRestore={restoreModelMaterial}
            onDismiss={() => setMaterialApplication({ kind: 'idle' })}
          />
          {!document && loadState.kind !== 'loading' && (
            <div className="empty-viewport">
              <FileArchive size={42} strokeWidth={1.35} />
              <h1>D5A / GLB 素材查看器</h1>
              <p>{loadState.kind === 'error' ? loadState.message : '未载入模型'}</p>
              <button className="command primary" type="button" onClick={() => inputRef.current?.click()}>
                <FolderOpen size={17} /> 打开模型
              </button>
            </div>
          )}
          {loadState.kind === 'loading' && (
            <div className="loading-overlay" aria-live="polite">
              <LoaderCircle className="spin" size={22} />
              <div className="loading-copy">
                <strong>{loadState.label}</strong>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="progress-track"><span style={{ width: `${progress * 100}%` }} /></div>
              <button className="text-button" type="button" onClick={() => loadAbortRef.current?.abort()}>取消</button>
            </div>
          )}
          {loadState.kind === 'error' && document && (
            <div className="toast error-toast" role="alert">
              <TriangleAlert size={17} />
              <span>{loadState.message}</span>
              <button type="button" aria-label="关闭错误" onClick={() => setLoadState({ kind: 'ready' })}><X size={16} /></button>
            </div>
          )}
          {exportState.kind === 'ready' && (
            <div className={`toast export-toast ${exportState.fidelity}`} role="status">
              <FileCheck2 size={17} />
              <span title={exportState.timings ? d5aTimingLabel(exportState.timings) : undefined}>
                {exportState.selectedOnly ? '选中部件 ' : '完整模型 '}{exportState.format.toUpperCase()} {formatBytes(exportState.bytes)}
                {exportState.timings ? ` · ${formatDuration(exportState.timings.totalMs)}` : ''}
                {' · '}{exportState.fidelity === 'pass' ? '保真检查通过' : '保真报告含警告'}
              </span>
              <ExportDownloadLink file={exportState.file} />
              {exportState.format !== 'dxf' && (
                <button
                  type="button"
                  title="打开导出结果"
                  aria-label="打开导出结果"
                  onClick={() => beginFile(exportState.file)}
                ><Eye size={16} /></button>
              )}
              <button type="button" aria-label="关闭导出状态" onClick={() => setExportState({ kind: 'idle' })}><X size={16} /></button>
            </div>
          )}
          {exportState.kind === 'error' && (
            <div className="toast error-toast" role="alert">
              <TriangleAlert size={17} />
              <span>{exportState.message}</span>
              <button type="button" aria-label="关闭导出错误" onClick={() => setExportState({ kind: 'idle' })}><X size={16} /></button>
            </div>
          )}
          {dragging && <div className="drop-overlay"><FileArchive size={35} /><strong>3D</strong></div>}
        </section>

        <aside className={`sidebar inspector-panel ${inspectorOpen ? 'is-open' : ''}`} aria-label="模型检查器">
          <div className="inspector-heading">
            <div className="segmented" role="tablist">
              <button className={tab === 'meshes' ? 'active' : ''} role="tab" type="button" onClick={() => setTab('meshes')}>
                网格 <span>{sceneItems.length}</span>
              </button>
              <button className={tab === 'materials' ? 'active' : ''} role="tab" type="button" onClick={() => setTab('materials')}>
                材质 <span>{materialViews.length}</span>
              </button>
            </div>
            <button className="mobile-close" type="button" aria-label="关闭检查面板" onClick={() => setInspectorOpen(false)}><X size={17} /></button>
          </div>
          <label className="filter-box">
            <Search size={15} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="筛选" />
          </label>
          <div className="selection-tools">
            <div className="selection-summary">
              <SelectionCheckbox
                label="选择当前筛选结果"
                checked={allTargetsSelected}
                indeterminate={someTargetsSelected}
                disabled={selectionTargetIds.length === 0}
                onChange={(checked) => viewportRef.current?.setObjectsSelected(selectionTargetIds, checked)}
              />
              <span>{selectedIds.length} / {sceneItems.length}</span>
              <button
                type="button"
                title="清空选择"
                aria-label="清空选择"
                disabled={selectedIds.length === 0}
                onClick={() => viewportRef.current?.clearSelection()}
              ><X size={15} /></button>
              <button
                type="button"
                title="显示全部网格"
                aria-label="显示全部网格"
                disabled={sceneItems.length === 0}
                onClick={() => viewportRef.current?.showAllObjects()}
              ><Eye size={15} /></button>
            </div>
            <div className="selection-actions" role="toolbar" aria-label="选中部件工具">
              <IconButton
                label="隐藏选中部件"
                disabled={selectedIds.length === 0}
                onClick={() => viewportRef.current?.setObjectsVisible(selectedIds, false)}
              ><EyeOff size={16} /></IconButton>
              <IconButton
                label="显示选中部件"
                disabled={selectedIds.length === 0}
                onClick={() => viewportRef.current?.setObjectsVisible(selectedIds, true)}
              ><Eye size={16} /></IconButton>
              <IconToggle
                label={isolationActive ? '恢复隔离前可见性' : '隔离选中部件'}
                active={isolationActive}
                disabled={selectedIds.length === 0 && !isolationActive}
                onClick={() => {
                  const isolated = viewportRef.current?.setIsolation(!isolationActive)
                  if (isolated) requestAnimationFrame(() => viewportRef.current?.fitSelection())
                }}
              ><Layers size={16} /></IconToggle>
              <IconButton
                label="适配选中部件"
                disabled={selectedIds.length === 0}
                onClick={() => viewportRef.current?.fitSelection()}
              ><Focus size={16} /></IconButton>
              <IconButton
                label="导出选中部件为 GLB"
                className="selection-export-button"
                disabled={selectedIds.length === 0 || exportState.kind === 'running' || modelExportBlocked}
                onClick={() => void saveGlb(true)}
              ><Download size={15} /><span>GLB</span></IconButton>
              <IconButton
                label="导出选中部件为 D5A"
                className="selection-export-button"
                disabled={selectedIds.length === 0 || exportState.kind === 'running' || modelExportBlocked}
                onClick={() => void saveD5a(true)}
              ><FileArchive size={15} /><span>D5A</span></IconButton>
              <IconButton
                label="导出选中部件为 DXF"
                className="selection-export-button"
                disabled={selectedIds.length === 0 || exportState.kind === 'running' || modelExportBlocked}
                onClick={() => void saveDxf(true)}
              ><FileOutput size={15} /><span>DXF</span></IconButton>
            </div>
          </div>
          <div className="inspector-list">
            {tab === 'meshes'
              ? filteredItems.slice(0, 250).map((item) => (
                  <MeshRow
                    key={item.id}
                    item={item}
                    onSelect={(selected) => viewportRef.current?.setObjectsSelected([item.id], selected)}
                    onToggle={() => viewportRef.current?.setObjectVisible(item.id, !item.visible)}
                  />
                ))
              : materials.slice(0, 250).map((material) => (
                  <MaterialRow
                    key={material.id}
                    material={material}
                    selectedCount={material.objectIds.filter((id) => selectedIdSet.has(id)).length}
                    onSelect={(selected) => viewportRef.current?.setObjectsSelected(material.objectIds, selected)}
                  />
                ))}
            {document && tab === 'meshes' && filteredItems.length === 0 && <PanelEmpty label="没有匹配的网格" />}
            {document && tab === 'materials' && materials.length === 0 && <PanelEmpty label="没有可用材质信息" />}
            {!document && <PanelEmpty label="等待模型" />}
          </div>
        </aside>
      </main>

      <footer className="statusbar">
        <span className={`status-dot ${loadState.kind}`} />
        <span>{document ? documentFormatLabel(document) : '就绪'}</span>
        <span className="status-separator" />
        <span>{formatCompact(modelResult?.model.triangleCount ?? 0)} 面</span>
        {selectedIds.length > 0 && <span>{selectedIds.length} 已选</span>}
        {materialApplication.kind === 'active' && <span>D5M 临时材质</span>}
        <span>{stats.calls} 绘制</span>
        <span>{stats.textures} 纹理</span>
        <span>{stats.frameMs.toFixed(1)} ms</span>
        <span className="status-spacer" />
        <span>GPU {formatBytes(gpuBytes)}</span>
      </footer>
      </div>

      {materialWorkspaceMounted && (
        <div className="workspace-pane" hidden={workspaceMode !== 'material'}>
          <Suspense fallback={<MaterialStudioLoading />}>
            <MaterialStudio
              request={materialRequest}
              active={workspaceMode === 'material'}
              applicationState={materialApplication}
              modelAvailable={Boolean(modelResult)}
              modelSelectionCount={selectedIds.length}
              onApplyToSelection={(draft, familyKey) => void applyMaterialToSelection(draft, familyKey)}
              onRequestOpen={() => inputRef.current?.click()}
            />
          </Suspense>
        </div>
      )}

      {batchWorkspaceMounted && (
        <div className="workspace-pane" hidden={workspaceMode !== 'batch'}>
          <Suspense fallback={<BatchWorkspaceLoading />}>
            <MaterialBatchWorkspace />
          </Suspense>
        </div>
      )}

      {pendingFile && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="large-title">
            <div className="dialog-icon"><TriangleAlert size={22} /></div>
            <div>
              <h2 id="large-title">高负载模型</h2>
              <p>{pendingFile.name}</p>
              <dl className="dialog-metrics"><div><dt>文件</dt><dd>{formatBytes(pendingFile.size)}</dd></div></dl>
            </div>
            <div className="dialog-actions">
              <button className="command secondary" type="button" onClick={() => setPendingFile(undefined)}>取消</button>
              <button className="command primary" type="button" onClick={() => void loadFile(pendingFile)}>继续加载</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MaterialStudioLoading() {
  return <>
    <main className="material-studio-loading">
      <LoaderCircle className="spin" size={24} />
      <span>加载材质制作器</span>
    </main>
    <footer className="statusbar"><span className="status-dot loading" /><span>准备 D5M 工作区</span></footer>
  </>
}

function BatchWorkspaceLoading() {
  return <>
    <main className="material-studio-loading">
      <LoaderCircle className="spin" size={24} />
      <span>加载 D5M 批处理</span>
    </main>
    <footer className="statusbar"><span className="status-dot loading" /><span>准备本地任务队列</span></footer>
  </>
}

function ModelMaterialPreviewBar({
  state,
  onEdit,
  onRestore,
  onDismiss,
}: {
  state: MaterialStudioApplicationState
  onEdit(): void
  onRestore(): void
  onDismiss(): void
}) {
  if (state.kind === 'idle') return null
  if (state.kind === 'applying') {
    return (
      <div className="model-material-preview-bar applying" role="status">
        <LoaderCircle className="spin" size={17} />
        <div><strong>正在应用 D5M 材质</strong><span>{state.materialTitle}</span></div>
        <button type="button" title="取消应用" aria-label="取消应用" onClick={onRestore}><X size={16} /></button>
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="model-material-preview-bar error" role="alert">
        <TriangleAlert size={17} />
        <div><strong>D5M 材质应用失败</strong><span>{state.message}</span></div>
        <button type="button" title="关闭" aria-label="关闭材质应用错误" onClick={onDismiss}><X size={16} /></button>
      </div>
    )
  }
  return (
    <div className="model-material-preview-bar active" role="status">
      <Palette size={17} />
      <div>
        <strong title={state.materialTitle}>{state.materialTitle}</strong>
        <span>{state.result.objectCount} 个部件 · {state.result.loadedTextureCount} 张纹理 · {state.result.mappedParameterCount}/{state.result.totalParameterCount} 参数</span>
      </div>
      <button type="button" title="返回材质工作区" aria-label="返回材质工作区" onClick={onEdit}><Palette size={16} /></button>
      <button type="button" title="恢复原材质" aria-label="恢复原材质" onClick={onRestore}><Undo2 size={16} /></button>
    </div>
  )
}

function AssetPanel({ document, modelResult }: { document: LoadedModelDocument; modelResult?: ViewportLoadResult }) {
  if (document.kind === 'glb') return <GlbAssetPanel document={document} modelResult={modelResult} />
  return <D5aAssetPanel document={document} modelResult={modelResult} />
}

function D5aAssetPanel({ document, modelResult }: { document: LoadedD5aDocument; modelResult?: ViewportLoadResult }) {
  const info = document.info
  const fallbackTriangles = document.bundles.reduce((total, bundle) => total + bundle.mesh.triangleCount, 0)
  const fallbackVertices = document.bundles.reduce((total, bundle) => total + bundle.mesh.vertexCount, 0)
  const fallbackDrawCalls = document.bundles.reduce(
    (total, bundle) => total + Math.max(bundle.mesh.descriptors.length, bundle.mesh.groups.length),
    0,
  )
  const versions = [...new Set(document.bundles.map((bundle) => bundle.mesh.version))]
  const versionLabel = versions.length > 0
    ? `D5Mesh ${versions.join('/')} ${document.bundles.length > 1 ? `× ${document.bundles.length}` : ''}`
    : 'FBX'
  return (
    <>
      <div className="asset-preview">
        {document.iconUrl ? <img src={document.iconUrl} alt="模型缩略图" /> : <Box size={34} />}
      </div>
      <div className="asset-title">
        <h2>{document.title}</h2>
        <span className={`variant-badge ${document.inspection.variant}`}>{variantLabel(document.inspection.variant)}</span>
      </div>
      <dl className="property-list">
        <Property label="文件" value={formatBytes(document.file.size)} />
        <Property label="解包" value={formatBytes(document.inspection.totalUncompressedBytes)} />
        <Property label="版本" value={versionLabel} />
        <Property label="三角面" value={formatNumber(modelResult?.model.triangleCount ?? fallbackTriangles)} />
        <Property label="顶点" value={formatNumber(modelResult?.model.vertexCount ?? fallbackVertices)} />
        <Property label="分组" value={formatNumber(modelResult?.model.drawCalls ?? fallbackDrawCalls)} />
        <Property label="解析" value={formatDuration(modelResult?.model.parseMs ?? document.parseMs)} />
        {info?.dimensions && (
          <Property
            label="尺寸"
            value={`${compactDecimal(info.dimensions.length)} × ${compactDecimal(info.dimensions.depth)} × ${compactDecimal(info.dimensions.height)}`}
          />
        )}
      </dl>
      <section className="panel-section">
        <h3>资源预算</h3>
        <div className="budget-grid">
          <BudgetValue label="CPU 几何" value={formatBytes(document.budget.geometryCpuBytes)} />
          <BudgetValue label="GPU 几何" value={formatBytes(modelResult?.model.geometryGpuBytes ?? document.budget.geometryGpuBytes)} />
          <BudgetValue label="源纹理" value={formatBytes(document.budget.textureSourceBytes)} />
          <BudgetValue label="GPU 纹理" value={formatBytes(modelResult?.model.textureGpuBytes ?? 0)} />
        </div>
      </section>
      {document.warnings.length > 0 && (
        <section className="panel-section warnings">
          <h3><TriangleAlert size={15} /> 注意</h3>
          {document.warnings.slice(0, 6).map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
        </section>
      )}
      <section className="panel-section archive-summary">
        <h3>容器</h3>
        <span>{document.inspection.entries.length} 个条目</span>
        <span>{modelResult?.model.declaredTextureCount ?? 0} 个声明纹理</span>
      </section>
    </>
  )
}

function GlbAssetPanel({ document, modelResult }: {
  document: Extract<LoadedModelDocument, { kind: 'glb' }>
  modelResult?: ViewportLoadResult
}) {
  return (
    <>
      <div className="asset-preview"><Box size={34} /></div>
      <div className="asset-title">
        <h2>{document.title}</h2>
        <span className="variant-badge glb">GLB 2.0</span>
      </div>
      <dl className="property-list">
        <Property label="文件" value={formatBytes(document.file.size)} />
        <Property label="格式" value="glTF Binary 2.0" />
        <Property label="三角面" value={formatNumber(modelResult?.model.triangleCount ?? 0)} />
        <Property label="顶点" value={formatNumber(modelResult?.model.vertexCount ?? 0)} />
        <Property label="网格" value={formatNumber(modelResult?.items.length ?? 0)} />
        <Property label="材质" value={formatNumber(modelResult?.materials.length ?? 0)} />
        <Property label="解析" value={formatDuration(modelResult?.model.parseMs ?? document.parseMs)} />
      </dl>
      <section className="panel-section">
        <h3>资源预算</h3>
        <div className="budget-grid">
          <BudgetValue label="源文件" value={formatBytes(document.file.size)} />
          <BudgetValue label="GPU 几何" value={formatBytes(modelResult?.model.geometryGpuBytes ?? 0)} />
          <BudgetValue label="纹理数量" value={formatNumber(modelResult?.model.textureCount ?? 0)} />
          <BudgetValue label="GPU 纹理" value={formatBytes(modelResult?.model.textureGpuBytes ?? 0)} />
        </div>
      </section>
      {document.warnings.length > 0 && (
        <section className="panel-section warnings">
          <h3><TriangleAlert size={15} /> 注意</h3>
          {document.warnings.slice(0, 6).map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
        </section>
      )}
      <section className="panel-section archive-summary">
        <h3>容器</h3>
        <span>二进制单文件</span>
        <span>{modelResult?.model.textureCount ?? 0} 张纹理</span>
      </section>
    </>
  )
}

function EmptyAssetPanel() {
  return (
    <div className="panel-empty tall">
      <Info size={20} />
      <span>素材信息</span>
    </div>
  )
}

function MeshRow({ item, onSelect, onToggle }: {
  item: SceneItem
  onSelect(selected: boolean): void
  onToggle(): void
}) {
  return (
    <div className={`mesh-row ${item.visible ? '' : 'is-hidden'} ${item.selected ? 'is-selected' : ''}`}>
      <input
        type="checkbox"
        aria-label={`选择网格 ${item.name}`}
        checked={item.selected}
        onChange={(event) => onSelect(event.target.checked)}
      />
      <Layers size={16} />
      <div><strong>{item.name}</strong><span>{item.material} · {formatCompact(item.triangles)} 面</span></div>
      <button type="button" aria-label={item.visible ? '隐藏网格' : '显示网格'} title={item.visible ? '隐藏网格' : '显示网格'} onClick={onToggle}>
        {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  )
}

function MaterialRow({ material, selectedCount, onSelect }: {
  material: MaterialView
  selectedCount: number
  onSelect(selected: boolean): void
}) {
  const checked = material.objectIds.length > 0 && selectedCount === material.objectIds.length
  const indeterminate = selectedCount > 0 && !checked
  return (
    <div className={`material-row ${selectedCount > 0 ? 'is-selected' : ''}`}>
      <SelectionCheckbox
        label={`选择材质 ${material.title} 引用的网格`}
        checked={checked}
        indeterminate={indeterminate}
        disabled={material.objectIds.length === 0}
        onChange={onSelect}
      />
      <span className="swatch" style={{ backgroundColor: material.color }} />
      <div><strong>{material.title}</strong><span>{material.textured ? '贴图材质' : '参数材质'}</span></div>
      <span className="row-index">{material.index + 1}</span>
    </div>
  )
}

function SelectionCheckbox({ label, checked, indeterminate, disabled, onChange }: {
  label: string
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  onChange(checked: boolean): void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      title={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

function Property({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function BudgetValue({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function PanelEmpty({ label }: { label: string }) {
  return <div className="panel-empty"><Layers size={19} /><span>{label}</span></div>
}

function IconButton({
  label,
  disabled,
  className = '',
  onClick,
  children,
}: React.PropsWithChildren<{ label: string; disabled?: boolean; className?: string; onClick(): void }>) {
  return <button className={`icon-button ${className}`} type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>
}

function ExportDownloadLink({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <a
      aria-label="下载导出结果"
      aria-disabled={!url}
      download={file.name}
      href={url || undefined}
      title="下载导出结果"
    ><Download size={16} /></a>
  )
}

function IconToggle({
  label,
  active,
  disabled,
  className = '',
  onClick,
  children,
}: React.PropsWithChildren<{ label: string; active: boolean; disabled?: boolean; className?: string; onClick(): void }>) {
  return <button className={`icon-button ${className} ${active ? 'active' : ''}`} type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>
}

function progressState(progress: LoadProgress): LoadState {
  return { kind: 'loading', label: progress.label, loaded: progress.loaded, total: progress.total }
}

function cliSceneUrl(): string | undefined {
  const page = new URL(window.location.href)
  const requested = page.searchParams.get('scene')
  if (!requested) return undefined
  const source = new URL(requested, window.location.origin)
  if (source.origin !== window.location.origin || source.pathname !== '/api/scene-file') return undefined
  return source.toString()
}

function filenameFromSceneResponse(response: Response): string {
  const value = response.headers.get('x-d5-scene-filename')
  if (!value) return 'scene.d5a'
  try {
    const filename = decodeURIComponent(value)
    return filename && !/[\\/]/.test(filename) ? filename : 'scene.d5a'
  } catch {
    return 'scene.d5a'
  }
}

function variantLabel(variant: LoadedD5aDocument['inspection']['variant']): string {
  if (variant === 'd5mesh') return '现代 D5Mesh'
  if (variant === 'legacy-fbx') return '旧版 FBX'
  if (variant === 'encrypted') return '加密容器'
  return '未知格式'
}

function documentFormatLabel(document: LoadedModelDocument): string {
  return document.kind === 'glb' ? 'GLB 2.0' : variantLabel(document.inspection.variant)
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** order).toFixed(order === 0 ? 0 : 1)} ${units[order]}`
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('zh-CN')
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function compactDecimal(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

function formatDuration(value?: number): string {
  if (value == null) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(1)} ms`
}

function d5aTimingLabel(timings: D5aExportTimings): string {
  return [
    `场景检查 ${formatDuration(timings.sourceInspectMs)}`,
    `D5Mesh 编译 ${formatDuration(timings.compileMs)}`,
    `纹理编码 ${formatDuration(timings.textureEncodeMs)}`,
    `ZIP 写入 ${formatDuration(timings.zipWriteMs)}`,
    `回读检查 ${formatDuration(timings.roundTripMs)}`,
    `总计 ${formatDuration(timings.totalMs)}`,
  ].join(' · ')
}

function rgb(color: [number, number, number, number]): string {
  return `rgb(${color.slice(0, 3).map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255)).join(' ')})`
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function environmentLabel(state: EnvironmentState): string {
  if (state.kind === 'idle') return '未加载'
  if (state.kind === 'loading') return state.name
  if (state.kind === 'ready') return state.name
  return state.message
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
