# D5A Viewer Progress Log

Last updated: 2026-07-31 (Asia/Shanghai)

## Objective

Build a portable, high-performance local CLI with an embedded WebUI that opens, inspects, renders, and converts D5 Render `.d5a` assets and common 3D formats using real files under `E:\D5 WorkSpace\model` and `Z:\D5森林树库` for verification.

## Current phase

The high-fidelity scene interchange, D5A/GLB round-trip, static part-isolation, and ordinary D5M discovery/create/view work are complete. The active phase is Phase 7: a portable high-performance local CLI with the embedded WebUI, shared task state, and scene-format operations.

真实场景 `convert` 和异常中断恢复已完成。Windows 发布运行时现已产出 Go 原生单一二进制，第一条原生 `inspect`/`validate`/`extract`/`serve`/`view` 链及内嵌 WebUI 已通过真实 v9/v10/v11、GLB 和 149 万面样例验证；内嵌 WebUI 与开发期 Node CLI 已新增真实 DXF 写出，但 Go 命令行自身的 `convert` 仍待迁移。Phase 7 的后续验收仍是原生 `convert`/`batch`/D5M 与目录批处理语义迁移、第二桌面平台实机启动，以及主 Web 包的性能分包收尾。SKP 仍是运行时边界固定后的首个专用格式适配器。

## Latest checkpoint

- 2026-07-31: A chunked ASCII DXF writer now exports complete scenes and selected parts as meter-based Z-up `3DFACE`, with part/material layers and True Color. Output is stream-read back for group-code, layer, face, bounds, units, and EOF checks; textures, UVs, shading bases, instances, animation, skinning, morphs, and hierarchy limits are explicit fidelity warnings. `npm run verify:cli-dxf` writes the real 12,844-triangle D5A to 4,374,210 bytes / 5 layers and the 3,968-triangle GLB to 1,363,035 bytes / 1 layer with exact face counts. WebUI desktop/mobile and selected-part exports pass; the full baseline is 34 files / 122 tests. DXF import/view, external-tool readback, native Go `convert`, and SKP export remain pending. The rebuilt embedded-WebUI executable is 12,733,952 bytes with SHA-256 `8fb70fb70d6b799cb495e8a408ea993ca8f6f5061fb65300f876e69890d5a59b`.
- 2026-07-31: Project execution now explicitly forbids long inline PowerShell commands. Build, packaging, fixture checks, and release verification must use short commands or named repository scripts with one auditable responsibility; this is an execution constraint and does not change Phase 7 completion status or reorder the roadmap.
- 2026-07-31: `npm run build:native` now produces a reproducible 12,716,544-byte `release/d5-tool.exe` with the production WebUI embedded and no Node runtime; the previous `d5-tool-win-x64` directory is removed only after a successful PE build, and `release/` contains only the executable. Fourteen top-level Go tests cover D5Mesh 9/10/11, GLB structure, ZIP extraction boundaries and local HTTP endpoints. `npm run verify:native` passes with an empty `PATH`: real v9/v10/v11 and GLB fixtures validate with zero errors/warnings, the 1,499,441-triangle fixture inspects in 822.5 ms with 11,358,208 bytes of Go system memory, `info.json` extraction is byte-identical, and embedded `serve`/`view` endpoints pass port fallback, status, token, method, HEAD and SHA-256 checks. The report is `research/output/phase7-native-cli-verification.json`; native conversion, batch/D5M commands, the second desktop platform and Web bundle splitting remain active Phase 7 work.
- 2026-07-30: D5A -> GLB now generates normalized tangent frames for normal-mapped primitives, with MikkTSpace bounded to ordinary non-indexed geometry and a lower-copy indexed/high-polygon path. The 1,499,441-triangle real D5A conversion produces a 246,350,424-byte GLB with Khronos Validator `0 errors / 0 warnings / 1 info`; a real Windows process interruption at the staged output is recovered on the next conversion using PID-aware partial cleanup and output leases. The full baseline is 33 test files / 118 tests with Web and CLI production builds passing.
- 2026-07-30: The former Node-runtime directory package is superseded by a Go native single-binary host. Go 1.24.5 and Rust 1.87.0 are available locally; Go was selected for standard-library embedding, HTTP serving, ZIP access, and reproducible Windows x64 builds. The native host migration starts with scene inspection, validation, extraction, `serve`, and `view`; Node remains only a development-time comparison harness. WSL has no installed distribution and QEMU/Docker are absent on this host, so second-platform runtime validation remains pending. Detailed evidence and Phase 7 status remain in `docs/ttt/D5A查看器持续演进.ttt.md`.

