/**
 * Gutter 拖拽操作辅助模块
 *
 * 作用：处理 gutter 或反链面板拖拽到编辑器的所有操作
 * 意图：从 onDrop 主函数中提取 gutter 拖拽逻辑，降低主函数复杂度
 * 调用时机：当 dataTransfer 包含 SIYUAN_DROP_GUTTER 类型时
 */
import {
    hasClosestByAttribute,
    isInEmbedBlock,
} from "../hasClosest";
import { insertEmptyBlock } from "../../../block/util";
import { focusByRange, getRangeByPoint } from "../selection";
import { fetchSyncPost } from "../../../util/network/fetch";
import { insertHTML } from "../insertHTML";
import { blockRender } from "../../render/blockRender";
import { dragSame, dragSb } from "./drag";
import {
    expandListBlockSources,
    handleLiGapDrop,
    handleListItemChildDrop,
    isListSourceType,
    resolveListTarget,
    shouldSkipListSourceDrop,
} from "./onDrop.helper.list";
import { getDragElement, getWorkspaceDir } from "./onDrop.environment";

/**
 * 在拖拽落点位置设置焦点
 *
 * 作用：根据鼠标坐标判断是否在编辑器底部之下，若是则插入空块，否则聚焦到落点
 * 意图：alt/shift 拖拽和文件树拖拽都需要先定位焦点，提取为共享函数
 * 调用时机：alt/shift 键拖拽时，在插入引用/嵌入块之前
 *
 * @param protyle 编辑器实例
 * @param event 拖拽事件
 * @returns 'embed' 表示落点在嵌入块内（应中止），'ok' 表示焦点已设置
 */
export const focusAtDropPoint = async (
    protyle: IProtyle,
    event: DragEvent & { target: HTMLElement },
): Promise<"embed" | "ok"> => {
    const lastChild = protyle.wysiwyg?.element.lastElementChild;
    // 落点在编辑器最后一个块的底部之下时，追加空块而非定位到已有块
    if (event.y > (lastChild?.getBoundingClientRect().bottom ?? 0)) {
        insertEmptyBlock(protyle, "afterend", lastChild?.getAttribute("data-node-id") ?? "");
        return "ok";
    }
    const range = getRangeByPoint(event.clientX, event.clientY);
    // range 为 null 说明落点不在可编辑区域，视为嵌入块场景中止操作
    if (!range) {
        return "embed";
    }
    // 嵌入块内不允许拖拽插入
    if (hasClosestByAttribute(range.startContainer, "data-type", "NodeBlockQueryEmbed")) {
        return "embed";
    }
    focusByRange(range);
    return "ok";
};

/**
 * Alt 键拖拽：将选中块作为引用插入到落点
 *
 * 作用：遍历选中的块 ID，获取引用文本后生成引用 DOM 并插入
 * 意图：alt+拖拽是创建块引用的快捷方式
 * 调用时机：gutter 拖拽且 event.altKey 为 true 时
 *
 * @param protyle 编辑器实例
 * @param selectedIds 被拖拽的块 ID 列表
 */
export const insertAsRef = async (
    protyle: IProtyle,
    selectedIds: string[],
): Promise<void> => {
    // 引用 DOM 必须由当前编辑器的 Lute 生成，缺失时终止并暴露初始化错误。
    if (!protyle.lute) {
        throw new Error("Cannot insert block references before Protyle Lute is initialized");
    }
    let markdown = "";
    for (let i = 0; i < selectedIds.length; i++) {
        if (selectedIds.length > 1) {
            markdown += "- ";
        }
        const response = await fetchSyncPost("/api/block/getRefText", {id: selectedIds[i]});
        markdown += `((${selectedIds[i]} '${response.data}'))`;
        if (selectedIds.length > 1 && i !== selectedIds.length - 1) {
            markdown += "\n";
        }
    }
    insertHTML(protyle.lute.Md2BlockDOM(markdown), protyle);
};

/**
 * Shift 键拖拽：将选中块作为查询嵌入块插入到落点
 *
 * 作用：遍历选中的块 ID，生成 SQL 查询嵌入块并插入
 * 意图：shift+拖拽是创建嵌入块的快捷方式
 * 调用时机：gutter 拖拽且 event.shiftKey 为 true 时
 *
 * @param protyle 编辑器实例
 * @param selectedIds 被拖拽的块 ID 列表
 */
