# 设置面板Tab化改进执行跟踪 (TikTocTak)

> **目标**: 将思源笔记设置面板从模态Dialog改造为可作为普通Tab打开的架构,消除"伪造Plugin"的hack方式,建立规范的内部Tab注册机制。量化指标:完成TabRegistry架构实现,重构至少1个内部Tab(文档树配置)使用新机制。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 架构决策
- **采用扩展点 + 插件API两层架构**: 内部使用扩展点层(TabRegistry),外部插件使用插件API层
- **参考Dock系统成熟模式**: 复用已有的Registry + Factory模式
- **保持向后兼容**: 新架构不破坏现有插件API

### 验证检查清单
- [ ] TabRegistry能够正确注册和查找Tab类型
- [ ] Plugin.addTab委托给TabRegistry后功能正常
- [ ] newModelByInitData优先查Registry,回退到插件遍历
- [ ] 文档树配置Tab使用新机制后功能正常
- [ ] 现有插件Tab功能不受影响

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后,**必须**剪切粘贴到【已归档】列表,并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了,从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理,随时修改或删除。
4. **数据驱动**: 用数据说话,不凭感觉。

---

## 🟢 近期计划 (立即聚焦,撸起袖子干)

- [ ] **Phase 1: 创建TabRegistry核心类 (P0)**
  - **背景**: 当前Tab数据分散在各插件的models属性中,查找需遍历所有插件,内部使用必须伪造Plugin。需要建立全局Registry统一管理。
  - **行动**:
    1. 创建 [`app/src/layout/registry/TabRegistry.ts`](../../app/src/layout/registry/TabRegistry.ts)
    2. 实现TabRegistration接口(type, init, destroy, beforeDestroy, resize, update)
    3. 实现TabRegistry单例类(register, get, has, createModel方法)
    4. 参考 [`app/src/layout/dock/dock.registry.ts`](../../app/src/layout/dock/dock.registry.ts) 的模式
  - **验收标准**:
    - TabRegistry类实现完整
    - 单例模式正确
    - 提供register/get/has/createModel四个核心方法
    - 通过TypeScript类型检查
  - **参考文档**:
    - [`app/src/layout/dock/dock.registry.ts`](../../app/src/layout/dock/dock.registry.ts) - Dock Registry参考
    - [`app/src/layout/dock/dock.factory.ts`](../../app/src/layout/dock/dock.factory.ts) - Factory模式参考

