# 这个区段由开发者编写,未经允许禁止AI修改
本目录下的文件是空间选择器的核心实现，修改需极其谨慎。

# 修改记录

## 2025-06-28

### 空间选择器架构设计

- **创建**: 设计并实现了高性能的通用空间选择器架构。
- **原因**: 用户需要处理大量DOM元素的空间查询，要求高性能且避免函数嵌套。
- **架构设计**:
  - **模块化设计**: 按功能拆分为多个独立模块
    - `types.ts` - 类型定义
    - `spatial-utils.ts` - 空间计算工具
    - `spatial-cache.ts` - 空间属性缓存系统
    - `spatial-hash.ts` - 空间哈希索引
    - `spatial-query.ts` - 空间查询核心逻辑
    - `index.ts` - 主入口和便捷API
  - **函数式风格**: 完全避免类和函数嵌套，采用纯函数组合
  - **性能优化**: 多层缓存和索引策略
- **核心特性**:
  - **空间哈希索引**: 将空间划分为网格块，快速筛选候选元素
  - **智能缓存**: 基于时间戳和脏标记的缓存策略，避免频繁重排
  - **批量更新**: 使用requestAnimationFrame和requestIdleCallback优化更新
  - **多种查询模式**: 相交、包含、部分相交、点附近、面积阈值等
- **性能优势**:
  - 查询复杂度从O(n)降低到O(log n)
  - 避免频繁的getBoundingClientRect调用
  - 支持大量元素的实时查询
  - 内存友好的WeakMap缓存策略
- **使用方式**:
  ```typescript
  const selector = createDefaultSpatialSelector();
  
  // 添加元素
  selector.addElement(element, rect);
  
  // 查询相交元素
  const intersecting = selector.queryIntersecting(elements, viewport);
  
  // 查询包含元素
  const contained = selector.queryContained(elements, selection);
  
  // 完整查询
  const result = selector.executeQuery(elements, queryRect);
  ```
- **好处**:
  - 高性能的空间查询能力
  - 完全函数式设计，无嵌套
  - 模块化架构，易于扩展
  - 内存安全，自动垃圾回收
  - 支持复杂的空间关系查询 