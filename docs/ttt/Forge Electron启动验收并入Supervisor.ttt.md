# Forge Electron 启动验收并入 Supervisor (TikTocTak)

> **状态**: 已完成（ack 竞态消除；白屏是独立问题，见下）
> **创建日期**: 2026-08-13
> **完成日期**: 2026-08-13
> **目标**: 删除 forge-electron-launcher 的一次性 ack 服务器，Electron 启动验收（ready/rejected）与 UI Host 注册直连长生命周期的 ForgeRuntimeSupervisor，从结构上消除「双 60 秒超时 + ack 端口生命周期」竞态（即 `ECONNREFUSED 127.0.0.1:51106` 根因）。
>
> **重要边界（实测确认）**: ack 合并**消除了 `ECONNREFUSED`**（`.forge-runtime/state.json` 已记录 `lastElectronLaunch.state="rejected"` 回执），但**白屏问题依旧**——白屏的真正根因是「`siyuan-ready-to-show` 从未发出」，与 ack 竞态无因果。白屏需按 `docs/ttt/Electron App白屏修复.ttt.md` Phase 3A 单独追踪。

## 背景与根因

- 原链路：`forge-start` → `forge-electron-launcher` spawn Electron，launcher 创建一个**一次性 ack HTTP 服务器**（随机端口如 51106），通过 env（`S_FORGE_LAUNCH_ACK_URL/TOKEN`）交给 Electron；Electron 就绪/失败 POST 该服务器回执。
- 竞态：launcher 侧 60 秒计时起点在 spawn 前，main.js 侧 60 秒计时起点在 Electron 完全启动后，launcher 超时几乎总先触发 → `ready.close()` 关闭 ack 服务器 → Electron 稍后发迟到 rejected 回执 → `ECONNREFUSED`。
- 结构冗余：ack 服务器做的事（启动验收 + UI Host 描述符传递），Supervisor（长生命周期管理面）全部能做；Electron 作为本设备进程本就有 Supervisor 全权限（需要调用 `/restart`）。
- 上游核实：上游 siyuan 无 Supervisor、无 launcher、无 ack 服务器；`siyuan-ready-to-show` 60 秒兜底是上游 main.js 自有（`ipcMain.once` + `setTimeout(60000)`）。

## 新协议设计

### env 传递（forge-start → Electron）

| 环境变量 | 值 | 说明 |
|---|---|---|
| `S_FORGE_SUPERVISOR_URL` | Supervisor `controlURL` | Electron 启动验收/UI Host 注册目标 |
| `S_FORGE_SUPERVISOR_TOKEN` | Supervisor `supervisorToken`（`this.token`，全权限） | 认证头 `x-s-forge-supervisor-token` |

删除 `S_FORGE_LAUNCH_ACK_URL` / `S_FORGE_LAUNCH_ACK_TOKEN` / `x-s-forge-launch-token`。

### Supervisor 新增端点 `POST /launch/ready`

请求体：
```json
{ "state": "ready" | "rejected", "reason": "string(可选)", "uiHost": {…descriptor 可选}, "disposition": "created"|"reused"(可选), "port": 6806, "workspace": "…" }
```
- 认证：需 `supervisorToken`（Electron 是可信本设备进程，全权限）。
- 语义：幂等；Supervisor 记录 `lastElectronLaunch`（内存 + `state.json` 去敏），不阻塞任何流程。
- 响应：`202 {"accepted": true}`（重复回执同样 202，幂等）；`401` 未认证；`400` 非法 state。
- UI Host 描述符随回执携带时，Supervisor 直接注册进 `uiHosts`（复用 `registerUIHost`），不再经 launcher 中转。

### 超时归属

- Supervisor 不新增独立超时计时器；超时判定保留在 **launcher 侧**（`DEFAULT_UI_READY_TIMEOUT_MS`），launcher 通过 `Promise.race([electronReadyPromise, timeout])` 等待 Supervisor 记录到 ready 回执。
- 但 **ack 服务器不再存在**，因此没有「服务器关闭」竞态；launcher 超时后仅报告 `Electron main interface did not confirm readiness within Xms`，不再有端口可拒绝。
- Electron 侧 `siyuan-ready-to-show` 60 秒兜底（上游逻辑）保留，超时后 POST `{state:"rejected", reason:"main UI did not signal readiness within 60000ms"}` 到 Supervisor。

## 各文件改造点

### `app/electron/forge-kernel-attach.js`
- 删除：`FORGE_LAUNCH_ACK_URL_ENV`、`FORGE_LAUNCH_ACK_TOKEN_ENV`、`FORGE_LAUNCH_ACK_HEADER`、`FORGE_LAUNCH_UI_HOST_READY`、`FORGE_TOKEN_PATTERN`、`sendForgeLaunchAcknowledgement`、`sendForgeUIHostReady`。
- 新增：`FORGE_SUPERVISOR_URL_ENV = "S_FORGE_SUPERVISOR_URL"`、`FORGE_SUPERVISOR_TOKEN_ENV = "S_FORGE_SUPERVISOR_TOKEN"`、`FORGE_SUPERVISOR_TOKEN_HEADER = "x-s-forge-supervisor-token"`、`resolveForgeSupervisorContext(env)`（校验 URL 为 loopback、token 非空）、`sendForgeLaunchAcknowledgement(launchContext, payload)`（POST 到 Supervisor `/launch/ready`，`launchContext` 改为含 `supervisor` 字段）。

