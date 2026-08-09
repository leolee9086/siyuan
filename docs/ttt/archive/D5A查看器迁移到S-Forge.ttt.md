# D5A 查看器迁移到 S-Forge（TTT）

## 目标

将 `D:\dev\d5a-viewer` 当前工作树完整纳入 S-Forge 的 `packages` 目录进行统一物理管理，包含 D5A/D5Mesh/D5M/GLB 预览器、处理器、原生 CLI、测试、研究脚本、文档、样本、构建产物和依赖快照；不创建新的 monorepo，不复制嵌套 Git 元数据，不改写原项目历史。

## 范围冻结

- TS 预览器：`packages/d5a-viewer/src` 全量迁移，包含 React/Three.js 视图、D5Mesh Worker、D5M 材质管线、GLB/DXF/D5A 导出和批处理运行时。
- Go 处理器：`packages/d5a-viewer/native` 全量迁移，包含 D5A ZIP 归档、D5Mesh v9/v10/v11、GLB 结构检查、DXF 转换、原生 WebUI 服务、CLI 与测试。
- 研究和证据：`packages/d5a-viewer/research`、`packages/d5a-viewer/docs`、根级构建配置和 `public/generated` 全量迁移。
- 当前工作树中的 `node_modules`、`fixtures`、`.artifacts`、`research/output`、构建产物和原生 WebUI 嵌入资源均已物理复制；迁移包自身的 `.gitignore` 只控制后续新生成物，不影响本次完整迁移快照。

## 进度

- [x] 在 `packages/d5a-viewer` 建立完整迁移目录，保留原项目相对路径和项目文档。
- [x] 将原生目录改造成可复用领域包，增加 `native/api.go` 稳定入口和 `native/cmd/d5-tool` 命令入口；CLI 与 Kernel 共用同一份解析代码。
- [x] Kernel `go.mod` 以本地 replace 接入迁移包，不引入远程依赖或 monorepo 工具链。
- [x] 文件浏览器增加根相对 `POST /api/s-forge/file-browser/d5a/inspect`，授权解析后返回 D5A 结构报告。
- [x] `.d5a` 文件页签消费真实报告，显示容器变体、条目、D5Mesh 版本、三角面/顶点/组/描述符、材质纹理引用和显式警告。
- [x] 迁移包 Go 测试全通过；Kernel D5A API fixture 覆盖真实 ZIP + D5Mesh v11 解析；前端预览交互覆盖报告渲染。
- [x] 将独立 `.d5mesh` 接入同一文件浏览结构报告端口；D5M 材质仍保留自己的 material loader/preview pipeline，不与场景容器解析混用。
- [x] 完成迁移包前端独立 `npm test`（34 文件、122 用例）和 `npm run build`；原生 `npm run build:native` 在仓库外 `GOCACHE` 下通过，生成 Windows PE `release/d5-tool.exe`（13,163,520 bytes）。
- [x] 已完成的迁移子 TTT 已移动到 `docs/ttt/archive`，原记录内容保持不变；未完成项未移动或删除。

## 验收证据

- Go 迁移包：`packages/d5a-viewer/native` 的 `go test ./... -count=1`。
- Kernel：`go test ./api -run TestFileBrowserD5AInspectionUsesMigratedDomainPackage -count=1`，验证根相对地址、真实 D5Mesh v11 三角面/顶点报告和无绝对路径泄漏。
- 前端：`pnpm exec vitest --run test/sforge/fileBrowser/FileBrowser.repository.test.ts test/sforge/fileBrowser/FileBrowserPreviewPanel.interaction.test.ts test/sforge/fileBrowser/FileBrowser.open.test.ts test/sforge/fileBrowser/useFileBrowser.test.ts`，4 个文件、19 个用例通过，覆盖 D5A 正向/异常响应契约。
- 全量迁移清单：源目录 10,391 个非 `.git` 文件，目标目录 10,394 个文件，缺失 0 个；额外 3 个为 Kernel 复用所需的 `native/api.go`、`native/api_test.go` 和 `native/cmd/d5-tool/main.go`。
- 工作区现有全量类型/lint 诊断按项目规则记录；本任务只处理新增 P0 逻辑错误。

## 变更记录

### 2026-08-09

- 完成完整代码物理迁移和原生包化；保留原项目的研究/处理器/测试文件。
- 接入 Kernel D5A inspection API 和文件浏览主预览报告组件。
- 迁移包和聚焦 Kernel/前端测试通过；私有样本批次和桌面内嵌 WebUI 现场验收继续单列。

### 2026-08-09 完整工作树迁移

- [x] 将原项目当前工作树中的 `fixtures`、`.artifacts`、`research/output` 和 `node_modules` 补齐到 `packages/d5a-viewer`，保留原有相对路径；未复制嵌套 `.git`。
- [x] 迁移包文件清单复核：`missing=0`；新增的 3 个原生入口文件属于 S-Forge 的领域包化接线。
- [x] D5A 接线子 TTT 已归档至 `docs/ttt/archive/D5A领域包与文件浏览接线.shorterm.ttt.md`。

