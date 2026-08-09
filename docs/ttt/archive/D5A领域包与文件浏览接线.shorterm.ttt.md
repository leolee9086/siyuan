# D5A 领域包与文件浏览接线（TikTocTak）

> **父任务**：[`D5A查看器迁移到S-Forge.ttt.md`](D5A查看器迁移到S-Forge.ttt.md)

## 任务边界

本子任务只追踪迁移包的原生复用边界、Kernel 授权适配和 D5A 文件预览入口，不重新实现 D5Mesh 解析器，不以伪造统计或占位卡片代替报告。

## 清单

- [x] 复制 `d5a-viewer` 当前源码、测试、CLI、研究脚本、文档和构建配置到 `packages/d5a-viewer`。
- [x] 将 `native` 包改为可导入的 `github.com/siyuan-note/siyuan/packages/d5a-viewer/native`，增加 `InspectFile`、`InspectFileJSON`、`InspectD5A`、`ValidateD5A`、`ExtractD5A` 和 `Run`。
- [x] 增加 `native/cmd/d5-tool`，保持单独命令行入口；原生构建脚本改为构建该入口。
- [x] Kernel 通过本地 Go module replace 复用迁移包；文件浏览器先校验 rootID/path，再调用 D5A parser。
- [x] 前端仓储、运行时守卫和 D5A 预览组件形成闭环；报告警告显式呈现。
- [x] 使用临时 `GOCACHE` 验证迁移包和 Kernel 聚焦测试，未在仓库根目录生成 gocache。
- [x] 增加独立 `.d5mesh` 预览报告端口，与 `.d5a` 共享报告模型但保留 `format=d5mesh` 和独立文件条目语义。
- [x] 运行迁移包独立 TS 全量测试/构建和原生发布脚本，保存结果与产物摘要；`verify-native` 的私有样本批次仍单列为待验收项。

## 已验证文件

- `packages/d5a-viewer/native/api.go`
- `packages/d5a-viewer/native/cmd/d5-tool/main.go`
- `kernel/api/file_browser.go`
- `kernel/api/router.go`
- `app/src/sforge/fileBrowser/FileBrowser.repository.ts`
- `app/src/sforge/fileBrowser/FileBrowserD5APreview.vue`
- `app/src/sforge/fileBrowser/FileBrowserPreviewPanel.vue`

## 证据

- `go test ./... -count=1`（迁移包 native 及 cmd）。
- `go test ./api -run TestFileBrowserD5AInspectionUsesMigratedDomainPackage -count=1`。
- `pnpm exec vitest --run test/sforge/fileBrowser/FileBrowserPreviewPanel.interaction.test.ts`（3 tests）。
- 迁移包 `npm test`（34 files / 122 tests）、`npm run build`、`npm run build:native`（外部 GOCACHE）和 `release/d5-tool.exe capabilities --json`。
