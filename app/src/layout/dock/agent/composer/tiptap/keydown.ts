/** 用途：约束 Tiptap 编辑器；使用范围：Composer 键盘分派。 */
import type {Editor} from "./imports";
/** 用途：匹配可配置发送快捷键；使用范围：发送分派；解耦评估：键位协议经目录网关复用。 */
import {matchHotKey} from "./imports";
/** 用途：进入 Composer 历史浏览；使用范围：空输入 ArrowUp；解耦评估：纯状态转换通过目录网关复用。 */
import {beginComposerHistoryBrowsing} from "./imports";
/** 用途：判断 Composer 是否存在历史；使用范围：空输入 ArrowUp；解耦评估：纯状态读取通过目录网关复用。 */
import {hasComposerHistory} from "./imports";
/** 用途：判断 Composer 是否正在浏览历史；使用范围：方向键和普通输入；解耦评估：纯状态读取通过目录网关复用。 */
import {isBrowsingComposerHistory} from "./imports";
/** 用途：向较新 Composer 历史导航；使用范围：ArrowDown；解耦评估：纯状态转换通过目录网关复用。 */
import {navigateComposerHistoryDown} from "./imports";
/** 用途：向较旧 Composer 历史导航；使用范围：ArrowUp；解耦评估：纯状态转换通过目录网关复用。 */
import {navigateComposerHistoryUp} from "./imports";
/** 用途：退出 Composer 历史浏览；使用范围：普通字符输入；解耦评估：纯状态转换通过目录网关复用。 */
import {resetComposerHistoryCursor} from "./imports";
/** 用途：约束 Composer 消息历史状态；使用范围：空输入时的上下翻页。 */
import type {ComposerHistoryState} from "../AgentComposer.history.types";
/** 用途：复用标准建议菜单键盘动作；使用范围：Slash 菜单分派；解耦评估：菜单处理器只接收公开状态和事件。 */
import {handleTiptapSuggestionMenuKey} from "./menu";
/** 用途：在退出键时同步取消 Slash 请求；使用范围：Slash 菜单分派；解耦评估：显式状态变化替代延迟清理。 */
import {deactivateTiptapSlashSuggestions} from "./slash";
/** 用途：约束 Composer 聚合交互状态；使用范围：键盘处理器。 */
import type {TiptapComposerInteractionState} from "./types";
/** 用途：聚合键盘分派依赖；使用范围：公开键盘处理入口。 */
import type {TiptapComposerKeyDownContext} from "./types";

/**
 * 作用：识别应交给 Tiptap History 的撤销和重做按键；意图：只阻止事件冒泡到文档编辑器；
 * 调用时机：每次 Composer keydown 的第一道分派；问题/改进：快捷键集合与当前桌面协议保持一致。
 */
const isUndoRedoShortcut = (event: KeyboardEvent) => {
    if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
        return false;
    }
    const key = event.key.toLowerCase();
    return key === "z" || (!event.shiftKey && key === "y");
};

/**
 * 作用：消费处于激活状态的 Slash 菜单按键；意图：退出时同步取消异步请求；
 * 调用时机：普通发送和历史导航之前；问题/改进：其余按键继续交给编辑器输入。
 */
const handleSlashMenuKey = (
    state: TiptapComposerInteractionState,
    event: KeyboardEvent,
) => {
    if (!state.slash.active || !state.suggestion.open) {
        return false;
    }
    // Escape 同时关闭菜单和使当前 Slash 请求失效，避免旧响应重新打开菜单。
    if (event.key === "Escape") {
        event.preventDefault();
        deactivateTiptapSlashSuggestions(state);
        return true;
    }
    return handleTiptapSuggestionMenuKey(state.suggestion, event);
};

/** 作用：判定当前文档是否只有空段落；意图：仅允许空输入进入历史；调用时机：ArrowUp 分派。 */
const isEditorEmpty = (editor: Editor) =>
    editor.state.doc.childCount === 1 && editor.state.doc.firstChild?.childCount === 0;

/**
 * 作用：处理已发送消息的上下翻页；意图：保留进入历史前的草稿并在末尾恢复；
 * 调用时机：建议菜单未打开时；问题/改进：历史容量由 ComposerHistory 统一负责。
 */
const handleHistoryNavigation = (
    editor: Editor,
    history: ComposerHistoryState,
    event: KeyboardEvent,
    enableHistory: boolean,
) => {
    // 上游编辑态协议：enableHistory 显式关闭（如用户消息编辑）时不接管方向键。
    if (!enableHistory) {
        return false;
    }
    // 空输入或已在浏览历史时，ArrowUp 才接管当前编辑内容。
    if (event.key === "ArrowUp" && (isBrowsingComposerHistory(history) || isEditorEmpty(editor)) && hasComposerHistory(history)) {
        event.preventDefault();
        const text = isBrowsingComposerHistory(history)
            ? navigateComposerHistoryUp(history)
            : beginComposerHistoryBrowsing(history, editor.state.doc.textContent);
        editor.commands.setContent(text);
        return true;
    }
    // 浏览过程中 ArrowDown 向新消息移动，并在越过末尾时恢复原草稿。
    if (event.key === "ArrowDown" && isBrowsingComposerHistory(history)) {
        event.preventDefault();
        editor.commands.setContent(navigateComposerHistoryDown(history));
        return true;
    }
    return false;
};

/** 作用：识别无修饰键的 Enter；意图：修饰键和 Shift+Enter 仍由编辑器处理；调用时机：发送分派。 */
const isPlainEnter = (event: KeyboardEvent) =>
    event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

/** @同步豁免: 生命周期 Tiptap keydown 要求在当前事件中同步返回消费结果，异步函数不符合第三方回调协议。 */
/** 分派显式状态和编辑器命令，不在回调闭包内另建隐藏状态。 */
export const handleTiptapComposerKeyDown = (
    context: TiptapComposerKeyDownContext,
    event: KeyboardEvent,
) => {
    // 撤销和重做由当前 Tiptap History 消费，但不得继续冒泡到全局文档历史。
    if (isUndoRedoShortcut(event)) {
        event.stopPropagation();
        return false;
    }
    if (handleSlashMenuKey(context.state, event)) {
        return true;
    }
    // 没有建议菜单占用 Enter 时，普通 Enter 才提交当前消息。
    if (isPlainEnter(event) && !context.state.suggestion.open) {
        event.preventDefault();
        context.onSend();
        return true;
    }
    if (!context.state.suggestion.open && handleHistoryNavigation(context.editor, context.history, event)) {
        return true;
    }
    // 用户开始输入普通字符后退出历史浏览，后续方向键不再覆盖新草稿。
    if (isBrowsingComposerHistory(context.history) && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        resetComposerHistoryCursor(context.history);
    }
    return false;
};
