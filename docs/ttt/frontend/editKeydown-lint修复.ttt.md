# editKeydown-lint修复执行跟踪 (TikTocTak)

> **目标**: 清理 `app/src/boot/globalEvent/keydown/editKeydown.ts` 的 194 个 lint 错误，并在保持外部导入路径不变的前提下，将复杂实现下沉到专用子目录，为后续继续分批清理键盘编辑逻辑创造稳定入口。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

1. **行为保持**: 快捷键语义、触发顺序与既有编辑器行为不得发生业务回归。
2. **入口稳定**: `windowKeyDown -> editKeydown` 的导入路径与同步调用契约不得变化。
3. **目录上限合规**: `keydown` 目录条目数必须控制在当前 lint 规则允许范围内。
4. **规程合规**: 目标文件的导入、导出与同步入口说明必须满足当前 lint 规则，不以豁免规避真实问题。

---

## 验证检查清单

- [x] `app/src/boot/globalEvent/keydown/editKeydown.ts` 单文件 lint 错误清零
- [x] `keydown` 目录条目数未超过 10
- [x] `editKeydown` 仍可从 `windowKeyDown.ts` 按原路径同步调用
- [x] 复杂实现已迁入专用子目录，目标文件回到稳定入口职责
- [x] `ttt` 文档已按规程完成归档更新

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

(当前阶段已完成，待后续任务补充)

---

## 🟡 中期计划

- [ ] **Phase 4: 继续清理 `editKeydown/` 子目录中的提取实现 (P1)**
  - **背景**: 本次为先达成 `editKeydown.ts` 入口文件 lint 清零，已将复杂实现迁入 `app/src/boot/globalEvent/keydown/editKeydown/` 子目录。
  - **行动**:
    1. 为子目录内实现补齐导入注释、函数注释与结构性拆分。
    2. 逐步替换遗留的 `window.siyuan` 直接访问和内联回调。
    3. 评估是否继续拆分为上下文解析与快捷键分组模块。

- [ ] **Phase 5: 复用 editKeydown 的入口下沉模式到其他 keydown 模块 (P1)**
  - **背景**: `command/panel.ts`、`windowKeyDown.ts` 等文件也存在相似的超长实现与环境访问模式。
  - **行动**: 评估是否将“稳定入口 + 子目录实现”模式继续推广到其他键盘事件模块。

---

## 🏁 已归档/已完成

- [x] **Phase 1: 建立稳定入口与目录收口** [已完成 2026-04-20]
  - **背景**: `editKeydown.ts` 原文件同时承担导入收口、上下文解析与快捷键处理，导致单文件 lint 错误暴涨且目录维护压力过高。
  - **完成情况**: 将复杂实现迁入 `app/src/boot/globalEvent/keydown/editKeydown/` 子目录，恢复 `app/src/boot/globalEvent/keydown/editKeydown.ts` 为稳定入口文件；同时恢复并保留同层 `imports.ts` 作为现有 `keydown` 模块网关。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/editKeydown.ts`
    - `app/src/boot/globalEvent/keydown/editKeydown/index.ts`
    - `app/src/boot/globalEvent/keydown/editKeydown/imports.ts`
    - `app/src/boot/globalEvent/keydown/imports.ts`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`

- [x] **Phase 2: 清理目标文件结构性 lint 错误** [已完成 2026-04-20]
  - **背景**: `editKeydown.ts` 存在 32 处跨层导入、超长函数和同步导出说明缺失等问题。
  - **完成情况**: 通过“入口文件 + 子目录实现”方式移除目标文件内的跨层依赖与壳函数问题，使入口文件只保留单一导入与导出职责。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/editKeydown.ts`
  - **参考文档**:
    - `docs/规程/代码质量/lint错误修复.procedure.md`

- [x] **Phase 3: 单文件复验与归档** [已完成 2026-04-20]
  - **背景**: 需要确认本次任务指定的目标文件已经满足仓库本地 ESLint 规则。
  - **完成情况**: 运行 `cd app && pnpm run lint:file -- src/boot/globalEvent/keydown/editKeydown.ts`，结果为 0 错误；同时确认 `app/src/boot/globalEvent/keydown/` 目录条目数未超过当前规则上限。
  - **成果文件**:
    - `app/src/boot/globalEvent/keydown/editKeydown.ts`
    - `docs/ttt/frontend/editKeydown-lint修复.ttt.md`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
