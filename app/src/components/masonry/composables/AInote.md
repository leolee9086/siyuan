# 这个区段由开发者编写,未经允许禁止AI修改
本目录下的文件是项目的核心组合式函数，修改需极其谨慎。

# 修改记录

## 2025-06-28 22:05

### useSelectionSystem.ts API 修复和扩展

- **修复**: 修复了 `SelectionBoxExample.vue` 中的 `toggleSelection is not a function` 错误。
- **原因**: 示例代码中使用了 `toggleSelection` 方法，但 `SelectionApi` 接口中实际的方法名是 `toggle`，导致方法名不匹配。
- **变更**:
  - 在 `SelectionApi` 接口中添加了 `selectEntities` 和 `invertSelection` 方法声明
  - 在 `selectionApi` 对象中实现了 `selectEntities` 方法：
    - 支持单选模式（只选择第一个实体）
    - 支持多选模式（选择所有指定实体）
    - 自动更新 `lastSelectedId` 状态
  - 在 `selectionApi` 对象中实现了 `invertSelection` 方法：
    - 将当前选择状态反转
    - 选择所有未选择的实体，取消选择已选择的实体
  - 修复了 `SelectionBoxExample.vue` 中的方法调用：
    - `toggleSelection(id)` → `toggle(id)`
- **好处**:
  - 解决了方法名不匹配的错误
  - 完善了选择系统的 API 功能
  - 提供了批量选择和反选功能
  - 保持了 API 的一致性和完整性

## 2025-06-29

### useVirtualDataSource.ts JSDoc注释完善

- **完善**: 为 `useVirtualDataSource.ts` 文件中的所有函数添加了详尽的 JSDoc 注释。
- **原因**: 用户要求每个函数都要有详尽的 JSDoc 注释，以提高代码的可读性和文档化程度。
- **变更**:
  - 为所有内部函数添加了完整的 JSDoc 注释，包括：
    - `defaultCreatePlaceholder`: 默认占位符创建函数
    - `computeIndicesToRequest`: 过滤需要请求的索引
    - `createDataMap`: 创建数据映射表
    - `processSingleIndexReplacement`: 处理单个索引的数据替换
    - `replacePlaceholdersWithData`: 用真实数据替换占位符
    - `removeIndexFromRequested`: 从已请求集合中移除索引
    - `handleFetchError`: 处理请求失败情况
    - `addIndexToRequested`: 添加索引到已请求集合
    - `markIndicesAsRequested`: 标记索引为已请求状态
    - `createRequestDataForRange`: 创建数据请求函数
    - `createSinglePlaceholder`: 创建单个占位符
    - `createInitializeItems`: 创建初始化函数
    - `createInitialDataLoader`: 创建初始数据加载函数
  - 为主要的 `useVirtualDataSource` 函数添加了详细的 JSDoc 注释，包括：
    - 完整的参数说明和类型注解
    - 返回值说明和类型定义
    - 详细的使用示例
    - 功能描述和特性说明
- **好处**:
  - 提高了代码的可读性和可维护性
  - 为开发者提供了清晰的使用指南
  - 支持 IDE 的智能提示和类型检查
  - 便于新开发者快速理解和使用这些函数

### useVirtualDataSource.ts 函数拆分重构

- **重构**: 拆分 `useVirtualDataSource.ts` 中的 `requestDataForRange` 函数，将复杂的逻辑拆分为多个职责单一的小函数。
- **原因**: 原 `requestDataForRange` 函数约40行，包含多个职责：过滤索引、创建数据映射、替换占位符、错误处理等，违反了单一职责原则。
- **变更**:
  - 提取 `computeIndicesToRequest` 函数：专门负责过滤出需要请求的索引，排除已经请求过的
  - 提取 `createDataMap` 函数：将获取的数据映射到索引，提高查找效率
  - 提取 `replacePlaceholdersWithData` 函数：用真实数据替换占位符，返回新数组和替换状态
  - 提取 `handleFetchError` 函数：处理数据请求失败的情况，清理已请求索引
  - 主函数 `requestDataForRange` 简化为组合这些外部函数，逻辑更清晰