### 2026-08-09 迁移包独立验收

- [x] `npm install --ignore-scripts --offline` 在迁移目录完成依赖恢复。
- [x] `npm test`：34 个测试文件、122 个用例通过。
- [x] `npm run build`：WebUI 与 CLI 构建通过。
- [x] `$env:GOCACHE=<仓库外临时目录>; npm run build:native`：原生构建通过，PE 头校验和 SHA-256 已输出。
- [x] `release/d5-tool.exe capabilities --json`：确认 D5A inspect/view/validate/extract/convert:dxf、GLB、DXF 和内嵌 WebUI 能力声明。

## 2026-08-09 迁移完整性复核（当前工作树）

- [x] 重新扫描 `D:\dev\d5a-viewer` 与 `packages/d5a-viewer` 的全部非 `.git` 文件：源 `10,362` 个、目标 `10,365` 个，缺失 `0` 个；额外的 3 个仍仅为领域包入口 `native/api.go`、`native/api_test.go` 和 `native/cmd/d5-tool/main.go`。
- [x] 对 2,272 个非构建/依赖文件逐一计算 SHA-256；除原生包化改动外没有未解释差异。21 个差异均为原生 `package main` -> 可导入 `package d5a`、迁移模块路径、CLI 构建入口和包级 `.gitignore` 调整。
- [x] `npm test`：34 个文件、122 个用例通过；`npm run build` 的 WebUI 与 CLI 构建通过。
- [x] `go test ./... -count=1`（`packages/d5a-viewer/native`）：原生领域包与 `cmd/d5-tool` 通过。
- [x] Kernel 通过 `go list` 解析 `github.com/siyuan-note/siyuan/packages/d5a-viewer/native` 到 `D:\dev\s-forge\packages\d5a-viewer\native`；`go test ./filebrowser -count=1` 与 D5A/文件操作 API 聚焦测试通过。
- [x] `$env:GOCACHE=<仓库外临时目录>; npm run verify:native-convert` 通过：真实 D5A/GLB/高面数 D5A 分别回读 `12,844`、`3,968`、`1,499,441` 个三角面，DXF 图层/米制单位/EOF/True Color 与拒绝覆盖均通过；最高样本输出 `457.96 MiB`、峰值 Go 内存 `139.1 MiB`。
- [x] 迁移目录仍保留源项目的 `src`、`native`、`research`、`docs`、`fixtures`、`.artifacts`、`public`、`dist`、`dist-cli`、`release` 和 `node_modules` 相对路径；没有复制嵌套 Git 元数据，也没有删除外部源目录。
- [x] 临时 Go 缓存使用仓库外临时目录并已清理；`git diff --check` 通过。

## 2026-08-09 当前环境复核补记

- [x] 以当前两个工作树重新枚举全部非 `.git` 文件：源 `10,391` 个、目标 `10,394` 个，缺失 `0` 个；目标额外的 3 个仍为 `native/api.go`、`native/api_test.go` 和 `native/cmd/d5-tool/main.go`。
- [x] 同步核对非 `.git` 目录：源 `629` 个、目标 `631` 个，缺失 `0` 个；额外的 `native/cmd` 与 `native/cmd/d5-tool` 是上述 CLI 领域包入口目录。
- [x] 当前完整快照的 23 个字节差异均有记录：19 个原生文件改为可导入 `d5a` 包、`native/go.mod`/CLI 构建入口和包级 `.gitignore` 的领域包化调整，以及构建生成的 `node_modules/.vite` 结果、`release/d5-tool.exe` 和路径调整脚本；没有未解释的源文件缺失。
- [x] `$env:GOCACHE=<仓库外临时目录>; go test ./... -count=1`（迁移包）通过；`go list` 仍解析至 `D:\dev\s-forge\packages\d5a-viewer\native`。
- [x] `npm test`（34 个文件、122 个用例）、`npm run build` 和 `npm run verify:native-convert` 均通过；当前高面数样本为 `1,499,441` 面、输出 `457.96 MiB`、峰值 Go 分配 `139.4 MiB`。

## 2026-08-09 全量迁移门禁固化

- [x] 新增 `app/scripts/verify-d5a-migration.mjs` 与 `app/package.json` 的 `verify:d5a-migration` 入口；校验递归遍历源/目标全部条目，包含隐藏文件、依赖快照、构建产物、样本和研究输出，不按功能白名单筛选。
- [x] 当前门禁命令 `pnpm run verify:d5a-migration` 输出：源 `11,020` 条、目标 `11,026` 条，`missing=0`、`typeMismatches=0`；目标额外 6 条为领域包入口目录/文件及本次验证报告，不存在源路径缺失。
- [x] 门禁默认只要求源路径完整覆盖目标；`--hash` 可对全部同路径文件执行 SHA-256 审计，`--strict` 可额外将目标新增条目视为失败。嵌套 `.git` 元数据始终不纳入迁移清单，避免在 S-Forge 内形成第二个仓库。
