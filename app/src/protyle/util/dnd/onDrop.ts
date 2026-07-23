/**
 * 拖拽放置主编排模块
 *
 * 作用：处理编辑器内所有拖拽放置事件的入口和路由
 * 意图：将具体拖拽逻辑委托给各辅助模块，主函数仅负责事件分类和路由
 * 调用时机：编辑器 drop 事件触发时
 */
import { Constants } from "../../../constants";
import { hasClosestByClassName } from "../hasClosest";
import {
    getDragElement,
    clearDragElement,
} from "./onDrop.environment";
import {
    handleAvViewTabSort,
    handleGutterDrop,
} from "./onDrop.helper.routing";
import {
    insertFileTreeAsRef,
    insertFileTreeToAv,
    convertDocToHeading,
    reloadDocAfterConvert,
} from "./onDrop.helper.fileTree";
import {
    handleExternalEditorDrop,
    handleExternalAvCellDrop,
} from "./onDrop.helper.external";
import { IDndState } from "./onDrop.types";
import { hideDragTip } from "../dragTip";
import {handleBlockReferenceDrop} from "./onDrop.helper.blockRef";

export type { IDndState };

/**
 * 处理文件树拖拽的完整流程
 *
 * 作用：根据修饰键和目标元素类型，路由到引用插入、AV 插入或文档转标题
 * 意图：文件树拖拽有三种目标场景，需要统一入口管理
 * 调用时机：dataTransfer 包含 SIYUAN_DROP_FILE 且格式合法时
 *
 * @param protyle 编辑器实例
 * @param event 拖拽事件
 * @param ids 文件树节点 ID 列表
 * @param targetElement 拖拽目标元素（可能为 null）
 */
const handleFileTreeDrop = async (
    protyle: IProtyle,
    event: DragEvent & { target: HTMLElement },
    ids: string[],
    targetElement: Element | null,
): Promise<void> => {
    const isAvTarget = targetElement
        && (targetElement.classList.contains("av__row")
            || targetElement.classList.contains("av__gallery-item")
            || targetElement.classList.contains("av__gallery-add"));

    // 非 altKey 且目标不是 AV 行/画廊：插入为引用链接
    if (!event.altKey && !isAvTarget) {
        await insertFileTreeAsRef(protyle, ids, event);
        return;
    }
    // 目标有 dragover 标记且非反链数据：处理 AV 插入或文档转标题
    if (!targetElement || protyle.options?.backlinkData
        || targetElement.className.indexOf("dragover__") === -1) {
        return;
    }
    const scrollTop = protyle.contentElement?.scrollTop ?? 0;
    const targetClass = targetElement.className.split(" ");

    // 目标是 AV 行/画廊：插入为 AV 块
    if (isAvTarget) {
        await insertFileTreeToAv(protyle, ids, targetElement, targetClass);
    }
    // 目标是普通块：文档转标题
    if (!isAvTarget) {
        const isBottom = targetClass.includes("dragover__bottom");
        await convertDocToHeading(ids, targetElement, isBottom);
        await reloadDocAfterConvert(protyle, scrollTop);
    }
    targetElement.classList.remove(
        "dragover__bottom",
        "dragover__top",
        "dragover__left",
        "dragover__right",
        "dragover__bottom--sibling",
        "dragover__top--sibling",
        "dragover__bottom--child",
        "dragover__top--child"
    );
    (targetElement as HTMLElement).style.removeProperty("--drag-indent");
    (targetElement as HTMLElement).style.removeProperty("--drag-guides");
    (targetElement as HTMLElement).style.removeProperty("--drag-line-left");
    (targetElement as HTMLElement).style.removeProperty("--drag-base-bg");
    (targetElement as HTMLElement).style.removeProperty("--drag-line-bg");
};

/**
 * 处理外部文件/HTML 拖拽
 *
 * 作用：根据目标是否在 AV 内，路由到编辑器拖拽或 AV 单元格拖拽
 * 意图：外部拖拽只有两种目标场景，统一入口简化主函数
 * 调用时机：无 dragElement 且 dataTransfer 类型为 Files 或 text/html 时
 *
 * @param protyle 编辑器实例
 * @param event 拖拽事件
 */
const handleExternalDrop = async (
    protyle: IProtyle,
    event: DragEvent & { target: HTMLElement },
): Promise<void> => {
    event.preventDefault();
    const avElement = hasClosestByClassName(event.target, "av");
    // 目标不在 AV 内：走编辑器拖拽逻辑
    if (!avElement) {
        await handleExternalEditorDrop(protyle, event);
        return;
    }
    // 目标在 AV 内：走 AV 单元格拖拽逻辑
    await handleExternalAvCellDrop(protyle, event, avElement);
};