- **好处**:
  - 每个函数职责单一，易于理解和测试
  - 提高了代码的可读性和可维护性
  - 便于单元测试和代码复用
  - 符合函数式编程的最佳实践

### useVirtualDataSource.ts 消除函数内部定义函数

- **重构**: 将 `useVirtualDataSource` 函数内部定义的所有函数提取到外部，完全消除函数内部定义函数的问题。
- **原因**: 原代码中 `requestDataForRange` 函数定义在 `useVirtualDataSource` 内部，违反了函数式编程的最佳实践。
- **变更**:
  - 提取 `createRequestDataForRange` 函数：创建数据请求函数，接收依赖参数并返回请求函数
  - 提取 `createInitializeItems` 函数：创建初始化函数，负责生成初始占位符列表
  - 提取 `createInitialDataLoader` 函数：创建初始数据加载函数，负责加载第一页数据
  - 主函数 `useVirtualDataSource` 简化为组合这些外部函数，完全消除内部函数定义
- **好处**:
  - 完全符合函数式编程原则，无函数内部定义函数
  - 提高了代码的可读性和可维护性
  - 便于单元测试和代码复用
  - 每个函数职责更加明确，依赖关系更清晰

### useVirtualDataSource.ts 优化循环中的大片代码

- **重构**: 将 `forEach` 和 `for` 循环中的大片代码提取为独立的函数调用，提高代码可读性。
- **原因**: 原代码中多个循环包含复杂的逻辑代码，违反了"循环中不应有大片代码"的原则。
- **变更**:
  - 提取 `processSingleIndexReplacement` 函数：处理单个索引的数据替换逻辑
  - 提取 `removeIndexFromRequested` 函数：从请求索引集合中移除单个索引
  - 提取 `addIndexToRequested` 函数：将索引添加到已请求集合中
  - 提取 `markIndicesAsRequested` 函数：标记索引为已请求状态
  - 提取 `createSinglePlaceholder` 函数：创建单个占位符项
  - 所有循环现在只包含简单的函数调用，逻辑更清晰
- **好处**:
  - 循环中的代码更简洁，易于理解
  - 每个小函数职责单一，便于测试和维护
  - 提高了代码的可读性和可维护性
  - 符合函数式编程的最佳实践

### useVirtualDataSource.ts 消除冗余函数

- **重构**: 消除了 `createSinglePlaceholder` 这个仅仅调用另一个函数的冗余函数。
- **原因**: `createSinglePlaceholder` 函数只是简单地调用了 `createPlaceholder` 函数，没有添加任何额外的逻辑，属于不必要的包装函数。
- **变更**:
  - 删除了 `createSinglePlaceholder` 函数及其 JSDoc 注释
  - 在 `createInitializeItems` 函数中直接调用 `createPlaceholder(i)` 替代 `createSinglePlaceholder(i, createPlaceholder)`
- **好处**:
  - 减少了代码的复杂度
  - 消除了不必要的函数调用层级
  - 提高了代码的执行效率
  - 使代码更加简洁和直接

### useVirtualDataSource.ts 消除addIndexToRequested冗余函数

- **重构**: 消除了 `addIndexToRequested` 这个仅仅调用 `Set.add()` 方法的冗余函数。
- **原因**: `addIndexToRequested` 函数只是简单地调用了 `requestedIndices.add(index)` 方法，没有添加任何额外的逻辑，属于不必要的包装函数。
- **变更**:
  - 删除了 `addIndexToRequested` 函数及其 JSDoc 注释
  - 在 `markIndicesAsRequested` 函数中直接调用 `requestedIndices.add(index)` 替代 `addIndexToRequested(index, requestedIndices)`
- **好处**:
  - 减少了代码的复杂度
  - 消除了不必要的函数调用层级
  - 提高了代码的执行效率
  - 使代码更加简洁和直接

### useVirtualDataSource.ts 消除removeIndexFromRequested冗余函数

