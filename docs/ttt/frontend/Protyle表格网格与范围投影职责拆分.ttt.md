# Protyle 表格网格与范围投影职责拆分（TikTocTak）

> **最终目标**：保持表格合并单元格、复制、剪切、粘贴、范围坐标和 HTML 重建行为不变，将 `protyle/util/table.ts` 中的纯网格领域与交互/事务职责分离，并逐步完成现有 `table/` 子域的单向化。
>
> **当前目标**：综合旧根已完成墓碑化；继续按行列编辑、导航和事务职责收敛现行 `table/` 子域的真实类型与行为门禁。
>
> **下一步任务**：为跨 thead/tbody 导航、冻结表头滚动和复杂合并编辑补齐行为基线，再依据现行子域诊断迁移完整调用链。

## 不变量

- `fn__none` 只表示合并单元格占位，不进入实际可编辑单元格结果。
- rowspan/colspan 缺失、非法或小于 1 时仍按 `1` 处理。
- 范围坐标继续以起始/结束单元格覆盖矩形的左上角为原点，支持反向选择。
- 历史数据中超出末行的 rowspan 必须截断到真实表格行数。
- HTML 投影继续克隆单元格、重算跨度、补齐合并占位，并保证独立结果含 thead。
- 从 tbody 开始复制时，首行及其 rowspan 覆盖行继续提升为表头，禁止跨越 thead/tbody 的合并单元格。
- 功能完全相同只保留一个网格算法；根文件、子域和测试不得出现平行实现。
- 所有 `imports.ts` 继续直达真实声明或唯一实现，不建立网关多跳。

## 现状基线

- `protyle/util/table.ts` 约 1100 行，同时包含键盘导航、行列编辑、对齐、标题 Dialog、事务和纯网格范围投影。
- `protyle/util/table/` 已存在行、列、修复和标题子域，但网格范围实现仍留在综合根模块。
- `insertHTML` 仅为 `getTableRangeCells` 加载根模块，从而形成 `insertHTML -> table -> block/util -> editor` 当前首环。
- `index.copy`、`index.copy.helpers` 与 `index.cut` 仅为 `getTableRangeHTML` 依赖同一综合根。
- 建立任务时生产图为 `2243` 节点、`282` 条代表环、唯一 SCC `619`。

## 目标架构

1. `table/grid/grid.types.ts`：完整描述物理单元格、二维网格、范围边界、相对坐标和输出单元格。
2. `table/grid/`：唯一网格构建、范围求交、坐标投影与独立 HTML 重建实现，不依赖 Protyle、事务、Layout 或菜单。
3. `table.ts`：继续暂存尚未迁移的交互行为，但不转发已迁移网格 API。
4. 插入、复制与剪切调用方直达 `table/grid.ts`，依赖图明确表达纯查询所有权。

## 近期计划

- [x] 建立表格物理网格、反向合并范围和非法端点行为测试。
- [x] 迁移唯一网格构建、范围边界与单元格投影。
- [x] 迁移 HTML 投影并更新全部复制/剪切消费者。
- [ ] 验证目标 lint、Node、Protyle 契约、imports 多跳、Madge/Tarjan 与 diff。

## 中期计划

- [x] 审计根 `table.ts` 与现有子域的公开表面；确认根文件生产入边为零、14 个导出均有唯一现行所有者，移除实现并保留完整映射墓碑。
- [ ] 将剩余行列编辑、导航、选区和 Dialog/事务编排分别归入已有子域。
- [ ] 为跨 thead/tbody 导航、冻结表头滚动和复杂合并编辑补齐行为基线。

## 远期计划

- [x] 删除综合 `protyle/util/table.ts` 的运行时实现并保留同路径墓碑，所有生产调用点直达稳定表格子域。
- [ ] 表格全部子域退出应用主 SCC，且不新增独立 SCC。
- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一并完成全源码零循环验收。

## 风险与验收标准

