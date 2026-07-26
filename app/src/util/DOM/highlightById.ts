/** 用途：规范化历史滚动参数；使用范围：本文件公开 API 在进入主流程前统一调用；解耦评估：参数兼容逻辑和高亮定位强耦合，放在专用 helper 内最清晰。 */
import { normalizeScrollPosition } from "./helpers/highlightById";
/** 用途：按块 ID 查找实际高亮目标；使用范围：`highlightById` 主流程；解耦评估：DOM 查找与过滤逻辑属于定位实现细节，抽到 helper 便于控制文件体积。 */
import { findHighlightTarget } from "./helpers/highlightById";
/** 用途：从当前编辑器选区回退到块元素；使用范围：`scrollCenter` 在未显式传入目标节点时调用；解耦评估：该逻辑和选区/Protyle 结构强耦合，保留在同模块 helper 更合适。 */
import { resolveCurrentBlockElement } from "./helpers/highlightById";
/** 用途：优先按当前 Selection 滚动；使用范围：`scrollCenter` 的首个分支；解耦评估：选区滚动依赖多段内部 helper，拆出后主文件更易读。 */
import { scrollCurrentSelection } from "./helpers/highlightById";
/** 用途：按滚动模式把目标块带入可视区；使用范围：`scrollCenter` 在确定最终目标元素后调用；解耦评估：纯滚动实现细节抽到 helper 更利于复用和减小主文件体积。 */
import { scrollNodeIntoView } from "./helpers/highlightById";

/**
 * 为目标元素添加短时高亮类，帮助前进后退或搜索定位后快速辨认当前块。
 * 调用时机：`highlightById` 找到匹配块或标题后同步调用。
 * 问题/改进：当前仍使用定时器移除类名，后续如样式层改为动画事件可去掉时间依赖。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const bgFade = (element: Element) => {
    element.classList.add("protyle-wysiwyg--hl");
    /* 使用固定延时是为了沿用现有高亮闪烁时长，避免改动现有视觉反馈节奏。 */
    setTimeout(() => element.classList.remove("protyle-wysiwyg--hl"), 1024);
};

/**
 * 按块 ID 查找并高亮目标块，供搜索跳转、历史回退和编辑器切换等流程复用。
 * 调用时机：搜索结果点击、编辑器切换、前进后退定位时同步调用。
 * 问题/改进：当前标题高亮与普通块高亮共用同一入口，如后续差异扩大可再拆分。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const highlightById = (
    protyle: IProtyle,
    id: string,
    position: ScrollLogicalPosition | boolean = "nearest"
) => {
    const nodeElement = findHighlightTarget(protyle, id);
    const hasNodeElement = !!nodeElement;
    if (hasNodeElement) {
        scrollCenter(protyle, nodeElement, position);
        bgFade(nodeElement);
        return nodeElement;
    }
    if(!protyle.options.render) {
        throw new Error("highlightById: protyle.options.render 未定义，无法判断是否可高亮标题。");
    }
    if(!protyle.title || !protyle.title.editElement) {
        throw new Error("highlightById: protyle.title.editElement 未定义，无法高亮标题。");
    }
    const shouldHighlightTitle = id === protyle.block.rootID && protyle.options.render.title && !!protyle.title.editElement;
    if (!shouldHighlightTitle) {
        return undefined;
    }
    bgFade(protyle.title.editElement);
    return protyle.title.editElement;
};

/**
 * 把当前块、当前选区或显式传入的节点滚动到可见区域，统一处理编辑器内部多种滚动场景。
 * 调用时机：高亮定位、选区恢复、上传/粘贴后回到光标位置等流程都会调用。
 * 问题/改进：函数承担了多种历史兼容分支，但现在只保留编排职责，复杂细节已下沉到 helper。
 * @同步豁免: 需要绝对同步的DOM访问
 * 该遗留公开 API 被大量编辑器调用，保留原参数顺序以避免改变既有调用语义。
 */
export const scrollCenter =
/** @参数豁免: 遗留代码 - 保持现有公开滚动 API 与全部调用点兼容。 */
(
    protyle: IProtyle,
    nodeElement?: Element,
    position: ScrollLogicalPosition | boolean = "nearest",
    behavior: ScrollBehavior = "auto"
) => {
    const scrollPosition = normalizeScrollPosition(position);
    const handledCurrentSelection = !protyle.disabled && !nodeElement
        ? scrollCurrentSelection(protyle, scrollPosition, behavior)
        : false;
    if (handledCurrentSelection) {
        return;
    }
    const explicitNodeElement = nodeElement instanceof HTMLElement ? nodeElement : undefined;
    const targetElement = explicitNodeElement || resolveCurrentBlockElement(protyle);
    const hasTargetElement = !!targetElement;
    if (!hasTargetElement) {
        return;
    }
    scrollNodeIntoView(protyle, targetElement, {block: scrollPosition, behavior});
};
