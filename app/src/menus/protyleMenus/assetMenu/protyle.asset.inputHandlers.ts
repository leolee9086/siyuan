/**
 * 用途：恢复编辑器工具栏选区焦点
 * 使用范围：资源菜单取消（Escape）时恢复编辑态
 * 解耦评估：通过 imports.ts 转发，编辑器焦点能力与事件处理逻辑解耦
 */
import { focusToolbarRange } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：确认资源后关闭菜单
 * 解耦评估：通过 imports.ts 转发，菜单系统依赖入口统一
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：处理上下方向键高亮移动
 * 使用范围：列表键盘导航
 * 解耦评估：通过 imports.ts 转发，导航逻辑复用且与业务解耦
 */
import { upDownHint } from "./imports";
/**
 * 用途：渲染预览图片
 * 使用范围：上下键切换高亮项时更新预览图
 * 解耦评估：通过 imports.ts 转发，渲染能力与输入事件处理解耦
 */
import { renderAssetsPreview } from "./imports";
/**
 * 用途：约束键盘导航、确认和取消共享的完整菜单上下文。
 * 使用范围：本文件所有键盘生命周期处理函数。
 */
import type {AssetMenuKeyboardContext} from "./imports";

/**
 * 处理 Enter 键事件。
 */
const 处理Enter键 = (
    context: AssetMenuKeyboardContext,
    event: KeyboardEvent
) => {
    const {element, protyle, destination} = context;
    const isEmpty = element.querySelector(".b3-list--empty");

    // 列表为空时，如果没有回调，则关闭菜单并聚焦。
    if (isEmpty && destination.kind === "editor") {
        getSiyuanGlobalMenus().menu.remove();
        focusToolbarRange(protyle);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 列表为空时，由调用方接管的选择模式不做任何事。
    if (isEmpty) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    const currentElement = element.querySelector(".b3-list-item--focus");
    if (!currentElement) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    const dataValue = currentElement.getAttribute("data-value") ?? "";
    const textContent = currentElement.textContent ?? "";

    destination.select(dataValue, textContent);
    // 编辑器模式由菜单完成插入后的收尾；回调模式的宿主自行决定何时关闭。
    if (destination.kind === "editor") {
        getSiyuanGlobalMenus().menu.remove();
    }
    event.preventDefault();
    event.stopPropagation();
};

/**
 * 处理 Escape 键事件。
 */
const 处理Escape键 = (protyle: IProtyle, destination: AssetMenuKeyboardContext["destination"]) => {
    if (destination.kind === "callback") {
        return;
    }
    focusToolbarRange(protyle);
};

/**
 * 创建键盘事件处理器。
 * @同步豁免: UI构建 - 键盘事件必须同步处理，才能保证焦点、预览和菜单状态一致。
 */
export const 创建键盘事件处理器 = (
    context: AssetMenuKeyboardContext
) => (event: KeyboardEvent) => {
    const {element, listElement, previewElement, protyle, destination} = context;
    if (event.isComposing) {
        return;
    }

    const isEmpty = element.querySelector(".b3-list--empty");
    const currentElement = !isEmpty ? upDownHint(listElement, event) : null;
    if (currentElement) {
        const dataValue = currentElement.getAttribute("data-value") ?? "";
        previewElement.innerHTML = renderAssetsPreview(dataValue);
        event.stopPropagation();
    }

    // Enter 触发确认选择逻辑，优先处理回调和默认插入行为。
    if (event.key === "Enter") {
        处理Enter键(context, event);
        return;
    }

    // Escape 触发取消逻辑，在无回调场景下恢复编辑焦点。
    if (event.key === "Escape") {
        处理Escape键(protyle, destination);
    }
};

/**
 * 创建 input 事件处理器。
 * @同步豁免: UI构建 - 输入过程中需同步触发列表刷新，保证搜索反馈实时性。
 */
export const 创建输入事件处理器 = (renderList: () => void) => (event: Event) => {
    const isComposingInput = event instanceof InputEvent && event.isComposing;
    if (isComposingInput) {
        return;
    }
    event.stopPropagation();
    renderList();
};

/**
 * 创建 compositionend 事件处理器。
 * @同步豁免: UI构建 - 输入法提交后需同步刷新列表，避免候选确认与结果列表不同步。
 */
export const 创建组合结束处理器 = (renderList: () => void) => (event: Event) => {
    event.stopPropagation();
    renderList();
};
