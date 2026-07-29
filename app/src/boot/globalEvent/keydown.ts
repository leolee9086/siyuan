/**
 * 墓碑：本文件原有的窗口键盘聚合实现已完成领域拆分，不再承载运行时逻辑。
 *
 * - `windowKeyDown`：使用 `./keydown/windowKeyDown/windowKeyDown`。
 * - `sendGlobalShortcut`：使用 `./keydown/windowKeyDown/globalShortcut/send`。
 * - `sendUnregisterGlobalShortcut`：使用 `./keydown/windowKeyDown/globalShortcut/unregister`。
 *
 * 保留本文件用于源码与 Git 历史查询；不重新导出替代实现，以便旧导入在编译期显式暴露并迁移到真实所有者。
 */
export {};
