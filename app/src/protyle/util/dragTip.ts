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
/**
 * 用途：SForge Symbol 键，用于以类型安全的方式存取全局注册表中的拖拽提示状态和行级竖线元素引用
 * 使用范围：getDragTipState / getCaretLineElement 惰性初始化函数中作为 Symbol 键参数
 * 解耦评估：全局注册表是架构核心基础设施，通过 imports.ts 统一转发已解耦；
 *           如需替换注册表实现，仅需修改 imports.ts 中的来源，dragTip.ts 无需改动
 */
import {SForgeSymbols} from "./imports";
/**
 * 用途：从 SForge 全局注册表读取拖拽提示框状态对象
 * 使用范围：getDragTipState / getCaretLineElement 惰性初始化函数中读取全局状态
 * 解耦评估：全局注册表是架构核心基础设施，通过 imports.ts 统一转发已解耦；
 *           如改为依赖注入方式，需将 dragTipState 作为参数传入所有 export 函数，
 *           但当前调用点（编辑器/文档树的 dragover 事件）无法提供此上下文，
 *           注入成本高于直接使用注册表带来的耦合成本
 */
import {getSForgeState} from "./imports";
/**
 * 用途：将拖拽提示框状态或行级竖线元素引用写入 SForge 全局注册表
 * 使用范围：惰性初始化首次创建状态对象时 / showCaretLine 创建竖线元素时 / hideCaretLine 销毁时
 * 解耦评估：与 getSForgeState 对称，全局注册表是架构核心基础设施，
 *           当前调用模式为单例状态管理，注册表方式相比模块级变量
 *           的优势在于可测试性（支持状态重置）和 HMR 兼容性
 */
import {setSForgeState} from "./imports";
/**
 * 用途：运行时类型守卫，用于将 getSForgeState 返回的联合类型收窄为 DragTipState
 * 使用范围：仅在 getDragTipState 惰性初始化函数中调用
 * 解耦评估：守卫函数是纯逻辑设施，在 dragTip.guard.ts 中定义不引入循环依赖；
 *           如果将守卫逻辑内联到 dragTip.ts 会触发"禁止使用 is 关键字" lint 规则，
 *           因此必须拆分到独立的 .guard.ts 文件中
 */
import {isDragTipState} from "./dragTip.guard";
/**
 * 用途：运行时类型守卫，用于将 getSForgeState 返回的联合类型收窄为 HTMLElement | null
 * 使用范围：仅在 getCaretLineElement 惰性初始化函数中调用
 * 解耦评估：与 isDragTipState 同理，守卫是纯逻辑设施，
 *           拆分到 dragTip.guard.ts 即可同时满足禁止 is 关键字和禁止 as 断言两条 lint 规则
 */
import {isHTMLElementOrNull} from "./dragTip.guard";

/** Base64 透明 1x1 PNG 图片数据，用于设置拖拽时的光标图片 */
export const transparentImgSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * 获取拖拽提示框状态（惰性初始化）
 * 通过 SForge 全局注册表管理，避免模块级 const 可变状态违反 lint 约束
 * @显式返回类型原因: 需要与 SForge 注册表类型守卫配合，确保返回类型稳定
 */
function getDragTipState(): DragTipState {
    const raw = getSForgeState(SForgeSymbols.DRAG_TIP_STATE);
    if (isDragTipState(raw)) {
        return raw;
    }
    const state: DragTipState = {
        rafId: 0,
        title: "",
        action: "",
        position: { x: 0, y: 0 },
        element: null,
        titleElement: null,
        actionElement: null,
        lastTitle: "",
        lastAction: "",
        // 提示框当前渲染尺寸，定位计算依赖真实测量值而非估算值
        width: 0,
        height: 0,
        // Alt 拖拽幽灵元素的几何信息，null 表示当前拖拽未启用幽灵跟随
        ghost: null,
    };
    setSForgeState(SForgeSymbols.DRAG_TIP_STATE, state);
    return state;
}

/**
 * 在指定父元素下查询匹配选择器的 HTMLElement
 * 使用 instanceof 守卫替代 as 断言以满足 lint 约束
 */
