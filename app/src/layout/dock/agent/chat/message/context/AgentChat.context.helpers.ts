import {maxVisibleBlockIDs} from "./imports";
import type {IEditorContext} from "./imports";
import type {ProtyleDomain} from "./imports";

/** 汇总所有编辑器中的块选择，保留跨页签选择上下文。 */
export const collectSelectedBlockIDs = (editors: ProtyleDomain[]) => {
    const selected: string[] = [];
    for (const editor of editors) {
        const elements = editor.protyle?.wysiwyg?.element?.querySelectorAll(
            "[data-node-id].protyle-wysiwyg--select"
        ) || [];
        for (const element of elements) {
            const id = element.getAttribute("data-node-id");
            if (id) {
                selected.push(id);
            }
        }
    }
    return Array.from(new Set(selected));
};

/** 判断编辑器是否位于可见的中心布局，供上下文候选排序复用。 */
const isContextEditorVisible = (editor: ProtyleDomain) =>
    !editor.protyle.element.classList.contains("fn__none") &&
    editor.protyle.element.closest(".layout__center") !== null;

/** 按块选择、DOM 选区、最近页签和可见性依次选择上下文编辑器。 */
export const findContextEditor = (editors: ProtyleDomain[]) => {
    const selected = editors.find((editor) => isContextEditorVisible(editor) &&
        !!editor.protyle?.wysiwyg?.element?.querySelector(".protyle-wysiwyg--select"));
    if (selected) {
        return selected;
    }
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const ranged = range ? editors.find((editor) => editor.protyle.element.contains(range.startContainer)) : undefined;
    return ranged || findMostRecentEditor(editors) ||
        editors.find((editor) => !editor.protyle.element.classList.contains("fn__none"));
};

/** 查找当前聚焦且最近激活的编辑器页签。 */
const findMostRecentEditor = (editors: ProtyleDomain[]) => {
    let candidate: ProtyleDomain | undefined;
    let activeTime = 0;
    for (const editor of editors) {
        let head = editor.protyle.model?.parent?.headElement;
        const visibleWithoutHead = !head && editor.protyle.element.getBoundingClientRect().height > 0;
        const tabBody = visibleWithoutHead ? editor.protyle.element.closest(".fn__flex-1[data-id]") : null;
        if (tabBody) {
            head = document.querySelector<HTMLElement>(
                `.layout-tab-bar .item[data-id="${tabBody.getAttribute("data-id")}"]`
            ) ?? undefined;
        }
        const activation = parseInt(head?.dataset.activetime || "0");
        // 条件 head?.classList.contains("item--focus") && activation >... 成立时才执行此分支，避免影响其它会话或响应阶段。
        if (head?.classList.contains("item--focus") && activation > activeTime) {
            activeTime = activation;
            candidate = editor;
        }
    }
    return candidate;
};

/** 收集编辑器视口内最多指定数量的块标识。 */
const collectVisibleBlockIDs = (editor: ProtyleDomain) => {
    const protyle = editor.protyle;
    const result: string[] = [];
    const scrollContainer = protyle.contentElement || protyle.wysiwyg?.element?.parentElement;
    if (!scrollContainer || !protyle.wysiwyg?.element) {
        return result;
    }
    const view = scrollContainer.getBoundingClientRect();
    for (const child of Array.from(protyle.wysiwyg.element.children)) {
        const element = child;
        const id = element.getAttribute("data-node-id");
        const rect = element.getBoundingClientRect();
        // 条件 id && rect.height > 0 && rect.bottom >= view.top && rec... 成立时才执行此分支，避免影响其它会话或响应阶段。
        if (id && rect.height > 0 && rect.bottom >= view.top && rect.top <= view.bottom) {
            result.push(id);
        }
        if (result.length >= maxVisibleBlockIDs) {
            break;
        }
    }
    return result;
};

/** 将文档元数据、选择和可见块合成为请求上下文。 */
/**
 * `buildEditorContext` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export const buildEditorContext = (editor: ProtyleDomain): IEditorContext | undefined => {
    const protyle = editor.protyle;
    const activeDocID = protyle.block?.rootID;
    const focusedBlockID = protyle.block?.id;
    const activeDocTitle = protyle.title?.editElement?.textContent?.trim() || undefined;
    const notebookID = protyle.notebookId || undefined;
    const selectedBlockIDs = collectSelectedBlockIDs([editor]);
    const visibleBlockIDs = collectVisibleBlockIDs(editor);
    if (!activeDocID && !activeDocTitle && !notebookID && !focusedBlockID &&
        selectedBlockIDs.length === 0 && visibleBlockIDs.length === 0) {
        return undefined;
    }
    const context: IEditorContext = {};
    if (activeDocID) {
        context.activeDocID = activeDocID;
    }
    if (activeDocTitle) {
        context.activeDocTitle = activeDocTitle;
    }
    if (notebookID) {
        context.notebookID = notebookID;
    }
    // 条件 focusedBlockID && focusedBlockID !== activeDocID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (focusedBlockID && focusedBlockID !== activeDocID) {
        context.focusedBlockID = focusedBlockID;
    }
    // 条件 selectedBlockIDs.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (selectedBlockIDs.length > 0) {
        context.selectedBlockIDs = selectedBlockIDs;
    }
    // 条件 visibleBlockIDs.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (visibleBlockIDs.length > 0) {
        context.visibleBlockIDs = visibleBlockIDs;
    }
    return context;
};