## Scheduled product expansion

- The local CLI is scheduled with `inspect`, `view`, `convert`, `batch`, `validate`, `extract`, and `serve`; `serve` launches the embedded WebUI on localhost.
- CLI and WebUI share parsers, converters, capability detection, fidelity reports, cancellation, concurrency and memory limits, and resumable batch state.
- SKP import and creation are the first dedicated format-adapter milestone. Validation covers multiple SKP generations, component instances, hierarchy, materials, textures, UVs, units, axes, metadata, and one high-polygon fixture.
- Common-format interchange then covers DXF, glTF/GLB, OBJ/MTL, FBX, STL, PLY, DAE, 3DS, USD/USDZ, ABC, and IFC, with optional backends for SDK- or host-dependent formats.
- Performance acceptance includes a 1.5-million-triangle single asset and a 100-file batch with reproducible throughput, peak-memory, cancellation, and restart tests.

## Verified findings

- The sample library contains 15,327 `.d5a` files totaling about 410 GB. Observed size range: 8,656 bytes to 1,589,440,767 bytes.
- `.d5a` is ZIP-compatible. Common root entries are `1.d5mesh`, `icon.png`, `info.json`, `summary.txt`, and `textures/`.
- A scan of the first 1,200 files found these local-header combinations:

| General-purpose flag | Method | Count | Interpretation |
| ---: | ---: | ---: | --- |
| 0 | 8 | 978 | Plain Deflate |
| 0 | 0 | 213 | Plain Stored |
| 2058 | 8 | 4 | Deflate with UTF-8/data descriptor flags |
| 2049 | 99 | 3 | WinZip AES wrapper, actual method in AES extra field |
| 2056 | 8 | 2 | Deflate with UTF-8/data descriptor flags |

- The plain sample `E:\D5 WorkSpace\model\_1.d5a` is 1,407,108 bytes and contains a 1,388,636-byte `1.d5mesh`, `info.json`, `summary.txt`, `icon.png`, and four JPEG textures.
- Its `info.json` reports dimensions `37.578472 x 34.558685 x 12.438389`, five material slots, `infoVersion: 19`, and texture references inside the nested JSON string `detailInfo`.
- `E:\D5 WorkSpace\model\矩形面片.d5a` uses ZIP method 99 and an AES extra field. Encrypted archives are a compatibility branch, not the only form in the corpus.
- User scope decision: encrypted official-library containers are out of the current implementation scope. Detect and explain them, but prioritize fully parsing plain D5A assets.
- `Z:\D5森林树库` is an additional reference corpus, especially for high-polygon vegetation stress tests.
- Public D5 documentation confirms `.d5a` is a directly importable D5 model format. It does not publish the `.d5mesh` binary layout.
- The public `Zscqy17/D5_Tools` repository contains a 212-byte synthetic plane mesh. It suggests a versioned binary header followed by JSON metadata, material/vertex data, and indices, but it is not yet treated as authoritative for general files.
- Version 11 `.d5mesh` is mapped through the end of the stream: UTF-16 JSON metadata, descriptor/material keys, column-major transforms, positions, normals, UVs, extra attributes, and indices.
- The full 15,327-file `E:` corpus scan found 7,730 plain D5Mesh archives, 6,871 legacy FBX archives, 3 ZIP-encrypted containers, 691 protected `All those moments` payloads, 30 unknown containers, and 2 invalid ZIP files. Plain D5Mesh versions are v9 (226), v10 (599), and v11 (6,905).
- The parsed geometry in `E:\D5 WorkSpace\model\_1.d5a` contains 5 groups and 12,844 triangles, exactly matching its metadata. Its transformed bounds also match the dimensions in `info.json`.
- `921c45dfb88fc0837ea94f22eac5391b.fbx.d5a` contains one 1,499,441-triangle group, one UV set, and three PBR texture files. All 4,498,323 UV tuples are finite and inside `[0,1]`; the visual corruption was caused by vertically flipping a top-left-origin D5/Unreal atlas.
- D5Mesh geometry is normalized to Unreal Z-up even when metadata `upVector` records a Y-up import source. The renderer now converts all modern D5Mesh roots to Three.js Y-up.
- `Z:\D5森林树库` contains 2,181 files totaling about 88.8 GB. The corpus includes a legacy D5A branch containing binary FBX, `d5material.xml`, and `textures/`.

## Implemented

