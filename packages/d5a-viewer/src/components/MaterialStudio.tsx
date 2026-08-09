import {
  Box,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Info,
  LoaderCircle,
  Package,
  Paintbrush,
  Rotate3d,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadD5mDocument, type LoadedD5mDocument } from '../d5m/document'
import { canonicalD5mPath } from '../d5m/archive'
import type { D5mFidelityReport } from '../d5m/fidelity'
import { describeD5mPreview } from '../d5m/material-runtime'
import {
  parseD5mColor,
  parseD5mScalar,
  updateD5mColor,
  updateD5mScalar,
} from '../d5m/parameters'
import { resolveD5mDraftResource } from '../d5m/resources'
import {
  clearDraftTexture,
  createDraftFromTemplate,
  loadD5mTemplateRegistry,
  mostObservedD5mProfile,
  setDraftTexture,
  type D5mTemplateRegistry,
} from '../d5m/templates'
import { createD5mBlobArtifact } from '../d5m/tasks'
import type { D5mMaterialParameter } from '../d5m/types'
import { createD5mDraft, type D5mMaterialDraft } from '../d5m/writer'
import type { D5mModelMaterialPreviewResult } from '../render/viewport-controller'
import {
  MaterialPreview,
  type MaterialPreviewDiagnostics,
  type MaterialPreviewShape,
} from './MaterialPreview'

export type MaterialStudioRequest =
  | { kind: 'new'; nonce: number }
  | { kind: 'file'; file: File; nonce: number }

export type MaterialStudioApplicationState =
  | { kind: 'idle' }
  | { kind: 'applying'; materialTitle: string }
  | { kind: 'active'; materialTitle: string; result: D5mModelMaterialPreviewResult }
  | { kind: 'error'; message: string }

type StudioState =
  | { kind: 'idle'; label: string }
  | { kind: 'loading'; label: string; loaded: number; total: number }
  | { kind: 'ready'; label: string }
  | { kind: 'error'; label: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; label: string; completed: number; total: number }
  | { kind: 'ready'; file: File; report: D5mFidelityReport; writeMs: number; entryCount: number }
  | { kind: 'error'; message: string }

