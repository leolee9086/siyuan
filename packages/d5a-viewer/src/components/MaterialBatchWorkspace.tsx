import {
  CheckCircle2,
  Circle,
  FileJson2,
  Files,
  FolderInput,
  FolderOutput,
  ListChecks,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  estimateD5mBatchArtifactBytes,
  executeD5mBatchArtifactJob,
  type D5mBatchArtifactStorage,
  type D5mBatchArtifactSummary,
} from '../d5m/batch-runtime'
import { loadD5mTemplateRegistry, type D5mTemplateRegistry } from '../d5m/templates'
import {
  parseD5mBatchManifest,
  type D5mBatchJob,
  type D5mBatchManifest,
} from '../tasks/d5m-batch'
import {
  runTaskQueue,
  type TaskQueueItem,
  type TaskQueueItemStatus,
} from '../tasks/queue'

type BatchViewStatus = 'pending' | 'running' | TaskQueueItemStatus

interface BatchJobView {
  job: D5mBatchJob
  index: number
  status: BatchViewStatus
  attempts: number
  elapsedMs?: number
  message?: string
  completed?: number
  total?: number
  error?: string
  result?: D5mBatchArtifactSummary
}

type BatchWorkspaceState =
  | { kind: 'idle'; message: string }
  | { kind: 'ready'; message: string }
  | { kind: 'running'; message: string }
  | { kind: 'completed'; message: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'error'; message: string }

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>
}

interface CliBatchMonitor {
  state: {
    manifest: string
    updatedAt: string
    jobs: Record<string, { status: BatchViewStatus; attempts: number; error?: string }>
    events?: Array<{ timestamp: string; type: 'started' | 'completed'; id: string; status?: BatchViewStatus; message: string; error?: string }>
  }
}

