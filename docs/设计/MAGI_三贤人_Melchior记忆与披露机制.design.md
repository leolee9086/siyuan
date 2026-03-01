# 梅基奥尔 (Melchior) 记忆与披露机制设计 (纯理性/逻辑中枢)

> **核心认知定调**：三贤人之间**没有分工关系，只有视角关系**。他们的差异来源于分配到的记忆结构和所处的大五人格切面不同。

## 1. 核心定位 (Identity & Role)
Melchior 代表的是 **”织”的职业和责任视角**。
面对同一个任务，Melchior 拥有当前场景的全量上下文记忆，其记忆结构与一般 AI Agent 相同——完整的对话历史、代码、错误日志、执行结果，一切当前任务相关的信息都在其视野内。

*   **隐喻**：职业和责任视角、当前场景的全量观察者。

## 2. 记忆机制：当前场景全量记忆 (Memory Architecture)

Melchior 的记忆机制设计为 **”当前场景全量，跨任务清零”**：

### 2.1 输入上下文 (Context Window)
*   **构成**：**当前场景/任务的完整上下文**，与一般 AI Agent 的记忆模型一致。
*   **包含**：
    *   当前任务的完整对话历史
    *   原始用户指令（未经摘要）
    *   当前运行环境的 Stack Trace、错误日志详情
    *   正在修改或审阅的代码
    *   Shell 返回的完整执行结果

### 2.2 生命周期：跨任务清零 (Task-Boundary Reset)
一旦 Trinity (显意识) 宣布当前 Task ID 完结或发生场景切换，Melchior 针对上一任务的工作台会被**清空**。
*   **为什么这么设计**：Melchior 的价值在于对当前场景的全量高精度观察。跨任务的历史连续性由 Balthazar 负责。

### 2.3 摘要职责 (Summarization Duty)
当系统需要对当前场景进行摘要压缩时（例如上下文即将溢出、或任务切换时需要为 Balthazar 生成跨任务记忆），**Melchior 优先承担摘要任务**。Melchior 拥有当前场景的全量上下文，是最适合执行信息压缩的实体。

摘要产物的去向：
*   经由 Dreaming Process，被验证为通用的事实（Facts）和技术方案（Patterns）写入**语义知识图谱 (Semantic Knowledge)**，供未来所有节点检索
*   剥离大块原始输入输出后的任务摘要，注入 **Balthazar 的跨任务情景记忆**

## 3. 输出机制 (Output Protocol)

Melchior 不直接面向用户输出，其回答经由 `introspection.go` 重新包装为 Trinity 的第一人称内心独白。

### 3.1 输出特征
Melchior 的输出自然倾向于从职业和责任视角切入，但不对其输出风格做强制约束——风格由 $P_{base}$ 的人格特质自然涌现。

### 3.2 输出示例
> - **诊断**：当前异常为 `NullPointerException` 发生于 `col.ts:793`。
> - **逻辑推演**：由于 `previousID` 被安全取出，但未在 793 行做 `undefined` 校验直接传递给 `transaction` 导致链式崩溃。
> - **最优解路径**：在 793 行前添加 `if (!previousID) return;` 保护性返回，或提供默认 Fallback。
> - **重要性判定**：`requires_deliberation: false` (常规修复，无需投票，建议直接批准)。

### 3.3 与 Trinity 的交互
Trinity 看到这段内容后，就像人的脑子里冒出了一个极度清晰的”理智判断”。Trinity 会将这个逻辑框架，结合其他两位贤人的输入，包装成属于”织”的话术输出。