export const insertAsEmbed = async (
    protyle: IProtyle,
    selectedIds: string[],
): Promise<void> => {
    // 嵌入块需要 Lute 和编辑器 DOM，缺失时终止并暴露初始化错误。
    if (!protyle.lute || !protyle.wysiwyg) {
        throw new Error("Cannot insert embedded blocks before Protyle is initialized");
    }
    let html = "";
    for (const id of selectedIds) {
        html += `{{select * from blocks where id='${id}'}}\n`;
    }
    insertHTML(protyle.lute.SpinBlockDOM(html), protyle, true);
    blockRender(protyle, protyle.wysiwyg.element);
};

/**
 * 从拖拽源收集源元素列表
 *
 * 作用：根据选中的块 ID 构建查询选择器，从拖拽元素或跨窗口模板中收集非嵌入块元素
 * 意图：同窗口拖拽从 dragElement 查询，跨窗口拖拽从 dataTransfer 数据构建临时 DOM 查询
 * 调用时机：gutter 普通拖拽（非 alt/shift）且目标有 dragover 标记时
 *
 * @param selectedIds 被拖拽的块 ID 列表
 * @param gutterType 完整的 gutter 类型字符串（用于获取跨窗口 HTML 数据）
 * @param gutterTypes 解析后的 gutter 类型数组
 * @param event 拖拽事件
 * @returns 收集到的源元素列表
 */
export const collectSourceElements = async (
    selectedIds: string[],
    gutterType: string,
    gutterTypes: string[],
    event: DragEvent,
): Promise<Element[]> => {
    const result: Element[] = [];
    let queryClass = "";
    for (const item of selectedIds) {
        queryClass += `[data-node-id="${item}"],`;
    }
    const selector = queryClass.substring(0, queryClass.length - 1);
    const dragEl = getDragElement();

    // 同窗口拖拽：从拖拽源元素中查询匹配的块
    if (dragEl) {
        const matched = dragEl.querySelectorAll(selector);
        for (const el of matched) {
            // 嵌入块内的元素不参与拖拽
            if (!isInEmbedBlock(el)) {
                result.push(el);
            }
        }
        return result;
    }
    const workspaceDir = getWorkspaceDir();
    // 跨窗口拖拽：工作空间路径匹配时从 dataTransfer 数据构建临时 DOM
    // 不能跨工作区域拖拽 https://github.com/siyuan-note/siyuan/issues/13582
    if (workspaceDir.toLowerCase() !== (gutterTypes[3] ?? "")) {
        return result;
    }
    const tpl = document.createElement("template");
    tpl.innerHTML = `<div>${event.dataTransfer?.getData(gutterType) ?? ""}</div>`;
    const matched = tpl.content.querySelectorAll(selector);
    for (const el of matched) {
        // 嵌入块内的元素不参与拖拽
        if (!isInEmbedBlock(el)) {
            result.push(el);
        }
    }
    return result;
};

/**
 * 清理源元素并构建操作所需的 ID 和 srcs 数据
 *
 * 作用：移除源元素的高亮/选中标记和搜索标记，收集 nodeId 并构建 IOperationSrcs
 * 意图：gutter 拖拽到 AV 或普通块时都需要此数据，提取为共享函数
 * 调用时机：collectSourceElements 之后，执行实际拖拽操作之前
 *
 * @param sourceElements 源元素列表
 * @returns sourceIds 和 srcs 数组
 */
export const prepareSourceData = async (
    sourceElements: Element[],
): Promise<{ sourceIds: string[]; srcs: IOperationSrcs[] }> => {
    const sourceIds: string[] = [];
    const srcs: IOperationSrcs[] = [];
    for (const item of sourceElements) {
        item.classList.remove("protyle-wysiwyg--hl");
        item.removeAttribute("select-start");
        item.removeAttribute("select-end");
        // 反链提及有高亮标记，拖拽到正文时应移除
        const marks = item.querySelectorAll('[data-type="search-mark"]');
        for (const markItem of marks) {
            markItem.outerHTML = markItem.innerHTML;
        }
        const id = item.getAttribute("data-node-id") ?? "";
        sourceIds.push(id);
        srcs.push({
            itemID: Lute.NewNodeID(),
            id,
            isDetached: false,
        });
    }
    return { sourceIds, srcs };
};

