# 文件查询 API 与仓储 (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目的**: 将已存在的 `kernel/filequery.Service` 接入文件浏览 API 和前端仓储，为标签、关键词、星级、扩展名、RGB/HSL/调色板查询提供真实根作用域。

## 边界

- API 只负责认证边界、请求解码、`filequery.Service` 调用和统一响应包络；索引过滤仍由 `assetmeta.SearchAssetsAdvanced` 保持。
- `filequery.Service` 负责授权根到索引身份的映射；客户端只能提交稳定 `rootID`，不能提交绝对路径或索引内部 `data` 身份。
- 工作空间默认查询覆盖 `data + workspace`；显式 `allRoots` 只覆盖当前存在且具备浏览能力的根；失效/越权根返回明确错误。
- 前端仓储必须验证响应结构、回显根地址映射和分页字段，不能把未校验 JSON 交给视图。

## 进度

- [x] `filequery.Service` 根映射和默认/全根/失效根单元测试。
- [x] `/api/s-forge/file-browser/search` API handler、路由和错误映射。
- [x] 前端搜索契约、响应守卫、仓储和竞态控制器。
- [x] 真实 Vue 挂载测试覆盖标签/颜色组合请求；后端聚焦测试覆盖索引边界和授权根映射。

## 验收证据

- Go：API handler 使用临时 workspace 和 stub index，验证远端拒绝、默认 workspace、全部根和越权根。
- Vue：仓储测试验证包络、请求回显、分页和结构错误；搜索控制器测试验证取消/旧响应不覆盖新查询。