- Strict bounds-checked D5Mesh version 11 parser with actionable diagnostics.
- ZIP inspection for modern D5Mesh, legacy FBX, encrypted, and unknown variants.
- Abortable zip.js extraction and Web Worker geometry parsing with transferable buffers.
- Identity-index removal and no-copy Three.js `BufferAttribute` creation.
- Modern `info.json` material parsing and diffuse, normal, roughness, metallic, opacity, and emissive texture binding.
- D5Mesh v9/v10 interleaved geometry, instance tables, Unreal Pitch/Yaw/Roll transforms, and v11 separated geometry are normalized into one descriptor model.
- Repeated v10 instances share one `BufferGeometry` per prototype; geometry disposal is identity-deduplicated.
- Modern D5 texture coordinates retain their native top-left atlas orientation; legacy FBX keeps its separate vertical-flip path.
- D5 material UV tiling, offset, rotation, normal scale, roughness-map strength, and roughness-map inversion are mapped into Three.js textures/materials.
- Actual D5 aliases such as `Normal Map One` are resolved without confusing scalar `Normal Map (opacity)` controls for texture slots.
- Texture slots settle independently: a failed slot is diagnosed with material, slot, and archive path after the remaining slots finish loading.
- If an archive contains model texture images but a completed build binds zero textures, the viewer reopens the same file once to discard stale parsed metadata/model state; a repeated zero-texture result becomes an explicit warning instead of a silent white model.
- Legacy FBX loading with `d5material.xml` material reconstruction.
- Texture path cache, 2048-pixel maximum edge, GPU memory estimate, and complete resource disposal.
- Legacy FBX geometry groups are reordered by material at load time so repeated groups collapse into one draw batch per material.
- Demand-driven rendering, bounded pixel ratio, optional continuous rotation, camera framing, grid, wireframe, screenshot export, canvas ray picking, multi-selection, visibility, isolation/restore, and selection framing.
- Static multi-material FBX meshes expose each material group as an independently selectable draw-range view while sharing position, normal, UV, index, material, and GPU buffers.
- Selected-part GLB/D5A export clones only node shells, flattens transforms into model-root space, borrows heavy resources, recalculates selected D5A dimensions, and rejects unresolved animation or skin dependencies explicitly.
- Full-model GLB/D5A export uses a detached all-visible projection, so temporary hide/isolate state and viewport presentation transforms never remove or rotate exported content.
- Desktop inspector and responsive mobile drawer with load progress, cancellation, format diagnostics, and resource budgets.
- Local Radiance HDR environment loading with PMREM, 0-3 intensity control, an independent background toggle, replacement/cancellation handling, and explicit GPU resource release.
- GLB is a first-class viewer input. A shared, reusable loader runtime supports Draco, Meshopt, and Basis Universal/KTX2; decoder code and WASM stay in lazy production chunks, worker concurrency is bounded, and the runtime is disposed with the viewport.
- D5A to GLB export performs an in-memory GLTFLoader readback plus independent Khronos Validator checks before download. Its schema-2 fidelity report covers geometry, hierarchy, matrices, UV0/UV1, PBR parameters, texture slots, samplers, dimensions, transforms, alpha modes, and validator findings.
- GLB inputs and D5A inputs both populate the validated schema-1 scene document. Ordinary unencrypted D5A export writes D5Mesh v11, infoVersion-19 material metadata, summary data, and PNG-encodable textures, then performs a complete archive, model-build, and fidelity-report readback before exposing the result.
- GLB documents transfer payload ownership to each build with `takePayload()`; a later controller rebuild re-reads and revalidates the original `File` only when needed, avoiding both a persistent duplicate and stale detached buffers.
- D5A write-back compacts every primitive to only its referenced vertices, retains shared instance geometry, preserves logical D5 material keys across sparse source slots, and restores diffuse-alpha cutout materials without double-applying an opacity map.
- Center-based D5 texture transforms are converted to equivalent `KHR_texture_transform` offsets during export, preserving source pixels without copying high-polygon geometry buffers.
- Compressed GLB texture budgets use actual mip payload bytes; uncompressed images retain dimension-based estimates. Camera framing accounts for both horizontal and vertical field of view.
- Production build splits the optional FBX loader into a separate chunk.

## Verification results

