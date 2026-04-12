# MagiRoot.ctx 拆分记录

创建时间: 2026-04-12
状态: 已完成
目标文件: `app/src/magi/entry/MagiRoot.ctx.ts`

## 背景

- 原文件物理行数: 1148
- 单文件 lint 问题: 141
- 关键约束:
  - `entry` 目录条目数为 11，触发 `folder-item-limit`
  - 原文件同时承载状态创建、工作空间守卫、source simulation、计算属性、窗口控制、context 装配
  - 需遵循“先备份，再修改，再核对”的规程

## 现状职责分块

1. 工作空间 AI 主笔记本守卫与启动流程
2. MAGI 主面板基础动作
3. Source Simulation 面板状态与提交流程
4. 视图计算属性映射
5. 窗口控制与最终上下文装配

## 拆分方案

- 将 `MagiRoot.ctx.ts` 迁入已存在的 `app/src/magi/entry/rootctx/` 子目录
- 在 `rootctx` 内建立 `imports.ts` 作为跨目录依赖网关
- 按职责拆为以下模块:
  - `MagiRoot.state.ts`
  - `MagiRoot.workspace.ts`
  - `MagiRoot.actions.ts`
  - `MagiRoot.sourceSimulation.ts`
  - `MagiRoot.computed.ts`
  - `MagiRoot.handlers.ts`
  - `index.ts`
- 更新 `MagiRoot.vue` 的上下文导入入口到 `./rootctx`

## 备份策略

- 原始文件静态备份到:
  - `app/src/magi/entry/rootctx/MagiRoot.ctx.backup.ts`
- 备份完成后再删除顶层 `MagiRoot.ctx.ts`
- 备份文件仅作为人工核对基线，不参与后续实现演进

## 校验步骤

1. `pnpm run lint:file -- src/magi/entry/rootctx/imports.ts` ✅
2. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.state.ts` ✅
3. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.workspace.ts` ✅
4. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.actions.ts` ✅
5. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.sourceSimulation.ts` ✅
6. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.sourceSimulation.submit.ts` ✅
7. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.computed.ts` ✅
8. `pnpm run lint:file -- src/magi/entry/rootctx/MagiRoot.handlers.ts` ✅
9. `pnpm run lint:file -- src/magi/entry/rootctx/index.ts` ✅
10. 核对 `entry` 与 `rootctx` 目录条目数量（分别为 10 / 10）✅

## 结果

- 原始 `MagiRoot.ctx.ts` 已迁移到 `rootctx/` 子目录并按职责拆分
- 顶层 `entry` 目录条目数从 11 降到 10，`folder-item-limit` 约束已满足
- `rootctx` 子目录内保留 10 个条目，其中包含 1 份静态备份和 9 个运行时/装配文件
- `MagiRoot.vue` 仅更新了上下文导入入口到 `./rootctx`

## 风险点

- `rootctx` 子目录条目数必须控制在 10 个以内，避免新的 `folder-item-limit`
- `useMagiRootContext` 和 handler/computed 装配函数需继续满足单函数行数约束
- source simulation 提交链路包含登录、请求镜像和消息状态写回，拆分后要重点核对行为一致性
