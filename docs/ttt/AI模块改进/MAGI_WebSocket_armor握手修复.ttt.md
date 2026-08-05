# MAGI WebSocket armor 握手修复跟踪（TikTocTak）

> **目标**：修复 MAGI runtime monitor 在携带 armor 的浏览器 WebSocket 握手中，服务端未选择 `Sec-WebSocket-Protocol` 导致 Chromium 持续拒绝连接的问题。
>
> **当前状态**：🟢 实现与源级验证完成。真实 HTTP `101 Switching Protocols` 握手、标准 WebSocket 客户端、全量前后端测试及并发/静态检查均已通过；当前运行实例需按仓库既有流程更新 Kernel 并重新加载前端后才会载入本次修复。

## 固定边界

1. armor token 继续由现有身份签发、验签和一致性检查路径管理，不进入 URL、Cookie、事件载荷或持久化会话数据。
2. WebSocket 响应只回显版本化的公开协议，不回显 armor token。
3. 普通思源 `/ws` 客户端不声明子协议时保持原有行为。
4. MAGI channel adapter、LLM 接口、事件投影、Agent 会话数据和上游思源数据结构不参与本次改动。
5. 协议选择通过现有 WebSocket 路由与 MAGI wire contract 扩展，不为测试增加生产执行入口。

## 已确认根因

- 前端以 armor token 作为唯一 WebSocket subprotocol 发起连接。
- Melody 默认 upgrader 没有选择该 subprotocol，服务端仍返回 `101`，但响应缺少 `Sec-WebSocket-Protocol`。
- Chromium 按 WebSocket 协议拒绝该握手；armor 本身有效时服务端不会记录鉴权拒绝，因此浏览器错误与服务端零拒绝日志可以同时出现。
- 既有前端测试只检查伪造工厂的调用参数，Kernel 测试只直接调用鉴权函数，均未覆盖真实握手响应。

## 实施阶段

- [x] **Phase 1：真实故障复现**
  - 携带 subprotocol 的标准客户端稳定得到 `Server did not respond with sent protocols.`。
  - 相同地址不携带 subprotocol 时连接成功。
  - 原始 `101` 响应已确认缺少 `Sec-WebSocket-Protocol`。
- [x] **Phase 2：协议协商修复**
  - 定义版本化公开协议，前端同时声明公开协议与 armor。
  - `/ws` 仅对已识别的 MAGI runtime-monitor 请求选择公开协议。
  - armor 继续由现有请求头解析和连接期鉴权路径处理。
- [x] **Phase 3：真实测试**
  - 使用真实 Gin、Melody、HTTP server 和标准 WebSocket dialer 验证 `101` 与所选协议。
  - 验证缺少公开协议时握手失败，普通思源连接保持无子协议行为。
  - 验证 Guardian、workspace token、avatar-only 和缺失 armor 的既有鉴权矩阵。
- [x] **Phase 4：专项验证**
  - 运行前端 bridge/lifecycle 测试、Kernel API/server 测试、Go race/vet、目标 lint 和差异检查。
  - 记录运行时尚需前端重新加载与 Kernel 更新的交付边界。

## 验收矩阵

| 场景 | 预期结果 | 证据 |
|---|---|---|
| Guardian armor 浏览器握手 | 返回 `101`，所选协议为公开协议 | 真实 WebSocket server/dialer 测试 |
| 响应头保密 | `Sec-WebSocket-Protocol` 不包含 armor | 真实握手响应断言 |
| 缺少公开协议 | 在升级前返回 `400` | 真实失败握手测试 |
| 普通思源 WebSocket | 不声明子协议时仍连接成功 | 真实普通连接测试 |
| armor 鉴权 | 原有 Guardian/channel/route/workspace 约束不变 | Kernel API 鉴权测试 |
| 前端发送 | 协议列表依次包含公开协议和 armor | bridge 测试 |

## 实施结果

1. 前端 runtime monitor 连接依次声明公开协议 `magi-runtime-monitor-v1` 与现有 armor token；没有 armor 的连接仍沿用无子协议调用。
2. Kernel 在现有 `/ws` 路由升级前只识别 runtime monitor 请求并回选公开协议；普通思源 WebSocket 继续直接进入 Melody。
3. armor 仍从客户端声明的协议列表中提取，并继续通过原有签发、验签、Guardian 身份一致性、route class、channel 和到期强制断开逻辑处理；响应头不回显 armor。
4. `handleWebSocketRequest` 是生产 `/ws` 路由的实际处理器，真实握手测试直接覆盖该处理器，没有增加测试专用生产入口。

## 验证记录

| 检查 | 结果 |
|---|---|
| `go test -count=1 ./server ./api ./nerv/magi/websocket` | 通过；真实握手、Kernel API 和 MAGI WebSocket 包全部通过 |
| `go test -short -tags fts5 ./...` | 通过；Kernel 全包门禁通过 |
| `go test -race -count=1 ./server ./api` | 通过；server 与 api 未发现数据竞争 |
| `go vet ./server ./api ./nerv/magi/websocket` | 通过 |
| `pnpm exec vitest run test/magi/bindMagiWebSocketEventBridge.test.ts test/magi/useMagi.lifecycle.test.ts` | 通过；2 个文件、12 项测试 |
| `pnpm test` | 通过；Node 261 项与 Vitest 999 项，共 1260 项测试全部通过 |
| 目标 `lint:file` | HEAD 基线 21 项、当前 21 项、本次新增 0 项；均为目标文件既有结构规则债务，本修复不扩张为 MAGI 内部重构 |
| 差异检查 | `git diff --check` 通过；改动路径未涉及 channel adapter、LLM 接口、Agent 数据或上游会话结构 |

## 运行时交付边界

仓库规则禁止由本任务编译或重启 Kernel，也禁止运行前端 build；因此测试证明的是修复后的源代码与真实临时 HTTP/WebSocket server 行为。端口 `6806` 上已经启动的旧 Kernel 与已加载页面不会自动获得未交付的源代码，需由维护者按 Forge 既有更新流程加载 Kernel，并重新加载前端资源后再观察浏览器连接。

## 完成条件

真实握手、鉴权矩阵、前端协议构造和普通连接兼容全部通过；工作树差异不涉及 channel adapter、LLM 接口、Agent 数据或上游会话结构。

**计划创建时间**：2026-08-05
