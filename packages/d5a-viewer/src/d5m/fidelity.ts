import { canonicalD5mPath } from './archive'
import { describeD5mProfile, loadD5mDocument } from './document'
import { materialDataFromD5mDraft, type D5mMaterialDraft } from './writer'

export type D5mCheckStatus = 'pass' | 'warning' | 'fail'

export interface D5mFidelityCheck {
  id: string
  label: string
  status: D5mCheckStatus
  detail: string
}

export interface D5mFidelityReport {
  schemaVersion: 1
  format: 'd5m'
  status: D5mCheckStatus
  sourceKind: 'new' | 'edited'
  outputBytes: number
  elapsedMs: number
  checks: D5mFidelityCheck[]
}

interface ExpectedEntry {
  path: string
  kind: 'material' | 'source' | 'blob'
  size?: number
  signature?: number
  blob?: Blob
}

export async function verifyD5mOutput(
  draft: D5mMaterialDraft,
  output: File,
  signal?: AbortSignal,
): Promise<D5mFidelityReport> {
  const startedAt = performance.now()
  const checks: D5mFidelityCheck[] = []
  const document = await loadD5mDocument(output, { signal })
  try {
    const expectedMaterial = materialDataFromD5mDraft(draft)
    addBooleanCheck(
      checks,
      'material-json',
      '材质字段与嵌套结构',
      stableStringify(document.material) === stableStringify(expectedMaterial),
      '顶层字段、未知字段及 matInfo 结构与草稿一致',
      '写出后的 material.json 与草稿存在差异',
    )
    addBooleanCheck(
      checks,
      'parameter-signature',
      '参数签名、顺序与大小写',
      stableStringify(document.parameters) === stableStringify(draft.parameters),
      `${draft.parameters.length} 个参数逐项一致`,
      '参数数组、顺序、类型、名称大小写或未知字段发生变化',
    )
    if (draft.secondaryParameters) {
      addBooleanCheck(
        checks,
        'secondary-parameter-signature',
        'matInfo2 参数签名、顺序与大小写',
        stableStringify(document.secondaryParameters) === stableStringify(draft.secondaryParameters),
        `${draft.secondaryParameters.length} 个 matInfo2 参数逐项一致`,
        'matInfo2 参数数组、顺序、类型、名称大小写或未知字段发生变化',
      )
    }
    const expectedProfile = describeD5mProfile(expectedMaterial, draft.parameters)
    addBooleanCheck(
      checks,
      'material-profile',
      '材质族与精确制式身份',
      document.profile.familyId === expectedProfile.familyId &&
        document.profile.profileId === expectedProfile.profileId,
      `${document.profile.familyId} / ${document.profile.profileId}`,
      `预期 ${expectedProfile.familyId} / ${expectedProfile.profileId}，实际 ${document.profile.familyId} / ${document.profile.profileId}`,
    )
    addBooleanCheck(
      checks,
      'text-encoding',
      '文本编码与 matInfo 存储形态',
      document.encoding === draft.encoding &&
        document.bom === draft.bom &&
        document.matInfoStorage === draft.matInfoStorage,
      `${document.encoding}${document.bom ? ' + BOM' : ''} / ${document.matInfoStorage}`,
      `预期 ${draft.encoding}${draft.bom ? ' + BOM' : ''} / ${draft.matInfoStorage}，实际 ${document.encoding}${document.bom ? ' + BOM' : ''} / ${document.matInfoStorage}`,
    )
    const unresolved = document.textureReferences.filter((reference) => !reference.resolvedPath)
    addBooleanCheck(
      checks,
      'texture-references',
      '纹理引用闭合',
      unresolved.length === 0,
      `${document.textureReferences.length} 个有效引用均可解析`,
      unresolved.map((reference) => `${reference.slot}: ${reference.value}`).join('；'),
    )

    const expectedEntries = buildExpectedEntries(draft)
    const actualEntries = new Map(
      document.inspection.entries
        .filter((entry) => !entry.directory)
        .map((entry) => [canonicalD5mPath(entry.filename), entry]),
    )
    const expectedPaths = [...expectedEntries.keys()].sort()
    const actualPaths = [...actualEntries.keys()].sort()
    addBooleanCheck(
      checks,
      'entry-manifest',
      '归档文件清单',
      stableStringify(actualPaths) === stableStringify(expectedPaths),
      `${actualPaths.length} 个文件条目与预期一致`,
      manifestDifference(expectedPaths, actualPaths),
    )

    let copiedVerified = 0
    let overriddenVerified = 0
    const resourceFailures: string[] = []
    for (const [key, expected] of expectedEntries) {
      throwIfAborted(signal)
      if (expected.kind === 'material') continue
      const actual = actualEntries.get(key)
      if (!actual) continue
      if (expected.kind === 'source') {
        if (
          actual.uncompressedSize !== expected.size ||
          (expected.signature != null && actual.signature !== expected.signature)
        ) {
          resourceFailures.push(expected.path)
        } else {
          copiedVerified += 1
        }
      } else if (expected.blob) {
        const outputBytes = await document.archive.bytes(actual.filename, signal)
        const exact = actual.uncompressedSize === expected.blob.size &&
          await sha256(expected.blob) === await sha256(outputBytes)
        if (exact) overriddenVerified += 1
        else resourceFailures.push(expected.path)
      }
    }
    addBooleanCheck(
      checks,
      'resource-bytes',
      '资源字节与 CRC',
      resourceFailures.length === 0,
      `${copiedVerified} 个源资源 CRC 一致，${overriddenVerified} 个新增或替换资源字节一致`,
      `以下资源不一致：${resourceFailures.join('；')}`,
    )

    const warnings = document.warnings.filter((warning) => !warning.includes('容器中没有'))
    if (warnings.length > 0) {
      checks.push({
        id: 'document-warnings',
        label: '回读诊断',
        status: 'warning',
        detail: warnings.join('；'),
      })
    }
  } finally {
    await document.close()
  }
  return {
    schemaVersion: 1,
    format: 'd5m',
    status: aggregateStatus(checks),
    sourceKind: draft.source ? 'edited' : 'new',
    outputBytes: output.size,
    elapsedMs: performance.now() - startedAt,
    checks,
  }
}

