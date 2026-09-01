/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构解耦重构（commit b413a5fe9f "refactor: separate breadcrumb actions by domain"）按领域拆分取代了原单文件 action.ts。
 * 本地替代/迁移到：
 *   - net2LocalAssets：app/src/protyle/breadcrumb/assets/net2LocalAssets.ts
 *   - updateReadonly：app/src/protyle/breadcrumb/readonly/updateReadonly.ts
 *   - fullscreen：app/src/app/fullscreen/toggleApplicationFullscreen.ts（导出 toggleApplicationFullscreen，内部分解为 updateHeaderDragRegion、updateLayoutDragRegion、updateWindowControlsZIndex、updateWindowUI、updateButtonAndDock、syncEditors）
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 新增 export const setFullscreen(element, enter, btnElement?)：显式 enter 布尔参数，状态未变化时提前返回 false。
 *   2. 原 fullscreen() 改为薄封装：setFullscreen(element, !element.classList.contains("fullscreen"), btnElement)。
 *   3. 切换函数返回布尔值表示是否实际切换（含 btnElement 分支返回 true）。
 *   4. 简化关闭其它全屏编辑器的循环逻辑；修正 WebkitAppRegion 三元方向（enter ? "" : "drag"）。
 *   5. net2LocalAssets 与 updateReadonly 上游无变化，冲突仅由本地删除引起。
 * 增量去向：全屏行为的等价逻辑已由本地 app/fullscreen/toggleApplicationFullscreen.ts 承接；但上游新增的显式 enter 参数 API 未移植（本地为 toggle 式、无布尔返回值）。TODO：若调用方需要显式 enter 语义（见 app/src/protyle/index.ts 的 setFullscreenState 调用点），请在 app/fullscreen 模块补充该 API 或适配调用方。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