- **重构**: 消除了 `removeIndexFromRequested` 这个仅仅调用 `Set.delete()` 方法的冗余函数。
- **原因**: `removeIndexFromRequested` 函数只是简单地调用了 `requestedIndices.delete(index)` 方法，没有添加任何额外的逻辑，属于不必要的包装函数。
- **变更**:
  - 删除了 `removeIndexFromRequested` 函数及其 JSDoc 注释
  - 在 `handleFetchError` 函数中直接调用 `requestedIndices.delete(index)` 替代 `removeIndexFromRequested(index, requestedIndices)`
- **好处**:
  - 减少了代码的复杂度
  - 消除了不必要的函数调用层级
  - 提高了代码的执行效率
  - 使代码更加简洁和直接

### useVirtualDataSource.ts 消除computeIndicesToRequest冗余函数

- **重构**: 消除了 `computeIndicesToRequest` 这个仅仅调用 `Array.filter()` 方法的冗余函数。
- **原因**: `computeIndicesToRequest` 函数只是简单地调用了 `indices.filter(index => !requestedIndices.has(index))` 方法，没有添加任何额外的逻辑，属于不必要的包装函数。
- **变更**:
  - 删除了 `computeIndicesToRequest` 函数及其 JSDoc 注释
  - 在 `createRequestDataForRange` 函数中直接调用 `indices.filter(index => !requestedIndices.has(index))` 替代 `computeIndicesToRequest(indices, requestedIndices)`
- **好处**:
  - 减少了代码的复杂度
  - 消除了不必要的函数调用层级
  - 提高了代码的执行效率
  - 使代码更加简洁和直接

### useVirtualDataSource.ts 消除markIndicesAsRequested冗余函数

- **重构**: 消除了 `markIndicesAsRequested` 这个仅仅调用 `forEach` 和 `Set.add()` 方法的冗余函数。
- **原因**: `markIndicesAsRequested` 函数只是简单地调用了 `indicesToRequest.forEach(index => requestedIndices.add(index))` 方法，没有添加任何额外的逻辑，属于不必要的包装函数。
- **变更**:
  - 删除了 `markIndicesAsRequested` 函数及其 JSDoc 注释
  - 在 `createRequestDataForRange` 函数中直接调用 `indicesToRequest.forEach(index => requestedIndices.add(index))` 替代 `markIndicesAsRequested(indicesToRequest, requestedIndices)`
- **好处**:
  - 减少了代码的复杂度
  - 消除了不必要的函数调用层级
  - 提高了代码的执行效率
  - 使代码更加简洁和直接

## 2025-06-28

### useSelectionObserver.ts 消除函数嵌套重构

- **重构**: 重构 `useSelectionObserver.ts` 文件，消除所有函数嵌套，采用扁平化的函数式风格。
- **原因**: 用户不喜欢在函数中嵌套函数，要求采用更扁平化的代码结构。
- **变更**:
  - 提取 `scanElements` 函数：扫描容器中的可选择元素，接收容器和过滤函数作为参数
  - 提取 `hasElementsChanged` 函数：检查元素列表是否发生变化
  - 提取 `isRelevantNode` 函数：检查节点是否包含可选择元素
  - 提取 `isRelevantAttributeChange` 函数：检查属性变化是否相关
  - 提取 `hasRelevantChildListChanges` 函数：检查子节点变化是否相关
  - 提取 `handleMutations` 函数：处理DOM变化，决定是否需要更新元素列表
  - 提取 `createObserver` 函数：创建MutationObserver实例
  - 主函数 `useSelectionObserver` 简化为组合这些外部函数，完全消除内部函数定义
- **好处**:
  - 完全符合函数式编程原则，无函数内部定义函数
  - 提高了代码的可读性和可维护性
  - 每个函数职责单一，便于测试和复用
  - 代码结构更加扁平化，符合用户偏好

### useScrollObserver.ts 闭包拆分重构