export function assertD5mFidelity(report: D5mFidelityReport): void {
  const failures = report.checks.filter((check) => check.status === 'fail')
  if (failures.length > 0) {
    throw new Error(`D5M 往返门禁未通过：${failures.map((check) => `${check.label}（${check.detail}）`).join('；')}`)
  }
}

function buildExpectedEntries(draft: D5mMaterialDraft): Map<string, ExpectedEntry> {
  const expected = new Map<string, ExpectedEntry>()
  for (const entry of draft.source?.inspection.entries ?? []) {
    if (entry.directory) continue
    expected.set(canonicalD5mPath(entry.filename), {
      path: entry.filename,
      kind: 'source',
      size: entry.uncompressedSize,
      signature: entry.signature,
    })
  }
  const materialPath = draft.source?.inspection.materialEntry ?? 'material.json'
  expected.set(canonicalD5mPath(materialPath), { path: materialPath, kind: 'material' })
  for (const [path, blob] of draft.resources) setBlobEntry(expected, path, blob)
  if (draft.icon) setBlobEntry(expected, 'icon.png', draft.icon)
  if (draft.summary != null) {
    setBlobEntry(expected, 'summary.txt', new Blob([draft.summary], { type: 'text/plain' }))
  }
  return expected
}

function setBlobEntry(expected: Map<string, ExpectedEntry>, path: string, blob: Blob): void {
  const key = canonicalD5mPath(path)
  const existing = expected.get(key)
  expected.set(key, { path: existing?.path ?? path.replaceAll('\\', '/'), kind: 'blob', blob })
}

function addBooleanCheck(
  checks: D5mFidelityCheck[],
  id: string,
  label: string,
  pass: boolean,
  passDetail: string,
  failDetail: string,
): void {
  checks.push({ id, label, status: pass ? 'pass' : 'fail', detail: pass ? passDetail : failDetail })
}

function manifestDifference(expected: string[], actual: string[]): string {
  const expectedSet = new Set(expected)
  const actualSet = new Set(actual)
  const missing = expected.filter((path) => !actualSet.has(path))
  const extra = actual.filter((path) => !expectedSet.has(path))
  return [
    missing.length > 0 ? `缺少 ${missing.join(', ')}` : '',
    extra.length > 0 ? `多出 ${extra.join(', ')}` : '',
  ].filter(Boolean).join('；') || '归档清单顺序或路径存在差异'
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  )
}

async function sha256(value: Blob | Uint8Array): Promise<string> {
  const bytes = value instanceof Blob ? await value.arrayBuffer() : value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function aggregateStatus(checks: D5mFidelityCheck[]): D5mCheckStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'warning')) return 'warning'
  return 'pass'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('D5M 验证已取消', 'AbortError')
}