const queryHTMLElement = (parent: HTMLElement, selector: string) => {
    const el = parent.querySelector(selector);
    return el instanceof HTMLElement ? el : null;
};

/**
 * 计算提示框的视口坐标
 * 无幽灵时悬浮于光标上方并留出 pointerOffset 间距；
 * 有幽灵时对齐幽灵元素左上角并留出 gap 间距，使提示框紧贴被拖拽元素
 */
const getDragTipPosition = (state: DragTipState) => {
    const gap = 8;
    const pointerOffset = 16;
    if (!state.ghost) {
        return {
            left: state.position.x,
            top: state.position.y - state.height - pointerOffset
        };
    }

    const ghostLeft = state.position.x - state.ghost.offsetX;
    const ghostTop = state.position.y - state.ghost.offsetY;
    return {
        left: ghostLeft,
        top: ghostTop - state.height - gap
    };
};

/** 初始化或复用 .drag-tip 元素，将其挂载到 document.body */
const initDragTipElement = () => {
    const state = getDragTipState();
    // 优先复用已有的 .drag-tip（跨编辑器/文档树区域时避免重复创建）
    const existing = document.querySelector(".drag-tip");
    // 检查已有元素是否存在且为 HTMLElement，避免 querySelector 返回非 Element 类型
    if (existing instanceof HTMLElement) {
        state.element = existing;
        state.titleElement = queryHTMLElement(existing, ".drag-tip__title");
        state.actionElement = queryHTMLElement(existing, ".drag-tip__action");
        return;
    }
    // 新建拖拽提示元素
    state.element = document.createElement("div");
    state.element.className = "tooltip drag-tip";
    // 拖拽提示需即时显示，覆盖 .tooltip 默认的 300ms 出现动画
    state.element.style.animation = "none";
    state.element.style.pointerEvents = "none";
    state.element.style.zIndex = "1000000";
    state.element.style.fontSize = "14px";
    state.element.style.lineHeight = "20px";
    // 锚定到视口原点，再由 transform 定位（transform 走 GPU 合成，不触发 layout）
    state.element.style.top = "0";
    state.element.style.left = "0";
    state.titleElement = document.createElement("div");
    state.titleElement.className = "drag-tip__title";
    state.titleElement.style.cssText = "max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--b3-tooltips-color);";
    state.actionElement = document.createElement("div");
    state.actionElement.className = "drag-tip__action";
    state.actionElement.style.cssText = "color:var(--b3-tooltips-second-color);font-size:12px;";
    state.element.append(state.titleElement, state.actionElement);
    document.body.append(state.element);
};

/**
 * RAF 回调：将 state 中的文案和坐标写入 DOM
 * 仅在 showDragTip 调度时执行，避免高频 dragover 下逐次写 DOM
 */
const renderDragTip = () => {
    const state = getDragTipState();
    state.rafId = 0;
    let updateSize = false;
    let element = state.element;
    let titleElement = state.titleElement;
    let actionElement = state.actionElement;
    // 元素尚未创建或已被移除出文档流时重新初始化
    if (!element || !element.isConnected) {
        initDragTipElement();
        element = state.element;
        titleElement = state.titleElement;
        actionElement = state.actionElement;
        state.lastTitle = "";
        state.lastAction = "";
        updateSize = true;
    }
    // 初始化失败时静默跳过（如 document 尚未就绪）
    if (!element || !titleElement || !actionElement) {
        return;
    }
    // 名称/文案变化才写 textContent，减少 DOM 写入
    if (state.lastTitle !== state.title) {
        titleElement.textContent = state.title;
        state.lastTitle = state.title;
        // 名称为空时隐藏上半行
        titleElement.style.display = state.title ? "" : "none";
        updateSize = true;
    }
    // 操作文案变化时才写入
    if (state.lastAction !== state.action) {
        actionElement.textContent = state.action;
        state.lastAction = state.action;
        updateSize = true;
    }
    // 内容或元素发生变化时重新测量尺寸，保证上方偏移基于真实高度
    if (updateSize) {
        const rect = element.getBoundingClientRect();
        state.width = rect.width;
        state.height = rect.height;
    }
    const position = getDragTipPosition(state);
    element.style.transform = `translate(${position.left}px, ${position.top}px)`;
};

