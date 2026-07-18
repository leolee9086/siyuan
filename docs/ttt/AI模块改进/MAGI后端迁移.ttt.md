# MAGI 决策逻辑后端迁移任务跟踪 (TikTocTak)

> **目标**: 将 MAGI 系统的所有决策逻辑和 LLM 请求从前端迁移到 Go 后端，前端仅通过 WebSocket 监听状态更新，确保决策逻辑完全不变。
>
> **范围**: `app/src/magi` 目录下的所有决策相关模块
>
> **约束**: 
> 1. 所有决策逻辑必须保持不变
> 2. 前端仅通过 WebSocket 监听状态
> 3. 不修改现有前端代码，仅在后端实现对应逻辑
> 4. 审慎决策入口仅由 Melchior 的工具调用信号决定，不允许后端新增语义兜底规则

### 已确认决策（持续更新）

- **D-001（2026-03-06）审慎决策入口**: 严格只看 Melchior 工具调用中的 `requiresDeliberation` 信号；禁止通过正文关键词、正则、规则引擎或其他运行时逻辑介入 LLM 语义决策。

- **D-002（2026-03-06）审慎决策触发机制**: Melchior使用工具调用传递审慎决策信号，工具名为`deliberation_signal`，参数为`{"requires_deliberation": boolean, "reason": string}`，Melchior每次响应都必须调用此工具。

- **D-003（2026-03-06）上下文消息历史管理**: 采用差异化策略，Melchior使用80%上下文token占用（动态计算），Balthazar使用40%，Casper固定7条消息，Trinity固定3条消息。需要实现token计数功能。

- **D-004（2026-03-06）三贤人并行响应超时处理**: 至少等待两个贤人的消息，否则报错；如果只有一个没有回复或过慢，只警告不阻断流程；超时的消息不传递给Trinity，但过慢完成的消息仍会进入对应agent的历史。

- **D-005（2026-03-06）投票流程超时处理**: 单个投票请求超时30秒，投票失败不重试，直接视为该贤人投否决票。

- **D-006（2026-03-06）Trinity统合超时和重试**: Trinity请求采用指数退避重试策略，最大重试次数10次，超过后报错返回错误给用户。

- **D-007（2026-03-06）Trinity内省输入构建**: 保持前端实现，使用固定模板拼接三贤人响应（"逻辑告诉我/情绪告诉我/直觉告诉我"），伪装为Trinity自身调用`<think_about>`工具传递。

## 📋 任务背景

### 当前架构问题

MAGI 系统当前完全在前端实现，存在以下问题：

1. **安全性问题**: API Key 暴露在前端代码中
2. **性能问题**: 所有 LLM 请求都从浏览器发起，受网络限制
3. **可维护性问题**: 决策逻辑分散在多个前端模块中
4. **扩展性问题**: 无法实现服务端缓存、批处理等优化

### 目标架构

```
┌─────────────────┐         WebSocket          ┌─────────────────┐
│                 │ ◄─────────────────────────► │                 │
│   前端 (Vue)    │    状态推送 + 事件监听      │  Go 后端        │
│                 │                             │                 │
└─────────────────┘                             └────────┬────────┘
                                                         │
                                                         │ HTTP
                                                         ▼
                                                  ┌─────────────┐
                                                  │  LLM API    │
                                                  │  (OpenAI)   │
                                                  └─────────────┘
```

### 核心决策流程

```
用户输入
  │
  ├─► Melchior 响应 ──┐
  ├─► Balthazar 响应 ─┼─► Trinity 统合 ──► 最终响应
  └─► Casper 响应 ────┘
       │
       │ (如果 Melchior 标记需要审慎决策)
       │
       ├─► Balthazar 投票 ─┐
       └─► Casper 投票 ────┼─► 投票结果 (≥2/3 通过)
```

## 🎯 迁移范围分析

### 需要迁移的核心模块

#### 1. 配置管理层 (`core/marduk.ts`)
- **功能**: SEEL 配置加载、验证、响应生成、共识决策
- **关键函数**:
  - `getSEELConfig()`: 获取 SEEL 配置
  - `validateSynchronization()`: 验证同步率
  - `generateResponse()`: 生成响应
  - `generateConsensus()`: 生成共识
  - `loadLatestConfig()`: 加载配置
- **迁移优先级**: P0（基础设施）

#### 2. 决策协调层 (`composables/magiConsensus.ts`)
- **功能**: 贤者响应收集、投票流程、Trinity 统合
- **关键函数**:
  - `processSagesResponses()`: 收集所有贤者响应
  - `collectSingleSageResponse()`: 收集单个贤者响应
  - `handleTrinitySummary()`: Trinity 统合
  - `需要审慎决策()`: 判断是否需要投票
  - `processVoting()`: 执行投票流程
- **迁移优先级**: P0（核心逻辑）

#### 3. LLM 通信层 (`core/wise/mockWise.ts`)
- **功能**: SSE 流式通信、上下文管理、消息处理
- **关键函数**:
  - `创建MockWISE实例()`: 创建 WISE 实例
  - `构建SSE请求配置()`: 构建请求配置
  - `创建SSE桥接回调()`: SSE 回调处理
- **迁移优先级**: P0（通信基础）

#### 4. 流式处理层 (`utils/streamProcessor.ts`)
- **功能**: SSE 流解析、工具调用处理、消息组装
- **关键函数**:
  - `processStreamResponse()`: 处理流式响应
  - `handleAsyncGeneratorResponse()`: 处理异步生成器
  - `consumeStream()`: 消费流
  - `extractChunkDataFromChunk()`: 提取 chunk 数据
