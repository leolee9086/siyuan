# Efu 与 Everything provider 迁移（TikTocTak）

> **状态**：领域包与 kernel adapter 注册表已完成首个真实切片，API/画廊接入仍进行中（2026-08-11）
> **父任务**：[`文件浏览Dock与Monaco编辑器.ttt.md`](../文件浏览Dock与Monaco编辑器.ttt.md)

## 已确认参考调用链

- SACAssetsManager 的 Everything provider 位于 `source/server/utils/glob/withEverything.js`，通过 `electron-edge-js` 调用 Everything DLL；另有 `src/utils/thirdParty/everything.js` 调用 Everything HTTP JSON 服务。
- HTTP 入口固定传递 `search`、`path_column`、`size_column`、`date_modified_column`、`date_created_column` 和 `count`，响应只把 `type=file` 项投影为本地资源项。
- EFU 入口位于 `src/utils/thirdParty/everything.js` 的 `parseEfuContentFromFile`；格式是 CSV 表头 `Filename,Size,Date Modified,Date Created`，Windows FILETIME/毫秒值需要按参考转换后再形成文件项。
- 画廊将 Everything/EFU 作为独立数据 provider，和默认工作空间遍历、标签索引、颜色索引不是同一个查询分支。

## s-forge 当前边界

- `kernel/filequery.Service.Search` 当前只协调授权根、`assetmeta` 索引和共享 `filebrowser.ScanContext`；没有 provider 配置、外部服务健康检查或 EFU 文件授权入口。
- 文件画廊目前只消费 `/api/s-forge/file-browser/search` 的根内相对 `{rootID,path}` 结果；不能把外部绝对路径直接注入该契约。
- 因而本切片不以给 `SearchRequest` 增加大量可选字段的方式伪接入 provider，也不把 HTTP 失败降级为空结果。

## 结构纠偏记录（2026-08-11）

- [x] 删除 Kernel 内按 provider 分文件的 `kernel/fileprovider/efu.go` 与 `kernel/fileprovider/everything.go`；两个独立包直接实现共享 provider DTO 和注册契约，Kernel 不再做字段映射。
- [x] provider 注册契约改为基础 `Provider + Descriptor`，查询、目录列表、Stat、Open、健康检查和 CRUD 通过能力接口分别调度；只读 EFU/Everything 不被迫实现写能力，SMB 可实现完整文件能力集合。
- [x] Everything HTTP 的列开关、loopback 校验、HTTP 健康检查和 provider-owned request 解码下沉到 `packages/everything-http-native`；EFU request 解码和 root-relative source 仍在 `packages/everything-efu`。
- [ ] 当前仍只有 EFU/Everything 查询能力真正接入；SMB/session、List/Stat/Open/CRUD/Watch、外部地址生命周期和统一画廊来源尚未完成，不能把能力接口声明当作功能完成。

## 待实现契约

- [x] 冻结 `FileBrowserExternalProvider` 的 provider ID、能力、健康状态、分页、取消和明确错误模型：`everything-http` 与 `efu` 独立请求/响应，页大小上限 1000，`context.Context` 取消直接返回取消错误，provider 失败不转为空结果。
- [x] Everything HTTP provider 只接受 loopback host（`localhost`、`127.0.0.1`、`::1`）和 1-65535 端口；结果使用短期受控 `ExternalAssetAddress` token，不冒充 workspace/Agent root，也不把绝对路径写入本地根页签数据。
- [x] EFU provider 只读取已授权根内的 `.efu` 文件，使用 RFC4180 CSV 解析；重复项保留，坏行、缺失字段、大小/时间转换错误写入逐项 `issues`，不静默过滤或伪造成功。
- [x] 领域包按真实职责拆开：现有 `packages/everything-client-http` 保持纯 TypeScript 浏览器客户端；Go Everything 领域实现位于独立 `packages/everything-http-native`；EFU 解析与分页位于独立 `packages/everything-efu`；不把 Go 与 TypeScript 混放在同一包目录。
- [x] kernel `fileprovider.ProviderRegistry` 只注册 adapter，统一校验 provider ID、重复注册、回包 provider、分页边界和 opaque address；`AddressRegistry.ResolveFor` 校验 token 所属 provider。
- [~] 已建立统一 provider-search API 组合入口和 registry factory；画廊来源页签、持久化配置和两条独立 API 仓储仍待实现，默认工作空间/Agent 根查询逻辑保持不变。
- [x] 已用本地 HTTP fixture、EFU 字节 fixture、分页、取消、服务不可用/结构错误、loopback 越界、真实 `filebrowser.Open` root-relative source 和 provider token 越界测试验证；测试不以空数组代替错误。
- [ ] 接入完成后把本文件移入 `docs/ttt/archive/`，保留审计证据和未完成边界。

## 冻结的领域响应

- `ExternalAssetAddress` 只包含 `provider`、短期 `token` 和展示用 `name`；token 由 kernel registry 生成，内容/缩略图请求不能提交任意绝对路径。
- `ExternalAssetPage` 保留 `assets`、`totalCount`、`offset`、`limit`、`hasMore`、`provider` 和 `issues`；Everything 的 HTTP/JSON/结构错误是页级错误，EFU 的行级问题只进入 `issues`。
- registry envelope 只保留 `provider` 与嵌套 `request` payload；Everything 请求类型由 `packages/everything-http-native` 自己定义 `host`、`port`、`search`、`offset`、`limit`、`sort`，EFU 请求类型由 `packages/everything-efu` 自己定义 `rootID`、`.efu` 根内 `path`、`offset`、`limit`。不再用跨 provider 的万能可选字段结构，也不修改 `filequery.SearchRequest`。

## 当前证据

- 真实领域与 adapter 代码：`packages/everything-http-native`、`packages/everything-efu`、`kernel/fileprovider`。
- 证据：`go test ./...`（`packages/everything-http-native`）、`go test ./...`（`packages/everything-efu`）、`go test ./fileprovider -count=1`（kernel）、`go test ./api -run 'TestFileBrowserProviderSearch' -count=1` 和提交门禁同款 `go test -short -tags fts5 ./...` 均通过；测试使用系统默认 `GOCACHE`，未创建项目内缓存目录；代理环境为 `http://127.0.0.1:7890`。
- 当前仍未接入 API 仓储、画廊来源页签、Everything 现场服务和 provider 配置持久化，因此本子任务不归档、不宣称 M2/M3 完成。
- 文件浏览改动的独立验证：`pnpm exec vitest --run test/sforge/fileBrowser`（31 个文件、105 个用例）、`pnpm run typecheck:protyle-contract`、`pnpm run dev:once` 和 `git diff --check`。
