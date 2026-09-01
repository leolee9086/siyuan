/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：6b76e932e5 refactor: formalize BlockPanel domain contract
 * 本地替代/迁移到：app/src/block/panelLoad.ts, app/src/block/panelRemoval.ts, app/src/block/panelLoad.test.ts
 *         及 block 领域拆分（panel 契约化为 BlockPanel domain）
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   - 条件编译块 /// #if !BROWSER / /// #if !MOBILE 引入 openNewWindowById / moveResize / openFileById 等
 *   - 块面板打开/定位/拖拽相关小修（与本地新 domain 等价）
 * 增量去向：本地新 domain 已覆盖面板打开与生命周期；条件编译已在本地架构中替换为运行时判断（如 isMobile / isBrowser），无需恢复此文件。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
