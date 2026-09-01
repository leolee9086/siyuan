/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构拆除了编辑器工具网关（s-forge 提交 12bd93e0b7
 * 「refactor: remove stale editor utility gateway」），原导出已按领域迁往独立模块。
 * 本地替代/迁移到（相对 app/src/）：
 *   openFile            → editor/open/openFile.ts
 *   openFileById        → editor/utils.openFileById.ts（内部助手：editor/util.switchEditor.ts、editor/util.getUnInitTab.ts）
 *   updatePanelByEditor → editor/util.updatePanelByEditor.ts
 *   isCurrentEditor     → editor/util.isCurrentEditor.ts
 *   updateOutline       → editor/util.updateOutline.ts
 *   updateBacklinkGraph → editor/util.updateBacklinkGraph.ts
 *   openAsset           → asset/open/openAsset.ts
 *   openBy              → platform/localPath/openBy.ts
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. openFileById 新增 notebookId / keepAVPanel 选项：getBlockInfo 附带 notebook 参数，zoomIn 仅在 id 不等于 rootID 时生效，并向下透传。
 *   2. 资产打开改用 getAssetExtension() 并新增 isBrowserRenderableImagePath() 校验；抽出 openAssetWithOptions，新增导出 openAssetInBackground()（保光标后台打开资产）。
 *   3. openFile 支持 keepAVPanel（不移除 .av__panel/.av__mask）与资产分支 keepCursor；ipcRenderer.invoke 外包 try/catch；keep-cursor 属性仅在 options.id 存在时设置。
 *   4. switchEditor 的 observerLoad 定位观察器新增「用户滚动即中止」（wheel/touchstart/touchmove/翻页键经 AbortController）；getUnInitTab/newTab 透传 notebookId。
 *   5. updateOutline 回传 protyle.notebookId；updateBacklinkGraph 记录 notebookId，反链面板改用 prepareForBlock()/refreshIfVisible(true)/switchBlock() 取代内联 getBacklink2 拉取。
 * 增量去向：TODO 移植清单 ——
 *   a. notebookId/keepAVPanel 选项及透传 → editor/utils.openFileById.ts 与 editor/open/openFile.ts（本地签名已改为 AppFacade/ILayoutModel 且暂无这些选项）。
 *   b. getAssetExtension/isBrowserRenderableImagePath 助手本地尚不存在 → 需先补 util/pathName、util/imageURL 等价实现，再接入 asset/open/openAsset.ts。
 *   c. openAssetInBackground → asset/open/openAsset.ts 新增变体（本地完全缺失）。
 *   d. observerLoad 用户滚动中止逻辑 → editor/util.switchEditor.ts。
 *   e. prepareForBlock/refreshIfVisible(true)/switchBlock 与 notebookId 记账 → layout/dock 反链模型与 editor/util.updateBacklinkGraph.ts。
 *   注意：本地重构后签名与依赖网关均已变化（imports.ts 转发、部分函数 async 化），移植须语义适配，不可照抄上游 diff。
 * ⚠ 合并警告：本合并工作区仍有以下文件引用旧路径「editor/util」，解析本冲突时需同步改为上述新模块路径：
 *   menus/commonMenuItem.ts、menus/protyle.ts、protyle/hint/index.ts、protyle/toolbar/index.ts、util/mount.ts、search/util.ts、
 *   protyle/render/av/openDatabaseRow.ts、protyle/render/av/openDatabaseItem.ts、editor/openLink.ts（自 "./util"）。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