- **迁移优先级**: P0（流式处理）

#### 5. 投票决策层 (`composables/consensus/realVote.ts`)
- **功能**: 真实投票决策（调用 LLM）
- **关键函数**:
  - `获取真实投票决策()`: 获取投票决策
  - `创建评审系统提示词()`: 创建提示词
  - `解析决策()`: 解析决策结果
- **迁移优先级**: P0（投票逻辑）

#### 6. 状态管理层 (`composables/useMagi.ts`)
- **功能**: Vue 响应式状态、初始化、消息管理
- **需要改造**: 
  - 移除 LLM 调用逻辑
  - 改为 WebSocket 客户端
  - 保留状态管理和 UI 绑定
- **迁移优先级**: P1（前端适配）

### 不需要迁移的模块

- **UI 组件** (`components/`): 保持不变
- **事件总线** (`events/`): 保持不变，但需要适配 WebSocket
- **提示词模板** (`prompts/`): 可能需要同步到后端
- **类型定义** (`types/`): 需要在后端重新定义

## 📝 任务分解

### Phase 0: 准备工作 (P0)

- [x] **T0.1: 创建后端项目结构**
  - 在 `kernel/` 下创建 `magi/` 目录
  - 设计 Go 项目结构（基于独立Agent架构）
  - 定义架构文档
  - **产出**:
    - `docs/设计/MAGI/README.md`: 项目概述
    - `docs/设计/MAGI/STRUCTURE.md`: 详细结构设计
    - `docs/设计/MAGI/ARCHITECTURE.md`: 架构概览
    - `docs/设计/MAGI/AVATAR.md`: Avatar说明
    - `docs/设计/MAGI/AGENT_COGNITION.md`: Agent认知模型
  - **完成时间**: 2026-03-06

- [x] **T0.2: 定义 WebSocket 协议**
  - 设计消息格式（事件类型、数据结构）
  - 定义状态推送机制
  - 编写协议文档
  - **产出**:
    - `docs/技术文档/MAGI/WEBSOCKET_PROTOCOL.md`: WebSocket协议完整规范
    - 定义了9种事件类型（轮次、贤者响应、投票、统合、共识、错误）
    - 定义了会话管理和错误处理机制
    - 包含完整示例流程和消息格式
  - **完成时间**: 2026-03-06

- [x] **T0.3: 设计数据模型**
  - 定义 Go 结构体（对应前端类型）
  - 设计配置存储方案
  - 设计会话管理方案
  - **产出**:
    - `kernel/magi/types/types.go`: 核心消息和流式处理类型
    - `kernel/magi/config/config.go`: 配置相关类型
    - `kernel/magi/coordinator/session.go`: 会话管理类型
    - `kernel/magi/docs/DATA_MODEL.md`: 完整数据模型文档
  - **完成时间**: 2026-03-06

### Phase 1: 后端核心实现 (P0)

- [x] **T1.1: 实现配置管理模块**
  - 迁移 `marduk.ts` 逻辑到 Go
  - 实现配置加载和验证
  - 实现 SEEL 配置管理
  - **参考**: `app/src/magi/core/marduk.ts`
  - **完成时间**: 2026-03-06
  - **产出**: `kernel/magi/config/manager.go`

- [x] **T1.2: 实现 LLM 客户端**
  - 实现 OpenAI 兼容 HTTP 客户端
  - 实现 SSE 流式响应处理
  - 实现请求重试和错误处理
  - **参考**: `app/src/magi/core/wise/mockWise.ts`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/llm/client.go`: LLM客户端封装实现
    - `kernel/magi/llm/client_test.go`: 单元测试（6个测试全部通过）
  - **实现说明**:
    - 复用`util.NewOpenAIClient()`和`util.CallClaudeChatCompletionMagi()`
    - 实现OpenAI和Claude两种Provider支持
    - 实现会话级别上下文管理（SessionContext）
    - 支持流式和同步两种调用方式
    - 提供工具调用结果构建辅助函数

- [x] **T1.3: 实现流式处理器**
  - 实现 SSE chunk 解析
  - 实现工具调用提取
  - 实现 Trinity speak 工具处理
  - **参考**: `app/src/magi/utils/streamProcessor.ts`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/stream/processor.go`: 流式处理器实现
    - `kernel/magi/stream/processor_test.go`: 单元测试（12个测试全部通过）
  - **实现说明**:
    - 实现SSE chunk解析（支持`data:`前缀和纯文本）
    - 实现工具调用增量合并（按index聚合name和arguments分片）
    - 实现trinity_speak工具解析（区分public/internal channel）
    - 实现deliberation_signal工具识别
    - 实现StreamResult构建（包含工具调用元数据）

