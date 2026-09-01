/** 用途：统一持久化定位视图；使用范围：完成阶段；解耦评估：直达定位状态真实所有者。 */
import {persistAVLocateView} from "./imports";
/** 用途：目标缺失消息；使用范围：完成失败；解耦评估：经本阶段网关直达唯一实现。 */
import {showMessage} from "./imports";
/** 用途：清除单元格选择；使用范围：表格定位；解耦评估：经本阶段网关直达唯一实现。 */
import {clearSelect} from "./imports";
/** 用途：添加拖拽填充柄；使用范围：表格定位；解耦评估：经本阶段网关直达唯一实现。 */
import {addDragFill} from "./imports";
/** 用途：居中滚动明确目标；使用范围：定位完成；解耦评估：经本阶段网关直达纯 DOM 唯一实现。 */
import {scrollTargetIntoView} from "./imports";
/** 用途：统一定位状态；使用范围：请求、高亮和清理；解耦评估：直达状态真实所有者。 */
import {clearAVLocateRequest} from "./imports";
/** 用途：读取统一定位状态；使用范围：高亮呈现；解耦评估：经本阶段网关直达状态所有者。 */
import {getAVLocateRegistry} from "./imports";
/** 用途：读取当前定位请求；使用范围：完成呈现；解耦评估：经本阶段网关直达状态所有者。 */
import {getAVLocateRequest} from "./imports";
/** 用途：清除旧高亮；使用范围：新高亮前；解耦评估：经本阶段网关直达状态所有者。 */
import {clearLocatedHighlight} from "./imports";
/** 用途：完整定位请求；使用范围：完成阶段；解耦评估：纯类型直达领域声明。 */
import type {AVLocateHighlightFrame} from "../locate.types";
/** 用途：高亮状态；使用范围：timer 生命周期；解耦评估：同领域纯类型声明。 */
import type {AVLocateHighlightState} from "../locate.types";
/** 用途：完整呈现上下文；使用范围：完成阶段内部函数；解耦评估：同领域纯类型声明。 */
import type {AVLocatePresentationContext} from "../locate.types";
/** 用途：完整定位请求；使用范围：目标选择与清理；解耦评估：同领域纯类型声明。 */
import type {IAVLocateRequest} from "../locate.types";

/** 清除一帧高亮的 DOM 和注册状态。 */
const clearLocatedHighlightFrame = (frame: AVLocateHighlightFrame, highlightState: AVLocateHighlightState) => {
    const {blockElement} = frame.context;
    const registry = getAVLocateRegistry();
    highlightState.element.classList.remove(highlightState.className);
    const currentState = registry.highlightStates.get(blockElement);
    // map 仍指向本 timer 时清理对应状态。
    if (currentState?.timer === highlightState.timer) {
        registry.highlightStates.delete(blockElement);
        registry.activeHighlights.delete(currentState);
    }
    // token 仍属于本次高亮时才清除，避免影响新定位。
    if (registry.highlightTokens.get(blockElement) === frame.token) {
        registry.highlightTokens.delete(blockElement);
    }
};

/** 在浏览器绘制帧中解析重渲染后的最终目标节点。 */
const renderLocatedHighlight = (frame: AVLocateHighlightFrame) => {
    const {context, groupQuery, token} = frame;
    const {blockElement, protyle, data, request} = context;
    const registry = getAVLocateRegistry();
    const className = data.viewType === "table" ? "av__row--locate" : "av__gallery-item--locate";
    const targetQuery = data.viewType === "table" ? `.av__row[data-id="${request.itemID}"]` : `.av__gallery-item[data-id="${request.itemID}"]`;
    // DOM 已卸载或 token 已被新定位替换时丢弃旧动画帧。
    if (!blockElement.isConnected || registry.highlightTokens.get(blockElement) !== token) {
        return;
    }
    const groupElement = blockElement.querySelector(groupQuery);
    const targetElement = groupElement?.querySelector(targetQuery);
    // 目标可能在动画帧前被重渲染移除，此时结束本次高亮。
    if (!(targetElement instanceof HTMLElement)) {
        registry.highlightTokens.delete(blockElement);
        return;
    }
    for (const item of blockElement.querySelectorAll(`.${className}`)) {
        item.classList.remove(className);
    }
    // 表格定位同步清除编辑器内其它块与行高亮，卡片视图无需此步骤。
    if (data.viewType === "table") {
        for (const item of protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--hl, .av__row--hl")) {
            item.classList.remove("protyle-wysiwyg--hl", "av__row--hl");
        }
    }
    targetElement.classList.add(className);
    const highlightState: AVLocateHighlightState = {element: targetElement, className, timer: 0};
    // 高亮保持 1024ms，完成函数接收完整帧和状态，不捕获局部闭包。
    highlightState.timer = window.setTimeout(clearLocatedHighlightFrame, 1024, frame, highlightState);
    registry.highlightStates.set(blockElement, highlightState);
    registry.activeHighlights.add(highlightState);
};

/** 在目标周围显示短时定位高亮，并以 token 隔离旧动画。 */
const highlightLocatedItem = (context: AVLocatePresentationContext, groupQuery: string) => {
    clearLocatedHighlight(context.blockElement);
    const registry = getAVLocateRegistry();
    const token = Symbol();
    registry.highlightTokens.set(context.blockElement, token);
    const frame: AVLocateHighlightFrame = {context, groupQuery, token};
    requestAnimationFrame(renderLocatedHighlight.bind(undefined, frame));
};

