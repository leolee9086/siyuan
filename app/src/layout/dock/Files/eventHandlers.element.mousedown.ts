/**
 * Files 组件 element 的事件处理器（mousedown 事件）
 * @module eventHandlers.element.mousedown
 */

import { Constants } from "../../../constants";
import { openFileById } from "../../../editor/utils.openFileById";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isStylableElement } from "./eventHandlers.guard";
import type { App } from "../../../index";
import type { Files } from "../Files";

/**
 * element 的 mousedown 事件处理函数（鼠标滚轮点击打开文件）
 * @param event - 鼠标事件
 * @param files - Files 实例
 * @param app - App 实例
 */
function onElementMousedown(event: MouseEvent, files: Files, app: App): void {
    // 检查是否为鼠标中键点击
    if (event.button !== 1) {
        return;
    }
    // 检查是否启用了使用当前标签页打开
    if (!getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
        return;
    }

    // 使用类型守卫获取事件目标（支持 SVG 图标元素）
    if (!isStylableElement(event.target)) {
        return;
    }
    let target: HTMLElement | SVGElement | null = event.target;

    while (target && !target.isEqualNode(files.element)) {
        // 检查是否为 LI 元素且未在打开中
        if (target.tagName === "LI" && target.getAttribute("data-node-id") && !target.getAttribute("data-opening")) {
            target.setAttribute("data-opening", "true");
            const nodeId = target.getAttribute("data-node-id") ?? "";
            openFileById({
                app: app,
                removeCurrentTab: false,
                id: nodeId,
                action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
                afterOpen: target.removeAttribute.bind(target, "data-opening")
            });
            event.stopPropagation();
            event.preventDefault();
            break;
        }
        target = target.parentElement;
    }
}

/**
 * 创建 element 的 mousedown 事件处理器
 * @param files - Files 实例
 * @param app - App 实例
 * @returns 事件处理函数
 */
function createElementMousedownHandler(
    files: Files,
    app: App
): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
        onElementMousedown(event, files, app);
    };
}

/**
 * 设置 element 的 mousedown 事件处理（鼠标滚轮点击打开文件）
 * @param files - Files 实例
 * @param app - App 实例
 * @同步豁免: UI构建
 */
export function setupElementMousedownHandler(files: Files, app: App): void {
    const handler = createElementMousedownHandler(files, app);
    files.element.addEventListener("mousedown", handler);
}
