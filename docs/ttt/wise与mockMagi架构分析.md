# wise 与 mockMagi 架构分析

## 零、实际引用关系（关键发现）

在原始前端聊天面板中，**只有 mockMagi.js 被实际使用**：
- `useMagi.js` → 导入 `initMagi`, `MockTrinity` from `mockMagi.js`
- `wise/index.js` → 仅被 `magiSystem.js` 导入
- `magiSystem.js` → **未被任何前端聊天面板代码引用**

结论：聊天面板的核心运行时是 mockMagi.js，wise/ 模块服务于另一条未激活的决策管线。

## 一、两个模块的职责

### wise/ 目录（已迁移至 app/src/magi/core/wise/）
- **职责**：三贤人的"决策引擎"层，面向函数投票、对话总结、技术评估等结构化AI任务
- **核心抽象**：`createWISE` 工厂 → 派生 `createMelchior`/`createBalthazar`/`createCasper`
- **API模式**：通过注入的 `WISEApi.post()` 发送标准 messages 请求，同步等待完整响应
- **无状态**：不维护对话历史，每次调用独立
- **当前状态**：已迁移但在聊天面板场景中未被使用

### mockMagi.js（聊天面板的实际运行时）
- **职责**：三贤人的"聊天代理"层，面向用户对话场景（SSE流式、上下文记忆、连接管理）
- **核心抽象**：`MockWISE` 基类 → 派生 `MockMelchior`/`MockBalthazar`/`MockCasper`/`MockTrinity`
- **API模式**：通过 `createAISSEProvider` + `createPromptStreamer` 实现SSE流式响应
- **有状态**：维护 `messages`（展示用）和 `_contextMessages`（API上下文），含 `memorySize` 滑动窗口
- **额外能力**：`connect()`连接管理、`voteFor()`模拟投票、`loading`状态、`updateConfig()`热更新

## 二、依赖关系

```
[聊天面板调用链 - 实际激活]
useMagi.js ──导入──→ mockMagi.js (initMagi, MockTrinity)
mockMagi.js ──使用──→ dummySys/rei.js （人格特征集）
            ──使用──→ wise/promptTemplates/ （提示词模板）
            ──使用──→ useOpenAISSE.js （SSE流式客户端）

[决策管线 - 未被聊天面板激活]
magiSystem.js ──使用──→ wise/{Melchior,Balthazar,Casper}
                         ↑ 基于 wise/baseWise.js (WISE)
```

## 三、重叠分析

| 维度 | wise/ | mockMagi.js |
|------|-------|-------------|
| 目标场景 | 结构化决策（投票/评估） | 用户聊天对话 |
| 通信方式 | 同步POST | SSE流式 |
| 状态管理 | 无状态 | 有状态（上下文记忆） |
| 投票机制 | AI驱动的函数评分 | 随机模拟评分 |
| 聊天面板是否使用 | 否 | 是 |

**结论：职责不重叠，且聊天面板仅依赖mockMagi。**

## 四、架构调整建议

### 推荐方案：mockMagi迁移为独立chatAgent模块

mockMagi.js 是聊天面板的实际运行时，应迁移为独立模块，与wise并列：

```
app/src/magi/core/
├── wise/          # 决策引擎（已迁移，服务于magiSystem）
├── chatAgent/     # 聊天代理（从mockMagi迁移，服务于聊天面板）
│   ├── baseChatAgent.ts    # MockWISE → createChatAgent
│   ├── melchiorChat.ts     # MockMelchior配置
│   ├── balthazarChat.ts    # MockBalthazar配置
│   ├── casperChat.ts       # MockCasper配置
│   ├── trinityChat.ts      # MockTrinity（综合人格）
│   └── chatAgent.types.ts  # 聊天代理类型
├── dummySys/      # 人格特征集（已迁移）
└── magiSystem.ts  # 编排器
```

### 迁移要点
1. `MockWISE` 基类 → `createChatAgent` 工厂函数（遵循已有lint规则，不用class）
2. SSE流式依赖 `useOpenAISSE` → 复用已迁移的 `service/sseParser.ts` + `service/requestController.ts`
3. 各子类仅是配置差异，迁移为配置对象 + 工厂调用
4. `MockTrinity.reply()` 的综合逻辑（收集其他贤人响应后合成）需特殊处理
5. `initMagi()` → 迁移为 `createChatAgentGroup()` 编排函数
