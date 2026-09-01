/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构（commit bb633de2bb "refactor: separate AV locate lifecycle"）将 AV 定位生命周期从单文件拆分为 locate/ 领域包。
 * 本地替代/迁移到：
 *   - app/src/protyle/render/av/locate/locate.types.ts （IAVLocateRequest 及内部类型）
 *   - app/src/protyle/render/av/locate/state/state.ts （beginAVRender / isCurrentAVRender / setAVLocateRequest / clearAVLocateRequest / getAVLocateParams）
 *   - app/src/protyle/render/av/locate/activation/activation.ts （queueAVLocateRequest / activateAVLocate / activateAVLocateWithRetry / activateQueuedAVLocate，注意签名已改为 AVLocateActivationContext）
 *   - app/src/protyle/render/av/locate/window/prepare.ts （prepareAVLocate，含 showUnavailableTarget 状态提示）
 *   - app/src/protyle/render/av/locate/presentation/finish.ts （finishAVLocate / highlightLocatedItem）
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 新增导出 applyAVRenderContext / persistAVLocateView / failAVRender：视图切换持久化事务自 finishAVLocate 抽出为 persistAVLocateView（依赖新模块 locateView 的 getAVLocateViewChange）；viewNotFound 错误提示改由 failAVRender 依据 response.data.error 统一处理。
 *   2. 定位高亮类名统一为 "protyle-wysiwyg--hl"，弃用 av__row--locate 与 av__gallery-item--locate。
 *   3. queueAVLocateRequest 不再强制 select:true/highlight:true，改为透传调用方标志（request.select ?? false、request.highlight ?? true）。
 *   4. getAVLocateParams 移除 viewID 回退读取 CUSTOM_SY_AV_VIEW 属性的逻辑（viewID: request.viewID || ""）。
 *   5. 选中与锚点改走新依赖：rangeSelect 的 setAVCellAnchor/setAVItemAnchor、virtualScroll 的 updateAVRowSelect、clearSelect(["galleryItem"])、gallery/style 的 getCardWidth（替代内联卡片宽度计算），并移除 addDragFill 导入。
 * 增量去向：
 *   - TODO port：增量 3 → locate/activation/activation.ts；增量 4 → locate/state/state.ts。
 *   - TODO port：增量 1 → 需在 locate/presentation 与 locate/state 新增 persistAVLocateView/failAVRender/applyAVRenderContext；其依赖的上游模块 render/av/locateView（getAVLocateViewChange）本地不存在，需一并移植或适配。
 *   - TODO port：增量 2 → locate/presentation/finish.ts 的 highlightLocatedItem。
 *   - TODO port：增量 5 → 其中 updateAVRowSelect 本地已有（render/av/virtualScroll/state.ts）；setAVCellAnchor/setAVItemAnchor（上游 rangeSelect 模块）与 getCardWidth（上游 gallery/style）本地不存在，移植前需先建模块或适配本地 selection/dragFill 实现。
 * 警告：合并树中仍有 3 个已干净合入的文件以 "./locate" 引用旧路径，墓碑化后这些导入将无法解析——
 *   app/src/protyle/render/av/openDatabaseItem.ts（activateQueuedAVLocate/queueAVLocateRequest，可改指向 locate/activation/activation）、
 *   app/src/protyle/render/av/render.ts 与 app/src/protyle/render/av/gallery/render.ts（applyAVRenderContext/failAVRender/persistAVLocateView 为上游新增符号，本地暂无对应实现）。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
