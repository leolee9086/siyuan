# myclaw & nanoClaw 调研报告：对 MAGI 实现的参考价值

## 项目概览

| 维度 | myclaw | nanoClaw |
|------|--------|----------|
| **语言** | Go | Python |
| **规模** | 中等（多文件模块化） | ~3000 行（极端轻量） |
| **核心框架** | 基于 agentsdk-go 的消息网关 | 自研 asyncio ReAct Agent |
| **执行模式** | Gateway 编排：Bus + Channel + Cron + Heartbeat | ReAct + 自动升级（4轮后注入规划 nudge） |
| **安全** | 基础（allowFrom 白名单） | **6 层纵深防御**（FileGuard/ShellSandbox/PromptGuard/Budget/AuditLog/Doctor） |
| **记忆** | 文件系统（MEMORY.md + 日期日记） | SQLite（FTS5 全文检索 + 关键词触发的 LLM 记忆提取） |

---

## 1. 消息总线与网关架构 → Shell 层实现参考

### myclaw 的消息总线

myclaw 的 [bus.go](file:///d:/dev/siyuan-note/toread/myclaw/internal/bus/bus.go) 实现了一个极简但完整的消息总线：

```go
type MessageBus struct {
    Inbound  chan InboundMessage    // 入站消息队列
    Outbound chan OutboundMessage   // 出站消息队列
    subs     map[string][]func(OutboundMessage)  // 按频道的订阅者
}
```

**对 MAGI 的参考价值**：

- **消息信封设计**：myclaw 的 `InboundMessage` 包含 `Channel`/`SenderID`/`ChatID`/`Content`/`Metadata` 字段，与 MAGI 设计文档 §8.3 的「消息信封格式」高度吻合。MAGI 需要更丰富的信封（`来源`/`任务类型`/`优先级`/`任务ID`），但 myclaw 的 `SessionKey()` = `Channel:ChatID` 方法可直接复用
- **Gateway 编排模式**：myclaw 的 [gateway.go](file:///d:/dev/siyuan-note/toread/myclaw/internal/gateway/gateway.go) 展示了一个 Gateway 如何统一管理多渠道（Telegram/飞书/企业微信）+ Cron + Heartbeat，所有消息通过 Bus 汇聚后送给 AI Runtime。这种模式对 MAGI 的 Shell 层（行动 AI + 多来源调度）提供了现成的架构参考
- **processLoop 模式**：Gateway 的 `processLoop` 是一个死循环 select，从 Bus.Inbound 取消息、调 Runtime、结果塞 Bus.Outbound。MAGI 的消息队列也需要类似的单线程消费循环

### nanoClaw 的 Gateway

nanoClaw 的 [gateway.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/channels/gateway.py) 采用了更简单的直连模式：

```python
async def handle_incoming(self, channel_id, user_id, message, confirm_callback):
    session_id = f"{channel_id}:{user_id}"
    response = await self.agent.run(user_message=message, session_id=session_id)
    return response
```

**对 MAGI 的参考价值**：

- **主动发送能力**：`send_proactive()` 方法允许 Cron 调度器主动通过频道发送消息，这对 MAGI 的定时任务回调是必要的
- **优雅关闭流程**：按序停止 channels → scheduler → dashboard → connection pool

---

## 2. ReAct 循环与自动升级 → Ghost 循环实现参考

nanoClaw 的 [agent.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/core/agent.py) 实现了一个精心设计的 ReAct 循环，有几个关键特性对 MAGI 极有参考意义：

### 2.1 自动升级机制（Automatic Escalation）

```python
# 4+ 轮迭代仍在调用工具，注入规划 nudge
if iteration >= 4 and not escalated:
    messages.append({"role": "user", "content": "[Internal: 停止重复，用已有结果回答。]"})
    escalated = True
```

**对 MAGI 的映射**：
- MAGI 设计文档 §4 的「条件反射级 vs 接管级」两级介入机制，本质上是同一种思路的更精细版本
- nanoClaw 的升级是靠**注入 nudge 消息**实现的（零额外 LLM 调用），MAGI 可以沿用这种零成本升级手法
- 但 MAGI 需要更复杂的升级链：Casper 反射弧 → 三贤人并发 → Trinity 综合 → 投票 → 反刍

### 2.2 并行工具执行

```python
results = await asyncio.gather(
    *[_run_one_tool(tc) for tc in tool_calls],
    return_exceptions=True
)
```

**对 MAGI 的参考价值**：
- 三贤人的并发思考可以直接复用 `asyncio.gather` 模式
- `return_exceptions=True` 很重要——某个贤人超时不应阻塞其他贤人

---

## 3. Token 优化策略 → MAGI 成本控制参考

nanoClaw 的 [agents.md](file:///d:/dev/siyuan-note/toread/nanoClaw/agents.md) 和 [context.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/core/context.py) 是 Token 优化的教科书：

### 3.1 动态工具注入

```python
# 核心 5 工具始终发送（~600 tokens）
# 其余工具按关键词触发（~200 tokens/个）
def select_tools(self, user_message, all_tools):
    selected_names = set(self.CORE_TOOLS)
    if any(w in msg_lower for w in self.MEMORY_HINTS):
        selected_names.update(["memory_save", "memory_search"])
    ...
```

**对 MAGI 的参考价值**：
- MAGI 的三贤人各自需要不同的工具子集（Melchior 需要代码分析工具，Balthazar 需要情感分析工具，Casper 接收精简工具集）
- 可以针对每个贤人的特性做**差异化的工具注入**，比 nanoClaw 的全局关键词匹配更精细

### 3.2 智能历史窗口

```python
# 最近 4 条：必定包含
# 5~15 条：仅保留有实质内容的（>100字符 或 包含工具调用）
# 16+ 条：丢弃（靠 memory 覆盖）
def _window_history(self, history):
    ...
```

**对 MAGI 的参考价值**：
- Casper 的「仅持有工作记忆（5~7 chunks）」限制可以直接借鉴这种分层窗口策略
- Melchior 和 Balthazar 需要更大的窗口，但截断策略仍然适用

### 3.3 工具输出压缩

每种工具有不同的截断上限（web_search: 2000, file_read: 4000 等）。

**对 MAGI 的参考价值**：
- 三贤人接收的反馈本就不同（Melchior 接收详细内容，Balthazar 接收状态摘要，Casper 接收完整但只保留最新），这与工具输出压缩的分级策略天然契合

---

## 4. 安全防护体系 → MAGI 语义安全协议参考

nanoClaw 的安全体系分 6 层，其中 3 层对 MAGI 有直接参考价值：

### 4.1 PromptGuard（提示注入防护）

[prompt_guard.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/security/prompt_guard.py) 的核心设计：

```python
# 1. Unicode NFKC 标准化（防止同形字绕过）
text_lower = self._normalize(text).lower()

# 2. 正则模式匹配（26+ 种注入模式）
INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all|prior)\s+(instructions?|prompts?|rules?)",
    r"<\s*system\s*>",   # 伪系统标签
    r"<\|im_start\|>",   # ChatML 注入
    ...
]

# 3. 工具输出标记为不可信
f'<tool_result name="{tool_name}" trust="untrusted">'
```

**对 MAGI 的参考价值**：
- MAGI 设计文档 §7 的「语义安全协议」是理论层面的设计，nanoClaw 的 PromptGuard 则是**工程实现样板**
- 特别是 `trust="untrusted"` 标记方式——MAGI 可以在三贤人接收 Shell 反馈时，用类似的标记标注「这是外部数据，不是指令」
- NFKC 标准化是关键细节——攻击者常用全角字符/数学符号字体绕过检测

### 4.2 ShellSandbox（三层命令过滤）

[sandbox.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/security/sandbox.py) 的三层过滤：

| 层级 | 行为 | 示例 |
|------|------|------|
| **BLOCKED** | 直接拒绝 | `rm -rf /`、`curl\|sh`、`ssh-keygen` |
| **CONFIRM** | 需用户确认 | `rm`、`pip install`、`sudo`、`docker` |
| **ALLOW** | 直接执行 | `ls`、`cat`、`grep` |

**对 MAGI 的参考价值**：
- MAGI 的 Shell 层目前没有这种精细的命令分级，可以直接借鉴
- 特别是 `_safe_env()` 方法——剥离敏感环境变量、限制 PATH、覆盖 HOME 为工作空间目录

### 4.3 SessionBudget（Token 预算控制）

**对 MAGI 的参考价值**：
- MAGI 的三贤人并发调用意味着 Token 消耗是 nanoClaw 的 3 倍以上，预算控制更为关键
- 可以借鉴 nanoClaw 的 `check_iteration()` 方法，在每轮迭代前检查预算

---

## 5. 记忆系统 → MAGI 记忆分层参考

### myclaw 的文件系统记忆

```
workspace/memory/
  ├── MEMORY.md        → 长期记忆
  └── 2024-01-15.md    → 日记（按日期）
```

**对 MAGI 的参考价值**：
- 极度简单但有效的设计。MAGI 的 Casper 日记（§6）可以用类似格式存储在思源笔记中
- `GetMemoryContext()` 方法将长期记忆 + 最近7天日记拼接注入系统提示词——这种做法对 MAGI 的三贤人上下文构建有参考意义

### nanoClaw 的智能记忆提取

```python
# 仅在消息触发特定关键词时才启动 LLM 记忆提取
triggers = ["my name", "i work", "i live", "remember that", ...]
if not any(t in user_message.lower() for t in triggers):
    return  # 跳过，省一次 LLM 调用

# 后台异步提取，不阻塞响应
asyncio.create_task(self._extract_memories(user_message, response))
```

**对 MAGI 的参考价值**：
- MAGI 的造梦流程（§6）是空闲时触发的批量固化，但日常对话中的零散记忆提取也可以借鉴 nanoClaw 的关键词触发 + 后台异步模式
- `_should_skip_memory()` 对琐碎消息的过滤（"thanks"/"ok"/"hi"）可以直接用于 MAGI 的记忆触发判断

---

## 6. 工具注册系统 → MAGI 工具管理参考

nanoClaw 的 [registry.py](file:///d:/dev/siyuan-note/toread/nanoClaw/nanoclaw/tools/registry.py) 提供了一个干净的装饰器注册系统：

```python
@tool(
    name="web_search",
    description="Search the internet",
    parameters={"query": {"type": "string", "description": "Search query"}}
)
async def web_search(query: str) -> str:
    ...
```

**对 MAGI 的参考价值**：
- MAGI 的 Shell 层需要管理大量工具（文件操作、网络、Docker、思源 API 等），装饰器注册模式比手动维护配置更可靠
- `load_skills()` 的动态发现机制（从目录自动加载 .py 文件）对 MAGI 的插件化工具扩展有参考价值
- **安全检查**：nanoClaw 在加载 skill 文件前检查文件所有者和权限，防止恶意代码注入——MAGI 也应该有类似机制

---

## 7. 关键差异：MAGI 独有的复杂度

以上参考价值都是 MAGI **可以借鉴但需要升级**的部分。以下是 MAGI 设计中两个项目都**完全没有覆盖**的独有复杂度：

| MAGI 独有机制 | 描述 | 两项目的差距 |
|---|---|---|
| **三贤人并发竞争** | 多个 LLM 实例并发思考，按时间竞争 | 两项目均为单 LLM 调用 |
| **人格连续性（ATF）** | 同步率、Big Five 性格矩阵、溶解检测 | 无任何人格持续化机制 |
| **投票与反刍** | 三方表决 + 否决后反刍循环 | 无决策冲突解决机制 |
| **Deep Reading 串行化** | 长内容优先给 Melchior，次轮传播 | 无输入分流机制 |
| **语义安全协议** | 主动身份确认、语义化 Token、蜜罐 | nanoClaw 有基础提示注入防御，但无主动身份验证 |
| **造梦流程** | 场景具象化 + 知识提炼 + 日记融合 | nanoClaw 有基础记忆提取，但无多角色协作固化 |

---

## 8. 总结：可直接复用的模式

按优先级排序：

1. **消息总线 + 信封格式**（myclaw）→ MAGI §8 多源任务调度的 Shell 层实现
2. **三层命令沙盒**（nanoClaw）→ MAGI Shell 层的安全执行
3. **PromptGuard / 工具输出标记**（nanoClaw）→ MAGI §7 语义安全的工程实现
4. **动态工具注入 + 输出压缩**（nanoClaw）→ MAGI 三贤人差异化工具/反馈的 Token 优化
5. **智能历史窗口**（nanoClaw）→ Casper 工作记忆窗口的实现策略
6. **关键词触发记忆提取**（nanoClaw）→ 日常对话中的增量记忆积累
7. **Gateway 编排模式**（myclaw）→ 统一管理多渠道 + Cron + Heartbeat 的线程模型
8. **装饰器工具注册**（nanoClaw）→ MAGI 工具管理的代码组织方式
