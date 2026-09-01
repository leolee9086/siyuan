/**
 * 墓碑：本文件原有的综合编辑器快捷键实现已完成领域拆分，不再承载运行时逻辑。
 *
 * - `commonHotkey`、`getStartEndElement`、`duplicateBlock`、`goHome`：使用 `./commonHotkey/commonHotkey`。
 * - `upSelect`、`downSelect`：使用 `./commonHotkey/upSelect` 与 `./commonHotkey/downSelect`。
 * - `goEnd`：使用 `./commonHotkey/goEnd/goEnd`。
 * - `alignImgCenter`、`alignImgLeft`：使用 `./commonHotkey/commonHotkeyAlign`。
 *
 * 保留本文件用于源码与 Git 历史查询；不重新导出替代实现，以便旧导入在编译期显式暴露并迁移到真实所有者。
 *
 * 合并说明：upstream/dev 对旧实现的后续修改仅涉及 `duplicateBlock` 内部行为（插入副本时去掉
 * processClonePHElement 包装，折叠标题复制改为 removeFoldAttr: false 并按正向顺序链式锚定插入），
 * 这些修改与本地拆分相互独立，已随本次合并移植到上述新属主模块，本文件不回填任何运行时代码。
 */
export {};