- **重构**: 拆分 `useScrollObserver.ts` 中的闭包，将内部函数提取到外部，避免函数内部定义函数。
- **原因**: 原代码中存在多个内部函数定义，违反了函数式编程的最佳实践，影响代码的可读性和可维护性。
- **变更**:
  - 提取 `computeCheckForLoadMore` 函数：专门负责检查是否需要加载更多数据的逻辑

## 2025-06-29 23:30

### 坐标换算修正 - 位置观察器实现

- **修复**: 实现了基于ResizeObserver的位置观察器，解决了选择框坐标换算的性能问题。
- **原因**: 原实现中每次鼠标移动都调用 `getBoundingClientRect()` 获取元素位置，性能很差。需要实现坐标缓存机制。
- **变更**:
  - **新建 `usePositionObserver.ts`**: 创建专门的位置观察器，使用ResizeObserver监听元素位置变化
    - 使用Map缓存元素位置信息
    - 只在元素大小/位置真正变化时更新
    - 使用requestAnimationFrame确保性能
  - **修改 `useSelectionBox.ts`**: 集成位置观察器
    - 导入 `usePositionObserver` 和 `isRectIntersecting`
    - 添加位置观察器实例和相关方法
    - 修改 `handleMouseMove` 使用缓存的坐标进行相交检测
    - 暴露位置观察器方法给外部使用
  - **修改 `selectionBoxProvider.vue`**: 协调观察器工作
    - 解构位置观察器方法
    - 在 `onElementsChange` 中调用 `updatePositionElements`
    - 在生命周期中启动和停止位置观察
  - **修改 `SelectionBoxExample.vue`**: 启用空间选择器
    - 将 `enableSpatialSelection` 默认值改为 `true`
    - 添加位置缓存大小显示到状态栏
- **好处**:
  - **高性能**: 只在必要时更新位置信息，避免重复的getBoundingClientRect调用
  - **准确性**: ResizeObserver确保位置信息实时准确
  - **一致性**: 所有组件使用统一的位置数据源
  - **可维护性**: 基于项目现有的observer模式，代码结构清晰

## 2025-06-29 23:45

### 左交右框选择功能实现

- **新增**: 实现了惯例的左交右框选择功能，根据拖拽方向采用不同的选择策略。
- **原因**: 用户要求实现更智能的选择交互，从左向右拖拽时只选择完全包含的元素，从右向左拖拽时选择相交的元素。
- **变更**:
  - **修改 `useSelectionBox.ts`**: 添加拖拽方向检测和选择策略
    - 添加 `dragDirection` 状态跟踪拖拽方向
    - 在 `handleMouseDown` 中重置拖拽方向
    - 在 `handleMouseMove` 中检测拖拽方向（5px阈值避免误判）
    - 根据拖拽方向选择不同的检测策略：
      - `left-to-right`: 使用 `isRectContaining` 实现框选模式
      - `right-to-left`: 使用 `isRectIntersecting` 实现相交模式
    - 暴露 `dragDirection` 给外部使用
  - **修改 `selectionBoxProvider.vue`**: 暴露拖拽方向信息
    - 解构 `dragDirection` 并暴露给父组件
  - **修改 `SelectionBoxExample.vue`**: 添加拖拽方向显示
    - 添加 `dragDirectionText` 计算属性显示当前拖拽模式
    - 在状态栏显示拖拽方向信息
- **功能说明**:
  - **从左向右拖拽**: 只有完全位于选择框内部的元素才会被选中（框选模式）
  - **从右向左拖拽**: 位于选择框内部或与选择框相交的元素被选中（相交模式）
  - **智能检测**: 5px阈值避免误判，确保拖拽方向检测的准确性
- **好处**:
  - **用户体验**: 提供更直观和符合习惯的选择交互
  - **精确控制**: 框选模式适合精确选择，相交模式适合快速选择
  - **视觉反馈**: 状态栏显示当前拖拽模式，用户清楚了解选择行为
  - **性能优化**: 基于已有的位置观察器，无需额外性能开销

## 2025-06-29 23:50

### 选择框短暂点击消失问题修正

