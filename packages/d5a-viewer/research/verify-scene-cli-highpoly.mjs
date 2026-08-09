import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const input = resolve(process.argv[2] ?? 'E:/D5 WorkSpace/model/921c45dfb88fc0837ea94f22eac5391b.fbx.d5a')
const reportPath = resolve(root, 'research', 'output', 'phase7-scene-cli-highpoly.json')
const cli = resolve(root, 'dist-cli/d5-tool.mjs')
const result = await run(process.execPath, [cli, 'inspect', input, '--quiet', '--json'], {
  cwd: root,
  maxBuffer: 16 * 1024 * 1024,
})
const inspection = JSON.parse(result.stdout)
const bundle = inspection.d5a?.bundles?.[0]
if (inspection.status !== 'pass' || bundle?.status !== 'parsed') throw new Error(`高面数 D5A 检查未通过：${inspection.status}`)
if ((bundle.mesh?.triangleCount ?? 0) < 1_000_000) throw new Error(`高面数样例三角面不足：${bundle.mesh?.triangleCount}`)
if (!Number.isFinite(inspection.runtime?.maxRssBytes) || inspection.runtime.maxRssBytes <= 0) {
  throw new Error('CLI 报告没有有效的进程 RSS 峰值')
}

const report = {
  schemaVersion: 1,
  command: 'verify:cli-scene-highpoly',
  input,
  status: inspection.status,
  variant: inspection.d5a.variant,
  fileBytes: inspection.file.bytes,
  uncompressedBytes: inspection.d5a.uncompressedBytes,
  mesh: bundle.mesh,
  material: bundle.material,
  inspectionElapsedMs: inspection.elapsedMs,
  runtime: inspection.runtime,
}
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`高面数 D5A: ${report.mesh.triangleCount.toLocaleString()} 面 / ${report.mesh.vertexCount.toLocaleString()} 顶点\n`)
process.stdout.write(`CLI: ${report.runtime.elapsedMs.toFixed(1)} ms / RSS 峰值 ${(report.runtime.maxRssBytes / 1024 / 1024).toFixed(1)} MB\n`)
process.stdout.write(`报告: ${reportPath}\n`)
