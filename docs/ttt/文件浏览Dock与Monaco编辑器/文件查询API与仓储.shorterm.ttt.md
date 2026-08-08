# 文件查询 API 与仓储 (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目的**: 将已存在的 `kernel/filequery.Service` 接入文件浏览 API 和前端仓储，为标签、关键词、星级、扩展名、RGB/HSL/调色板查询提供真实根作用域。

## 边界

- API 只负责认证边界、请求解码、`filequery.Service` 调用和统一响应包络；索引过滤仍由 `assetmeta.SearchAssetsAdvanced` 保持。
- `filequery.Service` 负责授权根到索引身份的映射；客户端只能提交稳定 `rootID`，不能提交绝对路径或索引内部 `data` 身份。
- 工作空间默认查询覆盖 `data + workspace`；显式 `allRoots` 只覆盖当前存在且具备浏览能力的根；失效/越权根返回明确错误。
- 前端仓储必须验证响应结构、回显根地址映射和分页字段，不能把未校验 JSON 交给视图。
- `pathPrefix + recursive=false + pathPrefixes` 组合表示“当前目录直接文件 OR 已选子目录递归内容”；混合 workspace `data` 身份和普通 workspace 路径必须合并根映射，不能只保留第一个子目录根。

## 进度

- [x] `filequery.Service` 根映射和默认/全根/失效根单元测试。
- [x] `/api/s-forge/file-browser/search` API handler、路由和错误映射。
- [x] 前端搜索契约、响应守卫、仓储和竞态控制器。
- [x] 真实 Vue 挂载测试覆盖标签/颜色组合请求；后端聚焦测试覆盖索引边界和授权根映射。
- [x] 目录面包屑/子目录选择请求通过共享仓储进入后端，并覆盖直接项、递归项和混合 workspace 根映射边界。
- [x] 响应守卫兼容 `assetmeta.AssetMeta` 的 `omitempty` 字段：未索引文件缺省 `width`、`height`、`fileSize` 时归一化为 `0`，非法数值和非法调色板仍拒绝。
- [x] 响应守卫错误改为可定位诊断：包络错误指出 `data.assets/totalCount/pageCount`，条目错误指出 `data.assets[index]`、相对路径、字段、期望类型和实际类型；合法的 200 条真实响应保持通过。
- [x] 诊断路径不在成功热路径创建条目错误字符串；调色板和可选字段校验改为复用常量/定长循环，避免为每个资源额外分配中间数组。

## 验收证据

- Go：API handler 使用临时 workspace 和 stub index，验证远端拒绝、默认 workspace、全部根和越权根。
- Vue：仓储测试验证包络、请求回显、分页和结构错误；搜索控制器测试验证取消/旧响应不覆盖新查询。
- 本轮 Vue 回归：`FileBrowser.query.repository.test.ts` 新增缺省媒体元数据响应；完整 `pnpm exec vitest --run test/sforge/fileBrowser` 为 21 个文件、60 个用例通过，`pnpm run typecheck:protyle-contract` 通过。
- 本轮真实响应验证：从本地 `6806` 读取 `root-ebc8c460379294ef/旧文件/新建文件夹`，响应为 `assets=200,totalCount=674,pageCount=4`，前端守卫解析通过；守卫单次解析耗时约 `0.6-0.9ms`。
- 本轮错误定位回归：覆盖缺失 `path` 和 `tags:null`，错误分别包含 `data.assets[0]`、路径和字段类型，不再只显示“响应格式错误”。
- 遍历性能基线（Windows，Intel i5-10400F）：`BenchmarkDirectorySnapshotNative` `4.93ms` vs 逐项 `Lstat` `78.33ms`；`BenchmarkRecursiveWalk/NativeParallel` `23.02ms` vs `filepath.Walk` `225.73ms`。该基线只证明当前小规模实现优势，不替代整个 D 盘验收。