| Sample | Branch | Geometry | Parse | Draw batching | Estimated GPU | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `E:\D5 WorkSpace\model\_1.d5a` | D5Mesh 11 | 12,844 triangles | 9.4-13.3 ms | 5 model draws | 17.9 MB | Five materials render with 16.7 MB of GPU textures |
| `E:\D5 WorkSpace\model\921c45dfb88fc0837ea94f22eac5391b.fbx.d5a` | D5Mesh 11 UV stress | 1,499,441 triangles | 103-298 ms | 1 model draw | 201.3 MB | Diffuse, roughness, and normal maps total 64.0 MB; face, helmet marks, chest badge, controls, and hoses align |
| `E:\D5 WorkSpace\model\化肥.d5a` | D5Mesh 9 | 18,708 triangles | 4.7 ms | 4 model draws | 43.2 MB | Four UTF-8 descriptors, shared material lookup, and textures render correctly |
| `E:\D5 WorkSpace\model\30宽磁吸灯组.skp.d5a` | D5Mesh 10 instances | 52,540 triangles | 4.5 ms | 73 model draws | 62.5 KB | 73 instances reuse six prototype buffers; transformed long edge matches 766 |
| `E:\D5 WorkSpace\model\4.skp_2.d5a` | D5Mesh 10 textured | 11,856 triangles | 4.9 ms | 20 model draws | 12.5 MB | Instance transforms and 11.4 MB of GPU textures reconstruct the combined model |
| `E:\D5 WorkSpace\model\LG白色滚筒洗衣机.skp.d5a` | D5Mesh 11 | 30,066 triangles | 7.7 ms | 7 model draws | 4.9 MB | Revealed and fixed reversed-winding SketchUp surfaces with double-sided D5 materials |
| `Z:\D5森林树库\V75花与草\V75花与草\蒙古韭_03_V75.d5a` | Legacy FBX | 16,702 triangles | 0.13-0.19 s | 25 to 2 material batches | 5.9 MB | Geometry and two XML materials rendered |
| `Z:\D5森林树库\V81小树木\V81小树木\刺梧桐_01_V81.d5a` | Legacy FBX stress | 1,542,696 triangles | 4.93 s | 9,799 to 4 material batches | 336.6 MB | High-poly tree rendered without browser errors |

- On the 89.8 MB tree stress sample, batching reduced total renderer submissions from 9,800 to 5 including the grid.
- Limiting textures to a 2048-pixel edge reduced estimated texture GPU memory from 581.8 MB to 195.4 MB on the same tree.
- The 303.8 MiB `野芭蕉_06_V67.d5a` exercises the high-load confirmation dialog before extraction begins.
- Desktop 1280x720 and mobile 390x844 screenshots were checked for layout overlap and nonblank canvas content.
- Repeatable pixel checks reported 2,269 to 6,182 sampled colors and 15.7% to 36.6% foreground coverage across the modern, high-poly desktop, and high-poly mobile screenshots.
- Twelve unit test files with 56 tests, TypeScript project checking, and the Vite production build pass. The optional FBX parser is code-split from the main application.
- HDR resource checks: robot baseline 4 WebGL textures, HDR lighting 6, same-file replacement 6; switching to `_1.d5a` while HDR remains active gives 7, and clearing HDR returns to that model's baseline 5. Enabling the visible HDR background uploads one additional source texture.
- HDR layout checks: no horizontal overflow at desktop `983x912` or mobile `390x844`; the mobile exact intensity input displays `1.35` without clipping.
- D5A/GLB round trips: `_1.d5a` is pixel-identical after the texture-transform fix; the legacy transparent plant averages 99.9916% full-viewport similarity; the v10 73-instance fixture is pixel-identical and retains 62.5 KB of unique GPU geometry.
- Ordinary D5A write-back: the transparent plant retains 16,702 triangles and 50,106 vertices with 99.9363% average viewport similarity; the v10 fixture retains 52,540 triangles, 1,620 unique vertices, and 73 descriptors with a pixel-identical viewport; the 1,499,441-triangle robot retains 4,498,323 vertices and a pixel-identical fitted viewport.
- Robot D5A write-back produces a 56.2 MB archive in 9.62 s: scene check 0.3 ms, D5Mesh compile 2.27 s, texture encoding 483.4 ms, ZIP writing 4.73 s, and full readback 2.13 s. The repeated load keeps 137.3 MB of GPU geometry and 64.0 MB of GPU textures.
- Independent GLB rendering: Babylon.js 9.18.1 opens the latest `_1` export as 12,844 triangles, five meshes, four materials, and five textures in about 124 ms. `research/output/glb-independent-babylon-latest.png` passes the nonblank pixel check with 3,069 sampled colors and 7.16% foreground coverage.
- External compressed GLB checks: Draco and Meshopt variants of Khronos Box both decode to 12 triangles and 24 vertices, and their framed `556x832` viewport regions are pixel-identical. The Khronos AnisotropyBarnLamp variant combining Meshopt and four KTX2 textures renders 10,203 triangles, 7,712 vertices, and three meshes in about 648 ms on first load.
- KTX2 budget verification: the lamp's model texture estimate changed from an incorrect 85.3 MB RGBA estimate to 16.0 MB of actual compressed mip payloads. The desktop canvas is nonblank and the `390x844` layout has no horizontal overflow.
- Part export: `_1.d5a` single-part GLB/D5A round trips are pixel-identical; a shared material selects two meshes; the transparent plant exposes 7,852- and 8,850-triangle parts; and a 98,260-triangle trunk is extracted from the 1,542,696-triangle tree in 1.49 s without copying the other roughly 1.44 million triangles.
- Shared-instance extraction: one 828-triangle `KK0167` instance exports as a 15.3 KB D5A or 53.7 KB GLB and returns as one mesh/material with a pixel-identical viewport; the 73-instance source retains only 62.5 KB of shared GPU geometry.
- Visibility semantics: while only 1 of 73 v10 instances is visible, full GLB and D5A exports still return all 52,540 triangles, 73 meshes/descriptors, and four materials.
- Mobile part tools fit inside `390x844` with no horizontal overflow. The six active commands occupy `left=84/right=372`, and the inspector drawer occupies `left=73/right=383`.
- Twelve unit test files with 56 tests, TypeScript project checking, and the production build pass. Draco, Meshopt, KTX2, Basis transcoder, and validator code remain lazy chunks; the 1,051.07 KB main bundle still triggers the tracked 900 KB warning.

