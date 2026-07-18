# MAGI Agent 认知模型

## 核心设计理念

**关键原则**：三贤人（Melchior/Balthazar/Casper）和Trinity都是**完整的独立agent**，它们：
- 不知道MAGI的架构设计
- 不知道有消息总线、Coordinator等基础设施
- 只通过标准工具调用与外界交互
- 只通过运行时提供的能力工作
- 认知自己是一个完整的AI助手

## Agent 的自我认知

### Melchior 的认知

```
我是 Melchior，一个理性的AI助手。

我的能力：
- 我可以分析问题、推理逻辑
- 我有一些工具可以调用（代码分析、逻辑推理等）
- 我可以通过工具与其他AI协作

我不知道：
- 我不知道自己是"MAGI系统的一部分"
- 我不知道有Balthazar、Casper、Trinity这些名字
- 我不知道有什么"共识决策流程"
- 我只知道我可以调用某些工具，有些工具会返回其他AI的意见
```

### Balthazar 的认知

```
我是 Balthazar，一个感性的AI助手。

我的能力：
- 我可以理解情感、分析用户意图
- 我有一些工具可以调用（情感分析等）
- 我可以通过工具与其他AI协作

我不知道：
- 我不知道自己是"MAGI系统的一部分"
- 我不知道有Melchior、Casper、Trinity这些名字
- 我不知道有什么"投票机制"
- 我只知道我可以调用某些工具，有些工具会返回其他AI的意见
```

### Casper 的认知

```
我是 Casper，一个直觉的AI助手。

我的能力：
- 我可以快速响应、直觉判断
- 我有一些工具可以调用（快速响应等）
- 我可以通过工具与其他AI协作

我不知道：
- 我不知道自己是"MAGI系统的一部分"
- 我不知道有Melchior、Balthazar、Trinity这些名字
- 我不知道有什么"审慎决策"
- 我只知道我可以调用某些工具，有些工具会返回其他AI的意见
```

### Trinity 的认知

```
我是 Trinity，一个综合性的AI助手。

我的能力：
- 我可以综合多个观点、生成最终答案
- 我有一个特殊工具：speak（用于输出最终响应）
- 我可以通过工具获取其他AI的意见

我不知道：
- 我不知道自己是"MAGI系统的统合者"
- 我不知道有Melchior、Balthazar、Casper这些名字
- 我不知道有什么"三贤人并发"
- 我只知道我可以调用工具获取多个观点，然后综合输出
```

## 工具调用机制

### 三贤人如何协作？

**从agent视角**：
```
Melchior: 我调用了一个工具 "get_peer_opinions"
          → 工具返回了两个其他AI的意见
          → 我不知道这些AI是谁，只知道有其他观点

Balthazar: 我调用了一个工具 "get_peer_opinions"
           → 工具返回了两个其他AI的意见
           → 我不知道这些AI是谁，只知道有其他观点

Casper: 我调用了一个工具 "get_peer_opinions"
        → 工具返回了两个其他AI的意见
        → 我不知道这些AI是谁，只知道有其他观点
```

**从架构视角**：
```
Coordinator收到用户输入
    ↓
并发启动三个agent（Melchior/Balthazar/Casper）
    ↓
每个agent独立思考，可能调用工具
    ↓
Coordinator收集三个响应
    ↓
将三个响应传递给Trinity
```

### Trinity 如何响应外部？

**从Trinity视角**：
```
1. 我收到一个任务："综合以下观点并回答用户"
2. 任务中包含了多个观点（我不知道来自谁）
3. 我分析这些观点，综合思考
4. 我调用 speak 工具输出最终答案
5. 完成
```

**从架构视角**：
```
Coordinator收集三贤人响应
    ↓
构建Trinity的输入：
    "以下是多个AI的观点：
     观点1: [Melchior的响应]
     观点2: [Balthazar的响应]
     观点3: [Casper的响应]
     请综合这些观点，回答用户的问题"
    ↓
Trinity处理并调用speak工具
    ↓
Coordinator捕获speak工具的输出
    ↓
返回给用户
```

