/** 用途：转发 Tiptap Composer 所需的编辑器、菜单和展示能力；使用范围：tiptap 子领域实现；解耦评估：所有跨目录运行时依赖统一经父级 imports 网关进入。 */
import {
    createProtyleMenu,
    Document,
    Editor,
    escapeHtml,
    getIconByType,
    HardBreak,
    History,
    matchHotKey,
    Mention,
    MenuItem,
    Paragraph,
    Placeholder,
    Text,
} from "../../imports";
/** 用途：转发 Composer 历史纯状态转换；使用范围：Tiptap 键盘分派和公共句柄；解耦评估：函数只接收公开状态，不引入模块级可变对象。 */
import {
    beginComposerHistoryBrowsing,
    clearComposerHistory,
    hasComposerHistory,
    isBrowsingComposerHistory,
    navigateComposerHistoryDown,
    navigateComposerHistoryUp,
    pushComposerHistory,
    resetComposerHistoryCursor,
    restoreComposerHistory,
} from "../AgentComposer.history";
/** 用途：转发编辑器、建议回调和标准菜单类型；使用范围：tiptap 子领域状态、适配器与句柄。 */
import type {
    Extensions,
    JSONContent,
    Menu,
    Node,
    SuggestionKeyDownProps,
    SuggestionProps,
} from "../../imports";

/** 导出标准菜单工厂。 */
export {createProtyleMenu};
/** 导出 Tiptap 文档节点。 */
export {Document};
/** 导出 Tiptap 编辑器。 */
export {Editor};
/** 导出 HTML 转义能力。 */
export {escapeHtml};
/** 导出块图标映射。 */
export {getIconByType};
/** 导出 Tiptap 换行节点。 */
export {HardBreak};
/** 导出 Tiptap 撤销历史扩展。 */
export {History};
/** 导出快捷键匹配工具。 */
export {matchHotKey};
/** 导出 Tiptap Mention 扩展。 */
export {Mention};
/** 导出标准菜单项。 */
export {MenuItem};
/** 导出 Tiptap 段落节点。 */
export {Paragraph};
/** 导出 Tiptap 占位符扩展。 */
export {Placeholder};
/** 导出 Tiptap 文本节点。 */
export {Text};
/** 导出 Tiptap JSON 内容类型。 */
export type {JSONContent};
/** 导出 Tiptap 扩展集合类型。 */
export type {Extensions};
/** 导出 ProseMirror 节点类型。 */
export type {Node};
/** 导出标准菜单类型。 */
export type {Menu};
/** 导出 Tiptap 建议键盘回调类型。 */
export type {SuggestionKeyDownProps};
/** 导出 Tiptap 建议渲染属性类型。 */
export type {SuggestionProps};
/** 导出进入历史浏览转换。 */
export {beginComposerHistoryBrowsing};
/** 导出清空历史转换。 */
export {clearComposerHistory};
/** 导出历史存在性判断。 */
export {hasComposerHistory};
/** 导出历史浏览状态判断。 */
export {isBrowsingComposerHistory};
/** 导出历史向下导航转换。 */
export {navigateComposerHistoryDown};
/** 导出历史向上导航转换。 */
export {navigateComposerHistoryUp};
/** 导出历史追加转换。 */
export {pushComposerHistory};
/** 导出历史游标重置转换。 */
export {resetComposerHistoryCursor};
/** 导出历史恢复转换。 */
export {restoreComposerHistory};
