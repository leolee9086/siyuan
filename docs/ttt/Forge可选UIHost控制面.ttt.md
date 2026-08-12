# Forge 可选 UI Host 控制面 (TikTocTak)

> **状态**: 进行中
> **创建日期**: 2026-08-13
> **目标**: 在不假设 Electron 必然存在的前提下，让 Forge Kernel 通过 Supervisor 查询已注册 UI Host，并调用 Host 明确声明的能力；首个闭环仅实现只读 `ui.windows.inspect`。

## 平台与依赖边界

- Kernel 和 Supervisor 只认识通用 Host 描述符：`id`、`kind`、`platform`、`capabilities`、`state`，不得依赖 `BrowserWindow`、`webContents` 或 Electron IPC 类型。
- Electron、浏览器、移动端是可选 Host 适配器；浏览器、移动端、`--browser` 与 `--no-browser` 在没有适配器时返回空 Host 集合。
- “没有 Host”“Host ID 不存在”“能力未声明”“Host 离线”“能力执行失败”使用不同错误码，不以空结果或占位数据掩盖失败。
- Host 控制 URL 和令牌只允许在本机回环控制链中流转，只保留在 Supervisor 内存，不写入公开状态或 `.forge-runtime/state.json`。
- Electron 主进程提供窗口诊断，不能依赖渲染器 IPC；主界面白屏、未发送 `siyuan-ready-to-show` 或渲染器崩溃时仍应可查询。

## 原子节点 1：只读窗口诊断

- [x] 建立共享 UI Host 描述符、能力名、调用请求和状态响应校验。
- [x] 建立独立令牌保护的 IPv4 回环 Host 控制端点，覆盖 `/status` 与 `/invoke`。
- [x] Electron 仅在 Forge 外部 Kernel 附着模式按需创建 Host；普通 Electron 启动不创建 Forge Host。
- [x] Electron 新实例和复用既有单实例两条启动路径均通过原 Forge 启动回执携带可选 Host 描述符。
- [x] `ui.windows.inspect` 返回真实窗口 URL、类型、可见性、焦点/最小化/最大化状态、渲染器状态、工作空间和启动诊断。
- [x] 启动诊断记录主 URL 发起、主帧完成/失败、`siyuan-ready-to-show`、60 秒超时和渲染器退出。
- [x] Supervisor 提供内存 Host 注册表、实时探活和通用能力调用；持久状态只包含去敏后的 Host 状态。
- [x] Kernel 提供通用 `uiHosts` 和 `invokeUIHost` API，不包含 Electron 分支。
- [x] Node 回环与 Supervisor 聚焦测试覆盖错误令牌、未知能力、执行失败、空 Host、离线 Host、成功调用和密钥去敏。
- [x] Kernel 定向处理器测试覆盖非 Forge 空集合、通用 Host 列表、严格调用字段和结构化错误透传。
- [ ] 通过当前 Forge Supervisor 部署本提交，并确认运行 Kernel revision 与提交一致。
- [ ] 在真实 Electron 白屏现场调用 `ui.windows.inspect`，保存窗口状态、启动诊断和 API 响应证据。

## 后续原子节点

- [ ] 为明确有副作用的能力分别设计授权和状态机：窗口重载、截图、DevTools；不得塞入一个带大量可选参数的万能调用。
- [ ] 按实际平台需求增加浏览器或移动端 Host 适配器；不存在适配器的平台继续使用空集合语义。
- [ ] 增加 Host 主动注销或有界离线记录清理，避免长时间 Supervisor 中累积失效 Host。

## 当前验证证据

- `node --test test/forge-ui-host-control.test.js test/forge-electron-launcher.test.js test/forge-runtime-supervisor.test.js`：67/67 通过。
- `go test ./api -run "TestForgeRuntime" -count=1`：通过，使用系统默认 Go 构建缓存，未创建工作区缓存目录。
- `go test ./api ./util -count=1`：使用当前用户已配置的系统默认 Go 构建缓存，`api` 与 `util` 均通过；未修改缓存目录或编译配置，未创建工作区缓存目录。
- `go vet ./api ./util`：通过，使用系统默认 Go 构建缓存。
- 所有修改的 JavaScript 文件通过 `node --check`，`git diff --check` 通过。
- 定向执行前端 ESLint 时，`electron/main.js` 及 CommonJS 脚本被浏览器配置统一报 `require/process/Buffer` 未定义，脚本目录又被项目 ignore；这不是该运行域的有效门禁。本节点新增的实际未使用捕获变量已修正，验收以项目 Node 测试和 `node --check` 为准。

## 完成条件

- [ ] 原子节点 1 形成单独提交，提交内容只包含本 TTT 与 UI Host 控制链文件。
- [ ] 运行时状态证明 Kernel 已部署到该提交；Electron 主进程能力需在下次正常 Forge UI 启动后注册。
- [ ] 完成真实白屏现场验收后，将本 TTT 移入 `docs/ttt/archive/`，保留完整审计记录。
