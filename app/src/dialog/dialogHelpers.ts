// ============================================================
// 对话框辅助函数 - 主导出文件
// ============================================================
// 本文件作为统一的导出点，从各个子模块重新导出所有函数
// 同时保留全屏相关的函数实现

/** 用途：全屏按钮状态更新函数。使用范围：对话框全屏模式切换。解耦评估：同目录模块直接导入。 */
import { 更新全屏按钮状态 } from "./dialogHelpers.html";

// ============================================================
// 全屏模式控制函数（本地实现）
// ============================================================

/**
 * @function 设置ResizeHandles显示状态
 * @zh-CN
 * @作用: 设置对话框调整大小手柄的显示或隐藏状态
 * @意图: 在全屏模式下隐藏调整大小手柄，在普通模式下显示
 * @调用时机: 在全屏状态切换时调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - DOM状态更新必须同步执行
 */
export function 设置ResizeHandles显示状态(container: Element, visible: boolean) {
    const resizeHandles = container.querySelectorAll("[class^='resize__']");
    for (const handle of resizeHandles) {
        // 仅在 HTMLElement 上设置样式，避免 querySelectorAll 返回的通用 Element 类型问题
        if (handle instanceof HTMLElement) {
            handle.style.display = visible ? "" : "none";
        }
    }
}

/**
 * @function 退出全屏模式
 * @zh-CN
 * @作用: 将对话框从全屏模式恢复到原始大小和位置
 * @意图: 提供全屏切换功能，恢复用户之前的窗口尺寸
 * @调用时机: 当用户点击退出全屏按钮或按 ESC 键时
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - DOM操作必须同步执行，否则全屏切换会因Promise而无法正确设置样式
 */
export function 退出全屏模式(
    container: HTMLElement,
    dialogElement: HTMLElement,
    originalSize: { width: string; height: string; left: string; top: string }
) {
    Object.assign(container.style, {
        width: originalSize.width,
        height: originalSize.height,
        left: originalSize.left,
        top: originalSize.top
    });

    container.style.maxWidth = "";
    container.style.maxHeight = "";
    container.style.borderRadius = "";

    dialogElement.classList.remove("b3-dialog--fullscreen");
    设置ResizeHandles显示状态(container, true);
    更新全屏按钮状态(dialogElement, false);
}

/**
 * @function 进入全屏模式
 * @zh-CN
 * @作用: 将对话框切换到全屏模式
 * @意图: 提供全屏显示功能，让对话框占据整个视窗
 * @调用时机: 当用户点击全屏按钮时
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - DOM操作必须同步执行
 */
export function 进入全屏模式(container: HTMLElement, dialogElement: HTMLElement) {
    Object.assign(container.style, {
        width: "100vw",
        height: "100vh",
        left: "0",
        top: "0",
        maxWidth: "100vw",
        maxHeight: "100vh",
        borderRadius: "0"
    });

    dialogElement.classList.add("b3-dialog--fullscreen");
    设置ResizeHandles显示状态(container, false);
    更新全屏按钮状态(dialogElement, true);
}
