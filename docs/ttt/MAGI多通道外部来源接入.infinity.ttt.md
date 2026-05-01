# MAGI 多通道外部来源接入 执行跟踪 (TikTocTak)

> **任务类型**: 🔄 无限滚动任务
> **目标**: 为 MAGI 建立通用多通道外部来源接入框架，使微信、Discord、Telegram 等 IM 渠道能够以统一接口接入 MAGI 认知引擎，并具有完善的、可配置的可信度管控体系。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 核心原则

1. **通道无关抽象**: 所有外部来源通过统一的 `ChannelAdapter` 接口接入，禁止在 MAGI 核心逻辑中出现特化通道代码。
2. **默认不可信**: 所有外部来源默认 `Trust=low, Risk=high`，`DirectResponseAllowed=false`，必须走 Avatar 路径。
3. **信任只能收敛不能扩张**: 请求方无法通过伪造信号提升自身可信度；trust/risk 以服务端配置为准。
4. **会话隔离**: 不同通道、不同账号、不同用户的来源会话完全隔离。
5. **防语义攻击**: channel 名称必须归一化到白名单枚举，禁止自由文本标签进入 LLM 输入。
6. **一次接入，持续扩展**: 后续新增通道只需实现 `ChannelAdapter` 接口并注册，无需改动 MAGI 核心路由。

## 验证检查清单

- [ ] `ChannelAdapter` 接口定义清晰，不包含任何特化通道类型引用
- [ ] WeChat 通道完整实现（消息接收、发送、CDN 媒体、登录）
- [ ] 可信度配置系统支持每个通道独立配置默认 trust/risk
- [ ] 支持按用户粒度覆盖 trust/risk（白名单、黑名单）
- [ ] 外部来源消息走 Avatar 路径，不可直接进入三贤人主循环
- [ ] 新增虚拟通道（如 Discord Mock）可通过接口在 1 小时内完成接入
- [ ] 会话按 `channel:account:user` 三级隔离

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：以 Go 编译通过、测试通过和功能验证为准，不凭感觉宣布完成。

## 🟢 近期计划

- [ ] **Phase 8: 自定义 Webhook 通道**
  - **愿景**: 允许用户通过 Webhook 自定义接入外部系统**
  - **背景**: 外部来源的可信度必须可配置、可持久化、可运行时更新。
  - **行动**:
    1. 实现 `channel/trust/` 包：配置加载、合并、缓存、热更新
    2. 实现 JSON Schema 验证的配置文件格式
    3. 实现通道级默认 trust/risk、用户级覆盖、黑白名单
    4. 集成到 `magi_source.go` 的 `buildRequestSourceContext` 流程
    5. 添加配置相关的 API 端点（`GET/PUT /api/magi/channels/trust-config`）
  - **验收标准**:
    - 配置缺失时默认 `Trust=low, Risk=high`
    - 用户级覆盖可单独配置 trust/risk
    - 黑白名单前置过滤有效
    - 运行时更新配置无需重启服务
  - **参考文档**: `docs/设计/MAGI多通道外部来源架构.design.md`

## 🟡 中期计划

- [ ] **Phase 6: Discord 通道适配器**
  - **愿景**: 通过 Discord Bot API 接入，验证接口通用性
- [ ] **Phase 7: Telegram 通道适配器**
  - **愿景**: 通过 Telegram Bot API 接入**
  - **背景**: 首个真实通道，验证接口设计的完备性。
  - **行动**:
    1. 实现 `channel/wechat/` 包实现 `ChannelAdapter` 接口
    2. iLink Bot API 客户端（getUpdates/sendMessage/getUploadUrl/getConfig/sendTyping）
    3. CDN 媒体上传/下载/AES-128-ECB 加解密
    4. 长轮询消息接收循环（goroutine 常驻）
    5. QR 扫码登录流程
    6. `WeixinMessage` → `InboundMessage` 转换
    7. 出站消息发送（文本 + 媒体）
  - **验收标准**:
    - 可通过微信收发文本消息
    - 可通过微信收发图片/文件
    - 二维码登录可正常完成
    - 断线自动重连

