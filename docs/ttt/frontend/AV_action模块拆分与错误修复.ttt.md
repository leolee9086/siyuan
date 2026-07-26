# AV action模块拆分与错误修复执行跟踪 (TikTocTak)

> **目标**: 将 `app/src/protyle/render/av/action.ts` 按职责拆分到 `action/` 子目录，先保留 `.backup.ts` 原始备份，再修复该模块触发的 lint 与 TypeScript 错误，同时保持现有导入路径与交互行为不变。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

1. **先备份后修改**: 原始 `action.ts` 必须先以 `.backup.ts` 形式保留，再进行目录迁移和代码调整。
2. **目录约束优先**: 本任务首先解决 `av` 目录条目超限与 `action.ts` 体量过大的结构性问题，不在 `av` 根层继续增加新的职责文件。
3. **行为保持不变**: 点击、右键菜单、单元格动画、完整复制等交互行为必须与原实现一致。
4. **注释真实有效**: import 注释中的用途、使用范围、解耦评估必须基于真实调用关系，不得为了通过 lint 填写空泛描述。

---

## 验证检查清单

- [x] 已创建 `action.ts.backup.ts` 备份
- [x] 备份文件由循环依赖生产源码边界排除，不影响生产 SCC
- [x] `action` 实现已迁入 `action/` 子目录
- [x] 现有 `./action` / `../render/av/action` 导入路径保持可用
- [x] `action` 模块相关 lint 错误清零
- [x] `action` 模块相关 TypeScript 错误清零
- [ ] 拆分后未改变原有交互行为

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 当前状态快照

- `app/src/protyle/render/av/action.ts` 已先备份为 `app/src/protyle/render/av/action.ts.backup.ts`，原始逻辑可随时对照回查。
- 主实现已迁移为 `app/src/protyle/render/av/action/index.ts` 入口，并拆出 `click.ts`、`contextmenu.ts`、`name.ts`、`animation.ts`、`duplicate.ts`、`imports.ts`、`action.guards.ts`。
- `action/` 目录当前条目数已压缩到约束范围内，避免继续在 `av` 根层堆积职责文件。
- `click/` 已完成真实子目录化拆分，当前结构包含 `shared.ts`、`cell.ts`、`className.ts`、`dataType.ts`、`dataType.advanced.ts`、`imports.ts`，并已清理该链路的 lint 问题。
- `contextmenu/` 已完成真实子目录化拆分，当前结构包含 `selection.ts`、`openBy.ts`、`copy.ts`、`fields.ts`、`rowActions.ts`、`imports.ts`、`types.ts`，根入口 `contextmenu.ts` 已瘦身为纯调度层。
- 根层 `action/imports.ts` 已重建为瘦网关，只保留 `click.ts`、`animation.ts`、`duplicate.ts`、`name.ts` 仍需要的共享依赖，`click/contextmenu` 已改为各自子目录网关。
- 已逐文件执行 `pnpm run lint:file -- <action 相关文件>`，当前 `action` 目录及 `click/contextmenu` 子目录均已通过 lint。
- 已执行 `pnpm exec tsc -p tsconfig.json --noEmit --pretty false` 并过滤 `src/protyle/render/av/action` 路径，当前未发现 action 模块相关 TypeScript 报错。

---

## 🟢 近期计划

- [-] **Phase 4: 逐调用路径复核交互正确性 (P0)**
  - **背景**: 用户明确要求将本任务按复杂任务处理，并逐行校验逻辑正确性，不能只做 lint 导向的机械调整。
  - **行动**:
    1. 对照 `action.ts.backup.ts` 检查点击、右键菜单、单元格动画、完整复制、标题同步等行为是否一致。
    2. 检查事务参数、DOM 同步、同页联动和移动端分支是否保留原语义。
    3. 在 lint/TS 清零后，再回查调用方路径与运行时假设。
  - **验收标准**:
    - 关键行为逐段核验完成
    - 不存在为通过 lint 新引入的空实现或语义漂移

---

## 🟡 中期计划

- [ ] **Phase 5: 验证相关调用方兼容性 (P1)**
  - **背景**: `action` 被 `wysiwyg`、`gutter`、`av` 内部多个模块直接引用。
  - **行动**:
    1. 校验 `index.click.ts`、`index.contextmenu.ts`、`insertHTML.ts`、`keydown.ts`、`relation.ts` 等调用方。
    2. 确认导入路径、运行时行为和选择状态同步未受影响。

---

## 🏁 已归档/已完成

- [x] **2026-04-20 Phase 1: 建立跟踪并备份原文件 (P0)**
  - 已创建本 ttt 文档。
  - 已生成 `app/src/protyle/render/av/action.ts.backup.ts` 原始备份。
  - 已确认 `.backup.ts` 不参与 lint。

- [x] **2026-04-20 Phase 2: 将 action 模块拆分到子目录 (P0)**
  - 已创建 `app/src/protyle/render/av/action/` 子目录并迁移主体实现。
  - 已保留 `app/src/protyle/render/av/action/index.ts` 作为稳定入口。
  - 已将目录条目数控制在约束范围内。

- [x] **2026-04-20 Phase 3: 修复 action 模块 lint 与 TS 错误 (P0)**
  - 已完成 `click/` 子目录真实拆分，并清理 `shared.ts`、`cell.ts`、`className.ts`、`dataType.ts`、`dataType.advanced.ts`、`imports.ts` 的 lint。
  - 已完成 `contextmenu/` 子目录真实拆分，并将 `contextmenu.ts` 收敛为纯入口调度。
  - 已将 `action/imports.ts` 缩减为当前层级最小共享网关，去除 `click/contextmenu` 下沉后不再需要的转发。
  - 已对 `action` 目录相关文件逐个执行 `pnpm run lint:file -- <file>`，当前未发现 lint 报错。
  - 已执行 `tsc` 并过滤 `src/protyle/render/av/action` 路径，当前未发现 action 模块相关 TypeScript 报错。

---

**文档创建**: 2026-04-20
**最后更新**: 2026-04-20（lint/TS 已清零，已转入行为复核阶段）

- **2026-07-27**：经 [循环依赖生产源码边界校正](./循环依赖生产源码边界校正.ttt.md) 复核，`action.ts.backup.ts` 是本任务明确保留的行为对照证据，不作删除；循环检查现按项目统一后缀规则将其排除，生产 `action/` 实现继续完整参与依赖图。
