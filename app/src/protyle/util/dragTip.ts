// 拖拽时跟随鼠标的自定义双区提示框：上半=操作对象名称，下半=操作文案
// 通过 .drag-tip 类做全局单例，在编辑器和文档树两处 dragover 共用

/**
 * 用途：提供 DragTipState 类型定义，将该类型的声明与实现分离，
 *       使 dragTip.ts 专注于运行时逻辑而非类型声明
 * 使用范围：仅在 dragTip.ts 内部使用，不对外暴露
 * 解耦评估：纯 type import，编译期擦除，无运行时依赖
 */
import {type DragTipState} from "./dragTip.types";
/**
 * 用途：判断当前运行环境是否为移动端，移动端不显示拖拽提示框以避免遮挡内容
 * 使用范围：仅在 showDragTip 入口处使用
 * 解耦评估：通过 import 直接引用 platform 模块，耦合可接受；
 *           如果未来需支持运行时可配置平台检测策略，可通过依赖注入替换
 */
import {isMobile} from "./imports";

/** Base64 透明 1x1 PNG 图片数据，用于设置拖拽时的光标图片 */
export const transparentImgSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const dragTipState: DragTipState = {
    rafId: 0,
    title: "",
    action: "",
    position: { x: 0, y: 0 },
    element: null,
    titleElement: null,
    actionElement: null,
    lastTitle: "",
    lastAction: "",
};

/**
 * 在指定父元素下查询匹配选择器的 HTMLElement
 * 使用 instanceof 守卫替代 as 断言以满足 lint 约束
 */
const queryHTMLElement = (parent: HTMLElement, selector: string) => {
    const el = parent.querySelector(selector);
    return el instanceof HTMLElement ? el : null;
};

/** 初始化或复用 .drag-tip 元素，将其挂载到 document.body */
const initDragTipElement = () => {
    // 优先复用已有的 .drag-tip（跨编辑器/文档树区域时避免重复创建）
    const existing = document.querySelector(".drag-tip");
    // 检查已有元素是否存在且为 HTMLElement，避免 querySelector 返回非 Element 类型
    if (existing instanceof HTMLElement) {
        dragTipState.element = existing;
        dragTipState.titleElement = queryHTMLElement(existing, ".drag-tip__title");
        dragTipState.actionElement = queryHTMLElement(existing, ".drag-tip__action");
        return;
    }
    // 新建拖拽提示元素
    dragTipState.element = document.createElement("div");
    dragTipState.element.className = "tooltip drag-tip";
    // 拖拽提示需即时显示，覆盖 .tooltip 默认的 300ms 出现动画
    dragTipState.element.style.animation = "none";
    dragTipState.element.style.pointerEvents = "none";
    dragTipState.element.style.zIndex = "1000000";
    dragTipState.element.style.fontSize = "14px";
    dragTipState.element.style.lineHeight = "20px";
    // 锚定到视口原点，再由 transform 定位（transform 走 GPU 合成，不触发 layout）
    dragTipState.element.style.top = "0";
    dragTipState.element.style.left = "0";
    dragTipState.titleElement = document.createElement("div");
    dragTipState.titleElement.className = "drag-tip__title";
    dragTipState.titleElement.style.cssText = "max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--b3-tooltips-color);";
    dragTipState.actionElement = document.createElement("div");
    dragTipState.actionElement.className = "drag-tip__action";
    dragTipState.actionElement.style.cssText = "color:var(--b3-tooltips-second-color);font-size:12px;";
    dragTipState.element.append(dragTipState.titleElement, dragTipState.actionElement);
    document.body.append(dragTipState.element);
};

/**
 * RAF 回调：将 state 中的文案和坐标写入 DOM
 * 仅在 showDragTip 调度时执行，避免高频 dragover 下逐次写 DOM
 */