export default function MaterialStudio({
  request,
  active,
  applicationState,
  modelAvailable,
  modelSelectionCount,
  onApplyToSelection,
  onRequestOpen,
}: {
  request: MaterialStudioRequest
  active: boolean
  applicationState: MaterialStudioApplicationState
  modelAvailable: boolean
  modelSelectionCount: number
  onApplyToSelection(draft: D5mMaterialDraft, familyKey: string): void
  onRequestOpen: () => void
}) {
  const [registry, setRegistry] = useState<D5mTemplateRegistry>()
  const [draft, setDraft] = useState<D5mMaterialDraft>()
  const [studioState, setStudioState] = useState<StudioState>({ kind: 'idle', label: '准备材质制式' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [baseProfileId, setBaseProfileId] = useState('')
  const [shape, setShape] = useState<MaterialPreviewShape>('sphere')
  const [autoRotate, setAutoRotate] = useState(false)
  const [parameterFilter, setParameterFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [previewDiagnostics, setPreviewDiagnostics] = useState<MaterialPreviewDiagnostics>()
  const [iconUrl, setIconUrl] = useState('')
  const [mobilePanel, setMobilePanel] = useState<'templates' | 'preview' | 'parameters'>('preview')
  const documentRef = useRef<LoadedD5mDocument | undefined>(undefined)
  const loadAbortRef = useRef<AbortController | undefined>(undefined)
  const saveAbortRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    const abort = new AbortController()
    setStudioState({ kind: 'loading', label: '加载 272 个材质制式', loaded: 0, total: 1 })
    void loadD5mTemplateRegistry(abort.signal)
      .then((loaded) => {
        if (abort.signal.aborted) return
        setRegistry(loaded)
        setStudioState({ kind: 'ready', label: `${loaded.familyCount} 个材质族 / ${loaded.profileCount} 个制式` })
      })
      .catch((error) => {
        if (!abort.signal.aborted) setStudioState({ kind: 'error', label: normalizeError(error) })
      })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!registry) return
    loadAbortRef.current?.abort()
    const abort = new AbortController()
    loadAbortRef.current = abort
    setSaveState({ kind: 'idle' })
    setPreviewDiagnostics(undefined)
    setParameterFilter('')
    setGroupFilter('')
    if (request.kind === 'new') {
      const family = registry.families.find((candidate) => candidate.key === 'standard-surface') ?? registry.families[0]
      const profile = family ? mostObservedD5mProfile(registry, family.id) : undefined
      if (!family || !profile) {
        setStudioState({ kind: 'error', label: '制式注册表没有可用模板' })
        return
      }
      void replaceDocument(undefined)
      setSelectedFamilyId(family.id)
      setSelectedProfileId(profile.id)
      setBaseProfileId(profile.id)
      setDraft(createDraftFromTemplate(profile))
      setShape(defaultShape(family.key))
      setStudioState({ kind: 'ready', label: `已从 ${family.label} / ${profile.label} 新建材质` })
      return () => abort.abort()
    }

    setStudioState({ kind: 'loading', label: '检查 D5M 容器', loaded: 0, total: request.file.size })
    void loadD5mDocument(request.file, {
      signal: abort.signal,
      onProgress: (progress) => setStudioState({
        kind: 'loading',
        label: progress.label,
        loaded: progress.loaded,
        total: progress.total,
      }),
    }).then(async (document) => {
      if (abort.signal.aborted) {
        await document.close()
        return
      }
      await replaceDocument(document)
      const family = registry.families.find((candidate) => candidate.id === document.profile.familyId)
      const profile = registry.profiles.find((candidate) => candidate.id === document.profile.profileId)
      const fallbackProfile = family ? mostObservedD5mProfile(registry, family.id) : undefined
      setSelectedFamilyId(family?.id ?? registry.families[0]?.id ?? '')
      setSelectedProfileId(profile?.id ?? fallbackProfile?.id ?? '')
      setBaseProfileId(profile?.id ?? '')
      setDraft(createD5mDraft(document))
      setShape(defaultShape(family?.key ?? 'standard-surface'))
      setStudioState({
        kind: 'ready',
        label: profile
          ? `已识别 ${family?.label ?? '材质'} / ${profile.label}`
          : `已读取 D5M；当前参数签名不在 272 个已观察制式中`,
      })
      void loadIcon(document)
    }).catch((error) => {
      if (!abort.signal.aborted) setStudioState({ kind: 'error', label: normalizeError(error) })
    })
    return () => abort.abort()
  }, [registry, request])

  useEffect(() => () => {
    loadAbortRef.current?.abort()
    saveAbortRef.current?.abort()
    void documentRef.current?.close()
  }, [])

  useEffect(() => () => {
    if (iconUrl) URL.revokeObjectURL(iconUrl)
  }, [iconUrl])

  const selectedFamily = registry?.families.find((family) => family.id === selectedFamilyId)
  const familyProfiles = useMemo(
    () => registry?.profiles
      .filter((profile) => profile.familyId === selectedFamilyId)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)) ?? [],
    [registry, selectedFamilyId],
  )
  const selectedProfile = registry?.profiles.find((profile) => profile.id === selectedProfileId)
  const activeFamily = registry?.families.find((family) => family.profileIds.includes(baseProfileId)) ??
    registry?.families.find((family) => family.id === documentRef.current?.profile.familyId) ??
    selectedFamily
  const activeProfile = registry?.profiles.find((profile) => profile.id === baseProfileId)
  const previewDescription = useMemo(
    () => draft ? describeD5mPreview(draft.parameters, activeFamily?.key ?? 'standard-surface') : undefined,
    [draft?.parameters, activeFamily?.key],
  )
  const groups = useMemo(() => draft
    ? [...new Set(draft.parameters.map((parameter) => parameter.group || '未分组'))].sort((a, b) => a.localeCompare(b))
    : [], [draft])
  const filteredParameters = useMemo(() => {
    if (!draft) return []
    const query = parameterFilter.trim().toLowerCase()
    return draft.parameters
      .map((parameter, index) => ({ parameter, index }))
      .filter(({ parameter }) => (!groupFilter || (parameter.group || '未分组') === groupFilter) &&
        (!query || `${parameter.name} ${parameter.group ?? ''} ${parameter.value}`.toLowerCase().includes(query)))
  }, [draft, groupFilter, parameterFilter])
  const parameterGroups = useMemo(() => {
    const grouped = new Map<string, Array<{ parameter: D5mMaterialParameter; index: number }>>()
    for (const item of filteredParameters) {
      const group = item.parameter.group || '未分组'
      const entries = grouped.get(group)
      if (entries) entries.push(item)
      else grouped.set(group, [item])
    }
    return [...grouped.entries()]
  }, [filteredParameters])
  const textureCount = draft?.parameters.filter((parameter) => parameter.type === 3 && parameter.value).length ?? 0

  const replaceDocument = async (next?: LoadedD5mDocument) => {
    const previous = documentRef.current
    documentRef.current = next
    if (iconUrl) {
      URL.revokeObjectURL(iconUrl)
      setIconUrl('')
    }
    if (previous && previous !== next) await previous.close().catch(() => undefined)
  }

  const loadIcon = async (document: LoadedD5mDocument) => {
    const path = document.inspection.iconEntry
    if (!path) return
    try {
      const blob = await document.archive.blob(path)
      if (documentRef.current !== document) return
      setIconUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return URL.createObjectURL(blob)
      })
    } catch {
      // The icon is optional; material data remains usable when it is malformed.
    }
  }

  const useSelectedTemplate = () => {
    if (!selectedProfile || !selectedFamily) return
    loadAbortRef.current?.abort()
    void replaceDocument(undefined)
    setDraft(createDraftFromTemplate(selectedProfile))
    setBaseProfileId(selectedProfile.id)
    setShape(defaultShape(selectedFamily.key))
    setSaveState({ kind: 'idle' })
    setStudioState({ kind: 'ready', label: `已从 ${selectedFamily.label} / ${selectedProfile.label} 新建材质` })
  }

  const selectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId)
    const profile = registry ? mostObservedD5mProfile(registry, familyId) : undefined
    setSelectedProfileId(profile?.id ?? '')
  }

  const updateDraft = (mutator: (next: D5mMaterialDraft) => void) => {
    setDraft((current) => {
      if (!current) return current
      const next = cloneDraft(current)
      mutator(next)
      next.material.updateTime = Date.now()
      return next
    })
    setSaveState({ kind: 'idle' })
  }

  const save = async () => {
    if (!draft || saveState.kind === 'saving') return
    saveAbortRef.current?.abort()
    const abort = new AbortController()
    saveAbortRef.current = abort
    setSaveState({ kind: 'saving', label: '写入 D5M', completed: 0, total: 1 })
    try {
      const filename = `${safeFilename(String(draft.material.title || '新建材质'))}.d5m`
      const artifact = await createD5mBlobArtifact(draft, filename, {
        signal: abort.signal,
        onEvent: (event) => {
          if (event.type !== 'started' && event.type !== 'progress') return
          setSaveState({
            kind: 'saving',
            label: event.message,
            completed: event.completed ?? 0,
            total: event.total ?? 1,
          })
        },
      })
      downloadBlob(artifact.write.blob, filename)
      downloadBlob(
        new Blob([JSON.stringify(artifact.report, null, 2)], { type: 'application/json' }),
        `${filename}.fidelity.json`,
      )
      setSaveState({
        kind: 'ready',
        file: artifact.file,
        report: artifact.report,
        writeMs: artifact.write.elapsedMs,
        entryCount: artifact.write.entryCount,
      })
    } catch (error) {
      if (!abort.signal.aborted) setSaveState({ kind: 'error', message: normalizeError(error) })
    }
  }

  const reopenSaved = async () => {
    if (saveState.kind !== 'ready' || !registry) return
    const file = saveState.file
    setStudioState({ kind: 'loading', label: '打开写出结果', loaded: 0, total: file.size })
    try {
      const document = await loadD5mDocument(file)
      await replaceDocument(document)
      const family = registry.families.find((candidate) => candidate.id === document.profile.familyId)
      const profile = registry.profiles.find((candidate) => candidate.id === document.profile.profileId)
      setDraft(createD5mDraft(document))
      setSelectedFamilyId(family?.id ?? selectedFamilyId)
      setSelectedProfileId(profile?.id ?? selectedProfileId)
      setBaseProfileId(profile?.id ?? '')
      setSaveState({ kind: 'idle' })
      setStudioState({ kind: 'ready', label: `已载入写出结果 ${file.name}` })
      void loadIcon(document)
    } catch (error) {
      setStudioState({ kind: 'error', label: normalizeError(error) })
    }
  }

  const progress = studioState.kind === 'loading' && studioState.total > 0
    ? Math.min(1, studioState.loaded / studioState.total)
    : saveState.kind === 'saving' && saveState.total > 0
      ? Math.min(1, saveState.completed / saveState.total)
      : 0
  const statusKind = studioState.kind === 'error' || saveState.kind === 'error' || applicationState.kind === 'error'
    ? 'error'
    : studioState.kind === 'loading' || saveState.kind === 'saving' || applicationState.kind === 'applying'
      ? 'loading'
      : draft
        ? 'ready'
        : 'idle'

  return (
    <Fragment>
      <main className="material-studio">
        <nav className="material-mobile-tabs" aria-label="材质工作区页面">
          <button className={mobilePanel === 'parameters' ? 'active' : ''} type="button" onClick={() => setMobilePanel('parameters')}>参数</button>
          <button className={mobilePanel === 'preview' ? 'active' : ''} type="button" onClick={() => setMobilePanel('preview')}>预览</button>
          <button className={mobilePanel === 'templates' ? 'active' : ''} type="button" onClick={() => setMobilePanel('templates')}>模板</button>
        </nav>

        <aside className={`material-templates ${mobilePanel === 'templates' ? 'mobile-active' : ''}`} aria-label="D5M 材质制式">
          <section className="material-template-library" aria-labelledby="material-template-heading">
            <div className="material-template-library-heading">
              <div><Paintbrush size={15} /><strong id="material-template-heading">材质模板</strong></div>
              <span>D5M</span>
            </div>
            <div className="material-template-library-subheading">
              <span>可用模板</span>
              <span>{registry?.familyCount ?? 0} 类</span>
            </div>
            <div className="material-template-list" role="listbox" aria-label="材质模板列表">
              {registry?.families.map((family) => (
                <button
                  key={family.id}
                  className={`material-template-item ${selectedFamilyId === family.id ? 'active' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={selectedFamilyId === family.id}
                  onClick={() => selectFamily(family.id)}
                >
                  <span className="material-template-glyph"><TemplateFamilyGlyph familyKey={family.key} /></span>
                  <span className="material-template-copy">
                    <strong>{family.label}</strong>
                    <small>{family.description}</small>
                  </span>
                  <span className="material-template-count" title={`${family.profileCount} 个已观察制式`}>{family.profileCount}</span>
                </button>
              ))}
              {!registry && <div className="material-template-pending"><LoaderCircle className="spin" size={16} /> 正在读取模板</div>}
            </div>
          </section>

          <details className="material-template-selection" open>
            <summary>
              <div className="material-template-selection-title">
                <span className={`material-family-state ${selectedFamily?.status ?? 'provisional'}`} aria-hidden="true" />
                <span>
                  <small>{selectedFamily?.status === 'confirmed' ? '已确认制式' : '待确认制式'}</small>
                  <strong>{selectedFamily?.label ?? '选择材质模板'}</strong>
                </span>
              </div>
              <ChevronDown className="material-template-chevron" size={16} aria-hidden="true" />
            </summary>
            <p className="material-template-description">{selectedFamily?.description ?? '从左侧选择要创建或替换的 D5 材质模板。'}</p>
            <label className="material-field">
              <span>模板变体</span>
              <select value={selectedProfileId} disabled={familyProfiles.length === 0} onChange={(event) => setSelectedProfileId(event.target.value)}>
                {familyProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label} · {profile.parameterCount} 参数 · {profile.count} 样本
                  </option>
                ))}
              </select>
            </label>
            <div className="material-template-metrics">
              <span>{selectedProfile?.parameterCount ?? 0} 参数</span>
              <span>{selectedFamily?.textureSlots.length ?? 0} 纹理槽</span>
              <span>{selectedProfile?.count ?? 0} 样本</span>
            </div>
            <button className="command primary material-create-button" type="button" disabled={!selectedProfile} onClick={useSelectedTemplate}>
              <FilePlus2 size={16} /> 以该模板新建
            </button>
          </details>

          <details className="material-current-summary">
            <summary>
              <div className="material-asset-hero">
                <div className="material-icon-preview">
                  {iconUrl ? <img src={iconUrl} alt="材质缩略图" /> : <Package size={25} strokeWidth={1.4} />}
                </div>
                <div>
                  <span className="material-current-label">当前材质</span>
                  <strong title={String(draft?.material.title ?? '')}>{String(draft?.material.title ?? 'D5M 材质')}</strong>
                  <small>{activeFamily?.label ?? '等待材质数据'}</small>
                </div>
              </div>
              <ChevronDown className="material-summary-chevron" size={16} aria-hidden="true" />
            </summary>
            <dl className="material-facts">
              <div><dt>制式</dt><dd title={baseProfileId}>{activeProfile?.label ?? '自定义签名'}</dd></div>
              <div><dt>参数</dt><dd>{draft?.parameters.length ?? 0}</dd></div>
              <div><dt>纹理</dt><dd>{textureCount}</dd></div>
              <div><dt>编码</dt><dd>{draft ? `${draft.encoding}${draft.bom ? ' BOM' : ''}` : '-'}</dd></div>
              <div><dt>结构</dt><dd>{draft?.matInfoStorage ?? '-'}</dd></div>
              <div><dt>来源</dt><dd>{draft?.source ? '现有 D5M' : '制式模板'}</dd></div>
            </dl>
          </details>

          <div className="material-primary-actions">
            <button className="command secondary" type="button" onClick={onRequestOpen}>
              <FolderOpen size={16} /> 打开 D5M
            </button>
            <button className="command primary" type="button" disabled={!draft || saveState.kind === 'saving'} onClick={() => void save()}>
              {saveState.kind === 'saving' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              保存 D5M
            </button>
          </div>
          <button
            className="command secondary material-model-apply"
            type="button"
            disabled={!draft || !modelAvailable || modelSelectionCount === 0 || applicationState.kind === 'applying'}
            title={!modelAvailable ? '未载入模型' : modelSelectionCount === 0 ? '模型中没有选中部件' : '在选中模型部件上临时预览当前材质'}
            onClick={() => {
              if (draft) onApplyToSelection(draft, activeFamily?.key ?? 'standard-surface')
            }}
          >
            {applicationState.kind === 'applying' ? <LoaderCircle className="spin" size={16} /> : <Paintbrush size={16} />}
            {modelSelectionCount > 0 ? `应用到 ${modelSelectionCount} 个部件` : '应用到选中部件'}
          </button>
        </aside>

        <section className={`material-preview-panel ${mobilePanel === 'preview' ? 'mobile-active' : ''}`} aria-label="材质预览">
          <div className="material-preview-toolbar">
            <div className="material-shape-control" role="tablist" aria-label="预览几何">
              <PreviewShapeButton label="球体" active={shape === 'sphere'} onClick={() => setShape('sphere')}><Circle size={17} /></PreviewShapeButton>
              <PreviewShapeButton label="立方体" active={shape === 'cube'} onClick={() => setShape('cube')}><Box size={17} /></PreviewShapeButton>
              <PreviewShapeButton label="平面" active={shape === 'plane'} onClick={() => setShape('plane')}><Square size={17} /></PreviewShapeButton>
            </div>
            <button className={`icon-button ${autoRotate ? 'active' : ''}`} type="button" title="自动旋转" aria-label="自动旋转" aria-pressed={autoRotate} onClick={() => setAutoRotate((value) => !value)}>
              <Rotate3d size={18} />
            </button>
            <span className="material-preview-title">{activeFamily?.label ?? '材质预览'}</span>
          </div>
          {draft ? (
            <MaterialPreview
              draft={draft}
              familyKey={activeFamily?.key ?? 'standard-surface'}
              shape={shape}
              autoRotate={autoRotate}
              active={active}
              onDiagnostics={setPreviewDiagnostics}
            />
          ) : (
            <div className="material-preview-empty"><Package size={38} /><span>等待 D5M 材质</span></div>
          )}
          {previewDiagnostics && (
            <div className="material-preview-diagnostics">
              <span>{previewDiagnostics.mappedParameters}/{previewDiagnostics.totalParameters} 参数参与预览</span>
              <span>{previewDiagnostics.loadedTextures} 张纹理已加载</span>
              {previewDiagnostics.errors.length > 0 && <strong title={previewDiagnostics.errors.join('；')}>{previewDiagnostics.errors.length} 项纹理诊断</strong>}
            </div>
          )}
          {previewDiagnostics && (previewDiagnostics.notices.length > 0 || previewDiagnostics.errors.length > 0) && (
            <div className="material-preview-notices">
              {(previewDiagnostics.errors.length > 0 ? previewDiagnostics.errors : previewDiagnostics.notices).slice(0, 2).map((notice) => (
                <span key={notice}><Info size={13} />{notice}</span>
              ))}
            </div>
          )}
          {(studioState.kind === 'loading' || saveState.kind === 'saving') && (
            <div className="loading-overlay material-loading" aria-live="polite">
              <LoaderCircle className="spin" size={22} />
              <div className="loading-copy">
                <strong>{saveState.kind === 'saving' ? saveState.label : studioState.label}</strong>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="progress-track"><span style={{ width: `${progress * 100}%` }} /></div>
              <button className="text-button" type="button" onClick={() => {
                loadAbortRef.current?.abort()
                saveAbortRef.current?.abort()
              }}>取消</button>
            </div>
          )}
          {(studioState.kind === 'error' || saveState.kind === 'error') && (
            <div className="toast error-toast material-toast" role="alert">
              <TriangleAlert size={17} />
              <span>{saveState.kind === 'error' ? saveState.message : studioState.label}</span>
              <button type="button" aria-label="关闭错误" onClick={() => {
                if (saveState.kind === 'error') setSaveState({ kind: 'idle' })
                if (studioState.kind === 'error') setStudioState({ kind: draft ? 'ready' : 'idle', label: draft ? '材质可编辑' : '等待材质' })
              }}>×</button>
            </div>
          )}
          {saveState.kind === 'ready' && (
            <div className={`toast export-toast material-toast ${saveState.report.status}`} role="status">
              <CheckCircle2 size={17} />
              <span>{formatBytes(saveState.file.size)} · {saveState.entryCount} 项 · 写入 {formatDuration(saveState.writeMs)} · 往返门禁通过</span>
              <button type="button" title="再次下载 D5M" aria-label="再次下载 D5M" onClick={() => downloadBlob(saveState.file, saveState.file.name)}><Save size={16} /></button>
              <button type="button" title="打开写出结果" aria-label="打开写出结果" onClick={() => void reopenSaved()}><Eye size={16} /></button>
              <button type="button" aria-label="关闭保存状态" onClick={() => setSaveState({ kind: 'idle' })}>×</button>
            </div>
          )}
        </section>

        <aside className={`material-parameters ${mobilePanel === 'parameters' ? 'mobile-active' : ''}`} aria-label="材质参数">
          <div className="material-parameter-header">
            <div className="material-section-heading"><div><SlidersHorizontal size={15} /><strong>材质参数</strong></div><span>{filteredParameters.length}</span></div>
            <label className="material-title-field">
              <span>名称</span>
              <input
                value={String(draft?.material.title ?? '')}
                disabled={!draft}
                onChange={(event) => updateDraft((next) => {
                  next.material.title = event.target.value
                  next.summary = event.target.value
                })}
              />
            </label>
            <div className="material-group-tabs" role="tablist" aria-label="参数分组">
              <button type="button" className={!groupFilter ? 'active' : ''} role="tab" aria-selected={!groupFilter} onClick={() => setGroupFilter('')}>全部 <span>{draft?.parameters.length ?? 0}</span></button>
              {groups.map((group) => (
                <button key={group} type="button" className={groupFilter === group ? 'active' : ''} role="tab" aria-selected={groupFilter === group} onClick={() => setGroupFilter(group)}>{group}</button>
              ))}
            </div>
            <label className="material-parameter-search">
              <Search size={15} />
              <input value={parameterFilter} placeholder="筛选名称、分组或值" onChange={(event) => setParameterFilter(event.target.value)} />
            </label>
          </div>
          <div className="material-parameter-list">
            {parameterGroups.map(([group, parameters]) => (
              <section className="material-parameter-group" key={group}>
                <div className="material-parameter-group-heading"><strong>{group}</strong><span>{parameters.length}</span></div>
                {parameters.map(({ parameter, index }) => (
                  <ParameterEditor
                    key={`${index}-${parameter.name}`}
                    draft={draft!}
                    parameter={parameter}
                    index={index}
                    mapped={previewDescription?.mappedParameterIndices.has(index) ?? false}
                    onRawChange={(value) => updateDraft((next) => {
                      const target = next.parameters[index]!
                      if (target.type === 3 && target.value !== value) clearDraftTexture(next, index)
                      next.parameters[index]!.value = value
                    })}
                    onScalarChange={(value) => updateDraft((next) => {
                      const target = next.parameters[index]!
                      target.value = updateD5mScalar(target.value, value)
                    })}
                    onColorChange={(color) => updateDraft((next) => {
                      const target = next.parameters[index]!
                      target.value = updateD5mColor(target.value, color)
                    })}
                    onTexture={(file) => updateDraft((next) => { setDraftTexture(next, index, file) })}
                    onClearTexture={() => updateDraft((next) => { clearDraftTexture(next, index) })}
                  />
                ))}
              </section>
            ))}
            {draft && filteredParameters.length === 0 && <div className="material-parameter-empty">没有匹配参数</div>}
          </div>
        </aside>
      </main>
      <footer className="statusbar material-statusbar">
        <span className={`status-dot ${statusKind}`} />
        <span>{applicationState.kind === 'error'
          ? applicationState.message
          : applicationState.kind === 'applying'
            ? '正在应用到模型部件'
            : saveState.kind === 'ready'
              ? 'D5M 往返门禁通过'
              : studioState.label}</span>
        <span className="status-separator" />
        <span>{activeFamily?.label ?? 'D5M'}</span>
        <span>{draft?.parameters.length ?? 0} 参数</span>
        <span>{textureCount} 纹理</span>
        {applicationState.kind === 'active' && <span>模型预览 {applicationState.result.objectCount} 部件</span>}
        <span className="status-spacer" />
        <span>{registry ? `${registry.observedMaterialCount.toLocaleString()} 份语料 / ${registry.profileCount} 制式` : ''}</span>
      </footer>
    </Fragment>
  )
}

function ParameterEditor({
  draft,
  parameter,
  index,
  mapped,
  onRawChange,
  onScalarChange,
  onColorChange,
  onTexture,
  onClearTexture,
}: {
  draft: D5mMaterialDraft
  parameter: D5mMaterialParameter
  index: number
  mapped: boolean
  onRawChange: (value: string) => void
  onScalarChange: (value: number) => void
  onColorChange: (value: { r: number; g: number; b: number; a: number }) => void
  onTexture: (file: File) => void
  onClearTexture: () => void
}) {
  const scalar = parameter.type === 1 ? parseD5mScalar(parameter.value) : undefined
  const color = parameter.type === 2 ? parseD5mColor(parameter.value) : undefined
  const hasRange = scalar?.min != null && scalar.max != null && scalar.max > scalar.min
  return (
    <section className="material-parameter-row">
      <div className="material-parameter-name">
        <span className={`mapping-dot ${mapped ? 'mapped' : ''}`} title={mapped ? '参与标准预览映射' : '原样保留写回'} />
        <div><strong>{parameter.name}</strong><small>{parameter.group || '未分组'} · T{parameter.type}</small></div>
      </div>
      {parameter.type === 3 ? (
        <TextureEditor draft={draft} parameter={parameter} index={index} onRawChange={onRawChange} onTexture={onTexture} onClear={onClearTexture} />
      ) : color ? (
        <ColorEditor color={color} raw={parameter.value} onChange={onColorChange} onRawChange={onRawChange} />
      ) : scalar ? (
        <div className="material-scalar-editor">
          {hasRange && (
            <input
              type="range"
              min={scalar.min}
              max={scalar.max}
              step={rangeStep(scalar.min!, scalar.max!)}
              value={clamp(scalar.current, scalar.min!, scalar.max!)}
              aria-label={`${parameter.name} 滑块`}
              onChange={(event) => onScalarChange(Number(event.target.value))}
            />
          )}
          <input
            className="material-number-input"
            type="number"
            value={scalar.current}
            step={hasRange ? rangeStep(scalar.min!, scalar.max!) : 'any'}
            aria-label={`${parameter.name} 数值`}
            onChange={(event) => onScalarChange(Number(event.target.value))}
          />
          <details className="material-raw-value"><summary>原始值</summary><input value={parameter.value} onChange={(event) => onRawChange(event.target.value)} /></details>
        </div>
      ) : (
        <input className="material-raw-input" value={parameter.value} aria-label={`${parameter.name} 原始值`} onChange={(event) => onRawChange(event.target.value)} />
      )}
    </section>
  )
}

function TextureEditor({
  draft,
  parameter,
  index,
  onRawChange,
  onTexture,
  onClear,
}: {
  draft: D5mMaterialDraft
  parameter: D5mMaterialParameter
  index: number
  onRawChange: (value: string) => void
  onTexture: (file: File) => void
  onClear: () => void
}) {
  const [thumbnail, setThumbnail] = useState('')
  const canonicalValue = canonicalD5mPath(parameter.value)
  const override = [...draft.resources].find(([path]) => {
    const canonical = canonicalD5mPath(path)
    return canonical === canonicalValue || canonical === canonicalD5mPath(`textures/${canonicalValue}`)
  })?.[1]
  const resourceRevision = JSON.stringify([
    parameter.value,
    override ? [override.size, override instanceof File ? override.lastModified : 0] : null,
    draft.source ? [draft.source.file.name, draft.source.file.size, draft.source.file.lastModified] : null,
  ])
  useEffect(() => {
    let active = true
    let objectUrl = ''
    const abort = new AbortController()
    setThumbnail('')
    void resolveD5mDraftResource(draft, index, abort.signal).then((resource) => {
      if (!active || !resource || /\.(?:dds|tiff?)$/i.test(resource.path)) return
      objectUrl = URL.createObjectURL(resource.blob)
      if (!active) URL.revokeObjectURL(objectUrl)
      else setThumbnail(objectUrl)
    }).catch(() => undefined)
    return () => {
      active = false
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [resourceRevision])
  return (
    <div className="material-texture-editor">
      <div className="material-texture-thumb">{thumbnail ? <img src={thumbnail} alt="" /> : <ImagePlus size={18} />}</div>
      <div className="material-texture-value">
        <input value={parameter.value} placeholder="未绑定纹理" aria-label={`${parameter.name} 资源路径`} onChange={(event) => onRawChange(event.target.value)} />
        <div>
          <label className="material-mini-command" title="绑定纹理">
            <ImagePlus size={14} /><span>绑定</span>
            <input
              className="sr-only"
              type="file"
              accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.dds,.webp,.tga,.hdr,.exr,.ktx,.ktx2"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onTexture(file)
                event.target.value = ''
              }}
            />
          </label>
          <button className="material-mini-command icon-only" type="button" title="清除纹理" aria-label={`清除 ${parameter.name}`} disabled={!parameter.value} onClick={onClear}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

function ColorEditor({
  color,
  raw,
  onChange,
  onRawChange,
}: {
  color: { r: number; g: number; b: number; a: number }
  raw: string
  onChange: (value: { r: number; g: number; b: number; a: number }) => void
  onRawChange: (value: string) => void
}) {
  return (
    <div className="material-color-editor">
      <input
        type="color"
        value={linearColorToHex(color)}
        aria-label="颜色"
        onChange={(event) => onChange({ ...hexToLinearColor(event.target.value), a: color.a })}
      />
      <label><span>A</span><input type="number" min="0" max="1" step="0.01" value={color.a} onChange={(event) => onChange({ ...color, a: Number(event.target.value) })} /></label>
      <details className="material-raw-value"><summary>原始值</summary><input value={raw} onChange={(event) => onRawChange(event.target.value)} /></details>
    </div>
  )
}

function PreviewShapeButton({ label, active, onClick, children }: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return <button className={active ? 'active' : ''} type="button" role="tab" title={label} aria-label={label} aria-selected={active} onClick={onClick}>{children}</button>
}

function TemplateFamilyGlyph({ familyKey }: { familyKey: string }) {
  if (familyKey === 'water') return <Circle size={16} />
  if (familyKey === 'glass' || familyKey === 'sheer-fabric') return <Square size={16} />
  if (familyKey === 'height-surface' || familyKey === 'landscape') return <Box size={16} />
  if (familyKey === 'fabric') return <ImagePlus size={16} />
  return <Paintbrush size={16} />
}

function defaultShape(familyKey: string): MaterialPreviewShape {
  return familyKey === 'water' || familyKey === 'landscape' ? 'plane' : 'sphere'
}

function cloneDraft(source: D5mMaterialDraft): D5mMaterialDraft {
  return {
    ...source,
    material: structuredClone(source.material),
    parameters: structuredClone(source.parameters),
    resources: new Map(source.resources),
  }
}

function linearColorToHex(color: { r: number; g: number; b: number }): string {
  const encode = (value: number) => Math.round(Math.pow(clamp(value, 0, 1), 1 / 2.2) * 255).toString(16).padStart(2, '0')
  return `#${encode(color.r)}${encode(color.g)}${encode(color.b)}`
}

function hexToLinearColor(value: string): { r: number; g: number; b: number } {
  const decode = (offset: number) => Math.pow(Number.parseInt(value.slice(offset, offset + 2), 16) / 255, 2.2)
  return { r: decode(1), g: decode(3), b: decode(5) }
}

function rangeStep(min: number, max: number): number {
  const span = Math.abs(max - min)
  if (span <= 1) return 0.01
  if (span <= 10) return 0.05
  if (span <= 360) return 1
  return Math.max(1, Math.round(span / 200))
}

function safeFilename(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || '新建材质'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function formatBytes(value: number): string {
  if (value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const order = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** order).toFixed(order === 0 ? 0 : 1)} ${units[order]}`
}

function formatDuration(value: number): string {
  return value < 1000 ? `${value.toFixed(1)} ms` : `${(value / 1000).toFixed(2)} s`
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
