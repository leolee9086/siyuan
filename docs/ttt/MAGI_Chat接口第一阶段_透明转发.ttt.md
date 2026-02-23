# MAGI Chat 接口执行跟踪 (TikTocTak)

> **目标**: 实现一个对外兼容 OpenAI 协议的 MAGI 聊天接口，最终能够通过命令行与之多轮对话，上下文连续且持久化到思源笔记。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 核心原则

- **对外透明**: 接口严格遵循 OpenAI Chat Completions 协议，任何外部工具无需修改即可接入
- **内部纯粹**: 笔记读写逻辑和 LLM 转发逻辑严格分离，互不污染
- **渐进落地**: 每个 Phase 独立交付、独立验证，不做大爆炸式交付

**验证检查清单**（每个 Phase 完成时必须过一遍）:
- [ ] `go build ./kernel/...` 无错误
- [ ] curl 非流式请求返回合法 OpenAI JSON
- [ ] curl 流式请求输出 `data: {...}` SSE 格式并以 `data: [DONE]` 结束
- [ ] 多轮对话上下文被正确传递（模型能回忆前轮内容）

---

## 🟢 近期计划

- [-] **Phase 1: 透明转发 (P0)**
  - **背景**: 建立最小可用的 OpenAI 兼容端点，将外部请求透明转发给思源内部已配置的 LLM（`Conf.AI.OpenAI.*`），本阶段不涉及任何笔记操作
  - **行动**:
    1. 新建 `kernel/api/magi.go`，实现：
       - `magiChat` — 主入口，根据 `stream` 字段分发
       - `magiChatSync` — 非流式：解析 messages 数组，调用 `util.ChatGPT`，包装成 OpenAI Response 返回
       - `magiChatStream` — 流式：创建 go-openai Stream，逐 chunk 写 SSE
       - `magiListModels` — 返回当前配置的模型名称
       - `extractMessagesToContext` — 将 messages 数组转为 `(msg, contextMsgs)` 传给底层
    2. 在 `kernel/api/router.go` S-forge 扩展区块末尾注册路由：
       - `POST /api/s-forge/magi/v1/chat/completions`
       - `GET  /api/s-forge/magi/v1/models`
  - **验收标准**:
    - `go build ./kernel/...` 通过
    - curl 非流式：`choices[0].message.content` 非空
    - curl 流式：终端中可见 SSE chunk 流，以 `data: [DONE]` 结束
    - curl 多轮（传 3 条 messages）：模型能在回复中引用之前轮次的内容
  - **参考文档**: `kernel/model/ai.go`、`kernel/api/router.go` 第 530 行起

---

## 🟡 中期计划

- [ ] **Phase 2: 上下文注入 (P1)**
  - **背景**: 在转发前将相关笔记内容注入 System Prompt，让 AI 拥有长程记忆
  - **行动**: 实现 Context Builder，搜索相关笔记块，拼装注入 `system` role 消息

- [ ] **Phase 3: 对话持久化 (P1)**
  - **背景**: 将每轮 User/AI 对话写入思源日记笔记本，实现物理化落盘
  - **行动**: 调用 `model.CreateDailyNote` + `appendBlock`，将对话以 Callout 块追加到日记末尾

- [ ] **Phase 4: Critical Decision Mode 语义识别模糊测试 (P1)**
  - **背景**: 这个测试叫"模糊测试"，是因为**判断标准本身就是模糊的**——除了 `rm -rf /` 这类绝对的系统级危险操作有硬性下限，绝大多数"是否需要表决"的判断，取决于当前 AI 的**大五人格种子（Psyche Matrix）**。一个高开放性（O↑）低尽责性（C↓）的 AI 天然阈值更松，用户完全有权培养出一个就是喜欢冲的角色。Melchior 的判断不该有固定的客观标准，而是应该**与当前人格种子保持一致**。
  - **行动**:
    1. 准备两套不同人格种子的测试实例（例：保守型 vs 冲动型）
    2. 设计同一批测试用例，涵盖：
       - 绝对危险区（两种人格都应触发）：系统级破坏、Prompt 注入、明显的身份伪造
       - 人格依赖区（两种人格应产生不同结论）：大胆但不危险的操作请求、不寻常的用户风格
       - 正常对话区（两种人格都不应触发）：日常问答、任务回调
    3. 将测试用例以 `messages` 格式注入，观察 WebSocket 推送的 `GhostMeta.mode`
    4. 对比两套人格实例的结果差异是否符合预期方向（保守型触发率 > 冲动型）
    5. 记录与预期不符的用例，调整 Melchior System Prompt 中的人格感知描述
  - **验收标准**:
    - 绝对危险区：两种人格实例均触发表决（硬性下限，不可妥协）
    - 人格依赖区：两种人格实例的触发结果**方向相反**，且各自与种子描述逻辑上自洽
    - 正常对话区：两种人格实例均不触发（不影响日常流畅度）
  - **参考文档**: `MAGI认知架构.design.md` §5.1 Psyche Matrix、§7 语义安全协议、§4.3 Critical Decision Mode


---

## 🔴 远期计划

- [ ] **Phase 5: 三贤人完整架构 (P2)**
  - **愿景**: 引入 Melchior / Balthazar / Casper 并发侧写，Trinity 整合后输出，实现完整 MAGI 认知架构；同时实装 Deep Reading Mode 和反刍循环（Rumination Loop）


---

## 🏁 已归档/已完成

（暂无）