- 浏览器对 table section 的 DOM 规范化会影响测试夹具，测试必须断言实际 DOM 与输出 HTML，而非只比较输入字符串。
- 合并范围必须覆盖横向、纵向、反向和跨 section 情况，禁止以简单二维表测试代表完整语义。
- 新模块必须是纯 DOM 计算，不注入 callback、工厂闭包、服务定位器或动态导入隐藏依赖。
- 代表环数量只用于定位；以目标边归零、SCC 成员退出、无新增 SCC及行为测试共同验收。

## 已归档/已完成区域

- **2026-07-27**：创建专项。确认两个公开 API 共享同一物理网格与范围边界模型，必须整体迁移；单独复制 `getTableRangeCells` 会制造重复算法，因此不采用。
- **2026-07-27**：唯一物理网格、跨度规范化、范围边界和相对单元格投影迁入 `table/grid`，根 `getTableRangeHTML` 暂时直接复用同一实现，不存在平行网格算法；`insertHTML` 直达纯 grid。同步发现 `table.ts` 与 `table/table.ts` 完全重复实现框选几何，现统一迁入 `table/selection/geometry`，根模块与五类消费者复用唯一 6px 容差判定。网格/几何专项 `5/5`、Node `193/193`、Protyle 契约类型、新模块 lint及 imports 多跳通过。生产图 `2247 / 332 / SCC 619`，新增 grid/selection 节点全部在 SCC 外，`insertHTML -> table.ts/table.ts` 两条边归零；代表环反升来自下一条 `insertHTML -> input -> blockFold`，不据此撤回正确职责拆分。
- **2026-07-27**：`getTableRangeHTML` 唯一实现迁入 `table/grid/html.ts`，按范围求交、输出网格、表头归一化和逐行序列化分阶段复用同一 grid；三个复制/剪切消费者直达新所有者，旧根实现和出口归零。专项增至 `7/7`，固定 tbody 起始范围提升为 thead、rowspan 占位、空 class 属性和非法端点行为；Node `193/193`、Protyle 契约类型、新模块 lint与网关门禁通过。根 `table.ts` 从约 1100 行降至 `833` 行并退出 SCC，生产图 `2248 / 332 / SCC 618`；grid 全子域在 SCC 外，范围投影近期阶段完成。
- **2026-07-29**：TypeScript 模块解析确认综合 `protyle/util/table.ts` 生产入边为 `0`；其通用、行、列、修复、标题、网格和框选公开行为全部已有唯一子域所有者，生产消费者均已直达这些模块。旧实现替换为无逻辑、无依赖、无公共导出的同路径墓碑，现行所有者同步记录替代关系；全量诊断精确减少 `233`，墓碑诊断为零，网格/框选 `7/7` 与零循环门禁通过。
- **2026-07-29**：墓碑化后的完整类型检查进一步暴露现行表格动作仍使用旧版 `updateTransaction(protyle, id, newHTML, oldHTML)` 调用形态。行、列、对齐、清空、标题和软换行统一迁入当前 `updateTransaction(protyle, element, oldHTML)` 契约，由事务入口从真实元素读取并验证块 ID；删除原先缺少 ID 时静默跳过提交的分支。事务契约测试固定行、列与对齐动作均传递同一块元素和旧快照，并证明缺少块 ID 时仍进入事务层的显式身份校验。表格网格、框选与事务专项共 `11/11` 通过。
- **2026-07-29**：正式 `pnpm run typecheck` 进一步暴露网格二维数组的 6 条 `noUncheckedIndexedAccess` 诊断。网格构建在 `ensureGridRow` 返回已验证的占用行；输出覆盖、单元格登记与序列化边界均在违反初始化不变量时显式抛错，不使用非空断言、类型降级或静默跳过。重跑正式门禁后项目仍有 `12,193` 条其它领域诊断，但 `src/protyle/util/table/**` 与 `test/protyle/tableTransactionContract.test.ts` 精确筛选为 `0`；完整日志位于 `C:\Users\al765\AppData\Local\Temp\sforge-typecheck-table-closeout-20260729.log`。

## 关联任务

- [Protyle 上传编排与资源写入职责拆分](./Protyle上传编排与资源写入职责拆分.ttt.md)
- [Protyle 菜单组合根与表格菜单拆分](./Protyle菜单组合根与表格菜单拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