### `app/electron/main.js`
- `initialForgeLaunchContext = resolveForgeLaunchContext(process.env)` → 改为解析 Supervisor 上下文。
- `acknowledgeForgeLaunch(launchContext, payload)` 内部 `sendForgeLaunchAcknowledgement` 打到 Supervisor `/launch/ready`。
- `announceForgeUIHost`：UI Host 描述符随 ready 回执或单独 POST `/ui-hosts/register` 直连 Supervisor。
- 其余（`siyuan-ready-to-show`、60 秒兜底、`readyToShowTimeout`）逻辑不变。

### `app/scripts/forge-electron-launcher.js`
- 删除：`createLaunchAcknowledgement`、`readAcknowledgement`、`isLoopbackAddress`（若不再用）、`timingSafeTokenEqual`（若不再用）、`FORGE_LAUNCH_ACK_*` import。
- `launchElectronMain` 改造：
  - 不再创建 ack 服务器；
  - spawn 时注入 `S_FORGE_SUPERVISOR_URL/TOKEN`（来自调用方传入的 `supervisor` 凭据）；
  - 等待「Supervisor 记录到 ready 回执」通过轮询 `/status` 或直接由调用方提供 promise；**简化方案**：`launchElectronMain` 返回 `{child, args, forwarded:false}`，由 `openForgeElectronInterface` 轮询 Supervisor `/status` 的 `lastElectronLaunch.state === "ready"`（带超时）。
- `openForgeElectronInterface`：接收 `supervisor` 凭据，UI Host 注册直接调用 `registerUIHost`（Supervisor 已记录，无需再从中转解析）。

### `app/scripts/forge-start.js`
- `openForgeInterface` 调用处传入 `supervisor: {url: supervisor.controlURL, token: supervisor.token}`。
- `openForgeInterface` → `openForgeElectronInterface` → `launchElectronMain` 逐层透传。

### `app/scripts/forge-runtime-supervisor.js`
- 新增 `POST /launch/ready` 端点（见上）。
- `status()` 增加 `lastElectronLaunch`（去敏：不含 token）。
- `state.json` 持久化 `lastElectronLaunch`（仅 state/reason/disposition/port/workspace/uiHostId，不含 token）。

## 测试矩阵

| 文件 | 删除测试 | 新增/改写测试 |
|---|---|---|
| `app/test/forge-electron-launcher.test.js` | ack 服务器相关（`createLaunchAcknowledgement`、`FORGE_LAUNCH_ACK_*` 断言、超时竞态相关） | launcher 注入 Supervisor env、无 ack 服务器、超时报告 |
| `app/test/forge-runtime-supervisor.test.js` | — | `/launch/ready` 认证、幂等、UI Host 随回执注册、`status.lastElectronLaunch` |
| `app/test/forge-kernel-attach.test.js`（若存在） | ack 解析测试 | Supervisor 上下文解析 |

## 验收标准

1. `node --test test/forge-electron-launcher.test.js test/forge-runtime-supervisor.test.js` 全绿。
2. 全仓库无 `FORGE_LAUNCH_ACK` 残留引用。
3. `pnpm forge` 启动日志不再出现 `Forge launch acknowledgement failed: connect ECONNREFUSED`。
4. Electron 就绪/超时/UI Host 注册均能通过 Supervisor 完成，无一次性端口。

## ✅ 实施完成（2026-08-13）

- **完成清单**：
  - `app/scripts/forge-runtime-supervisor.js`：新增 `POST /launch/ready` 端点（`recordElectronLaunch`，幂等，UI Host 随回执直接注册）、`lastElectronLaunch` 状态（`status()` 输出并持久化）、`supervisor.json` 记录 `supervisorToken` 供 reuse 分支注入。
  - `app/electron/forge-kernel-attach.js`：删除全部 `FORGE_LAUNCH_ACK_*` 协议，新增 `S_FORGE_SUPERVISOR_URL/TOKEN` env、`x-s-forge-supervisor-token` 头、`resolveForgeSupervisorContext`、`sendForgeLaunchAcknowledgement`（POST Supervisor `/launch/ready`）。
  - `app/scripts/forge-electron-launcher.js`：删除 `createLaunchAcknowledgement`（一次性 ack 服务器）及全部关联代码；`launchElectronMain` 注入 Supervisor 凭据；`waitForElectronLaunch` 轮询 Supervisor `/status` 判定 ready/rejected/超时。
  - `app/scripts/forge-start.js`：两处 `openForgeInterface` 调用注入 `supervisor: {url, token}`。
  - `app/electron/main.js`：改用 `resolveForgeSupervisorContext`，`acknowledgeForgeLaunch`/`announceForgeUIHost` 直连 Supervisor。
  - 测试：`forge-electron-launcher.test.js` 重写为 Supervisor 模型；`forge-runtime-supervisor.test.js` 新增 `/launch/ready` 幂等/状态/UI Host 注册/非法 state 测试。
- **验证**：`node --test test/forge-electron-launcher.test.js test/forge-runtime-supervisor.test.js` = **68/68 通过**；`node --check` 全部通过；全仓库 `FORGE_LAUNCH_ACK` 残留 = 0。
- **实测边界**：`.forge-runtime/state.json` 的 `lastElectronLaunch.state="rejected"` 证明 Supervisor 直连已生效（`ECONNREFUSED` 消失），但 `rejected` 本身表明 `siyuan-ready-to-show` 未发出——**白屏根因独立，按 `Electron App白屏修复.ttt.md` Phase 3A 追踪**。