export default function MaterialBatchWorkspace() {
  const [registry, setRegistry] = useState<D5mTemplateRegistry>()
  const [manifest, setManifest] = useState<D5mBatchManifest>()
  const [manifestName, setManifestName] = useState('')
  const [inputDirectory, setInputDirectory] = useState<FileSystemDirectoryHandle>()
  const [outputDirectory, setOutputDirectory] = useState<FileSystemDirectoryHandle>()
  const [jobViews, setJobViews] = useState<BatchJobView[]>([])
  const [workspaceState, setWorkspaceState] = useState<BatchWorkspaceState>({ kind: 'idle', message: '等待 D5M 任务' })
  const [concurrency, setConcurrency] = useState(2)
  const [memoryMb, setMemoryMb] = useState(512)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'issues'>('all')
  const [cliMonitor, setCliMonitor] = useState<CliBatchMonitor>()
  const manifestInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | undefined>(undefined)
  const directFilesRef = useRef(new Map<string, File>())
  const fallbackOutputsRef = useRef(new Map<string, File>())
  const generatedPathsRef = useRef(new Set<string>())
  const jobViewsRef = useRef<BatchJobView[]>([])

  useEffect(() => {
    const abort = new AbortController()
    void loadD5mTemplateRegistry(abort.signal)
      .then(setRegistry)
      .catch((error) => {
        if (!abort.signal.aborted) setWorkspaceState({ kind: 'error', message: normalizeError(error) })
      })
    return () => {
      abort.abort()
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    let active = true
    let timer: number | undefined
    let staticHost = false
    const refresh = async () => {
      try {
        const response = await fetch('/api/d5m-batch/state', { cache: 'no-store' })
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          staticHost = true
          return
        }
        if (response.ok) {
          const payload = await response.json() as CliBatchMonitor
          if (active && payload.state?.jobs) setCliMonitor(payload)
        }
      } catch {
        // The pure static and Vite hosts do not expose a CLI state endpoint.
      } finally {
        if (active && !staticHost) timer = window.setTimeout(() => void refresh(), 1_000)
      }
    }
    void refresh()
    return () => {
      active = false
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  const counts = useMemo(() => countStatuses(jobViews), [jobViews])
  const visibleJobs = useMemo(() => jobViews.filter((view) => {
    if (statusFilter === 'active') return view.status === 'pending' || view.status === 'running'
    if (statusFilter === 'issues') return view.status === 'failed' || view.status === 'blocked' || view.status === 'cancelled'
    return true
  }), [jobViews, statusFilter])
  const running = workspaceState.kind === 'running'
  const canRetry = counts.failed + counts.blocked + counts.cancelled > 0
  const cliCounts = useMemo(() => cliMonitor ? countCliStatuses(cliMonitor.state.jobs) : undefined, [cliMonitor])

  const installManifest = (next: D5mBatchManifest, name: string, directFiles = new Map<string, File>()) => {
    abortRef.current?.abort()
    directFilesRef.current = directFiles
    fallbackOutputsRef.current.clear()
    generatedPathsRef.current.clear()
    setInputDirectory(undefined)
    const views = next.jobs.map((job, index): BatchJobView => ({
      job,
      index,
      status: 'pending',
      attempts: 0,
    }))
    jobViewsRef.current = views
    setJobViews(views)
    setManifest(next)
    setManifestName(name)
    setWorkspaceState({ kind: 'ready', message: `${next.jobs.length} 个 D5M 任务已就绪` })
  }

  const loadManifest = async (file?: File) => {
    if (!file) return
    try {
      const next = parseD5mBatchManifest(JSON.parse(await file.text()) as unknown)
      installManifest(next, file.name)
    } catch (error) {
      setWorkspaceState({ kind: 'error', message: normalizeError(error) })
    }
  }

  const addD5mFiles = (files: FileList | null) => {
    const selected = [...(files ?? [])].filter((file) => /\.d5m$/i.test(file.name))
    if (selected.length === 0) {
      setWorkspaceState({ kind: 'error', message: '所选内容中没有 D5M 文件' })
      return
    }
    const directFiles = new Map<string, File>()
    const jobs = selected.map((file, index) => {
      const key = uniquePath(file.name, directFiles)
      directFiles.set(key, file)
      return {
        id: `inspect-${String(index + 1).padStart(3, '0')}`,
        operation: 'd5m.validate' as const,
        input: key,
      }
    })
    installManifest(parseD5mBatchManifest({ schemaVersion: 1, jobs }), `${selected.length} 个 D5M`, directFiles)
  }

  const chooseDirectory = async (mode: 'input' | 'output') => {
    const picker = (window as unknown as DirectoryPickerWindow).showDirectoryPicker
    if (!picker) {
      setWorkspaceState({ kind: 'error', message: '当前浏览器没有本地目录访问能力' })
      return
    }
    try {
      const directory = await picker.call(window, {
        id: mode === 'input' ? 'd5m-batch-input' : 'd5m-batch-output',
        mode: mode === 'input' ? 'read' : 'readwrite',
      })
      if (mode === 'input') {
        directFilesRef.current.clear()
        setInputDirectory(directory)
      } else {
        setOutputDirectory(directory)
      }
      setWorkspaceState({ kind: manifest ? 'ready' : 'idle', message: `${mode === 'input' ? '输入' : '输出'}目录: ${directory.name}` })
    } catch (error) {
      if (!isAbortError(error)) setWorkspaceState({ kind: 'error', message: normalizeError(error) })
    }
  }

  const patchJob = (id: string, patch: Partial<BatchJobView>) => {
    const next = jobViewsRef.current.map((view) => view.job.id === id ? { ...view, ...patch } : view)
    jobViewsRef.current = next
    setJobViews(next)
  }

  const runBatch = async (retryOnly: boolean) => {
    if (!manifest || !registry || running) return
    const outputJobs = manifest.jobs.filter((job) => job.operation !== 'd5m.validate')
    if (outputJobs.length > 1 && !outputDirectory) {
      setWorkspaceState({ kind: 'error', message: '多个制作任务需要选择输出目录' })
      return
    }
    const selectedIds = new Set(jobViewsRef.current
      .filter((view) => !retryOnly || ['failed', 'blocked', 'cancelled'].includes(view.status))
      .map((view) => view.job.id))
    if (selectedIds.size === 0) return
    const previousById = new Map(jobViewsRef.current.map((view) => [view.job.id, view]))
    for (const id of selectedIds) {
      patchJob(id, { status: 'pending', elapsedMs: undefined, message: undefined, completed: undefined, total: undefined, error: undefined })
    }
    const abort = new AbortController()
    abortRef.current = abort
    const storage = createBrowserStorage({
      inputDirectory,
      outputDirectory,
      directFiles: directFilesRef.current,
      fallbackOutputs: fallbackOutputsRef.current,
      generatedPaths: generatedPathsRef.current,
    })
    setWorkspaceState({ kind: 'running', message: `正在执行 ${selectedIds.size} 个 D5M 任务` })
    const startedAt = performance.now()
    try {
      const selectedJobs = manifest.jobs.filter((job) => selectedIds.has(job.id))
      const items: TaskQueueItem<D5mBatchArtifactSummary>[] = await Promise.all(selectedJobs.map(async (job) => ({
        id: job.id,
        estimatedBytes: await estimateD5mBatchArtifactBytes(job, storage),
        dependsOn: (job.dependsOn ?? []).filter((dependency) => selectedIds.has(dependency)),
        run: (signal) => executeD5mBatchArtifactJob(job, registry, storage, {
          signal,
          overwrite: (previousById.get(job.id)?.attempts ?? 0) > 0,
          onTaskEvent: (event) => {
            if (event.type === 'started' || event.type === 'progress') {
              patchJob(job.id, {
                message: event.message,
                completed: event.completed,
                total: event.total,
              })
            }
          },
        }),
      })))
      const result = await runTaskQueue(items, {
        concurrency,
        memoryBudgetBytes: memoryMb * 1024 * 1024,
        signal: abort.signal,
        onEvent: (event) => {
          if (event.type === 'started') {
            const previous = previousById.get(event.id)
            patchJob(event.id, {
              status: 'running',
              attempts: (previous?.attempts ?? 0) + 1,
              message: '准备 D5M 材质任务',
            })
          } else {
            patchJob(event.id, {
              status: event.status ?? 'failed',
              elapsedMs: event.elapsedMs,
              error: event.error,
              result: event.result,
              completed: undefined,
              total: undefined,
              message: event.status === 'passed' ? '材质门禁通过' : event.status === 'warning' ? '完成并含制式警告' : undefined,
            })
          }
        },
      })
      for (const item of result.items) {
        if (item.status === 'cancelled') patchJob(item.id, { status: 'cancelled', error: item.error })
      }
      const report = createWebBatchReport(manifestName, result, jobViewsRef.current, performance.now() - startedAt)
      if (outputDirectory) {
        await storage.write('d5m-batch-web-report.json', new Blob([`${JSON.stringify(report, null, 2)}\n`], {
          type: 'application/json',
        }), { overwrite: true })
      }
      setWorkspaceState(result.status === 'cancelled'
        ? { kind: 'cancelled', message: 'D5M 批处理已取消' }
        : result.status === 'fail'
          ? { kind: 'error', message: 'D5M 批处理存在失败任务' }
          : { kind: 'completed', message: `${result.items.length} 个 D5M 任务完成` })
    } catch (error) {
      if (abort.signal.aborted || isAbortError(error)) setWorkspaceState({ kind: 'cancelled', message: 'D5M 批处理已取消' })
      else setWorkspaceState({ kind: 'error', message: normalizeError(error) })
    } finally {
      if (abortRef.current === abort) abortRef.current = undefined
    }
  }

  return (
    <>
      <main className="batch-workspace">
        <aside className="batch-controls" aria-label="D5M 批处理设置">
          <section className="batch-control-section batch-source-section">
            <div className="batch-section-heading"><div><ListChecks size={16} /><strong>D5M 制作队列</strong></div><span>{registry?.profileCount ?? 0} 制式</span></div>
            <div className="batch-source-actions">
              <button className="command secondary" type="button" onClick={() => filesInputRef.current?.click()}><Files size={16} />添加 D5M</button>
              <button className="command secondary" type="button" onClick={() => manifestInputRef.current?.click()}><FileJson2 size={16} />任务清单</button>
            </div>
            <input ref={filesInputRef} className="sr-only" type="file" accept=".d5m" multiple onChange={(event) => {
              addD5mFiles(event.target.files)
              event.target.value = ''
            }} />
            <input ref={manifestInputRef} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => {
              void loadManifest(event.target.files?.[0])
              event.target.value = ''
            }} />
            <div className="batch-path-row"><FileJson2 size={14} /><span title={manifestName}>{manifestName || '未选择任务'}</span><strong>{manifest?.jobs.length ?? 0}</strong></div>
          </section>

          <section className="batch-control-section">
            <div className="batch-section-heading"><div><FolderInput size={16} /><strong>目录</strong></div></div>
            <button className="batch-directory-button" type="button" onClick={() => void chooseDirectory('input')}>
              <FolderInput size={16} /><span><small>输入</small><strong>{inputDirectory?.name ?? (directFilesRef.current.size > 0 ? `${directFilesRef.current.size} 个文件` : '未选择')}</strong></span>
            </button>
            <button className="batch-directory-button" type="button" onClick={() => void chooseDirectory('output')}>
              <FolderOutput size={16} /><span><small>输出</small><strong>{outputDirectory?.name ?? '浏览器下载'}</strong></span>
            </button>
          </section>

          <section className="batch-control-section">
            <div className="batch-section-heading"><div><LoaderCircle size={16} /><strong>资源预算</strong></div></div>
            <label className="batch-number-field"><span>并发作业</span><input type="number" min="1" max="16" value={concurrency} disabled={running} onChange={(event) => setConcurrency(clampInteger(event.target.value, 1, 16))} /></label>
            <label className="batch-number-field"><span>活动内存</span><div><input type="number" min="32" max="32768" step="32" value={memoryMb} disabled={running} onChange={(event) => setMemoryMb(clampInteger(event.target.value, 32, 32768))} /><small>MiB</small></div></label>
          </section>

          {cliMonitor && cliCounts && (
            <section className="batch-control-section batch-cli-monitor" aria-label="CLI 批处理状态">
              <div className="batch-section-heading"><div><ListChecks size={16} /><strong>CLI 同步</strong></div><span>{cliCounts.running} 运行</span></div>
              <div className="batch-cli-summary"><span>{cliCounts.passed} 通过</span><span>{cliCounts.warning} 警告</span><span>{cliCounts.issues} 问题</span></div>
              <details>
                <summary>CLI 日志 {cliMonitor.state.events?.length ?? 0}</summary>
                <div className="batch-cli-events">
                  {(cliMonitor.state.events ?? []).slice(-4).reverse().map((event) => (
                    <div key={`${event.timestamp}-${event.id}-${event.type}`}>
                      <strong>{event.status ?? event.type}</strong><span title={event.error ?? event.message}>{event.error ?? event.message}</span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}

          <div className="batch-run-actions">
            {running ? (
              <button className="command secondary" type="button" onClick={() => abortRef.current?.abort()}><Square size={15} />取消</button>
            ) : (
              <button className="command primary" type="button" disabled={!manifest || !registry} onClick={() => void runBatch(false)}><Play size={16} />开始</button>
            )}
            <button className="command secondary" type="button" disabled={running || !canRetry} onClick={() => void runBatch(true)}><RotateCcw size={15} />重试</button>
          </div>
        </aside>

        <section className="batch-queue" aria-label="D5M 任务队列">
          <header className="batch-queue-header">
            <div><strong>任务队列</strong><span>{counts.completed} / {jobViews.length}</span></div>
            {cliCounts && <span className="batch-cli-indicator">CLI {cliCounts.running} 运行 / {cliCounts.passed + cliCounts.warning} 完成</span>}
            <div className="batch-filter segmented" role="tablist" aria-label="任务状态筛选">
              <button className={statusFilter === 'all' ? 'active' : ''} type="button" role="tab" aria-selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>全部</button>
              <button className={statusFilter === 'active' ? 'active' : ''} type="button" role="tab" aria-selected={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>待处理 {counts.pending + counts.running}</button>
              <button className={statusFilter === 'issues' ? 'active' : ''} type="button" role="tab" aria-selected={statusFilter === 'issues'} onClick={() => setStatusFilter('issues')}>问题 {counts.issues}</button>
            </div>
          </header>
          {visibleJobs.length > 0 ? <VirtualJobList jobs={visibleJobs} /> : (
            <div className="batch-empty"><ListChecks size={36} strokeWidth={1.35} /><strong>{jobViews.length > 0 ? '当前筛选无任务' : 'D5M 任务队列为空'}</strong></div>
          )}
        </section>
      </main>
      <footer className="statusbar batch-statusbar">
        <span className={`status-dot ${workspaceState.kind === 'running' ? 'loading' : workspaceState.kind === 'error' ? 'error' : jobViews.length > 0 ? 'ready' : 'idle'}`} />
        <span>{workspaceState.message}</span>
        <span className="status-separator" />
        <span>{counts.passed} 通过</span>
        <span>{counts.warning} 警告</span>
        <span>{counts.issues} 问题</span>
        <span className="status-spacer" />
        <span>{concurrency} 并发 / {memoryMb} MiB</span>
      </footer>
    </>
  )
}

function VirtualJobList({ jobs }: { jobs: BatchJobView[] }) {
  const rowHeight = 58
  const overscan = 5
  const hostRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 400 })
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(() => setViewport((current) => ({ ...current, height: host.clientHeight })))
    observer.observe(host)
    setViewport({ scrollTop: host.scrollTop, height: host.clientHeight })
    return () => observer.disconnect()
  }, [])
  const start = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan)
  const end = Math.min(jobs.length, Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + overscan)
  return (
    <div ref={hostRef} className="batch-job-list" onScroll={(event) => setViewport({ scrollTop: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}>
      <div style={{ height: start * rowHeight }} />
      {jobs.slice(start, end).map((view) => <BatchJobRow key={view.job.id} view={view} />)}
      <div style={{ height: (jobs.length - end) * rowHeight }} />
    </div>
  )
}

function BatchJobRow({ view }: { view: BatchJobView }) {
  const label = operationLabel(view.job.operation)
  const target = view.job.operation === 'd5m.create' ? view.job.output : view.job.input
  const progress = view.total && view.completed != null ? Math.max(0, Math.min(1, view.completed / view.total)) : undefined
  return (
    <div className={`batch-job-row ${view.status}`} style={{ height: 58 }}>
      <span className="batch-job-status">{statusIcon(view.status)}</span>
      <div className="batch-job-main">
        <strong title={view.job.id}>{view.job.id}</strong>
        <span title={target}>{label} · {target}</span>
        {progress != null && <i style={{ width: `${progress * 100}%` }} />}
      </div>
      <div className="batch-job-detail">
        <strong>{statusLabel(view.status)}</strong>
        <span title={view.error ?? view.message}>{view.error ?? view.message ?? (view.attempts > 0 ? `${view.attempts} 次` : '待运行')}</span>
      </div>
    </div>
  )
}

function createBrowserStorage(options: {
  inputDirectory?: FileSystemDirectoryHandle
  outputDirectory?: FileSystemDirectoryHandle
  directFiles: Map<string, File>
  fallbackOutputs: Map<string, File>
  generatedPaths: Set<string>
}): D5mBatchArtifactStorage {
  return {
    async read(rawPath) {
      const path = normalizeBatchPath(rawPath)
      if (options.generatedPaths.has(path)) {
        if (options.outputDirectory) return readDirectoryFile(options.outputDirectory, path)
        const generated = options.fallbackOutputs.get(path)
        if (generated) return generated
      }
      const direct = options.directFiles.get(path)
      if (direct) return direct
      if (options.inputDirectory) return readDirectoryFile(options.inputDirectory, path)
      throw new Error(`输入目录中缺少 ${path}`)
    },
    async write(rawPath, blob, writeOptions) {
      const path = normalizeBatchPath(rawPath)
      if (writeOptions.signal?.aborted) throw new DOMException('写入已取消', 'AbortError')
      if (options.outputDirectory) {
        await writeDirectoryFile(options.outputDirectory, path, blob, writeOptions.overwrite, writeOptions.signal)
      } else {
        if (!writeOptions.overwrite && options.fallbackOutputs.has(path)) throw new Error(`输出已存在: ${path}`)
        const file = new File([blob], basename(path), { type: blob.type, lastModified: Date.now() })
        options.fallbackOutputs.set(path, file)
        downloadBlob(file, file.name)
      }
      options.generatedPaths.add(path)
    },
  }
}

async function readDirectoryFile(root: FileSystemDirectoryHandle, rawPath: string): Promise<File> {
  const { directory, filename } = await resolveDirectoryPath(root, rawPath, false)
  return (await directory.getFileHandle(filename)).getFile()
}

async function writeDirectoryFile(
  root: FileSystemDirectoryHandle,
  rawPath: string,
  blob: Blob,
  overwrite: boolean,
  signal?: AbortSignal,
): Promise<void> {
  const { directory, filename } = await resolveDirectoryPath(root, rawPath, true)
  let existed = true
  try {
    await directory.getFileHandle(filename)
  } catch (error) {
    if (!isNotFoundError(error)) throw error
    existed = false
  }
  if (existed && !overwrite) throw new Error(`输出已存在: ${rawPath}`)
  const handle = await directory.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(blob)
    if (signal?.aborted) throw new DOMException('写入已取消', 'AbortError')
    await writable.close()
  } catch (error) {
    await writable.abort(error).catch(() => undefined)
    if (!existed) await directory.removeEntry(filename).catch(() => undefined)
    throw error
  }
}

async function resolveDirectoryPath(
  root: FileSystemDirectoryHandle,
  rawPath: string,
  create: boolean,
): Promise<{ directory: FileSystemDirectoryHandle; filename: string }> {
  const segments = normalizeBatchPath(rawPath).split('/')
  const filename = segments.pop()
  if (!filename) throw new Error(`文件路径为空: ${rawPath}`)
  let directory = root
  for (const segment of segments) directory = await directory.getDirectoryHandle(segment, { create })
  return { directory, filename }
}

export function normalizeBatchPath(value: string): string {
  const path = value.trim().replaceAll('\\', '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)) throw new Error(`WebUI 只接受目录内相对路径: ${value}`)
  const segments = path.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error(`路径超出所选目录: ${value}`)
  return segments.join('/')
}

function createWebBatchReport(
  manifest: string,
  result: Awaited<ReturnType<typeof runTaskQueue<D5mBatchArtifactSummary>>>,
  jobs: BatchJobView[],
  elapsedMs: number,
) {
  const counts = countStatuses(jobs)
  return {
    schemaVersion: 1,
    format: 'd5m-batch-web',
    status: result.status,
    manifest,
    elapsedMs,
    peakActiveCount: result.peakActiveCount,
    peakActiveBytes: result.peakActiveBytes,
    counts,
    jobs: jobs.map(({ job, ...view }) => ({ id: job.id, operation: job.operation, ...view })),
  }
}

function countStatuses(jobs: BatchJobView[]) {
  const count = (status: BatchViewStatus) => jobs.filter((job) => job.status === status).length
  const passed = count('passed')
  const warning = count('warning')
  const failed = count('failed')
  const blocked = count('blocked')
  const cancelled = count('cancelled')
  const pending = count('pending')
  const running = count('running')
  return {
    passed,
    warning,
    failed,
    blocked,
    cancelled,
    pending,
    running,
    completed: passed + warning + failed + blocked + cancelled,
    issues: failed + blocked + cancelled,
  }
}

function countCliStatuses(jobs: CliBatchMonitor['state']['jobs']) {
  const values = Object.values(jobs)
  const count = (status: BatchViewStatus) => values.filter((job) => job.status === status).length
  const passed = count('passed')
  const warning = count('warning')
  const failed = count('failed')
  const blocked = count('blocked')
  const cancelled = count('cancelled')
  return {
    passed,
    warning,
    failed,
    blocked,
    cancelled,
    running: count('running'),
    pending: count('pending'),
    issues: failed + blocked + cancelled,
  }
}

function statusIcon(status: BatchViewStatus) {
  if (status === 'running') return <LoaderCircle className="spin" size={17} />
  if (status === 'passed') return <CheckCircle2 size={17} />
  if (status === 'warning' || status === 'blocked') return <TriangleAlert size={17} />
  if (status === 'failed' || status === 'cancelled') return <XCircle size={17} />
  return <Circle size={17} />
}

function statusLabel(status: BatchViewStatus): string {
  return {
    pending: '待运行',
    running: '运行中',
    passed: '通过',
    warning: '警告',
    failed: '失败',
    blocked: '依赖阻止',
    cancelled: '已取消',
  }[status]
}

function operationLabel(operation: D5mBatchJob['operation']): string {
  return operation === 'd5m.create' ? '制作' : operation === 'd5m.edit' ? '编辑' : '检查'
}

function uniquePath(filename: string, files: Map<string, File>): string {
  const normalized = normalizeBatchPath(filename)
  if (!files.has(normalized)) return normalized
  const extension = normalized.toLowerCase().endsWith('.d5m') ? '.d5m' : ''
  const stem = extension ? normalized.slice(0, -extension.length) : normalized
  let index = 2
  while (files.has(`${stem}-${index}${extension}`)) index += 1
  return `${stem}-${index}${extension}`
}

function basename(path: string): string {
  return path.split('/').at(-1) || 'output.d5m'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function clampInteger(value: string, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : min
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'NotFoundError')
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