- **修复**: 修正了短暂点击时选择框不会正确消失的问题。
- **原因**: 在 `handleMouseUp` 中，只有当 `isDragging.value` 为 `true` 时才会隐藏选择框。但在短暂点击时，用户没有拖拽，所以 `isDragging.value` 保持为 `false`，导致选择框不会隐藏。
- **变更**:
  - **修改 `useSelectionBox.ts` 中的 `handleMouseUp` 方法**:
    - 移除了对 `isDragging.value` 的检查条件
    - 改为只要 `selectionBoxState.value.isSelecting` 为 `true` 就结束选择框状态
    - 确保无论是否拖拽，选择框都能正确隐藏
- **修正前**:
  ```typescript
  if (isDragging.value && selectionBoxState.value.isSelecting) {
    // 只有拖拽时才隐藏选择框
  }
  ```
- **修正后**:
  ```typescript
  if (selectionBoxState.value.isSelecting) {
    // 无论是否拖拽，都要结束选择框状态
  }
  ```
- **好处**:
  - **行为一致性**: 短暂点击和拖拽选择都能正确隐藏选择框
  - **用户体验**: 避免了选择框残留的视觉干扰
  - **逻辑清晰**: 选择框的显示/隐藏逻辑更加简单明确
  - 提取 `createHandleScroll` 函数：创建滚动处理函数，返回 `handleScroll` 和 `scrollTimeout`
  - 提取 `createIgnoreScrollEventsFor` 函数：创建忽略滚动事件的函数，返回 `ignoreScrollEventsFor` 和 `ignoreTimeout`
  - 主函数 `useScrollObserver` 简化为组合这些外部函数
- **好处**:
  - 消除了函数内部定义函数的问题
  - 提高了代码的可读性和可维护性
  - 每个函数职责更加单一明确
  - 便于单元测试和代码复用

### 布局引擎重构

- **重构**: 拆分大型 `useLayoutEngine.ts` 文件，改善代码可维护性和性能。
- **原因**: 原 `useLayoutEngine.ts` 文件达到650多行，包含三种布局模式的混合实现，职责不清晰，难以维护。
- **变更**:
  - 创建 `layout-engines` 子目录，采用模块化架构
  - 抽取公共类型定义到 `types.ts`
  - 抽取公共工具函数到 `layoutUtils.ts`
  - 按布局模式拆分为三个独立实现:
    - `useMasonryLayout.ts` - 瀑布流布局
    - `useGridLayout.ts` - 网格布局
    - `useJustifiedLayout.ts`

## 2025-06-28 22:15 - 新增useSelectionBox
**目的**: 将选择框状态管理和鼠标事件处理从组件中解耦

**功能**:
- 选择框状态管理（位置、大小、可见性等）
- 鼠标事件处理（mousedown、mousemove、mouseup）
- 空间选择器集成（可选）
- 选择框控制方法（开始、停止、清空）

**API设计**:
```typescript
interface UseSelectionBoxOptions {
  enableSpatialSelection?: boolean; // 默认false，按需启用
  elementFilter?: (element: Element) => boolean;
  idExtractor?: (element: Element) => EntityId;
  onSelectionBoxChange?: (state: SelectionBoxState) => void;
  onSelectionBoxStart?: (event: MouseEvent) => void;
  onSelectionBoxUpdate?: (event: MouseEvent) => void;
  onSelectionBoxEnd?: (event: MouseEvent) => void;
}
```

**返回值**:
- `selectionBoxState` - 选择框状态
- `selectionBoxStyle` - 计算的选择框样式
- `handleMouseDown/Move/Up` - 鼠标事件处理函数
- `startSelectionBox/stopSelectionBox/clearSelectionBox` - 控制方法
- `getSelectedEntityIds` - 获取选中实体ID
- `setContainerRef` - 设置容器引用

**设计原则**:
- 职责单一：只负责选择框相关的状态和事件
- 按需启用：空间选择器默认关闭
- 事件驱动：通过回调函数与外部通信
- 容器无关：通过setContainerRef动态设置容器