const renderDragTip = () => {
    dragTipState.rafId = 0;
    let element = dragTipState.element;
    let titleElement = dragTipState.titleElement;
    let actionElement = dragTipState.actionElement;
    // 元素尚未创建或已被移除出文档流时重新初始化
    if (!element || !element.isConnected) {
        initDragTipElement();
        element = dragTipState.element;
        titleElement = dragTipState.titleElement;
        actionElement = dragTipState.actionElement;
        dragTipState.lastTitle = "";
        dragTipState.lastAction = "";
    }
    // 初始化失败时静默跳过（如 document 尚未就绪）
    if (!element || !titleElement || !actionElement) {
        return;
    }
    // 名称/文案变化才写 textContent，减少 DOM 写入
    if (dragTipState.lastTitle !== dragTipState.title) {
        titleElement.textContent = dragTipState.title;
        dragTipState.lastTitle = dragTipState.title;
        // 名称为空时隐藏上半行
        titleElement.style.display = dragTipState.title ? "" : "none";
    }
    // 操作文案变化时才写入
    if (dragTipState.lastAction !== dragTipState.action) {
        actionElement.textContent = dragTipState.action;
        dragTipState.lastAction = dragTipState.action;
    }
    // 固定偏移到光标右下方，不读取 offsetHeight 以免触发同步布局造成卡顿
    element.style.transform = `translate(${dragTipState.position.x + 16}px, ${dragTipState.position.y + 16}px)`;
};

/**
 * 显示拖拽提示框
 * @同步豁免: UI构建 — 该函数仅在 dragover 事件处理中同步调用，
 *             将数据写入 state 后通过 requestAnimationFrame 异步渲染，
 *             但函数本身仅做同步赋值，不包含异步操作，
 *             转为 async 会不必要地改变调用点签名
 */
export const showDragTip = (title: string, action: string, position: { x: number; y: number }) => {
    if (isMobile) {
        return;
    }
    dragTipState.title = title;
    dragTipState.action = action;
    dragTipState.position = position;
    // 合并到下一帧渲染，避免高频 dragover 下逐次写 DOM 造成卡顿
    if (!dragTipState.rafId) {
        dragTipState.rafId = requestAnimationFrame(renderDragTip);
    }
};

// Alt 拖拽插入引用时的行级竖线指示
let caretLineElement: HTMLElement | null = null;

/**
 * 显示拖拽插入引用的行级竖线
 * @同步豁免: UI构建 — 需要同步读取并设置 DOM 元素的位置样式，
 *             转为 async 会导致竖线位置落后一帧，产生视觉闪烁
 */
export const showCaretLine = (left: number, top: number, height: number) => {
    if (!caretLineElement) {
        caretLineElement = document.createElement("div");
        caretLineElement.style.cssText = "position:fixed;width:2px;background-color:var(--b3-theme-primary-light);z-index:1000000;pointer-events:none;border-radius:var(--b3-border-radius);";
        document.body.append(caretLineElement);
    }
    caretLineElement.style.left = left + "px";
    caretLineElement.style.top = top + "px";
    caretLineElement.style.height = height + "px";
    caretLineElement.style.display = "";
};

/**
 * 隐藏并销毁行级竖线元素
 * @同步豁免: 生命周期 — 资源清理操作，转为 async 无意义且可能延迟内存释放
 */
export const hideCaretLine = () => {
    caretLineElement?.remove();
    caretLineElement = null;
};

/**
 * 隐藏并销毁拖拽提示框及其所有子元素
 * @同步豁免: 生命周期 — 资源清理操作，转为 async 无意义且可能延迟内存释放
 */
export const hideDragTip = () => {
    if (dragTipState.rafId) {
        cancelAnimationFrame(dragTipState.rafId);
        dragTipState.rafId = 0;
    }
    dragTipState.element?.remove();
    dragTipState.element = null;
    dragTipState.titleElement = null;
    dragTipState.actionElement = null;
    dragTipState.lastTitle = "";
    dragTipState.lastAction = "";
    hideCaretLine();
};
