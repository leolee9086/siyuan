# 外部 provider 根与目录树接入（TikTocTak）

> **状态**：进行中（2026-08-12）。父任务：[`文件浏览Dock与Monaco编辑器.ttt.md`](../文件浏览Dock与Monaco编辑器.ttt.md)。协议适配进度由 [`常见文件服务provider适配.shorterm.ttt.md`](常见文件服务provider适配.shorterm.ttt.md) 追踪；本文件只追踪通用 provider session/resource 到 Dock 树、画廊和内容读取的产品链路。

## 已冻结的真实模型

- 通用层级严格为 `provider -> session -> resource -> entry`。两个 provider 之间不存在“是否指向同一设备”这一领域关系；不提供判断入口，也不做指纹匹配、归并、去重、共享设备节点或联动生命周期。
- `N:` 与 `O:` 是 `windows-smb-mount` 在同一个 Windows 登录会话中明确发现的两个映射共享，因此可以出现在同一个 SMB session 下，但必须保持为 `视频素材` 与 `工作文件` 两个独立 resource。这是单个 provider 的枚举结果，不是跨 provider 设备识别。
- 稳定地址使用 `provider + session + resource + opaque entry token`；`N:`、`O:`、UNC、DSM `folder_path` 和 S3 object key 均不得由前端自行拼接。provider 返回的来源名称只用于当前 session 内展示，不构成可比较身份。
- 本地工作空间和 Agent 授权目录继续由 `kernel/filebrowser.Service` 管理；远端 session/resource 由 `kernel/fileprovider.ProviderRegistry` 管理。前端可以在同一棵侧边栏树中呈现二者，但仓储和操作地址保持显式联合类型，不伪装成同一种物理路径。
- 目录树与画廊必须消费同一份来源/资源/目录状态。provider 失败进入显式错误状态并保留重试与关闭会话动作，不返回空数组伪装成功。

## 里程碑

- [ ] M1：暴露 provider 描述列表、打开/关闭 session、分页资源根、分页目录、Stat、内容流和 operation 状态的通用 Kernel API；handler 只编排 registry，不按 Synology/S3/WebDAV 写分支。
- [ ] M2：注册 Synology File Station、S3、WebDAV 生产 adapter，并建立真实的配置/凭据解析边界；未配置来源不生成假根。
- [ ] M3：前端增加显式 `local-root | provider-resource` 地址联合类型、响应守卫和仓储；外部资源不复用 `rootID + path` 假装本地根。
- [ ] M4：Dock 以 provider、session、resource、entry 为树层级；不增加设备推断层。session 断开时保留对应节点的已知结构和显式错误信息。
- [ ] M5：画廊查询、分页已加载/总数、预览原图/缩略图、属性 Dock、标签/颜色索引和 Agent 新任务入口接入 provider 地址。
- [ ] M6：桌面身份下验证群晖 SMB 的 `视频素材`、`工作文件`；DSM HTTP、S3、WebDAV 使用可重复 fixture 与现场来源分别验收。

## 当前证据与缺口

- [x] 共享契约已具备细粒度 `SessionProvider`、`ListResource`、`StatResource`、`OpenResource`、CRUD、Watch、operation 和原样 cursor；Kernel registry 已具备相应进程级生命周期方法。
- [x] Synology HTTP provider 已能在未指定单根时通过 `list_share` 返回多个共享资源，并用 opaque resource ID 区分共享。
- [x] Router 已暴露 provider 描述、session 开关、resource/目录分页、Stat、内容流、health、operation 和 CRUD 通用端点；前端仓储已接入描述、session、resource、目录和 Stat。画廊完整状态、配置表单、内容/CRUD 操作 UI 仍按 M3-M5 继续。
- [x] production registry 已注册 Everything/EFU、Windows SMB mount、Synology、S3 和 WebDAV；Synology/S3/WebDAV 使用 Kernel 短期 credential vault 解析各自 schema。持久化配置、用户输入表单和现场服务验收仍属于 M2/M6 未完成项。
- [ ] Windows SMB 映射发现和用户桌面会话现场尚未验证；当前执行身份的访问拒绝只记录为身份边界，不作为共享缺失证据。
- [x] Synology/S3/WebDAV 的生产组合根已注册且默认要求 HTTPS；私网 HTTP 需要当前 session 的显式确认，且 API 在 credentials 进入短期 vault 前完成 provider 预校验。配置 UI 的确认控件与警示仍属于 M2/M4 产品链路未完成项。

## 变更记录

| 日期 | 事项 | 证据 | 状态 |
| --- | --- | --- | --- |
| 2026-08-12 | 闭合外部 provider 明文凭据传输边界 | 生产 registry 默认策略、API vault 零调用、三 provider 前置校验和前端零网络调用回归通过 | 完成逻辑节点；配置 UI 待接入 |
| 2026-08-12 | 冻结 provider 独立命名空间与 `provider -> session -> resource -> entry` | Kernel 使用结构化 provider/session/resource/path 键；同值双 provider 的 Kernel 与前端树回归通过 | 完成 |
| 2026-08-11 | 建立独立接入清单并冻结 provider/session/resource/entry 与盘符别名边界 | 用户截图与明确确认；现有 contract、registry、router、前端 repository 源码 | 进行中 |
