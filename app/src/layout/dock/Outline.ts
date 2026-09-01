/**
 * 墓碑：本文件原有的单体 Outline 类已完成领域拆分，不再承载运行时逻辑。
 *
 * - Outline 组合根：使用 `./outline/Outline`。
 * - 完整公共领域契约与运行时身份：使用 `./outline/types`。
 * - 排序、筛选、展开、菜单、消息和初始化职责：使用 `./outline/` 下对应唯一所有者。
 *
 * 保留本文件用于源码与 Git 历史查询；不重新导出 `Outline`，以便旧导入在编译期显式暴露。
 *
 * 上游待移植清单（来源：upstream/dev 同路径文件，合并基线 03be0f94 → 上游版本 e0003830；
 * 上游改动只存在于单体类中，须按职责移植到 `./outline/` 对应唯一所有者后才能删除本清单）：
 * 1. 构造参数新增可选 `notebookId` 并缓存；经 `getNotebookId()` 复用所属笔记本，
 *    加密笔记本调用 `/api/outline/getDocOutline` 与 `/api/block/getBlockBreadcrumb` 时附带 `notebook`
 *    参数（拆分模块当前整体缺失加密笔记本分支）。
 * 2. 新增 `refreshId` 竞态守卫：构造首取、事务触发的刷新与 `refresh()` 在响应返回时
 *    校验 `refreshId` 与 `blockId` 未变化，过期响应直接丢弃。
 * 3. 新增公开方法 `refresh()`（带守卫的重取并同步文档标题）；现有 `reload()` 可作为落地载体合并该行为。
 * 4. 消息处理新增 `transactions` 分支：`transactionsMayChangeRootHeadingNumberSetting(data.data, blockId)`
 *    命中时触发 `refresh()`（判定函数在 `protyle/util/headingNumberCore`）。
 * 5. `savedoc` 刷新判定改用 `operationsMayChangeOutline(operations, headingIDs)`，替换
 *    `Outline.helpers.ts` 中按 action 逐项判断的 `检查操作是否需要重载`。
 * 6. `update()` 新增第三参数 `notebookId`，切换文档时同步缓存的所属笔记本。
 * 7. 展开层级持久化：`expandToLevel` 写入 `window.siyuan.storage[LOCAL_OUTLINE].expandLevel`
 *    并经 `setStorageVal` 落盘；`showExpandLevelMenu` 按存储值为当前层级菜单项标记 `current`。
 * 8. 标题级别转换改用 `applyHeadingLevelUpdates` 与 `getHeadingLevelUpdateOperations`
 *    （含 unfold 操作时的回调二次渲染），见 `protyle/util/headingTransform`。
 * 9. 复制/剪切标题统一传 `removeFoldAttr: false`（折叠属性随内容保留，不再按 fold 属性计算）；
 *    剪贴板写入与块引用确认在拆分模块已有等价实现（`writeBlockDOMClipboard`、
 *    `confirmBlockRefForBlocks`），仅需对齐该参数。
 */
export {};