- [ ] **Phase 2: 重构Plugin.addTab委托给Registry (P0)**
  - **背景**: 现有Plugin.addTab直接将工厂函数存储在this.models中,需要改为委托给TabRegistry,同时保持向后兼容。
  - **行动**:
    1. 修改 [`app/src/plugin/index.ts`](../../app/src/plugin/index.ts) L352-382的addTab方法
    2. 调用tabRegistry.register()注册Tab
    3. 保持this.models兼容性(供getOpenedTab使用)
    4. 确保type命名规则不变(插件名+类型)
  - **验收标准**:
    - addTab方法委托给TabRegistry
    - this.models仍然可用
    - 现有插件Tab功能不受影响
    - 通过现有插件测试
  - **参考文档**:
    - [`app/src/plugin/index.ts`](../../app/src/plugin/index.ts#L352-382) - 现有addTab实现

- [ ] **Phase 3: 重构newModelByInitData优先查Registry (P1)**
  - **背景**: 当前newModelByInitData遍历所有插件查找model,效率低。需要优先从TabRegistry查找,回退到插件遍历保持兼容。
  - **行动**:
    1. 修改 [`app/src/layout/util.ts`](../../app/src/layout/util.ts) L685-724的newModelByInitData函数
    2. 在Custom实例创建时优先调用tabRegistry.has()检查
    3. 如果Registry中存在,调用tabRegistry.createModel()
    4. 否则回退到原有的插件遍历逻辑
  - **验收标准**:
    - Registry中的Tab优先创建
    - 未注册到Registry的插件Tab仍能正常工作
    - 性能有提升(减少遍历)
    - 通过回归测试
  - **参考文档**:
    - [`app/src/layout/util.ts`](../../app/src/layout/util.ts#L685-724) - 现有实现

---

## 🟡 中期计划 (架构演进,步步为营)

- [ ] **Phase 4: 重构文档树配置Tab使用新机制 (P1)**
  - **背景**: [`app/src/config/fileTree.ts`](../../app/src/config/fileTree.ts) L190-219使用伪造Plugin的hack方式注册Tab,需要改为直接使用TabRegistry。
  - **行动**:
    1. 删除fileTree.ts中的伪造Plugin代码
    2. 直接调用tabRegistry.register()注册"internal-settings-filetree"类型
    3. 修改openFile调用,使用新的type标识
    4. 测试文档树配置面板功能

- [ ] **Phase 5: 创建统一的Registry导出模块 (P2)**
  - **背景**: 为未来扩展DockRegistry、CommandRegistry做准备,需要统一的导出入口。
  - **行动**:
    1. 创建 [`app/src/layout/registry/index.ts`](../../app/src/layout/registry/index.ts)
    2. 统一导出TabRegistry
    3. 为DockRegistry、CommandRegistry预留位置

- [ ] **Phase 6: 统一所有内部Tab注册方式 (P2)**
  - **背景**: 除文档树配置外,可能还有其他内部Tab使用了类似hack方式,需要统一迁移。
  - **行动**:
    1. 搜索代码库中所有伪造Plugin的模式
    2. 逐个迁移到TabRegistry
    3. 建立内部Tab注册规范文档

---

## 🔴 远期计划 (北极星目标,星辰大海)

- [ ] **Phase 7: 创建DockRegistry统一Dock管理 (P2)**
  - **愿景**: 参考TabRegistry模式,为Dock系统建立统一的Registry,消除Dock注册的分散性。

- [ ] **Phase 8: 创建CommandRegistry统一命令管理 (P2)**
  - **愿景**: 建立命令注册中心,统一管理内部命令和插件命令,提供更好的命令发现和冲突检测。

- [ ] **Phase 9: 建立完整的扩展点文档体系 (P2)**
  - **愿景**: 为TabRegistry、DockRegistry、CommandRegistry编写完整的开发文档,包括最佳实践和迁移指南。

---

## 🏁 已归档/已完成

_暂无已完成任务_

---

## 📊 进度跟踪

- **总任务数**: 9个Phase
- **已完成**: 0个
- **进行中**: 0个
- **近期计划**: 3个
- **中期计划**: 3个
- **远期计划**: 3个

---

## 📚 重要参考文档

### 架构设计
- 原文档: [`docs/设置面板Tab化改进计划.md`](../设置面板Tab化改进计划.md) (已迁移)
- 架构决策: 采用扩展点+插件API两层架构
- 参考模式: Dock系统的Registry + Factory模式

### 关键代码文件
| 文件 | 说明 |
|------|------|
| [`app/src/plugin/index.ts`](../../app/src/plugin/index.ts#L352-382) | Plugin.addTab现有实现 |
| [`app/src/layout/util.ts`](../../app/src/layout/util.ts#L685-724) | newModelByInitData函数 |
| [`app/src/layout/dock/Custom.ts`](../../app/src/layout/dock/Custom.ts) | Custom Model类 |
| [`app/src/config/fileTree.ts`](../../app/src/config/fileTree.ts#L190-219) | 现有伪造Plugin实现 |
| [`app/src/layout/dock/dock.registry.ts`](../../app/src/layout/dock/dock.registry.ts) | Dock Registry参考 |
| [`app/src/layout/dock/dock.factory.ts`](../../app/src/layout/dock/dock.factory.ts) | Factory模式参考 |

### 快速开始指南
原文档中的"🚀 快速开始"章节提供了详细的实现步骤,可作为Phase 1-4的执行参考。

---

**文档创建**: 2026-01-26  
**最后更新**: 2026-01-26  
**文档类型**: TikTocTak执行跟踪文档  
**原始文档**: [`docs/设置面板Tab化改进计划.md`](../设置面板Tab化改进计划.md)
