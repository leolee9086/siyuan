# 归档说明：MAGI_Go后端落实工程设计.design.md

**归档日期**: 2026-05-31  
**归档原因**: 与实际实现严重不符

## 过时原因

此设计文档是MAGI Go后端的工程蓝图，但**所有8个核心设计维度都完全偏离了实际实现**：

1. **包结构**: 文档规划 `kernel/agent/magi/`，实际为 `kernel/nerv/magi/`
2. **主引擎**: 文档规划 `engine.go`(统一引擎)，实际为 Coordinator + 独立Sage agent
3. **监控层**: 文档规划 `monitor/atf_math.go`，实际为独立的 `seraph/` 子系统
4. **适配层**: 文档规划 `adapter/llm_client.go`，实际为 `llm/` + `providers/` 多provider体系
5. **接口**: 文档规划 `MAGIEngine.Think()`，实际为 `Coordinator.CoordinateDecision()`
6. **三贤人**: 文档规划 `wise_man.go`(统一接口)，实际为 `sages/`(独立agent)
7. **Seraph**: 文档规划为中间件，实际为完整的心理治疗系统
8. **落地阶段**: 文档规划三阶段路线图，实际为逐步搭建

## 当前实际架构文档

实际架构已有以下文档覆盖（在 `kernel/nerv/magi/` 目录）：
- `ARCHITECTURE.md` — 实际架构概览
- `STRUCTURE.md` — 项目结构
- `README.md` — 概述
- `AGENT_COGNITION.md` — 认知系统
- `AVATAR.md` — Avatar系统
- `WEBSOCKET_PROTOCOL.md` — WebSocket协议

## 处置建议

- **不要参考此文档进行开发**
- 如需了解实际架构，请查看 `kernel/nerv/magi/` 目录下的实际代码和文档
- 如果需要在 `docs/设计/` 中保留工程蓝图，请基于实际代码重新编写