- [ ] **Phase 4: MAGI 路由集成 (P1)**
  - **背景**: 将通道适配器的消息流转入 MAGI 现有决策管线。
  - **行动**:
    1. `channel/` 消息 → `DispatcherTask` → `dispQueue` 的桥接
    2. `InboundMessage` → `RequestSourceContext` 转换（注入 trust/risk）
    3. 出站路由：`CoordinateDecision` 返回时按 `sourceCtx.Channel` 分发到对应通道
    4. 会话管理集成（`sourceSessionKey = "channel:account:user"`）
    5. 心跳集成（外部来源休眠期间仍可触发心跳）
  - **验收标准**:
    - 微信消息完整走通：接收 → MAGI 决策 → 回复
    - 多微信账号会话隔离
    - 黑名单消息不进入队列

- [ ] **Phase 5: 管理面板与运维能力 (P2)**
  - **行动**:
    1. 实现 `GET /api/magi/channels` 查看所有已注册通道状态
    2. 实现 `POST /api/magi/channels/:id/login` 触发通道登录
    3. 思源笔记面板集成：通道状态、信任配置编辑
    4. 日志与监控：通道消息量、错误率、延迟
  - **验收标准**:
    - 可在管理界面查看所有通道连接状态
    - 可在管理界面编辑信任配置
    - 通道异常时有日志告警

## 🔴 远期计划

（无）
  - **愿景**: 允许用户通过 Webhook 自定义接入外部系统

## 🏁 已归档/已完成

- [x] **Phase 5: 管理面板与运维能力 (P2)** [已完成 2026-04-30]
  - **背景**: 需要前端界面管理通道状态和信任配置。
  - **完成情况**:
    - 创建 `ExternalChannelsPanel.vue` Vue 组件：显示通道状态卡片、信任配置编辑面板
    - 后端 API：`GET /channel/list`、`GET /channel/trust-config`、`PUT /channel/trust-config`、`POST /channel/:channelId/login`
    - 在 MagiWorkspace 新增 "CHANNELS" 模式标签
    - REST API service 层 `magiExternalChannels.ts`
  - **成果文件**:
    - `app/src/magi/components/external-channels/ExternalChannelsPanel.vue`
    - `app/src/magi/components/external-channels/ExternalChannelsPanel.css`
    - `app/src/magi/service/magiExternalChannels.ts`
    - `kernel/api/magi_channel.go`
    - `kernel/api/router.go`
    - `app/src/magi/entry/MagiWorkspace.vue`

- [x] **Phase 4: MAGI 路由集成 (P1)** [已完成 2026-04-30]
  - **背景**: 将通道适配器的消息流转入 MAGI 现有决策管线。
  - **完成情况**:
    - 在 `channel/bridge.go` 实现全局 `Bridge` 桥接器
    - 在 `magi.go` 实现 `handleChannelInbound()` 将 `InboundMessage` → `RequestSourceContext` → `DispatcherTask`
    - 在 `magi.go` 实现 `routeChannelOutbound()` 将 MAGI 回复路由回对应通道适配器
    - 在 `magi.go` 实现 `handleChannelTask()` 处理外部通道消息（无 OpenAI 请求体）
    - 会话管理集成：`sourceSessionKey = "channelID:accountID:userID"`
    - 外部通道消息强制走 Avatar 路径（`DirectResponseAllowed=false`）
  - **成果文件**:
    - `kernel/nerv/magi/channel/bridge.go`
    - `kernel/api/magi.go`
  - **验证命令**: `cd kernel && go build ./api/...`