- [x] **T1.4: 实现贤者实例管理**
  - 实现 Melchior/Balthazar/Casper/Trinity 实例
  - 实现上下文消息管理
  - 实现并发响应收集
  - **参考**: `app/src/magi/core/wise/mockWise.subclass.ts`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/sages/sage.go`: 贤者实例管理实现
    - `kernel/magi/sages/sage_test.go`: 单元测试（7个测试全部通过）
  - **实现说明**:
    - 实现Sage结构体（包含name、displayName、config、llmClient、contextManager）
    - 实现SendMessage()方法（支持流式响应）
    - 实现上下文管理（AddToContext、GetContext、ClearContext）
    - 实现差异化上下文策略（message_count类型）
    - 实现工厂方法（NewMelchior、NewBalthazar、NewCasper、NewTrinity）
    - 支持并发安全（使用sync.RWMutex）

### Phase 2: 决策逻辑实现 (P0)

- [x] **T2.1: 实现响应收集逻辑**
  - 实现 `processSagesResponses` 对应逻辑
  - 实现并发请求管理
  - 实现响应超时处理
  - **参考**: `app/src/magi/composables/magiConsensus.ts:129-139`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/coordinator/collector.go`: 响应收集器实现
    - `kernel/magi/coordinator/collector_test.go`: 单元测试（4个测试全部通过）
  - **实现说明**:
    - 实现ResponseCollector结构体，支持配置超时时间
    - 使用goroutine并发调用三贤人的SendMessage
    - 使用channel收集响应结果
    - 实现超时控制（context.WithTimeout）
    - 至少2个贤者成功才继续，否则返回错误
    - 超时的贤者响应标记为失败
    - 自动解析Melchior的deliberation_signal工具调用
    - 将assistant响应添加到各贤者的上下文历史

- [x] **T2.2: 实现 Trinity 统合逻辑**
  - 实现 `handleTrinitySummary` 对应逻辑
  - 实现内省输入构建
  - 实现 speak 工具解析
  - 实现指数退避重试机制（最多10次）
  - **参考**: `app/src/magi/composables/magiConsensus.ts:185-222`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/coordinator/trinity.go`: Trinity统合逻辑实现
    - `kernel/magi/coordinator/trinity_test.go`: 单元测试（7个测试全部通过）
  - **实现说明**:
    - 实现内省输入构建（使用固定模板：逻辑告诉我/情绪告诉我/直觉告诉我）
    - 实现内省输入注入（伪装为think_about工具调用）
    - 实现Trinity流式调用和响应处理
    - 实现trinity_speak工具解析（区分public/internal channel）
    - 实现指数退避重试机制（初始1秒，最多10次，指数增长）
    - 返回public输出和internal消息列表

- [x] **T2.3: 实现投票决策逻辑**
  - 实现 `processVoting` 对应逻辑
  - 实现真实投票请求
  - 实现投票结果计算
  - **参考**: `app/src/magi/composables/magiConsensus.ts:239-279`
  - **参考**: `app/src/magi/composables/consensus/realVote.ts`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/coordinator/voting.go`: 投票决策逻辑实现
    - `kernel/magi/coordinator/voting_test.go`: 单元测试（10个测试全部通过）
  - **实现说明**:
    - 实现ProcessVoting()并行调用Balthazar和Casper
    - 实现getRealVote()构建投票提示词并调用LLM
    - 实现30秒超时控制（D-005）
    - 实现失败视为否决票（D-005）
    - 实现投票结果解析（JSON优先，文本关键词回退）
    - 实现≥2/3通过计算逻辑
    - 为Sage添加GetLLMClient()方法

