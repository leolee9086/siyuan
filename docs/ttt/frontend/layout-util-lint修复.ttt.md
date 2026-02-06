# app/src/layout/util.ts Lint错误修复执行跟踪 (TikTocTak)

> **目标**: 系统性清理 `app/src/layout/util.ts` 文件中的371个lint错误，首要解决文件超长问题（890行，限制300行），通过拆分重构保持功能不变
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

1. **文件拆分优先**: 首要解决文件超长问题（890行 > 300行限制）
2. **功能保持**: 拆分过程中不得改变代码原有逻辑和行为
3. **单一职责**: 按功能职责拆分文件，保持高内聚
4. **向后兼容**: 保持原有导出API不变

---

## 验证检查清单

- [ ] 所有文件行数不超过300行
- [ ] 所有lint错误已修复
- [ ] 原有API导出保持不变
- [ ] 代码功能未改变
- [ ] 相关测试通过

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

### Phase 1: 备份原文件并分析结构 (P0)

- **背景**: `app/src/layout/util.ts` 文件有890行，严重超过300行限制，且有371个lint错误
- **行动**:
  1. 备份原文件 `app/src/layout/util.ts` 到 `app/src/layout/util.ts.backup`
  2. 分析文件结构，识别功能模块：
     - 窗口切换相关: `switchWnd`, `getWndByLayout`
     - Dock相关: `dockToJSON`, `initInternalDock`, `JSONToDock`
     - 布局序列化: `saveLayout`, `exportLayout`, `getAllLayout`, `layoutToJSON`
     - 布局反序列化: `JSONToCenter`, `JSONToLayout`
     - 工具栏调整: `resizeTopBar`
     - 模型创建: `newModelByInitData`
     - 布局调整: `adjustLayout`, `fixWndFlex1`
     - 其他工具: `resetLayout`, `pdfIsLoading`, `getInstanceById`
  3. 制定拆分方案：
     - `layout/dock-utils.ts` - Dock相关操作
     - `layout/layout-serialization.ts` - 布局序列化/反序列化
     - `layout/window-utils.ts` - 窗口相关操作
     - `layout/ui-utils.ts` - UI调整相关
     - `layout/util.ts` - 保留核心导出和重导出
- **验收标准**: 
  - 原文件已备份
  - 拆分方案已确定
- **参考文档**: 
  - `docs/规程/代码质量/代码拆分与模块化.procedure.md`
  - `docs/规程/代码质量/lint错误修复.procedure.md`

### Phase 2: 创建Dock工具模块 (P0)

- **背景**: Dock相关逻辑独立，包括 `dockToJSON`, `initInternalDock`, `JSONToDock`
- **行动**:
  1. 创建 `app/src/layout/dock-utils.ts`
  2. 迁移 dockToJSON 函数及其内部逻辑
  3. 迁移 initInternalDock 函数
  4. 迁移 JSONToDock 函数
  5. 添加完整的JSDoc注释
  6. 修复forEach、if注释等lint错误
- **验收标准**: 
  - 文件行数不超过300行
  - 所有函数有完整注释
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/lint错误修复.procedure.md` 第3.1节

### Phase 3: 创建布局序列化模块 (P0)

- **背景**: 布局序列化逻辑复杂，包括 `saveLayout`, `exportLayout`, `getAllLayout`, `layoutToJSON`
- **行动**:
  1. 创建 `app/src/layout/layout-serialization.ts`
  2. 迁移 saveLayout 及相关逻辑
  3. 迁移 exportLayout 及相关逻辑
  4. 迁移 getAllLayout 函数
  5. 迁移 layoutToJSON 函数
  6. 添加完整的JSDoc注释
  7. 修复forEach、if注释、else等lint错误
- **验收标准**: 
  - 文件行数不超过300行
  - 所有导出函数有完整注释
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/lint错误修复.procedure.md` 第3.1节

### Phase 4: 创建布局反序列化模块 (P1)

- **背景**: JSONToCenter 和 JSONToLayout 函数逻辑复杂，需要单独拆分
- **行动**:
  1. 创建 `app/src/layout/layout-deserialization.ts`
  2. 迁移 JSONToCenter 函数及其内部逻辑
  3. 迁移 JSONToLayout 函数
  4. 处理 removedTabs 等相关状态
  5. 添加完整的JSDoc注释
  6. 修复所有lint错误
- **验收标准**: 
  - 文件行数不超过300行
  - 所有函数有完整注释
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/lint错误修复.procedure.md` 第3.1节

### Phase 5: 创建窗口工具模块 (P1)

- **背景**: 窗口切换相关逻辑包括 `switchWnd`, `getWndByLayout`
- **行动**:
  1. 创建 `app/src/layout/window-utils.ts`
  2. 迁移 switchWnd 函数
  3. 迁移 getWndByLayout 函数
  4. 添加完整的JSDoc注释
  5. 修复lint错误
- **验收标准**: 
  - 文件行数不超过300行
  - 所有函数有完整注释
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/lint错误修复.procedure.md` 第3.1节

### Phase 6: 创建UI工具模块 (P1)

- **背景**: UI调整相关逻辑包括 `resizeTopBar`, `adjustLayout`, `fixWndFlex1`
- **行动**:
  1. 创建 `app/src/layout/ui-utils.ts`
  2. 迁移 resizeTopBar 函数
  3. 迁移 adjustLayout 函数
  4. 迁移 fixWndFlex1 函数
  5. 添加完整的JSDoc注释
  6. 修复lint错误
- **验收标准**: 
  - 文件行数不超过300行
  - 所有函数有完整注释
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/lint错误修复.procedure.md` 第3.1节

### Phase 7: 重构util.ts为入口文件 (P1)

- **背景**: 保留 `util.ts` 作为入口文件，统一重导出所有功能
- **行动**:
  1. 保留 `resetLayout`, `pdfIsLoading`, `getInstanceById`, `newModelByInitData` 等简单函数
  2. 从重导出其他模块的函数
  3. 确保向后兼容：原有导入路径仍然有效
  4. 添加文件注释说明
- **验收标准**: 
  - 文件行数不超过300行
  - 原有API全部可访问
  - lint检查通过
- **参考文档**: 
  - `docs/规程/代码质量/代码拆分与模块化.procedure.md` 第6节

---

## 🟡 中期计划 (架构演进，步步为营)

- [ ] **Phase 8: 验证拆分结果** (P1)
  - **背景**: 确保所有拆分后的文件符合规范且功能正常
  - **行动**: 
    1. 运行完整lint检查
    2. 检查所有文件行数
    3. 验证API导出完整性
    4. 运行相关单元测试
  - **验收标准**: lint错误数为0，所有文件<300行，测试通过

- [ ] **Phase 9: 清理备份文件** (P2)
  - **背景**: 确认拆分成功后清理备份
  - **行动**: 
    1. 验证所有功能正常
    2. 删除备份文件
  - **验收标准**: 备份文件已删除

---

## 🔴 远期计划 (北极星目标，星辰大海)

- [ ] **建立文件大小监控机制** (P2)
  - **愿景**: 建立自动化检查，防止未来文件再次超限

---

## 🏁 已归档/已完成

(暂无)

---

**文档版本**: 1.0.0  
**创建时间**: 2026-02-03  
**维护者**: Roo (Code Mode)
