/** 用途：读取块引用拖放协议常量。使用范围：本 helper。解耦评估：经 DnD 细粒度依赖入口复用。 */
import {Constants} from "./imports";
/** 用途：解析块引用载荷。使用范围：drop 路由。解耦评估：经 DnD 入口复用共享纯函数。 */
import {parseBlockReferenceDropData} from "./imports";
/** 用途：排除嵌入块落点。使用范围：光标指示。解耦评估：经 DnD 入口复用无状态 DOM 查询。 */
import {hasClosestByAttribute} from "./imports";
/** 用途：排除数据库目标。使用范围：dragover/drop 路由。解耦评估：经 DnD 入口复用无状态 DOM 查询。 */
import {hasClosestByClassName} from "./imports";
/** 用途：定位鼠标 Range。使用范围：光标指示。解耦评估：经 DnD 入口复用 Selection 算法。 */
import {getRangeByPoint} from "./imports";
/** 用途：隐藏插入光标。使用范围：光标指示。解耦评估：经 DnD 入口复用统一提示运行时。 */
import {hideCaretLine} from "./imports";
/** 用途：隐藏动作提示。使用范围：dragover。解耦评估：经 DnD 入口复用统一提示运行时。 */
import {hideDragTip} from "./imports";
/** 用途：显示插入光标。使用范围：光标指示。解耦评估：经 DnD 入口复用统一提示运行时。 */
import {showCaretLine} from "./imports";
/** 用途：显示引用动作提示。使用范围：dragover。解耦评估：经 DnD 入口复用统一提示运行时。 */
import {showDragTip} from "./imports";
/** 用途：清理旧拖拽指示。使用范围：块引用拖放生命周期。解耦评估：同目录唯一清理实现。 */
import {cleanupDragIndicators} from "./util";
/** 用途：校验载荷工作空间。使用范围：drop。解耦评估：同目录环境访问器避免直接读取全局配置。 */
import {getWorkspaceDir} from "./onDrop.environment";
/** 用途：聚焦块引用落点。使用范围：drop。解耦评估：复用 gutter 已有落点语义。 */
import {focusAtDropPoint} from "./onDrop.helper.gutter";
/** 用途：插入块引用。使用范围：drop。解耦评估：复用 gutter 已有引用生成链。 */
import {insertAsRef} from "./onDrop.helper.gutter";

/** 在文档末尾块上标记水平插入位置。 */
const markDocumentEndDrop = (lastElement: Element) => {
    if (!lastElement.hasAttribute("data-node-id")) {
        return;
    }
    lastElement.classList.add("dragover__bottom");
};

/** 渲染块引用拖放的精确光标或文档末尾插入线。 */
/** @同步豁免: 需要绝对同步的DOM访问 - dragover 帧内必须立即更新 Range 指示，异步会造成视觉滞后。 */
export const renderBlockReferenceDropIndicator = (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent,
) => {
    cleanupDragIndicators(editorElement);
    hideCaretLine();
    for (const item of editorElement.querySelectorAll<HTMLElement>("[select-start], [select-end]")) {
        item.removeAttribute("select-start");
        item.removeAttribute("select-end");
    }
    const lastElement = protyle.wysiwyg.element.lastElementChild;
    if (!lastElement) {
        hideCaretLine();
        event.preventDefault();
        return;
    }
    // 鼠标落在最后一个块之后时使用水平块插入线。
    if (event.y > lastElement.getBoundingClientRect().bottom) {
        hideCaretLine();
        markDocumentEndDrop(lastElement);
        event.preventDefault();
        return;
    }
    const range = getRangeByPoint(event.clientX, event.clientY);
    // 无有效 Range 或落在嵌入块镜像时不绘制文本插入线。
    if (!range || hasClosestByAttribute(range.startContainer, "data-type", "NodeBlockQueryEmbed")) {
        event.preventDefault();
        return;
    }
    const rect = range.getBoundingClientRect();
    // 零高度 Range 没有可见插入位置。
    if (rect.height > 0) {
        showCaretLine(rect.left, rect.top, rect.height);
    }
    event.preventDefault();
};

/** 处理书签等组件发出的显式块引用 dragover，并阻断数据库目标。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 浏览器要求在 dragover 回调内同步设置 dropEffect 和 preventDefault。 */
export const handleBlockReferenceDragover = (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent & {target: HTMLElement},
) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !dataTransfer.types.includes(Constants.SIYUAN_DROP_BLOCK_REF)) {
        return false;
    }
    // 数据库不接受显式块引用，必须在 dragover 阶段展示禁止状态。
    if (hasClosestByClassName(event.target, "av")) {
        event.preventDefault();
        dataTransfer.dropEffect = "none";
        hideDragTip();
        cleanupDragIndicators(editorElement);
        return true;
    }
    dataTransfer.dropEffect = "copy";
    showDragTip(window.siyuan.dragTitle || "", window.siyuan.languages.dragTipRef, event.clientX, event.clientY);
    renderBlockReferenceDropIndicator(protyle, editorElement, event);
    return true;
};

/** 消费显式块引用 drop；载荷错误会记录并结束该次拖放，不进入其它路由。 */
export const handleBlockReferenceDrop = async (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent & {target: HTMLElement},
) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !dataTransfer.types.includes(Constants.SIYUAN_DROP_BLOCK_REF)) {
        return false;
    }
    event.preventDefault();
    event.stopPropagation();
    let ids: string[];
    try {
        ids = parseBlockReferenceDropData(
            dataTransfer.getData(Constants.SIYUAN_DROP_BLOCK_REF),
            getWorkspaceDir(),
        );
    } catch (error) {
        console.warn("parse block reference drop data failed", error);
        cleanupDragIndicators(editorElement);
        return true;
    }
    // 跨工作空间、无有效 ID 或数据库目标均消费事件但不写入。
    if (ids.length === 0 || hasClosestByClassName(event.target, "av")) {
        cleanupDragIndicators(editorElement);
        return true;
    }
    // 嵌入块镜像不是稳定写入位置。
    if (await focusAtDropPoint(protyle, event) === "embed") {
        cleanupDragIndicators(editorElement);
        return true;
    }
    await insertAsRef(protyle, ids);
    cleanupDragIndicators(editorElement);
    return true;
};
