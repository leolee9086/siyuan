import { Constants } from "../../../constants";
import { focusByWbr } from "../../../protyle/util/selection";
import { mathRender } from "../../../protyle/render/mathRender";
import { fetchPost } from "../../../util/network/fetch";
import { pathPosix } from "../../../util/file/pathName";
import { replaceFileName } from "../../../editor/rename";
import { isOperations, isHTMLElement } from "../dock.guard";
import type {ProtyleDomain} from "../../../protyle/protyle.types";
import type {OutlineEditorContext} from "./types";

/**
 * 作用：生成标题块的 HTML 结构。
 * 意图：用于在 DOM 中插入新的标题块时，构建符合 Protyle 规范的 HTML 字符串。
 * 调用时机：在插入新的同级或子级标题时调用。
 */
/** @同步豁免: UI构建 */
export const genHeadingHTML = (level: number, newId: string) => `<div data-subtype="h${level}" data-node-id="${newId}" data-type="NodeHeading" class="h${level}"><div contenteditable="true" spellcheck="false"><wbr></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;

/** 处理标题级别变换的响应 */
/** @同步豁免: DOM访问 */
export const 处理标题级别变换响应 = (editor: ProtyleDomain, responseData: { doOperations: IOperation[]; undoOperations: IOperation[] }) => {
    const protyle = editor.protyle;
    /**
     * 作用：确保编辑器处于所见即所得 (WYSIWYG) 模式。
     * 意图：后续 DOM 操作依赖于 WYSIWYG 元素。
     * 生效场景：Protyle 实例未初始化 WYSIWYG 组件时。
     */
    if (!protyle.wysiwyg) {
        return;
    }
    for (const op of responseData.doOperations) {
        const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`);
        for (const el of elements) {
            /**
             * 作用：确保遍历到的节点是 HTMLElement。
             * 意图：只有 HTMLElement 才有 outerHTML 属性，用于更新标题的 HTML 结构。
             * 生效场景：当查询到的节点是 HTMLElement 时，执行替换操作。
             */
            if (isHTMLElement(el)) {
                el.outerHTML = op.data;
            }
        }
        const newElements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${op.id}"]`);
        for (const el of newElements) {
            /**
             * 作用：确保遍历到的节点是 HTMLElement。
             * 意图：mathRender 函数仅接受 HTMLElement 类型的参数，需要排除非元素节点。
             * 生效场景：当查询到的节点是 HTMLElement 时，对其进行数学公式渲染。
             */
            if (isHTMLElement(el)) {
                mathRender(el);
            }
        }
    }
    const firstOp = responseData.doOperations[0];
    /**
     * 作用：聚焦到第一个受影响的元素。
     * 意图：提升用户体验，确保操作后视图滚动到变更位置。
     * 生效场景：当操作列表中存在至少一个操作时。
     */
    if (firstOp) {
        const focusEl = protyle.wysiwyg.element.querySelector(`[data-node-id="${firstOp.id}"]`);
        focusEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    editor.transaction(responseData.doOperations, responseData.undoOperations);
};

/** 创建插入同级标题后的响应处理器 */
/** @同步豁免: UI构建 */
export const 创建插入同级标题后处理器 = (
    获取Protyle和块元素: () => OutlineEditorContext | undefined,
    currentLevel: number
) => (response: IWebSocketData) => {
    const data = 获取Protyle和块元素();
    /**
     * 作用：验证上下文数据和响应数据的有效性。
     * 意图：确保存在 Protyle 实例、WebSocket 响应数据完整且操作类型符合预期，防止运行时错误。
     * 生效场景：当数据缺失、响应为空或操作类型校验失败时，提前返回。
     */
    if (!data || !data.protyle.wysiwyg || !response.data || !isOperations(response.data.doOperations)) {
        return;
    }
    const doOps = response.data.doOperations;
    const lastOp = doOps[doOps.length - 1];
    const previousID = lastOp.id;
    const newId = Lute.NewNodeID(), html = genHeadingHTML(currentLevel, newId);
    data.editor.transaction([{ action: "insert", data: html, id: newId, previousID }], [{ action: "delete", id: newId }]);
    const prevEl = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
    /**
     * 作用：确保前一个元素存在。
     * 意图：如果找不到参考的前一个元素，无法执行 insertAdjacentHTML。
     * 生效场景：previousID 对应的 DOM 元素未找到时。
     */
    if (!prevEl) {
        return;
    }
    prevEl.insertAdjacentHTML("afterend", html);
    const nextEl = prevEl.nextElementSibling;
    /**
     * 作用：如果插入成功并存在新元素，则聚焦它。
     * 意图：将光标移动到新插入的标题处，方便用户立即输入。
     * 生效场景：成功插入新标题元素后。
     */
    if (nextEl) {
        nextEl.scrollIntoView();
        focusByWbr(nextEl, document.createRange());
    }
};

