# Efu 与 Everything provider 迁移（TikTocTak）

> **状态**：契约冻结，接入进行中（2026-08-11）
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

## 待实现契约

- [x] 冻结 `FileBrowserExternalProvider` 的 provider ID、能力、健康状态、分页、取消和明确错误模型：`everything-http` 与 `efu` 独立请求/响应，页大小上限 1000，`context.Context` 取消直接返回取消错误，provider 失败不转为空结果。
- [x] Everything HTTP provider 只接受 loopback host（`localhost`、`127.0.0.1`、`::1`）和 1-65535 端口；结果使用短期受控 `ExternalAssetAddress` token，不冒充 workspace/Agent root，也不把绝对路径写入本地根页签数据。
- [x] EFU provider 只读取已授权根内的 `.efu` 文件，使用 RFC4180 CSV 解析；重复项保留，坏行、缺失字段、大小/时间转换错误写入逐项 `issues`，不静默过滤或伪造成功。
- [ ] 为两条 provider 设计独立 API 仓储和画廊来源页签；默认工作空间/Agent 根查询逻辑保持不变。
- [ ] 用本地 HTTP fixture、EFU 字节 fixture、取消、分页、服务不可用和路径越界测试验证；不得以空数组代替 provider 错误。
- [ ] 接入完成后把本文件移入 `docs/ttt/archive/`，保留审计证据和未完成边界。

## 冻结的领域响应

- `ExternalAssetAddress` 只包含 `provider`、短期 `token` 和展示用 `name`；token 由 kernel registry 生成，内容/缩略图请求不能提交任意绝对路径。
- `ExternalAssetPage` 保留 `assets`、`totalCount`、`offset`、`limit`、`hasMore`、`provider` 和 `issues`；Everything 的 HTTP/JSON/结构错误是页级错误，EFU 的行级问题只进入 `issues`。
- Everything 请求保留 `search`、`offset`、`limit`、`sort`；EFU 请求保留 `rootID`、`.efu` 根内 `path`、`offset`、`limit`。两者不修改 `filequery.SearchRequest`。

## 当前证据

- 本轮只完成参考调用链审计；未新增 provider 代码，未启动或停止 Everything 服务，未修改外部配置。
- 文件浏览改动的独立验证：`pnpm exec vitest --run test/sforge/fileBrowser`（31 个文件、105 个用例）、`pnpm run typecheck:protyle-contract`、`pnpm run dev:once` 和 `git diff --check`。
