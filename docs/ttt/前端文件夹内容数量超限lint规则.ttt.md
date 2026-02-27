# 文件夹内容数量超限 Lint 规则实现 执行跟踪 (TikTocTak)

> **目标**: 实现自定义 ESLint 规则 `folder-item-limit`，在被检查文件所在文件夹内的文件和子文件夹数量超过 10 个时报错。规则文件位于 `app/0_lints/folder-item-limit.mjs`，注册于 `app/eslint.config.mjs`。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

- 规则实现必须遵循 [`前端自定义lint规则实现.procedure.md`](../规程/代码质量/前端自定义lint规则实现.procedure.md)
- 规则文件使用 ESM 格式（`.mjs`），放置于 `app/0_lints/`
- 必须同时提供中文命名导出和英文别名导出
- 报错信息必须包含违规说明、最佳实践指导、修复提示三层结构
- 共享常量从 `app/0_lints/shared-constants.mjs` 导入，不得重复定义

### 验证检查清单

- [ ] 规则文件导出结构符合规程（中文+英文别名）
- [ ] meta 定义包含 type/docs/messages/schema
- [ ] 报错信息包含三层结构（违规说明/最佳实践/修复提示）
- [ ] 在 `eslint.config.mjs` 的 SHARED_PLUGINS 和 SHARED_RULES 中注册
- [ ] `pnpm run lint` 无配置错误
- [ ] 违规文件夹被正确检出，合规文件夹不被误报

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

- [x] ~~**Phase 3: 执行 lint 验证规则生效 (P0)**~~ → 已归档

- [x] ~~**Phase 4: 更新 task.md 标记任务完成 (P1)**~~ → 已归档

---

## 🏁 已归档/已完成

- [x] **Phase 1: 创建规则文件 (P0)** — 2026-02-27
  - 创建 `app/0_lints/folder-item-limit.mjs`，使用 `readdirSync` 读取目录条目数，排除隐藏文件，超过阈值（默认10）时报错
  - 导出结构：中文 `文件夹内容数量限制插件` + 英文别名 `folderItemLimitPlugin`

- [x] **Phase 2: 注册规则到 ESLint 配置 (P0)** — 2026-02-27
  - 在 `eslint.config.mjs` 中导入 `folderItemLimitPlugin`，注册到 `SHARED_PLUGINS` 和 `SHARED_RULES`（error 级别）
  - 验证：ESLint 已正确检出超限目录（如 `src/config` 35个条目、`src/util` 50个条目）

- [x] **Phase 3: 执行 lint 验证规则生效 (P0)** — 2026-02-27
  - 超限目录验证：`src/util/color.ts` 正确报出 `folder-item-limit` 错误（50 个条目 > 10）
  - 合规目录验证：`src/platform/index.ts` 未触发 `folder-item-limit`（3 个条目 ≤ 10）

- [x] **Phase 4: 更新 task.md 标记任务完成 (P1)** — 2026-02-27
  - task.md 第13行任务已标记 `[x]`