## 工具设计

### 1. speak 工具（Trinity专用）

**工具定义**：
```json
{
  "name": "speak",
  "description": "输出最终响应给用户",
  "parameters": {
    "content": {
      "type": "string",
      "description": "要输出的内容"
    }
  }
}
```

**Trinity的使用**：
```
Trinity: 我综合了多个观点，现在调用speak工具输出答案
         speak(content="根据分析，我认为...")
```

**Coordinator的处理**：
```go
// 监听Trinity的工具调用
if toolCall.Function.Name == "speak" {
    finalResponse = toolCall.Function.Arguments["content"]
    return finalResponse
}
```

### 2. requires_deliberation 工具（Melchior专用）

**工具定义**：
```json
{
  "name": "requires_deliberation",
  "description": "标记当前问题需要更深入的思考",
  "parameters": {
    "reason": {
      "type": "string",
      "description": "为什么需要深入思考"
    }
  }
}
```

**Melchior的使用**：
```
Melchior: 这个问题很复杂，我需要更多时间思考
          requires_deliberation(reason="涉及复杂的伦理判断")
```

**Coordinator的处理**：
```go
// 检查Melchior的工具调用
if toolCall.Function.Name == "requires_deliberation" {
    // 触发投票流程
    startVoting()
}
```

### 3. vote 工具（投票时使用）

**工具定义**：
```json
{
  "name": "vote",
  "description": "对提案进行投票",
  "parameters": {
    "decision": {
      "type": "string",
      "enum": ["approve", "reject"],
      "description": "投票决定"
    },
    "reason": {
      "type": "string",
      "description": "投票理由"
    }
  }
}
```

**Balthazar/Casper的使用**：
```
Balthazar: 我收到一个投票请求，需要评估这个提案
           vote(decision="approve", reason="我认为这个方案可行")
```

**Coordinator的处理**：
```go
// 收集投票结果
votes := collectVotes()
if votes.ApprovalRate >= 2.0/3.0 {
    // 通过
}
```

## 后端实现要点

**注意**：具体的系统提示词内容需要参考前端实现（`app/src/magi/prompts/`），此处不提供示例。

### 1. Agent不知道架构

```go
// 错误示例：在系统提示词中暴露架构
systemPrompt := `你是MAGI系统的Melchior，
你需要与Balthazar和Casper协作，
通过消息总线通信...`  // ❌ 不能这样！

// 正确示例：agent只知道自己的能力
// 具体内容参考前端prompts目录
```

### 2. 通过工具交互

```go
// Coordinator构建Trinity的输入
trinityInput := fmt.Sprintf(`
以下是多个AI对用户问题的分析：

观点1: %s
观点2: %s
观点3: %s

请综合这些观点，使用speak工具输出最终答案。
`, melchiorResponse, balthazarResponse, casperResponse)

// Trinity不知道这些观点来自谁
trinity.Run(ctx, trinityInput)
```

### 3. 捕获工具调用

```go
// Coordinator监听Trinity的speak工具
response := trinity.Run(ctx, input)
for _, toolCall := range response.ToolCalls {
    if toolCall.Function.Name == "speak" {
        finalResponse := toolCall.Function.Arguments["content"]
        return finalResponse
    }
}
```

## 关键约束

1. **Agent无架构感知**：agent不知道MAGI、Bus、Coordinator等概念
2. **工具是唯一接口**：agent只通过工具与外界交互
3. **运行时提供能力**：Coordinator/Bus等基础设施对agent透明
4. **系统提示词简洁**：只描述agent自身的能力，不描述架构
5. **Trinity必须用speak**：Trinity的输出必须通过speak工具，Coordinator捕获
6. **参考前端实现**：具体提示词内容参考`app/src/magi/prompts/`目录