/** 创建添加子标题的响应处理器 */
/** @同步豁免: UI构建 */
export const 创建添加子标题响应处理器 = (
    获取Protyle和块元素: () => OutlineEditorContext | undefined,
    currentLevel: number
) => (delResp: IWebSocketData) => {
    const doOps = delResp.data.doOperations;
    const lastDoOp = doOps[doOps.length - 1];
    let previousID = lastDoOp.id;

    const undoOps = delResp.data.undoOperations;
    const idx = undoOps.findIndex((op: IOperation) => {
        const si = op.data.indexOf(' data-subtype="h');
        return si > -1 && si < 260 && parseInt(op.data.substring(si + 16, si + 17), 10) === currentLevel + 1;
    });
    /**
     * 作用：调整新标题的插入位置。
     * 意图：如果在撤销操作中发现了当前级别的子标题（用于恢复），则将新标题插入到该子标题之前。
     *       这样可以确保新添加的子标题位于父标题之后、第一个现有子标题之前（作为第一个子标题）。
     * 生效场景：undoOperations 中包含子标题信息时（idx > -1）。
     */
    if (idx > -1) {
        const targetOp = undoOps[idx - 1];
        previousID = targetOp.id;
    }
    const data = 获取Protyle和块元素();
    /**
     * 作用：确保获取到了有效的上下文数据。
     * 意图：如果无法获取 Protyle 或 WYSIWYG 组件，则无法执行 DOM 操作。
     * 生效场景：环境数据缺失时。
     */
    if (!data || !data.protyle.wysiwyg) {
        return;
    }
    const newId = Lute.NewNodeID(), html = genHeadingHTML(currentLevel + 1, newId);
    data.editor.transaction([{ action: "insert", data: html, id: newId, previousID }], [{ action: "delete", id: newId }]);
    const prevEl = data.protyle.wysiwyg.element.querySelector(`[data-node-id="${previousID}"]`);
    if (!prevEl) {
        return;
    }
    prevEl.insertAdjacentHTML("afterend", html);
    const nextEl = prevEl.nextElementSibling;
    /**
     * 作用：聚焦新插入的元素。
     * 意图：提升用户体验，操作后直接聚焦。
     * 生效场景：插入操作成功且 nextElementSibling 存在时。
     */
    if (nextEl) {
        nextEl.scrollIntoView();
        focusByWbr(nextEl, document.createRange());
    }
};

/**
 * 作用：处理创建子文档后的响应。
 * 意图：当 "API createDocWithMd" 成功返回后，构建并执行事务：在原位置插入引用并移动原块到新文档。
 * 调用时机：在 executeSubDocCreateAndMove 中的 fetchPost 回调中调用。
 */
const handleCreateDocWithMdResponse = (
    editor: ProtyleDomain,
    ids: string[],
    name: string,
    blockElement: HTMLElement,
    response: IWebSocketData
) => {
    const protyle = editor.protyle;
    const newDocID = response.data;

    // 3. 构建 Transaction：插入引用 + 移动块
    const doOperations: IOperation[] = [];

    // 在原位置插入引用
    // Ref 格式: ((id 'text'))
    const refHTML = `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="false"><span>((${newDocID} '${name}'))</span><wbr></div><div class="protyle-attr" contenteditable="false"></div></div>`;

    doOperations.push({
        action: "insert",
        data: refHTML,
        id: Lute.NewNodeID(),
        previousID: blockElement.previousElementSibling?.getAttribute("data-node-id") || undefined,
        parentID: blockElement.parentElement?.getAttribute("data-node-id") || protyle.block.parentID
    });

    // 移动块到新文档
    for (const itemId of ids) {
        doOperations.push({
            action: "move",
            id: itemId,
            parentID: newDocID
        });
    }
    editor.transaction(doOperations);
};

/**
 * 作用：执行子文档创建及块移动的事务操作。
 * 意图：将核心逻辑提取为独立函数，复用且避免嵌套函数定义。
 */
const executeSubDocCreateAndMove = (
    editor: ProtyleDomain,
    ids: string[],
    newPath: string,
    name: string,
    blockElement: HTMLElement
) => {
    const protyle = editor.protyle;
    fetchPost("/api/filetree/createDocWithMd", {
        notebook: protyle.notebookId,
        path: newPath, // 已经是完整路径
        parentID: protyle.block.rootID,
        markdown: ""
    }, (response) => handleCreateDocWithMdResponse(editor, ids, name, blockElement, response));
};

/**
 * 作用：将指定块转换为子文档。
 * 意图：实现"转换为子文档"功能，创建新文档并移动原来的块。
 * 调用时机：用户在菜单确认后调用。
 */
export const convertBlockToSubDocument = async (editor: ProtyleDomain, blockElement: HTMLElement) => {
    const protyle = editor.protyle;
    const id = blockElement.getAttribute("data-node-id");
    if (!id) {
        return;
    }

    const isHeading = blockElement.getAttribute("data-type") === "NodeHeading";

    if (isHeading) {
        fetchPost("/api/filetree/heading2Doc", {
            targetNoteBook: protyle.notebookId,
            srcHeadingID: id,
            targetPath: protyle.path,
            pushMode: 0,
        });
        return;
    }

    const name = replaceFileName(blockElement.textContent?.trim()) || "Untitled";

    // 1. 获取当前文档的 HPath
    fetchPost("/api/filetree/getHPathByPath", {
        notebook: protyle.notebookId,
        path: protyle.path
    }, (response) => {
        const parentHPath = response.data;
        const newPath = pathPosix().join(parentHPath, name);
        executeSubDocCreateAndMove(editor, [id], newPath, name, blockElement);
    });
};
