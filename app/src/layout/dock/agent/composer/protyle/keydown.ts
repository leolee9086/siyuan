/** 用途：进入 Composer 历史浏览；使用范围：空输入 ArrowUp；解耦评估：纯状态转换经目录网关复用。 */
import {beginComposerHistoryBrowsing} from "./imports";
/** 用途：判断 Composer 是否存在历史；使用范围：ArrowUp 分派；解耦评估：纯状态读取经目录网关复用。 */
import {hasComposerHistory} from "./imports";
/** 用途：判断 Composer 是否正在浏览历史；使用范围：方向键和普通输入；解耦评估：纯状态读取经目录网关复用。 */
import {isBrowsingComposerHistory} from "./imports";
/** 用途：向较新历史导航；使用范围：ArrowDown 分派；解耦评估：纯状态转换经目录网关复用。 */
import {navigateComposerHistoryDown} from "./imports";
/** 用途：向较旧历史导航；使用范围：ArrowUp 分派；解耦评估：纯状态转换经目录网关复用。 */
import {navigateComposerHistoryUp} from "./imports";
/** 用途：退出历史浏览；使用范围：普通字符输入；解耦评估：纯状态转换经目录网关复用。 */
import {resetComposerHistoryCursor} from "./imports";
/** 用途：读取当前 Composer 空状态；使用范围：历史导航守卫；解耦评估：DOM 推导集中在内容模块。 */
import {isProtyleComposerEmpty} from "./content";
/** 用途：约束 Protyle 生命周期状态；使用范围：完整键盘分派。 */
import type {AgentProtyleComposerRuntime} from "./types";

/** 判断当前按键是否为不带修饰键的发送 Enter。 */
const isPlainEnter = (event: KeyboardEvent) =>
    event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

/** 在原生 Hint 可见时把选择按键交还给 Protyle，并阻止 Composer 发送或浏览历史。 */
const handleVisibleProtyleHint = (runtime: AgentProtyleComposerRuntime, event: KeyboardEvent) => {
    // 隐藏的 Hint 不占用键盘分派，后续发送和历史逻辑继续执行。
    if (runtime.hint.element.classList.contains("fn__none")) {
        return false;
    }
    const isSelectionKey = event.key === "Enter" || event.key.includes("Arrow");
    // 非选择键仍由 Protyle 自身处理，但当前 Composer 不得把它解释为发送或历史动作。
    if (!isSelectionKey) {
        return true;
    }
    // Protyle 确认已消费选择键时阻止浏览器默认行为和外层面板处理。
    if (runtime.hint.select(event, runtime.protyle)) {
        event.preventDefault();
        event.stopPropagation();
    }
    return true;
};

/** 处理已发送消息的上下翻页，并在越过末项后恢复进入浏览前的草稿 HTML。 */
const handleProtyleHistoryNavigation = (runtime: AgentProtyleComposerRuntime, event: KeyboardEvent) => {
    // 空输入或已在浏览历史时，ArrowUp 才接管当前编辑内容。
    if (event.key === "ArrowUp" && !event.shiftKey &&
        (isBrowsingComposerHistory(runtime.history) || isProtyleComposerEmpty(runtime)) &&
        hasComposerHistory(runtime.history)) {
        event.preventDefault();
        event.stopPropagation();
        const target = isBrowsingComposerHistory(runtime.history)
            ? navigateComposerHistoryUp(runtime.history)
            : beginComposerHistoryBrowsing(runtime.history, runtime.wysiwyg.element.innerHTML);
        runtime.wysiwyg.element.innerHTML = runtime.protyle.lute.Md2BlockDOM(target);
        return true;
    }
    // 浏览过程中 ArrowDown 向新消息移动，并在末端恢复原始 DOM 草稿。
    if (event.key === "ArrowDown" && isBrowsingComposerHistory(runtime.history)) {
        event.preventDefault();
        event.stopPropagation();
        const target = navigateComposerHistoryDown(runtime.history);
        runtime.wysiwyg.element.innerHTML = isBrowsingComposerHistory(runtime.history)
            ? runtime.protyle.lute.Md2BlockDOM(target)
            : target;
        return true;
    }
    return false;
};

/** @同步豁免: 生命周期 keydown 必须在当前捕获阶段决定是否消费事件，异步函数不符合浏览器事件协议。 */
/** 按 Hint、发送、历史和普通输入的优先级分派 Protyle Composer 键盘事件。 */
export const handleProtyleComposerKeyDown = (runtime: AgentProtyleComposerRuntime, event: KeyboardEvent) => {
    if (handleVisibleProtyleHint(runtime, event)) {
        return;
    }
    // Hint 未占用且没有修饰键时，Enter 才提交当前消息。
    if (isPlainEnter(event)) {
        event.preventDefault();
        event.stopPropagation();
        runtime.onSend();
        return;
    }
    if (handleProtyleHistoryNavigation(runtime, event)) {
        return;
    }
    // 新字符输入会结束历史浏览，后续方向键只操作新草稿。
    if (isBrowsingComposerHistory(runtime.history) && event.key.length === 1 &&
        !event.ctrlKey && !event.metaKey && !event.altKey) {
        resetComposerHistoryCursor(runtime.history);
    }
};