- [x] **Phase 3: WeChat iLink 通道适配器实现 (P1)** [已完成 2026-04-30]
  - **背景**: 首个真实通道，验证接口设计的完备性。
  - **完成情况**:
    - 在 `channel/wechat/` 下实现 `ChannelAdapter` 接口
    - iLink Bot API HTTP 客户端（getUpdates/sendMessage/getUploadUrl/getConfig/sendTyping）
    - QR 扫码登录流程（StartQRLogin/WaitQRLogin）
    - 长轮询消息接收循环（断线自动重连 + 指数退避）
    - `WeixinMessage` → `InboundMessage` 转换（文本/图片/语音/文件/视频）
    - 通过 `channel.GlobalBridge()` 推入 MAGI 队列
  - **成果文件**:
    - `kernel/nerv/magi/channel/wechat/types.go`
    - `kernel/nerv/magi/channel/wechat/api.go`
    - `kernel/nerv/magi/channel/wechat/auth.go`
    - `kernel/nerv/magi/channel/wechat/adapter.go`
    - `kernel/nerv/magi/channel/wechat/inbound.go`
  - **验证命令**: `cd kernel && go build ./nerv/magi/channel/...`

- [x] **Phase 2: 可信度配置系统实现 (P0)** [已完成 2026-04-30]
  - **背景**: 外部来源的可信度必须可配置、可持久化、可运行时更新。
  - **完成情况**:
    - 在 `channel/trust/` 实现配置加载/保存/查询/热重载
    - 支持通道级默认 trust/risk、账号级覆盖、用户级覆盖
    - 支持黑白名单前置过滤
    - 安全基线：配置缺失时默认 `Trust=low, Risk=high`
    - 防抬升机制：用户覆盖 trust 只能低于或等于账号基线，risk 只能高于或等于账号基线
    - 配置文件路径：`<workspace>/conf/channel-trust.json`
  - **成果文件**:
    - `kernel/nerv/magi/channel/trust/config.go`
    - `kernel/nerv/magi/channel/trust/manager.go`
    - `kernel/nerv/magi/channel/trust/resolve.go`
  - **验证命令**: `cd kernel && go build ./nerv/magi/channel/...`

- [x] **Phase 1: 通用 ChannelAdapter 接口设计与核心类型定义 (P0)** [已完成 2026-04-30]
  - **背景**: 确立通道适配器的抽象契约。
  - **完成情况**:
    - 在 `kernel/nerv/magi/channel/` 下创建了 `types.go`（InboundMessage/OutboundMessage/MediaAttachment）
    - 创建了 `adapter.go`（ChannelAdapter 接口 + ChannelStatus）
    - 创建了 `registry.go`（全局通道注册表）
    - 创建了 `trust_config.go`（TrustConfig/TrustLevel/RiskLevel 基本类型）
    - 更新了 `kernel/api/magi_source.go` 的 `parseSourceChannel()`，将 wechat/discord/telegram/slack/whatsapp 映射到 external-agent
  - **成果文件**:
    - `kernel/nerv/magi/channel/types.go`
    - `kernel/nerv/magi/channel/adapter.go`
    - `kernel/nerv/magi/channel/registry.go`
    - `kernel/nerv/magi/channel/trust_config.go`
    - `kernel/api/magi_source.go`
  - **验证命令**: `cd kernel && go build ./nerv/magi/channel/... && go build ./api/...`

- [x] **调研与设计阶段** [已完成 2026-04-30]
  - **背景**: 分析 openclaw-weixin 的实现方式和 MAGI 现有来源可信度体系，确定架构方案。
  - **完成情况**:
    - 完成了 openclaw-weixin 的 iLink Bot API 实现调研
    - 完成了 MAGI 来源可信度体系（identity/armor/trust/risk）调研
    - 确定了通用通道适配器 + 配置化可信度的整体方案
  - **成果文件**:
    - `docs/设计/MAGI多通道外部来源架构.design.md`
    - `docs/ttt/MAGI多通道外部来源接入.infinity.ttt.md`