- [x] **T2.4: 实现审慎决策判断**
  - 实现 Melchior 工具调用解析
  - 仅依据工具调用参数检测 `requiresDeliberation`
  - 禁止添加正文关键词/规则引擎等兜底判断
  - 实现决策分支路由
  - **参考**: `app/src/magi/composables/magiConsensus.ts:224-230`
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/coordinator/coordinator.go`: 决策协调器实现
    - `kernel/magi/coordinator/coordinator_test.go`: 单元测试（5个测试全部通过）
  - **实现说明**:
    - 实现Coordinator结构体整合collector和trinity
    - 实现CoordinateDecision()完整决策流程编排
    - 实现checkDeliberationRequired()严格只检查Melchior的RequiresDeliberation字段（D-001）
    - 实现executeVoting()投票流程调用
    - 实现buildRejectionMessage()构建否决消息
    - 实现buildConsensusMessage()构建共识消息（区分standard/critical模式）
    - 禁止任何正文关键词检测或规则引擎判断

### Phase 3: WebSocket 服务实现 (P0)

> **调研记录（2026-03-06）**:
> - **调研文档**: [`docs/调研/后端WebSocket功能调研.md`](../调研/后端WebSocket功能调研.md)
> - **核心发现**: 后端已有成熟WebSocket实现（`kernel/util/websocket.go`），包含完整的连接管理、消息推送、会话管理功能
> - **修正决策**: 取消独立实现WebSocket服务器，改为轻量级封装层复用现有实现
> - **工作量调整**: Phase 3总工作量从800+行减少到150行左右

- [x] **T3.1: 创建 WebSocket 封装层**
  - 复用 `kernel/util/websocket.go` 现有实现
  - 创建 MAGI 专用的 Pusher 封装
  - 实现会话ID到连接的映射管理
  - **产出**: `kernel/magi/websocket/pusher.go` (56行)
  - **产出**: `kernel/magi/websocket/pusher_test.go` (67行)
  - **说明**: 不重新实现WebSocket服务器，仅封装现有推送接口
  - **完成时间**: 2026-03-06

- [x] **T3.2: 实现状态推送机制**
  - 基于封装层实现9种事件类型的推送函数
  - 实现轮次开始推送（ROUND_STARTED）
  - 实现贤者响应推送（SEEL_REPLY_STARTED/COMPLETED/FAILED）
  - 实现流式 chunk 推送（SEEL_REPLY_CHUNK）
  - 实现投票进度推送（SEEL_VOTE_UPDATED：开始/进度/结果/失败）
  - 实现 Trinity 统合推送（TRINITY_SYNTHESIS_COMPLETED）
  - 实现共识消息推送（CONSENSUS_EMITTED）
  - 实现轮次失败推送（ROUND_FAILED）
  - **完成时间**: 2026-03-06
  - **产出**:
    - `kernel/magi/websocket/events.go` (217行)
    - `kernel/magi/websocket/events_test.go` (145行)
  - **实现说明**:
    - 实现12个事件推送函数（严格遵循WEBSOCKET_PROTOCOL.md）
    - 实现事件ID自动生成（magi-event-{timestamp}-{seq}）
    - 实现全局序列号管理（globalSeq）
    - 实现VoteDetail结构体用于投票结果详情
    - 所有测试通过（13个测试用例）

- [x] **T3.3: 实现 Coordinator 集成**
  - 在 Coordinator 中注入 WebSocket Pusher
  - 在响应收集时推送 sage_response 事件
  - 在投票流程时推送 voting_start/voting_result 事件
  - 在 Trinity 统合时推送 trinity_summary 事件
  - 在共识生成时推送 consensus 事件
  - 在错误处理时推送 error 事件
  - **完成时间**: 2026-03-07
  - **产出**:
    - 修改 `kernel/magi/coordinator/coordinator.go` - 添加sessionId参数和推送调用
    - 修改 `kernel/magi/coordinator/collector.go` - 添加贤者响应推送
    - 修改 `kernel/magi/coordinator/voting.go` - 添加投票流程推送
    - 修改 `kernel/magi/coordinator/trinity.go` - 添加Trinity统合推送
    - 更新所有测试文件以适配新签名
  - **实现说明**:
    - CoordinateDecision()添加sessionId参数，生成roundId
    - 在关键节点调用WebSocket推送函数（轮次开始、贤者响应、投票、Trinity统合、共识发出、错误）
    - 推送失败仅记录日志，不影响决策流程
    - 所有测试通过（30个测试用例）

### Phase 4: 前端适配 (P1)

> **调研记录（2026-03-07）**:
> - **调研文档**: [`docs/调研/Phase4现状与任务规划.md`](../调研/Phase4现状与任务规划.md)
> - **核心发现**: 后端HTTP接口未集成Coordinator，缺少会话管理机制
> - **任务调整**: Phase 4需要先完成3个后端任务（T4.0.x系列）再进行前端适配

#### 后端集成任务

- [x] **T4.0.1: 实现会话管理机制**
  - 创建HTTP/WebSocket会话生命周期管理器
  - 实现sessionId生成（格式：magi-{timestamp}-{random}）
  - 实现会话超时清理（默认30分钟，每5分钟检查）
  - 实现线程安全的会话存储（sync.Map）
  - **完成时间**: 2026-03-07
  - **产出**:
    - `kernel/magi/session/manager.go` (120行)
    - `kernel/magi/session/manager_test.go` (115行)
  - **测试结果**: 7个测试全部通过

- [x] **T4.0.2: 集成Coordinator到HTTP接口**
  - 修改`/api/s-forge/magi/v1/chat/completions`接口
  - 调用`coordinator.CoordinateDecision()`完整决策流程
  - 实现会话管理（获取或创建sessionId）
  - 实现响应格式转换（types.Message → openai.ChatCompletionResponse）
  - 支持流式和非流式两种模式
  - **完成时间**: 2026-03-07
  - **产出**:
    - 修改 `kernel/api/magi.go` - 集成Coordinator决策流程
    - 添加 `initMagiComponents()` - 初始化MAGI组件（ConfigManager、LLM Client、四个Sage、SessionManager、Coordinator）
    - 添加 `extractUserMessage()` - 提取用户消息
    - 添加 `getOrCreateSession()` - 会话管理
    - 添加 `sendSyncResponse()` - 同步响应转换
    - 添加 `sendStreamResponse()` - 流式响应转换
  - **实现说明**:
    - 保持HTTP接口路径不变（`/api/s-forge/magi/v1/chat/completions`）
    - 接受标准OpenAI请求格式（`openai.ChatCompletionRequest`）
    - 返回标准OpenAI响应格式（`openai.ChatCompletionResponse`）
    - 内部调用Coordinator.CoordinateDecision()执行MAGI决策
    - 通过WebSocket独立推送决策过程（不影响HTTP响应）
    - 会话ID由请求来源上下文稳定派生，不依赖额外的 `X-MAGI-*` 特殊请求头
    - 编译测试通过

- [ ] **T4.0.3: 实现配置加载逻辑**
  - 从文件系统加载SEEL配置
  - 解析配置并初始化贤者实例
  - 实现配置热重载

#### 前端适配任务

- [ ] **T4.1: 实现 WebSocket 客户端**
  - 创建 WebSocket 连接管理器
  - 实现自动重连
  - 实现消息队列

- [ ] **T4.2: 改造 useMagi composable**
  - 移除 LLM 调用逻辑
  - 接入 WebSocket 客户端
  - 保持状态管理接口不变
  - **参考**: `app/src/magi/composables/useMagi.ts`

- [ ] **T4.3: 适配事件总线**
  - 将 WebSocket 消息映射到事件总线
  - 保持现有事件接口不变
  - **参考**: `app/src/magi/events/magiEventBus.ts`

- [ ] **T4.4: 适配 LLM 适配器**
  - 改造 `standardLLMAdapter` 为 WebSocket 模式
  - 保持接口兼容性
  - **参考**: `app/src/magi/adapters/standardLLMAdapterFactory.ts`

### Phase 5: 测试与验证 (P0)

- [ ] **T5.1: 单元测试**
  - 后端核心逻辑单元测试
  - 流式处理单元测试
  - 投票逻辑单元测试

- [ ] **T5.2: 集成测试**
  - 完整决策流程测试
  - WebSocket 通信测试
  - 错误处理测试

- [ ] **T5.3: 对比测试**
  - 对比前后端决策结果一致性
  - 验证所有决策逻辑未改变
  - 性能对比测试

- [ ] **T5.4: 回归测试**
  - 运行现有前端测试
  - 验证 UI 功能完整性
  - 验证事件流正确性

### Phase 6: 文档与部署 (P1)

- [ ] **T6.1: 编写技术文档**
  - 后端架构文档
  - WebSocket 协议文档
  - 部署指南

- [ ] **T6.2: 编写迁移指南**
  - 配置迁移指南
  - 数据迁移指南
  - 回滚方案

- [ ] **T6.3: 性能优化**
  - 实现请求缓存
  - 实现连接池
  - 实现批处理优化

### Phase 7: Avatar运行时基础 (P0)

> **背景**: Avatar是nerv框架下dummysys(傀儡系统)内部注册的执行实体，用于为特定通道(channel)创建持续处理该通道请求的执行分身。Avatar不属于MAGI包，是独立的agent实例。
> **参考**: `kernel/nerv/dummysys/AVATAR.md`、`docs/设计/MAGI/ARCHITECTURE.md`、`docs/设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md`
> **架构关系**: nerv(框架) → dummysys(傀儡系统) → avatar(实体)

- [-] **T7.1: 实现Avatar运行时核心**
  - 创建`kernel/nerv/dummysys/runtime.go`
  - 实现Avatar结构体（包含avatarId、channel、systemPrompt、llmClient、contextManager）
  - 实现Avatar.Run()方法（接收消息并处理）
  - 实现独立的上下文管理（与MAGI完全隔离）
  - 实现状态管理（idle/active/destroyed）
  - 实现通道绑定机制（一个channel只能绑定一个Avatar）
  - **涉及文件**: `kernel/nerv/dummysys/runtime.go`
  - **验收标准**:
    - Avatar可以独立接收和处理消息
    - 上下文与MAGI完全隔离
    - 状态转换正确（idle ↔ active → destroyed）
    - 通道绑定规则正确执行
  - **依赖**: 无
  - **架构说明**: Avatar是dummysys实体，不是MAGI子模块

- [ ] **T7.2: 实现Avatar池管理**
  - 创建`kernel/nerv/dummysys/pool.go`
  - 实现AvatarPool结构体（管理多个Avatar实例）
  - 实现acquireAvatarRole()（优先复用idle Avatar）
  - 实现releaseAvatar()（归还Avatar到池）
  - 实现池状态查询（AvatarPoolSnapshot）
  - 实现线程安全的池操作（sync.RWMutex）
  - 实现通道到Avatar的映射管理（一个channel只能绑定一个Avatar）
  - **涉及文件**: `kernel/nerv/dummysys/pool.go`
  - **验收标准**:
    - 支持Avatar复用，减少创建成本
    - 池状态统计准确（idle/leased/pending_approval/retired/failed）
    - 并发安全
    - 通道独占规则正确执行
  - **依赖**: T7.1
  - **架构说明**: Avatar池是dummysys的管理机制

- [ ] **T7.3: 实现create_avatar工具**
  - 创建`kernel/nerv/magi/tools/create_avatar.go`
  - 实现create_avatar工具定义（参数：task、channel、systemPromptProposal）
  - 实现工具执行逻辑（调用Avatar池创建实例）
  - 实现channel绑定机制（检查channel是否已绑定）
  - 注册到MAGI工具系统
  - **涉及文件**: `kernel/nerv/magi/tools/create_avatar.go`
  - **验收标准**:
    - MAGI可以通过工具接口创建Avatar
    - Avatar正确绑定到指定channel
    - 返回avatarId供后续引用
    - 同一channel不能重复绑定
  - **依赖**: T7.2
  - **架构说明**: MAGI通过工具接口与dummysys交互，不直接管理Avatar

- [ ] **T7.4: 实现Avatar生命周期管理**
  - 创建`kernel/nerv/dummysys/lifecycle.go`
  - 实现生命周期事件（created/activated/idle/destroyed）
  - 实现状态转换逻辑（idle ↔ active → destroyed）
  - 实现销毁触发条件（心跳超时、异常、手动销毁）
  - 实现重建机制（destroyed后该channel的下次请求重建新Avatar）
  - **涉及文件**: `kernel/nerv/dummysys/lifecycle.go`
  - **验收标准**:
    - 生命周期事件完整记录
    - 状态转换符合`kernel/nerv/dummysys/AVATAR.md`第82-92行设计
    - 销毁后可正确重建
    - 重建时解除旧Avatar的channel绑定
  - **依赖**: T7.1
  - **架构说明**: 生命周期管理是dummysys的核心机制

### Phase 8: 请求路由与可信度 (P0)

> **背景**: 需要实现请求来源识别、可信度评估和路由机制，确保安全性。MAGI通过channel识别请求来源，并路由到对应的Avatar实例。
> **参考**: `kernel/nerv/dummysys/AVATAR.md` 第9-20行、`docs/设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md` 第4节
> **架构说明**: 路由层负责识别channel并查找绑定的Avatar，Avatar不存在时触发创建流程

- [ ] **T8.1: 实现请求路由与channel识别**
  - 创建`kernel/nerv/magi/gateway/router.go`
  - 实现channel提取逻辑（从请求metadata或header）
  - 实现路由决策（MAGI核心 vs Avatar）
  - 实现channel到Avatar的映射查询（通过Avatar池）
  - 实现未知channel的降级处理（降级为"unknown"）
  - 实现channel白名单验证（guardian/external-agent/system-cron/unknown）
  - **涉及文件**: `kernel/nerv/magi/gateway/router.go`
  - **验收标准**:
    - 正确识别4种预定义channel（guardian/external-agent/system-cron/unknown）
    - 路由到正确的处理器（MAGI或Avatar）
    - 非白名单channel降级为unknown
    - 查询Avatar池获取channel绑定状态
  - **依赖**: 无
  - **架构说明**: 路由层是MAGI与dummysys的桥接点

- [ ] **T8.2: 实现RequestTrustEnvelope与白名单**
  - 创建`kernel/nerv/magi/security/trust.go`
  - 实现RequestTrustEnvelope结构体（requestId、source、trustBase、riskLevel等）
  - 实现可信度评估逻辑（基于请求参数和传输上下文）
  - 实现channel白名单验证（guardian/external-agent/system-cron/unknown）
  - 实现结构化信封生成（防止语义攻击）
  - 实现exposureMode决策（full/partial/distorted）
  - **涉及文件**: `kernel/nerv/magi/security/trust.go`
  - **验收标准**:
    - 生成完整的RequestTrustEnvelope
    - channel严格限制在白名单内
    - 可信度评估合理（trustBase和riskLevel）
    - exposureMode根据可信度正确决策
  - **依赖**: 无
  - **架构说明**: 可信度评估决定Avatar的记忆访问权限（参考`kernel/nerv/dummysys/AVATAR.md`第73-79行）

- [ ] **T8.3: 实现来源绑定持续托管**
  - 创建`kernel/nerv/magi/gateway/binding.go`
  - 实现SourceAvatarBinding结构体（sourceKey、avatarRoleId、boundAt等）
  - 实现来源到Avatar的绑定建立（首次委派时通过Avatar池）
  - 实现绑定查询（后续请求直接路由到绑定的Avatar）
  - 实现绑定过期和升级机制（超时、风险、违规）
  - 实现绑定解除（Avatar销毁时）
  - **涉及文件**: `kernel/nerv/magi/gateway/binding.go`
  - **验收标准**:
    - 同来源后续请求自动路由到绑定的Avatar
    - 异常场景正确升级回Trinity
    - 绑定状态准确（active/escalated/expired）
    - Avatar销毁时自动解除绑定
  - **依赖**: T7.2, T8.1
  - **架构说明**: 绑定机制确保channel与Avatar的一对一关系（参考`kernel/nerv/dummysys/AVATAR.md`第17-20行）

- [ ] **T8.4: 实现入口allow/deny门禁**
  - 创建`kernel/nerv/magi/security/gate.go`
  - 实现入口门禁校验（基于RequestTrustEnvelope）
  - 实现deny决策的标准错误响应
  - 实现connection_attempt_blocked告警事件
  - 实现告警事件推送到MAGI（由Trinity处理）
  - **涉及文件**: `kernel/nerv/magi/security/gate.go`
  - **验收标准**:
    - deny请求返回标准错误（保持OpenAI兼容）
    - MAGI收到告警事件并由Trinity处理
    - allow请求正常进入决策流程
  - **依赖**: T8.2
  - **架构说明**: 门禁是MAGI的安全机制，不属于dummysys

### Phase 9: Avatar工具与通信 (P0)

> **背景**: Avatar需要通过内部工具与MAGI通信，并实现工具分域隔离。Avatar通过report_to_core工具向MAGI汇报，MAGI通过工具调用Avatar。
> **参考**: `kernel/nerv/dummysys/AVATAR.md` 第32-44行、`docs/设计/MAGI/ARCHITECTURE.md` 第16-19行、`docs/设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md` 第7节
> **架构说明**: Avatar与MAGI通过工具接口交互，不通过消息总线

- [ ] **T9.1: 实现report_to_core工具**
  - 创建`kernel/nerv/dummysys/tools.go`
  - 实现report_to_core工具定义（参数：type、content、urgency）
  - 实现汇报类型（heartbeat/progress/risk/summary）
  - 实现紧急程度（low/medium/high）
  - 实现汇报消息路由到MAGI（记录到共识消息）
  - **涉及文件**: `kernel/nerv/dummysys/tools.go`
  - **验收标准**:
    - Avatar可以调用report_to_core向MAGI汇报
    - 汇报类型和紧急程度正确传递
    - MAGI接收汇报并记录到共识消息
    - 前端通过WebSocket监听到汇报事件
  - **依赖**: T7.1
  - **架构说明**: report_to_core是Avatar的内部工具，参考`kernel/nerv/dummysys/AVATAR.md`第109-119行

- [ ] **T9.2: 实现心跳超时监控**
  - 创建`kernel/nerv/dummysys/heartbeat.go`
  - 实现心跳间隔配置（heartbeatIntervalRounds，如5轮）
  - 实现心跳超时检测（超过间隔未收到心跳）
  - 实现超时后Avatar销毁逻辑（标记为destroyed）
  - 实现心跳记录更新（lastReportAt）
  - **涉及文件**: `kernel/nerv/dummysys/heartbeat.go`
  - **验收标准**:
    - 超时Avatar被正确标记为destroyed
    - 心跳记录准确更新
    - 销毁后该channel的下次请求重建新Avatar
  - **依赖**: T7.4, T9.1
  - **架构说明**: 心跳机制确保Avatar活性，参考`kernel/nerv/dummysys/AVATAR.md`第45-50行和第175-183行

- [ ] **T9.3: 实现internal/external工具分域**
  - 创建`kernel/nerv/magi/tools/registry.go`
  - 实现ToolScope枚举（internal/external）
  - 实现工具注册时的scope标记
  - 实现工具路由（internal工具不进入对外消息流）
  - 实现Trinity的speak工具channel支持（public/internal）
  - **涉及文件**: `kernel/nerv/magi/tools/registry.go`
  - **验收标准**:
    - internal工具（report_to_core等）不暴露给外部
    - external工具（file、command等）正常执行
    - Trinity的speak工具支持channel参数
    - internal消息不进入LLM接口响应
  - **依赖**: T9.1
  - **架构说明**: 工具分域隔离Avatar内部通信和外部操作

- [ ] **T9.4: 实现MAGI调用Avatar工具链**
  - 创建`kernel/nerv/magi/tools/delegate_avatar.go`
  - 实现delegate_to_avatar工具（MAGI委派任务给Avatar）
  - 实现任务包构建（包含任务描述、必要上下文）
  - 实现Avatar响应收集（通过channel路由）
  - 实现回报结果整合到MAGI上下文
  - **涉及文件**: `kernel/nerv/magi/tools/delegate_avatar.go`
  - **验收标准**:
    - MAGI可以通过工具委派任务给Avatar
    - Avatar收到任务包并处理
    - 处理结果正确回报给MAGI
  - **依赖**: T7.3, T9.1
  - **架构说明**: MAGI通过工具调用Avatar，参考`kernel/nerv/dummysys/AVATAR.md`第121-131行和`docs/设计/MAGI/ARCHITECTURE.md`第16-19行

### Phase 10: 审批与安全 (P1)

> **背景**: Avatar创建需要三贤人共识审批机制，确保Avatar创建的合理性和安全性。
> **参考**: `kernel/nerv/dummysys/AVATAR.md` 第52-71行、`docs/设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md` 第6节
> **架构说明**: Avatar创建需要Melchior发起、Balthazar/Casper投票、Trinity设计系统提示词的完整共识流程

- [ ] **T10.1: 实现Avatar创建审批机制**
  - 创建`kernel/nerv/dummysys/approval.go`
  - 实现Melchior发起创建提案（判断是否需要创建Avatar）
  - 实现Balthazar/Casper投票评审（≥2/3通过）
  - 实现Trinity设计系统提示词（综合三贤人提案）
  - 实现审批决策接口（approved/rejected）
  - 实现审批超时处理
  - **涉及文件**: `kernel/nerv/dummysys/approval.go`
  - **验收标准**:
    - 新建Avatar触发三贤人共识流程
    - 复用Avatar不触发审批
    - 审批拒绝时返回可解释的错误
    - Trinity生成的系统提示词包含avatar_number、channel、report_to_core约束
  - **依赖**: T7.2
  - **架构说明**: 审批流程参考`kernel/nerv/dummysys/AVATAR.md`第54-71行的三贤人共识机制

- [ ] **T10.2: 实现审批记录与审计**
  - 创建`kernel/nerv/dummysys/audit.go`
  - 实现AvatarCreateApprovalRecord结构体
  - 实现审批记录持久化（写入审计日志）
  - 实现审批历史查询
  - 实现审计日志格式（requestId、decision、decidedAt、三贤人投票详情等）
  - **涉及文件**: `kernel/nerv/dummysys/audit.go`
  - **验收标准**:
    - 每次审批都有完整记录（包含三贤人共识过程）
    - 审计日志可查询和追溯
    - 记录包含必要的决策信息和系统提示词
  - **依赖**: T10.1
  - **架构说明**: 审计记录应包含完整的三贤人共识过程

- [ ] **T10.3: 实现安全门禁策略**
  - 创建`kernel/nerv/magi/security/policy.go`
  - 实现决策矩阵（trustBase × riskLevel → 决策）
  - 实现MAGI决策路由（magi_direct/avatar_delegate/reject）
  - 实现策略配置加载
  - 实现策略违规检测和告警
  - **涉及文件**: `kernel/nerv/magi/security/policy.go`
  - **验收标准**:
    - 决策矩阵符合设计文档（4.6节）
    - MAGI决策正确路由（直接处理或委派给Avatar）
    - 策略违规触发告警
  - **依赖**: T8.2, T8.4
  - **架构说明**: 门禁策略决定请求是由MAGI直接处理还是委派给Avatar

### Phase 11: Avatar集成与测试 (P1)

> **背景**: 将Avatar集成到现有HTTP接口，并完善测试覆盖。Avatar作为dummysys实体，通过路由层与MAGI协同工作。
> **参考**: `kernel/nerv/dummysys/AVATAR.md` 第133-151行、`docs/设计/MAGI/ARCHITECTURE.md`
> **架构说明**: HTTP接口通过路由层识别channel，查询Avatar池获取绑定的Avatar，实现MAGI与Avatar的协同

- [ ] **T11.1: 集成Avatar到HTTP接口**
  - 修改`kernel/api/magi.go`
  - 实现channel识别逻辑（从请求metadata或header提取）
  - 实现MAGI vs Avatar路由决策（通过路由层）
  - 实现Avatar响应格式转换（保持OpenAI兼容）
  - 实现来源绑定查询和建立（通过Avatar池）
  - **涉及文件**: `kernel/api/magi.go`
  - **验收标准**:
    - 请求正确路由到MAGI或Avatar
    - Avatar响应保持OpenAI兼容格式
    - 来源绑定正常工作（channel与Avatar一对一）
  - **依赖**: T7.2, T8.1, T8.3
  - **架构说明**: HTTP接口是MAGI与dummysys的统一入口，参考`kernel/nerv/dummysys/AVATAR.md`第133-151行

- [ ] **T11.2: 实现Avatar相关测试**
  - 创建`kernel/nerv/dummysys/runtime_test.go`
  - 创建`kernel/nerv/dummysys/pool_test.go`
  - 创建`kernel/nerv/dummysys/lifecycle_test.go`
  - 实现Avatar运行时单元测试
  - 实现Avatar池管理测试（包含通道绑定测试）
  - 实现生命周期测试（idle ↔ active → destroyed）
  - 实现心跳超时测试
  - 实现工具分域测试（internal/external）
  - **涉及文件**: `kernel/nerv/dummysys/*_test.go`
  - **验收标准**:
    - 核心功能有单元测试覆盖
    - 测试通过率100%
    - 边界情况有测试覆盖（如通道独占、心跳超时、重建机制）
  - **依赖**: T7.1, T7.2, T7.4, T9.2
  - **架构说明**: 测试应验证dummysys的核心机制（通道绑定、生命周期、心跳）

- [ ] **T11.3: 完善Avatar提示词基础**
  - 创建`kernel/nerv/dummysys/prompts/`目录
  - 实现Avatar系统提示词模板（由Trinity在审批时设计）
  - 实现提示词变量替换（avatar_number、channel等）
  - 实现report_to_core约束说明
  - 实现心跳要求说明（heartbeatIntervalRounds）
  - **涉及文件**: `kernel/nerv/dummysys/prompts/*.md`
  - **验收标准**:
    - Avatar系统提示词完整且清晰
    - 包含必要的约束和要求（avatar_number、channel、report_to_core）
    - 变量替换正确
  - **依赖**: T7.1
  - **架构说明**: 系统提示词由Trinity在三贤人共识后设计，参考`kernel/nerv/dummysys/AVATAR.md`第68-71行

## 📊 进度跟踪

### 任务统计

| 阶段 | 总任务数 | 已完成 | 进行中 | 待开始 | 完成度 |
|------|---------|--------|--------|--------|--------|
| Phase 0: 准备工作 | 3 | 3 | 0 | 0 | 100% |
| Phase 1: 后端核心 | 4 | 4 | 0 | 0 | 100% |
| Phase 2: 决策逻辑 | 4 | 4 | 0 | 0 | 100% |
| Phase 3: WebSocket | 3 | 3 | 0 | 0 | 100% |
| Phase 4: 前端适配 | 7 | 2 | 0 | 5 | 29% |
| Phase 5: 测试验证 | 4 | 0 | 0 | 4 | 0% |
| Phase 6: 文档部署 | 3 | 0 | 0 | 3 | 0% |
| Phase 7: Avatar运行时基础 | 4 | 0 | 0 | 4 | 0% |
| Phase 8: 请求路由与可信度 | 4 | 0 | 0 | 4 | 0% |
| Phase 9: Avatar工具与通信 | 4 | 0 | 0 | 4 | 0% |
| Phase 10: 审批与安全 | 3 | 0 | 0 | 3 | 0% |
| Phase 11: Avatar集成与测试 | 3 | 0 | 0 | 3 | 0% |
| **总计** | **46** | **16** | **0** | **30** | **35%** |


## 🔗 相关文档

### 源代码参考

- **配置管理**: [`app/src/magi/core/marduk.ts`](../../app/src/magi/core/marduk.ts)
- **决策协调**: [`app/src/magi/composables/magiConsensus.ts`](../../app/src/magi/composables/magiConsensus.ts)
- **LLM 通信**: [`app/src/magi/core/wise/mockWise.ts`](../../app/src/magi/core/wise/mockWise.ts)
- **流式处理**: [`app/src/magi/utils/streamProcessor.ts`](../../app/src/magi/utils/streamProcessor.ts)
- **投票决策**: [`app/src/magi/composables/consensus/realVote.ts`](../../app/src/magi/composables/consensus/realVote.ts)
- **状态管理**: [`app/src/magi/composables/useMagi.ts`](../../app/src/magi/composables/useMagi.ts)

### 规程文档

- **元规程**: [`.roo/rules/规程.md`](../../.roo/rules/规程.md)
- **负面记录**: [`.roo/rules/负面记录.md`](../../.roo/rules/负面记录.md)

### 技术文档

- **MAGI 实现状态调研**: [`docs/调研/MAGI实现状态调研.md`](../调研/MAGI实现状态调研.md)

## 💡 实现注意事项

### 决策逻辑保持不变的关键点

1. **响应收集顺序**: 三贤人并行请求，不依赖顺序
2. **Trinity 统合逻辑**: 必须使用相同的内省输入构建方式
3. **投票计算**: ≥2/3 通过的逻辑必须完全一致
4. **审慎决策判断**: 仅依据 Melchior 工具调用中的 `requiresDeliberation`；禁止在LLM没有调用工具时发起投票.
5. **流式处理**: chunk 解析和工具调用提取逻辑必须一致
6. **上下文管理**: memorySize 限制和消息历史管理必须一致

### Go 实现建议

1. **使用 goroutine 实现并发**: 三贤人响应收集
2. **使用 channel 实现流式**: SSE chunk 传递
3. **使用 context 管理超时**: 请求超时和取消
4. **使用 sync.Map 管理会话**: WebSocket 连接管理
5. **使用 interface 抽象 LLM**: 便于测试和扩展

### 测试策略

1. **单元测试**: 每个函数都有对应的单元测试
2. **快照测试**: 记录前端实现的输入输出，Go 实现必须匹配
3. **集成测试**: 完整流程的端到端测试
4. **压力测试**: 并发请求和长时间运行测试

