# Avatar 说明

## Avatar 是什么？

Avatar 是一个协议角色：所有不是 MAGI、但需要向 MAGI 汇报的 Agent 都属于 Avatar。它不是独立权限角色，也不要求专用运行时、消息总线或软件包。

- 内部 Avatar 复用上游思源笔记的普通 Agent 系统落地。
- 未来运行在工作空间外部的 Agent 工具，也可以通过 LLM 转发服务接入并作为 Avatar；转发服务需要提供等价的受控汇报适配器。
- task-directory capability 是可选的执行能力，不是 Avatar 的定义条件或专属权限。

## Avatar 的能力边界

### 1. 外部任务目录

获得有效 task-directory capability 的内部 Agent（包括 Avatar）可以绑定并读写工作空间之外的任务目录。目录读写权限不因 Agent 是否属于 Avatar、来源、channel 或创建方式而改变；没有该 capability 的 Avatar 不因此获得目录权限。

目录 capability 与会话可达性分离：

- capability 由后端注入，不能由模型参数或前端会话字段伪造。
- 绑定记录保存 `OwnerIdentityID`，只有对应 guardian owner 可以发现、查看、控制和使用该 Avatar 会话；外部 Avatar 由转发服务映射到同一 owner 约束。
- 其它用户、其它角色和其它 Agent 即使知道 `sessionID` 也不能读取、写入或控制该会话。
- Electron、Web 和移动端都可以访问已通过后端鉴权的 Avatar 会话；Electron 只提供可选的原生目录选择器。

### 2. 向 MAGI 汇报

所有内部 Avatar 必须拥有 `report2magi` 原生工具；外部 Avatar 通过 LLM 转发服务提供等价的受控报告适配器。两者都是唯一的受控汇报通道，只能向 MAGI 发送：

- 进度
- 执行结果
- 风险和阻塞
- 证据引用
- 需要 MAGI 决策的事项

报告的来源由后端根据真实会话上下文绑定，Avatar 不能指定其它接收者、伪造 `sessionID` 或伪造 owner 身份。

### 3. 通信限制

Avatar 的入站和出站消息只允许经过 guardian 或 MAGI：

- Avatar 不得与其它 Avatar 直接通信。
- Avatar 不得向 guardian、MAGI 之外的角色发送消息。
- 工具回调、confirm、question 和结果回传都必须经过后端通信 ACL。
- 普通用户不能通过 WebSocket 广播、会话列表或工具参数发现 Avatar 的受保护内容。

## Avatar 与 MAGI 的关系

### MAGI 派出 Avatar

MAGI 根据任务决定是否使用 Avatar。内部 Avatar 通过上游 Agent 系统创建或复用普通 Agent 会话；外部 Avatar 通过未来的 LLM 转发服务接入。派出动作应携带任务上下文、owner 约束和必要的目录 capability，但不能把外部目录 capability 授予 MAGI 自身。

### Avatar 向 MAGI 汇报

```text
Avatar 执行任务
    ↓
调用 report2magi
    ↓
后端绑定真实 Avatar session 与 owner
    ↓
MAGI 接收、持久化并分析报告
```

### MAGI 读取 Avatar 历史

MAGI 是受信任的上层分析者，可以读取和分析所有 Avatar 的聊天历史，用于：

- 汇总执行进度和结果
- 判断风险、阻塞和重试策略
- 形成后续派发决策
- 复盘 Avatar 的完整执行过程

该读取权限是 MAGI 的专用后端能力，不等同于 task-directory capability，也不应通过普通 guardian 会话或客户端伪造获得。

## MAGI 自身的目录边界

MAGI 不绑定外部任务目录，也不直接执行外部目录写操作：

- MAGI 对主笔记拥有完整编辑权限。
- forge 模式下 MAGI 只能阅读自身代码。
- 其它目录对 MAGI 强制只读；需要修改时必须派出拥有目录 capability 的普通 Agent/Avatar。

## 会话与生命周期

内部 Avatar 使用上游 Agent 系统的普通会话持久化和生命周期管理；外部 Avatar 的会话由转发服务保存并以受控接口接入。MAGI 通过统一的受保护全量历史读取服务访问所有已接入 Avatar 的历史；普通 guardian 只能访问自己 owner 身份绑定的 Avatar 会话。

## 实现与验证要求

- 复用 `kernel/agent` 的普通 Agent 运行时，不创建 Avatar 专用运行时分支。
- 在所有内部普通 Agent 工具集中注册 `report2magi`，并在后端绑定真实 session、owner 和接收者；为外部 Avatar 设计等价的转发报告适配器。
- task-directory 工具对普通 Agent/Avatar 按 capability 提供读写；MAGI 工具集不暴露 task-directory capability。
- 为 owner 隔离、MAGI 全量 Avatar 历史读取、内部 `report2magi`/外部报告适配器单向汇报和 Agent 间通信拒绝补充后端测试。
