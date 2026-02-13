# AIagent 设计文档拆分 (TikTocTak)

> **目标**: 将 `AIagent设计.design.md` 拆分为 Shell（Agent 运行时）和 Ghost（MAGI 认知架构）两个独立设计文档
> **原则**: Ghost 对 Shell 透明，Shell 可将 Ghost 视为普通 LLM 接口调用

---

## 拆分边界

| 原文档章节 | 归属 | 说明 |
|-----------|------|------|
| §1 概述 | Shell | Agent 运行时总览 |
| §2 核心架构 | Shell | 数据结构、运行循环 |
| §3 记忆系统 | Shell | 分层存储 |
| §4 工具系统 | Shell | 工具链、Sub-Agent |
| §5 上下文与预算管理 | Shell | Token 管理 |
| §6 安全沙箱 | Shell | 安全层 |
| §7.1 Ghost in the Shell | 两者 | 接口定义，Shell 侧保留接口描述，Ghost 侧保留内部实现 |
| §7.2 MAGI Internal | Ghost | 三贤人机制 |
| §7.3 决策流程 | Ghost | 意识循环 |
| §7.4 ATF System | Ghost | 同步率、Seraph |
| §7.5 Dreaming Process | Ghost | 造梦与记忆固化 |
| §8 实施计划 | Shell | 保留，引用 Ghost 文档 |
| §9-10 调研 | Shell | 保留 |

## 新文档

- `docs/设计/MAGI认知架构.design.md` — Ghost 内部实现
- `docs/设计/AIagent设计.design.md` — Shell 运行时（原文档瘦身）

## 接口约定

Shell 通过统一的 LLM 接口与 Ghost 交互：
- Shell 发送用户消息 + 上下文
- Ghost 返回响应文本 + 工具调用请求
- Shell 不感知 Ghost 内部的 MAGI/ATF/Seraph 机制

---

## 🟢 近期计划

- [ ] 创建 Ghost 文档 (MAGI认知架构.design.md)
- [ ] 重写 Shell 文档 (AIagent设计.design.md)
- [ ] 更新 ttt 引用

---

**文档创建**: 2026-02-13 11:28 (UTC+8)