/**
 * 处理普通块拖拽（非 AV 目标）
 *
 * 作用：根据目标是否在超级块内以及拖拽方向，调用 dragSame 或 dragSb
 * 意图：超级块列布局内的左右拖拽使用 dragSame，其他情况根据方向选择
 * 调用时机：gutter 拖拽目标不是 AV 元素且有源元素时
 *
 * @param protyle 编辑器实例
 * @param sourceElements 源元素列表
 * @param targetElement 拖拽目标元素
 * @param targetClass 目标元素的 CSS 类名列表
 * @param isCopy 是否使用复制语义（Ctrl 或 lite 模式）
 * @param editorElement 编辑器容器元素
 */
export const handleBlockDrag = async (
    protyle: IProtyle,
    sourceElements: Element[],
    targetElement: Element,
    targetClass: string[],
    isCopy: boolean,
    editorElement: HTMLElement,
    gutterTypes: string[],
): Promise<void> => {
    const isChild = targetClass.some(item => item.includes("--child"));
    const isBottom = targetClass.some(item => item.indexOf("dragover__bottom") === 0);
    const isHorizontal = targetClass.includes("dragover__left") || targetClass.includes("dragover__right");
    const isAfter = isBottom || targetClass.includes("dragover__right");
    const parentEl = targetElement.parentElement;
    const isSbCol = parentEl?.getAttribute("data-type") === "NodeSuperBlock"
        && parentEl?.getAttribute("data-sb-layout") === "col";
    const isListSource = isListSourceType(gutterTypes);
    const keepColumnListTarget = gutterTypes[0] === "nodelist" && isSbCol;
    const resolvedTarget = isListSource && targetElement.classList.contains("list") && !keepColumnListTarget
        ? resolveListTarget(targetElement, isBottom) || targetElement
        : targetElement;
    if (isListSource && shouldSkipListSourceDrop(
        sourceElements, resolvedTarget, isChild, isBottom, isCopy, editorElement,
    )) {
        return;
    }
    expandListBlockSources(sourceElements, resolvedTarget);
    const hasContentBlockSource = sourceElements.some(item =>
        !["NodeList", "NodeListItem"].includes(item.getAttribute("data-type") || ""));
    if (hasContentBlockSource && await handleLiGapDrop(
        protyle, sourceElements, resolvedTarget, targetClass, isChild, isBottom, isCopy,
    )) {
        return;
    }
    if (hasContentBlockSource && !isChild && resolvedTarget.getAttribute("data-type") === "NodeListItem") {
        return;
    }
    if (await handleListItemChildDrop(protyle, sourceElements, resolvedTarget, isChild, isBottom, isCopy)) {
        return;
    }

    await executeBlockMove(protyle, sourceElements, resolvedTarget, gutterTypes, {
        isAfter,
        isHorizontal,
        isSbCol,
        isCopy,
    });
    cleanupAfterBlockMove(protyle, editorElement);
};

const executeBlockMove = async (
    protyle: IProtyle,
    sourceElements: Element[],
    targetElement: Element,
    gutterTypes: string[],
    options: { isAfter: boolean; isHorizontal: boolean; isSbCol: boolean; isCopy: boolean },
): Promise<void> => {
    if (options.isSbCol && options.isHorizontal) {
        await dragSame(protyle, sourceElements, targetElement, options.isAfter, options.isCopy);
        return;
    }
    if (options.isSbCol) {
        await dragSb(protyle, sourceElements, targetElement, options.isAfter, "row", options.isCopy);
        return;
    }
    if (options.isHorizontal && gutterTypes[0] !== "nodelistitem") {
        await dragSb(protyle, sourceElements, targetElement, options.isAfter, "col", options.isCopy);
        return;
    }
    if (options.isHorizontal && targetElement.classList.contains("list")) {
        return;
    }
    await dragSame(protyle, sourceElements, targetElement, options.isAfter, options.isCopy);
};

const cleanupAfterBlockMove = (protyle: IProtyle, editorElement: HTMLElement): void => {
    const emptyItems = editorElement.querySelectorAll(".protyle-wysiwyg--empty");
    for (const item of emptyItems) {
        item.classList.remove("protyle-wysiwyg--empty");
    }
    const embedItems = protyle.wysiwyg?.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]');
    if (!embedItems) {
        return;
    }
    for (const item of embedItems) {
        item.removeAttribute("data-render");
        blockRender(protyle, item);
    }
};