/**
 * 记录 Alt 拖拽幽灵元素的几何信息
 * offsetX / offsetY 为光标相对幽灵元素左上角的偏移，用于让提示框跟随幽灵而非光标
 */
export const setDragTipGhost = (element: HTMLElement, offsetX: number, offsetY: number) => {
    const state = getDragTipState();
    const rect = element.getBoundingClientRect();
    state.ghost = {
        width: rect.width,
        height: rect.height,
        offsetX,
        offsetY
    };
};

/** 清除幽灵元素几何信息，恢复提示框默认的光标上方定位方式 */
export const clearDragTipGhost = () => {
    getDragTipState().ghost = null;
};

/**
 * 显示拖拽提示框
 * @同步豁免: UI构建 — 该函数仅在 dragover 事件处理中同步调用，
 *             将数据写入 state 后通过 requestAnimationFrame 异步渲染，
 *             但函数本身仅做同步赋值，不包含异步操作，
 *             转为 async 会不必要地改变调用点签名
 * position 支持两种形态：{ x, y } 坐标对象，或 x、y 两个数值参数
 */
export const showDragTip = (title: string, action: string, position: { x: number; y: number } | number, y?: number) => {
    if (isMobile) {
        return;
    }
    const state = getDragTipState();
    state.title = title;
    state.action = action;
    state.position = typeof position === "number" ? { x: position, y: y ?? 0 } : position;
    // 合并到下一帧渲染，避免高频 dragover 下逐次写 DOM 造成卡顿
    if (!state.rafId) {
        state.rafId = requestAnimationFrame(renderDragTip);
    }
};

/**
 * 获取行级竖线元素引用（惰性初始化）
 * 通过 SForge 全局注册表管理，避免模块级 let 可变状态违反 lint 约束
 * @显式返回类型原因: 需要与 SForge 注册表类型守卫配合，确保返回类型稳定
 */
function getCaretLineElement(): HTMLElement | null {
    const raw = getSForgeState(SForgeSymbols.CARET_LINE_ELEMENT);
    if (isHTMLElementOrNull(raw)) {
        return raw;
    }
    return null;
}

/**
 * 设置行级竖线元素引用
 * @柯里化 固定 SForgeSymbols.CARET_LINE_ELEMENT 键，避免在 showCaretLine / hideCaretLine
 *           两处调用点重复书写 Symbol 键名，降低后续重命名时的遗漏风险
 */
const setCaretLineElement = (el: HTMLElement | null) => {
    setSForgeState(SForgeSymbols.CARET_LINE_ELEMENT, el);
};

/**
 * 显示拖拽插入引用的行级竖线
 * @同步豁免: UI构建 — 需要同步读取并设置 DOM 元素的位置样式，
 *             转为 async 会导致竖线位置落后一帧，产生视觉闪烁
 */
export const showCaretLine = (left: number, top: number, height: number) => {
    let el = getCaretLineElement();
    if (!el) {
        el = document.createElement("div");
        el.style.cssText = "position:fixed;width:2px;background-color:var(--b3-theme-primary-light);z-index:1000000;pointer-events:none;border-radius:var(--b3-border-radius);";
        document.body.append(el);
        setCaretLineElement(el);
    }
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.height = height + "px";
    el.style.display = "";
};

/**
 * 隐藏并销毁行级竖线元素
 * @同步豁免: 生命周期 — 资源清理操作，转为 async 无意义且可能延迟内存释放
 */
export const hideCaretLine = () => {
    getCaretLineElement()?.remove();
    setCaretLineElement(null);
};

/**
 * 隐藏并销毁拖拽提示框及其所有子元素
 * @同步豁免: 生命周期 — 资源清理操作，转为 async 无意义且可能延迟内存释放
 */
export const hideDragTip = () => {
    const state = getDragTipState();
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
    }
    state.element?.remove();
    state.element = null;
    state.titleElement = null;
    state.actionElement = null;
    state.lastTitle = "";
    state.lastAction = "";
    state.width = 0;
    state.height = 0;
    state.ghost = null;
    hideCaretLine();
};
