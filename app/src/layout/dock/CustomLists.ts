/**
 * @AITODO
 * 实现一个"自定义块列表"面板
 *
 * ## 实施计划 (Implementation Plan) v5
 *
 * 1. **重构准备 (Refactoring - Pre-requisites)**
 *    - **目标**: 解决 `layout/dock/index.ts` 文件过大和类型硬编码问题。
 *    - **[NEW] `layout/dock/factory.ts`**:
 *      - 提取 Model 工厂方法 `createModel(type: string, tab: Tab, app: App, dock: Dock): Model | undefined`.
 *      - 将 `Dock.toggleModel` 中的 switch-case 逻辑迁移至此。
 *    - **[MODIFY] `layout/dock/index.ts`**:
 *      - 使用 `createModel` 替代原有的 switch-case 逻辑。
 *
 * 2. **通用动态 Dock 支持 (Generic Dynamic Dock Support)**
 *    - **目标**: 支持任意插件或模块注册动态侧边栏面板，不限于 CustomLists。
 *    - **[MODIFY] `layout/dock/index.ts`**:
 *      - **识别机制**: 实现静态方法 `Dock.isDynamicDock(type: string): boolean`。
 *        - 默认逻辑: check if `type` starts with `custom_list:` (之后可扩展为注册制)。
 *      - **按钮生成 (`genButton`)**: 允许 `isDynamicDock(type)` 的项渲染按钮。
 *      - **面板切换 (`toggleModel`)**:
 *        - `Dock` 类负责调用 `factory.createModel`。
 *        - `factory.ts` 负责解析 dynamic type (e.g. `custom_list:uuid`) 并实例化对应的 Model (e.g. `CustomLists`).
 *      - **API 扩展**:
 *        - `addCustomItem(type: string, title: string, icon: string)`: 动态添加 Dock 项。
 *        - `removeCustomItem(type: string)`: 动态移除 Dock 项。
 *
 * 3. **CustomLists 核心实现 (CustomLists Implementation)**
 *    - **类定义**: `export class CustomLists extends Model`
 *    - **数据存储**: `window.siyuan.storage[Constants.LOCAL_CUSTOMLISTS]`.
 *    - **数据结构**:
 *      ```typescript
 *      type CustomListType = 'dynamic' | 'static';
 *
 *      interface ICustomList {
 *          id: string;          // 唯一标识 (UUID), e.g. "uuid" -> type = "custom_list:uuid"
 *          title: string;       // 列表标题
 *          icon: string;        // 列表图标 (默认为 search 或 list)
 *          type: CustomListType;// 列表类型: 动态查询 vs 静态列表
 *          target: string | string[]; // 数据源:
 *                                    // - dynamic: 搜索查询语句 (string)
 *                                    // - static: 块ID列表 (string[])
 *          sort?: number;       // 排序方式
 *          openNodes?: string[];// 展开的节点ID
 *      }
 *      ```
 *    - **工厂集成**:
 *      - 在 `factory.ts` 中处理 `custom_list:` 前缀。
 *      - 解析 ID 并传递给 `new CustomLists({ app, tab, id })`.
 *
 *    - **渲染逻辑 (`renderList`)**:
 *      - **Dynamic (动态)**: 调用 `fetchPost("/api/search/searchBlock", { query: list.target })`。
 *        - 始终反映最新的搜索结果。
 *      - **Static (静态)**:
 *        - 直接根据 `list.target` (Block IDs) 渲染列表。
 *        - 类似 "收藏夹" 或 "暂存区"，内容固定，除非手动移除/重新排序。
 *
 *    - **操作接口 (API)**:
 *      - `addList(query: string, title?: string)`: 创建动态列表 -> 调用 `dock.addCustomItem`.
 *      - `createStaticList(title: string)`: 创建空的静态列表 -> 调用 `dock.addCustomItem`.
 *      - `addToStaticList(listId: string, blockIds: string[])`: 向静态列表添加块。
 *
 * 4. **集成与交互 (Integration)**
 *    - **Search 面板**: Pin 按钮 -> 调用 `dock.addCustomItem("custom_list:"+uuid, query, "icon")`.
 *    - **持久化**:
 *      - 确认 `layout/util.ts` 的 `dockToJSON` 能够序列化所有 Dock items.
 *      - 确保 `addCustomItem` 正确更新 DOM 和 `Dock.data`.
 *
 * 5. **待办事项 (TODO)**
 *    - [ ] Refactor `layout/dock/index.ts` -> `factory.ts`.
 *    - [ ] Implement `Dock.isDynamicDock` & `addCustomItem`.
 *    - [ ] Implement `CustomLists` skeleton.
 *    - [ ] Connect Search Panel "Pin" action.
 *
 * 6. **已知问题与风险 (Risks)**
 *    - **静态列表失效**: 如果块被删除，静态列表中的 ID 需要清理或标记失效。
 *      - *对策*: 渲染时过滤掉不存在的块，或者显示"已失效"。
 */