## Working architecture

- Browser-first React/TypeScript application.
- ZIP and mesh parsing in a Web Worker to keep interaction responsive.
- Three.js renderer with demand-driven frames, GPU resource disposal, texture caps, and large-file guardrails.
- Reusable GLB loading runtime shared by viewer and export readback, with optional renderer-aware KTX2 initialization.
- Schema-1 format-neutral scene documents are generated for modern D5Mesh, legacy FBX D5A, and GLB inputs. Geometry, instance, and animation buffers are borrowed rather than duplicated, while validation covers hierarchy and every cross-resource reference before conversion continues.
- Export projections separate UI state from file semantics: full projections preserve the complete model with all nodes visible, while selection projections contain only named selected meshes and reuse source geometry/material/texture storage until the target writer compacts its final buffers.
- The D5Mesh v11 writer contract is now recorded from a real file: little-endian version 11, counted UTF-16LE metadata, reserved zero, counted descriptors (`key`, material name, 16-float matrix), then counted geometry groups with separate position, normal, UV, extra, and index arrays. The `_1.d5a` fixture has a 57-character metadata record, five descriptors, and metadata triangle count 12,844.
- D5A write-back flattens node hierarchy to descriptor world matrices while retaining shared primitive geometry. Because the interchange document is right-handed Y-up and the D5 viewer applies `Rx(-90°)` on load, descriptors are written as `Rx(+90°) * nodeWorld`; instance-local matrices are composed before that conversion.
- The initial ordinary D5A archive writer targets `1.d5mesh`, a minimal infoVersion-19 `info.json`, `summary.txt`, and PNG-encodable textures. Unsupported primitive modes and semantics, generated normals/UVs, and compressed-mip texture transcoding gaps must remain visible in the round-trip fidelity report.
- The ordinary D5A writer now passes binary, archive, full viewer, and fidelity-report round trips. Coverage includes interleaved attributes, two descriptors sharing one geometry group, primitive-local vertex compaction, Y-up matrix conversion, generated required attributes, inverse center-based UV transforms, sparse logical material keys, alpha cutout, and reopening the generated ZIP through the existing archive/D5Mesh/model pipeline.
- High-polygon requirements: worker parsing, transferable buffers, cancellation, material batching, bounded device-pixel ratio, texture downscaling/caps, frame-on-demand rendering, and explicit triangle/GPU-memory budget warnings.
- Optional static hosting only; no mandatory native backend.
- Private local samples stay under `fixtures/private/` and are ignored by Git.

## Known limits

- D5Mesh payloads beginning with the protected `All those moments` marker are classified and reported without entering the plain parser.
- D5 shader controls beyond the mapped UV/PBR subset (for example saturation, subsurface, chamfer, and UDIM switching) still need explicit approximations or diagnostics.
- Official-library encrypted containers are detected and reported but are outside the current scope.
- Legacy FBX parsing is synchronous inside Three.js and can pause interaction for several seconds on million-triangle assets; extraction remains abortable before that parse step.
- D5 shader features without a direct Web PBR equivalent are approximated with `MeshStandardMaterial`.
- Selected-part export currently targets static meshes. Animated scenes and skinned meshes are stopped with explicit dependency diagnostics until track, skeleton, and joint closure is implemented.