/**
 * 从 dataTransfer 中查找 gutter 类型标识
 *
 * 作用：遍历 dataTransfer.types 查找以 SIYUAN_DROP_GUTTER 开头的类型
 * 意图：gutter 拖拽通过 dataTransfer 的 type 字段传递类型信息
 * 调用时机：onDrop 主函数中判断拖拽来源时
 *
 * @param dataTransfer 拖拽事件的 dataTransfer 对象
 * @returns gutter 类型字符串，未找到时返回空字符串
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步读取 dataTransfer */
const findGutterType = (dataTransfer: DataTransfer): string => {
    for (const type of dataTransfer.types) {
        // gutter 类型以特定前缀开头
        if (type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            return type;
        }
    }
    return "";
};

/**
 * 判断 gutter 类型是否为 AV ViewTab 排序
 *
 * 作用：检查 gutterType 是否匹配 ViewTab 排序的前缀模式
 * 意图：ViewTab 排序需要在清理 dragover 之前单独处理并提前返回
 * 调用时机：onDrop 主函数中 gutter 类型判断时
 *
 * @param gutterType gutter 类型字符串
 * @returns 是否为 ViewTab 排序类型
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 纯字符串比较，无异步需求 */
const isViewTabSort = (gutterType: string): boolean => {
    const prefix = `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}ViewTab${Constants.ZWSP}`;
    return gutterType.startsWith(prefix.toLowerCase());
};

/**
 * 清理拖拽目标元素的 dragover 状态
 *
 * 作用：移除目标元素上的 dragover 样式类和选区属性
 * 意图：拖拽结束后需要清理视觉状态，避免残留高亮
 * 调用时机：onDrop 主函数中 ViewTab 排序判断之后
 *
 * @param editorElement 编辑器容器元素
 * @returns 清理后的目标元素，未找到时返回 null
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽清理必须同步执行 */
const cleanupDragoverTarget = (editorElement: HTMLElement): Element | null => {
    const targetElement = editorElement.querySelector(
        ".dragover__left, .dragover__right, .dragover__bottom, .dragover__top, " +
        ".dragover__bottom--sibling, .dragover__top--sibling, .dragover__bottom--child, .dragover__top--child",
    );
    if (!targetElement) {
        return null;
    }
    targetElement.classList.remove("dragover");
    targetElement.removeAttribute("select-start");
    targetElement.removeAttribute("select-end");
    return targetElement;
};

/**
 * 拖拽放置事件主入口
 *
 * 作用：接收编辑器 drop 事件，根据 dataTransfer 类型分发到对应处理函数
 * 意图：作为唯一入口统一管理所有拖拽场景的路由和清理
 * 调用时机：编辑器 editorElement 的 drop 事件监听器
 *
 * @param protyle 编辑器实例
 * @param editorElement 编辑器容器元素
 * @param event 拖拽事件（target 已断言为 HTMLElement）
 * @param state 拖拽状态（计数器、dragover 元素等）
 */
export const onDrop = async (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent & { target: HTMLElement },
    state: IDndState,
): Promise<void> => {
    state.counter = 0;
    hideDragTip();
    window.siyuan.dragTitle = "";
    // dataTransfer 不存在时无法处理
    if (!event.dataTransfer) {
        return;
    }
    // 只读模式或编辑器内选中文字拖拽：阻止默认行为后返回
    if (protyle.disabled || event.dataTransfer.getData(Constants.SIYUAN_DROP_EDITOR)) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    if (await handleBlockReferenceDrop(protyle, editorElement, event)) {
        clearDragElement();
        return;
    }
    const gutterType = findGutterType(event.dataTransfer);

    // AV ViewTab 排序：独立处理后直接返回（原始逻辑不清理 dragElement）
    if (isViewTabSort(gutterType)) {
        await handleAvViewTabSort(protyle, gutterType);
        return;
    }
    const targetElement = cleanupDragoverTarget(editorElement);

    // gutter 拖拽（块拖拽/反链面板拖拽）
    if (gutterType) {
        await handleGutterDrop(protyle, editorElement, event, gutterType, targetElement, state);
        clearDragElement();
        return;
    }
    // 文件树拖拽数据：从 dataTransfer 中获取文件 ID 列表
    const fileData = event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE) ?? "";
    // 合法的文件树 ID 至少包含一个 '-'（如 "20210808180117-6v0mkxr"），不含 '-' 说明数据无效
    if (fileData.split("-").length > 1) {
        const ids = fileData.split(",");
        await handleFileTreeDrop(protyle, event, ids, targetElement);
        clearDragElement();
        return;
    }
    // 外部文件/HTML 拖拽：无 dragElement 且类型为 Files 或 text/html
    if (!getDragElement()
        && (event.dataTransfer.types.includes("Files")
            || event.dataTransfer.types.includes("text/html"))) {
        await handleExternalDrop(protyle, event);
    }
    clearDragElement();
};