/** 按表格语义选择目标块单元格。 */
const selectLocatedTableTarget = (context: AVLocatePresentationContext, bodyElement: HTMLElement) => {
    const {blockElement, request} = context;
    const rowElement = bodyElement?.querySelector(`.av__row[data-id="${request.itemID}"]`);
    const targetElement = rowElement?.querySelector(".av__cell[data-dtype=\"block\"]");
    // 允许选择时同步单元格选择态和拖拽填充柄。
    if (targetElement instanceof HTMLElement && request.select !== false) {
        clearSelect(["cell"], blockElement);
        targetElement.classList.add("av__cell--select");
        addDragFill(targetElement);
    }
    return targetElement instanceof HTMLElement ? targetElement : undefined;
};

/** 展开目标分组并按视图语义选择目标元素。 */
const selectLocatedTarget = (context: AVLocatePresentationContext, groupQuery: string) => {
    const {blockElement, data, request} = context;
    const bodyElement = blockElement.querySelector(groupQuery);
    if (!(bodyElement instanceof HTMLElement)) {
        return;
    }
    // 分组 body 在定位时必须展开，否则目标虽存在但不可见。
    if (bodyElement.classList.contains("fn__none")) {
        bodyElement.classList.remove("fn__none");
        const previousElement = bodyElement.previousElementSibling;
        const foldIcon = previousElement?.querySelector("[data-type=\"av-group-fold\"] svg");
        foldIcon?.classList.add("av__group-arrow--open");
    }
    // 表格定位选择块列单元格，卡片与看板走卡片选择语义。
    if (data.viewType === "table") {
        return selectLocatedTableTarget(context, bodyElement);
    }
    const targetElement = bodyElement.querySelector(`.av__gallery-item[data-id="${request.itemID}"]`);
    // 非高亮卡片定位才保留持久选择，高亮模式只显示短时视觉标记。
    if (targetElement instanceof HTMLElement && request.select !== false && !request.highlight) {
        for (const item of blockElement.querySelectorAll(".av__gallery-item--select")) {
            item.classList.remove("av__gallery-item--select");
        }
        targetElement.classList.add("av__gallery-item--select");
    }
    return targetElement instanceof HTMLElement ? targetElement : undefined;
};

/** 将目标滚动到当前视图可见区域，保留表格首行和看板横向定位特例。 */
const scrollLocatedTarget = (context: AVLocatePresentationContext, targetElement: HTMLElement) => {
    const {blockElement, protyle, data} = context;
    // 未分组表格首行按编辑器内容区定位，避免居中导致顶部留白。
    if (data.viewType === "table" && data.target.index === 0 && !data.target.groupID) {
        const contentRect = protyle.contentElement.getBoundingClientRect();
        protyle.contentElement.scrollTop += blockElement.getBoundingClientRect().top - contentRect.top;
    }
    // 其余目标使用统一居中滚动逻辑。
    if (data.viewType !== "table" || data.target.index !== 0 || data.target.groupID) {
        scrollTargetIntoView(protyle.contentElement, targetElement, {position: "center", behavior: "auto"});
    }
    // 只有看板需要额外校正横向滚动。
    if (data.viewType !== "kanban") {
        return;
    }
    const kanbanElement = blockElement.querySelector(".av__kanban");
    if (!(kanbanElement instanceof HTMLElement)) {
        return;
    }
    const kanbanRect = kanbanElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    // 目标超出看板横向可视范围时滚动到中央。
    if (targetRect.left < kanbanRect.left || targetRect.right > kanbanRect.right) {
        kanbanElement.scrollLeft += targetRect.left + targetRect.width / 2 - (kanbanRect.left + kanbanRect.width / 2);
    }
};

/** 清除缺失目标并在本请求尚未报告时显示消息。 */
const reportMissingTarget = (blockElement: HTMLElement, request: IAVLocateRequest) => {
    clearAVLocateRequest(blockElement, request);
    if (!request.messageShown) {
        showMessage(window.siyuan.languages.databaseItemNotFound);
    }
};

/** 完成定位的视图持久化、选择、滚动和高亮生命周期。 @同步豁免: 需要绝对同步的DOM访问 - 选择与滚动必须作用于本次渲染 DOM。 */
export const finishAVLocate = (blockElement: HTMLElement, protyle: IProtyle, data: IAV) => {
    const request = getAVLocateRequest(blockElement);
    if (!request) {
        return;
    }
    // 响应目标与当前请求不一致时结束旧请求，禁止应用过期结果。
    if (!data.target || data.target.itemID !== request.itemID) {
        clearAVLocateRequest(blockElement, request);
        return;
    }
    const context: AVLocatePresentationContext = {blockElement, protyle, data, request};
    if (!blockElement.isConnected) {
        clearAVLocateRequest(blockElement, request);
        return;
    }
    if (persistAVLocateView(blockElement, protyle, data)) {
        return;
    }
    // 非可见目标已在准备阶段报告原因，完成阶段只负责清理请求。
    if (data.target.status !== "visible") {
        clearAVLocateRequest(blockElement, request);
        return;
    }
    const groupQuery = data.target.groupID ? `.av__body[data-group-id="${data.target.groupID}"]` : ".av__body";
    const targetElement = selectLocatedTarget(context, groupQuery);
    if (!targetElement) {
        reportMissingTarget(blockElement, request);
        return;
    }
    scrollLocatedTarget(context, targetElement);
    if (request.highlight) {
        highlightLocatedItem(context, groupQuery);
    }
    clearAVLocateRequest(blockElement, request);
};
