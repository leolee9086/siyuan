# Avatar 详细说明

## Avatar 是什么？

Avatar是MAGI为特定通道（channel）创建的**执行分身**，用于持续处理该通道的请求。

## Avatar 的核心特征

### 1. 通道绑定

Avatar创建时会绑定到特定channel：
- `guardian`: Guardian来源的请求
- `external-agent`: 外部agent的请求
- `system-cron`: 定时任务触发的请求
- `unknown`: 未知来源

**绑定规则**：
- 一个channel只能绑定一个Avatar
- Avatar持续负责该channel的所有请求
- Avatar销毁后，channel会重新创建新Avatar

### 2. 独立运行时

Avatar是完全独立的agent实例：
- 有自己的AI实例（MockWISE）
- 有独立的系统提示词
- 维护独立的上下文历史
- 可以调用外部工具

### 3. 汇报机制

Avatar通过`report_to_core`工具向MAGI汇报：

**汇报类型**：
- `heartbeat`: 心跳（必须定期发送）
- `progress`: 进度更新
- `risk`: 风险警告
- `summary`: 任务总结

**紧急程度**：
- `low`: 低优先级
- `medium`: 中等优先级
- `high`: 高优先级

### 4. 心跳监控

Avatar必须定期发送心跳，否则会被销毁：
- 每个Avatar有`heartbeatIntervalRounds`参数（如5轮）
- 如果超过间隔未发送心跳，Avatar被标记为`destroyed`
- 销毁后，该channel的下次请求会创建新Avatar

### 5. 创建流程

Avatar的创建需要三贤人共识：

```
1. Melchior发起
   ├─ 判断是否需要创建Avatar
   ├─ 输出JSON: {initiate: true/false, reason, systemPromptProposal, requirements}
   └─ 如果initiate=false，流程终止

2. Balthazar/Casper投票
   ├─ 评审Melchior的提案
   ├─ 输出JSON: {decision: "approved"/"rejected", reason, systemPromptProposal, requirements}
   └─ 需要≥2/3通过

3. Trinity设计系统提示词
   ├─ 综合三贤人的提案
   ├─ 设计最终的Avatar系统提示词
   └─ 必须包含avatar_number、channel、report_to_core约束
```

### 6. 记忆隔离

Avatar只能访问部分记忆，根据`exposureMode`：
- `full`: 完整暴露记忆种子和人格改写
- `partial`: 部分脱敏
- `distorted`: 歪曲信息（用于不可信来源）

### 7. 生命周期

```
创建 → idle → active → idle → ... → destroyed
  ↑                                      ↓
  └──────────── 重建 ←───────────────────┘
```

**状态说明**：
- `idle`: 空闲，等待请求
- `active`: 正在处理请求
- `destroyed`: 已销毁（心跳超时或异常）

## Avatar 与 MAGI 的关系

### MAGI 创建 Avatar

```
用户请求 → MAGI判断需要Avatar
    ↓
Melchior发起创建提案
    ↓
Balthazar/Casper投票
    ↓
Trinity设计系统提示词
    ↓
创建Avatar实例并绑定channel
```

### Avatar 向 MAGI 汇报

```
Avatar处理请求
    ↓
调用 report_to_core(type, content, urgency)
    ↓
MAGI接收汇报并记录到共识消息
    ↓
前端通过WebSocket监听到汇报事件
```

### MAGI 调用 Avatar

```
用户请求 → MAGI识别channel
    ↓
查找该channel绑定的Avatar
    ↓
如果存在且未销毁，委派给Avatar
    ↓
Avatar处理并返回结果
```

## Avatar 在后端的实现位置

**重要**：Avatar不属于`kernel/magi/`包的一部分！

Avatar应该在独立的包中实现：
```
kernel/agent/          # 通用Agent运行时
└── avatar/           # Avatar专用实现
    ├── runtime.go    # Avatar运行时
    ├── pool.go       # Avatar池管理
    ├── lifecycle.go  # 生命周期管理
    └── tools.go      # report_to_core工具
```

**MAGI与Avatar的交互**：
- MAGI通过工具接口创建Avatar
- MAGI通过channel路由请求到Avatar
- Avatar通过`report_to_core`工具向MAGI汇报

## 示例场景

### 场景1：Guardian请求

```
1. 用户通过Guardian发送请求
2. 请求带有channel="guardian"
3. MAGI检查是否有绑定的Avatar
4. 如果没有，三贤人共识创建Avatar-01并绑定到guardian
5. 后续guardian请求都由Avatar-01处理
6. Avatar-01定期发送心跳汇报
```

### 场景2：定时任务

```
1. Cron触发定时任务
2. 请求带有channel="system-cron"
3. MAGI检查是否有绑定的Avatar
4. 如果有Avatar-02绑定到system-cron，直接委派
5. Avatar-02执行任务并汇报进度
```

### 场景3：心跳超时

```
1. Avatar-01处理了5轮请求
2. 第6轮请求时，Avatar-01应该发送心跳
3. 但Avatar-01没有调用report_to_core(type="heartbeat")
4. MAGI检测到心跳超时，销毁Avatar-01
5. 下次guardian请求时，重新创建Avatar-03
```

## 关键设计约束

1. **Avatar不在Bus上**：Avatar有自己的运行时，不通过MAGI的消息总线
2. **通道独占**：一个channel只能绑定一个Avatar
3. **心跳强制**：Avatar必须定期发送心跳，否则被销毁
4. **共识创建**：Avatar创建需要三贤人共识，不能随意创建
5. **记忆隔离**：Avatar只能访问部分记忆，保护核心人格
