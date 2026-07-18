# MAGI 后端模块

MAGI 系统的 Go 后端实现，作为 kernel 项目的子包，负责所有决策逻辑和 LLM 请求处理。

## 项目结构

```
kernel/magi/
├── config/          # 配置管理（SEEL配置、验证、响应生成）
├── llm/             # LLM客户端（OpenAI兼容HTTP客户端、SSE流式处理）
├── stream/          # 流式处理器（SSE chunk解析、工具调用提取）
├── consensus/       # 共识决策（响应收集、投票流程、Trinity统合）
├── sage/            # 贤者实例管理（Melchior/Balthazar/Casper/Trinity）
├── websocket/       # WebSocket服务（连接管理、状态推送、事件路由）
├── types/           # 类型定义
├── prompts/         # 提示词模板
└── internal/        # 内部工具函数
```

**注意**：magi 是 kernel 项目的子包，使用 kernel 的 go.mod，不需要独立的 go.mod 文件。

## 模块说明

### config - 配置管理层
对应前端 `core/marduk.ts`，负责：
- SEEL 配置加载和验证
- 同步率验证
- 响应生成配置
- 共识决策配置

### llm - LLM通信层
对应前端 `core/wise/mockWise.ts`，负责：
- OpenAI 兼容 HTTP 客户端
- SSE 流式响应处理
- 请求重试和错误处理
- 上下文消息管理

### stream - 流式处理层
对应前端 `utils/streamProcessor.ts`，负责：
- SSE chunk 解析
- 工具调用提取
- Trinity speak 工具处理
- 消息组装

### consensus - 决策协调层
对应前端 `composables/magiConsensus.ts`，负责：
- 贤者响应收集（并发请求）
- Trinity 统合逻辑
- 投票流程管理
- 审慎决策判断

### sage - 贤者实例层
对应前端 `core/wise/mockWise.subclass.ts`，负责：
- Melchior 实例（理性决策）
- Balthazar 实例（感性决策）
- Casper 实例（直觉决策）
- Trinity 实例（统合）

### websocket - WebSocket服务层
负责：
- WebSocket 连接管理
- 状态推送机制
- 事件路由
- 会话管理

### types - 类型定义
对应前端 `types/`，定义：
- 消息结构
- 配置结构
- 响应结构
- 事件结构

### prompts - 提示词模板
对应前端 `prompts/`，包含：
- 系统提示词
- 投票提示词
- 统合提示词

### internal - 内部工具
通用工具函数：
- 错误处理
- 日志记录
- 上下文管理
- 辅助函数

## 设计原则

1. **决策逻辑保持不变**：所有决策逻辑必须与前端实现完全一致
2. **并发安全**：使用 goroutine 和 channel 实现并发控制
3. **流式优先**：支持 SSE 流式响应
4. **可测试性**：使用 interface 抽象，便于单元测试
5. **可扩展性**：模块化设计，便于后续优化

## 依赖关系

```
websocket → consensus → sage → llm → stream
              ↓          ↓       ↓
            config     types   prompts
              ↓          ↓       ↓
            internal ←──┴───────┘
```
