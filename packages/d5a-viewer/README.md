# D5A Viewer

High-performance local asset inspection and conversion toolkit with a browser UI and a Node.js CLI. Scene assets and D5M material documents use separate pipelines.

## Supported content

- Plain ZIP-compatible D5A containing D5Mesh versions 9, 10, or 11 plus `info.json`
- Legacy D5A containing binary FBX, `d5material.xml`, and textures
- GLB 2.0 viewing and validated export with Draco, Meshopt, and Basis Universal/KTX2 decoding
- Ordinary unencrypted D5A export with complete viewer readback and fidelity reporting
- Meter-based ASCII DXF `3DFACE` export with part/material layers, True Color, stream readback, and explicit format-loss reporting
- Mesh/material part selection, canvas picking, visibility, isolation, and selected-part GLB/D5A/DXF export
- Ordinary ZIP-compatible D5M inspection, preview, creation, editing, stream writing, and fidelity reports across 10 observed families and 272 exact profiles
- PBR textures, native D5 UV transforms, alpha-cutout materials, shared instances, and local HDR environment lighting
- Detection and clear diagnostics for encrypted, protected, damaged, and unknown containers

D5M is a material format. It is created and validated as a material document and can be previewed on model parts, but it is not exported as a GLB model. The active phase is the portable CLI, embedded WebUI, task protocol, and bounded batch runtime. SKP remains the first dedicated common scene-format adapter after that runtime is fixed.

## Run

```powershell
npm install
npm run dev
```

Production output is fully static:

```powershell
npm run build
npx vite preview
```

Run the focused regression suite, TypeScript check, and production build together:

```powershell
npm run check
```

## CLI

开发环境中的 CLI 使用 Node.js 22：

```powershell
npm run build:cli
npm run cli -- capabilities
npm run cli -- d5m profiles
npm run cli -- d5m create --family glass --title "Glass" --output glass.d5m
npm run cli -- d5m edit glass.d5m --output glass-edited.d5m --set "Utiling=X=2 Y=0 Z=0"
npm run cli -- d5m validate glass-edited.d5m --json
npm run cli -- inspect "E:\D5 WorkSpace\model\_1.d5a" --json
npm run cli -- view "E:\D5 WorkSpace\model\_1.d5a" --open
npm run cli -- view _1-selection.glb --port 5350
npm run cli -- validate _1-selection.glb --json
npm run cli -- convert "E:\D5 WorkSpace\model\_1.d5a" --output _1.dxf --overwrite
npm run cli -- extract "E:\D5 WorkSpace\model\_1.d5a" --output extracted --entry info.json
npm run verify:cli-dxf
```

Windows x64 发布物由 Go 生成单一原生二进制，静态 WebUI、Worker 和资源会嵌入 `d5-tool.exe`；运行时不依赖 Node.js 或 PATH：

```powershell
npm run build:native
.\release\d5-tool.exe capabilities --json
.\release\d5-tool.exe view "E:\D5 WorkSpace\model\_1.d5a" --open
npm run verify:native
```

`release/` 是生成物目录，不纳入源码控制。开发期 Node CLI 已提供 D5A/GLB 到 DXF 的写出和批处理，用于迁移与回归对照；Go 原生命令行的 `convert` 尚在 Phase 7，当前单文件通过内嵌 WebUI 使用 DXF 导出。

Batch manifests support explicit dependencies and resumable state:

```json
{
  "schemaVersion": 1,
  "jobs": [
    { "id": "create", "operation": "d5m.create", "family": "glass", "output": "out/glass.d5m" },
    { "id": "edit", "operation": "d5m.edit", "dependsOn": ["create"], "input": "out/glass.d5m", "output": "out/glass-edited.d5m", "title": "Edited glass" },
    { "id": "validate", "operation": "d5m.validate", "dependsOn": ["edit"], "input": "out/glass-edited.d5m" }
  ]
}
```

```powershell
npm run cli -- d5m batch --manifest jobs.json --concurrency 4 --memory-mb 512
npm run cli -- d5m batch --manifest jobs.json --resume --retry-failed
npm run verify:d5m-profiles
```

Scene batches use the root `batch` command and share the same dependency, memory-budget, lock, and recovery behavior:

```json
{
  "schemaVersion": 1,
  "jobs": [
    { "id": "inspect", "operation": "scene.inspect", "input": "asset.d5a", "report": "reports/asset.json" },
    { "id": "validate", "operation": "scene.validate", "input": "asset.glb", "report": "reports/asset.glb.json" },
    { "id": "extract", "operation": "scene.extract", "input": "asset.d5a", "output": "extracted", "entries": ["info.json"], "dependsOn": ["inspect"] }
  ]
}
```

```powershell
npm run cli -- batch --manifest scene-jobs.json --concurrency 2 --memory-mb 512
npm run cli -- batch --manifest scene-jobs.json --resume --retry-failed
npm run verify:batch-scene
npm run verify:cli-view
```

`view` starts a loopback-only WebUI and exposes only the requested D5A or GLB through a per-launch tokenized endpoint. The page reconstructs the selected file from that same-origin endpoint and loads it through the normal viewer pipeline; `--open` launches the returned local URL in the system browser.

Batch state and each D5M output use process-aware sidecar locks. A second process cannot mutate the same state or output while its owner is alive; after an interrupted process exits, `--resume` reclaims the stale lock, resets interrupted jobs, and removes orphaned staged files before retrying. The repeatable process-interruption gate is `npm run verify:interrupt-d5m`; `npm run verify:d5m-profiles` creates, edits, and validates all 272 observed exact D5M profiles.

The material preview keeps `Diffuse Map` and `DiffuseLandscape Map` as separate texture slots and blends landscape assets with `CustomTexBlend`. `sscolor2` is recognized as a subsurface-color input for thin-fabric preview. Protected texture payloads retain their original bytes and surface a diagnostic rather than appearing as ordinary decoded images.

Build the static WebUI and run it only on the local machine:

```powershell
npm run build
npm run cli -- serve --port 5329
npm run cli -- serve --port 5329 --state jobs.json.state.json
```

`serve` accepts only `127.0.0.1`, `localhost`, or `::1`, and advances to the next local port when the requested one is occupied. With `--state`, it exposes only that batch state at `/api/d5m-batch/state`; the WebUI shows its current counts and bounded event log. The WebUI has a D5M batch workspace: direct D5M selection creates a validation queue, while a schema 1 manifest can create, edit, and validate materials through selected local input/output directories. `npm run verify:serve` covers the static entry, SPA fallback, generated registry, port fallback, and state endpoint.

Private sample assets are kept under `fixtures/private/` and excluded from source control. Format findings and validation status are recorded in `docs/ttt/D5A查看器持续演进.ttt.md`.
