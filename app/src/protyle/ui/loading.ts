import { Constants } from "../../constants";

/**
 * 在编辑器上显示加载动画。
 *
 * @作用 在 Protyle 编辑器区域显示一个带有旋转图标的加载指示器，
 *       可选地显示加载提示信息。使用延时显示策略，避免快速加载时出现闪烁。
 *
 * @意图 在执行耗时操作（如加载文档内容、重新渲染等）时，给用户视觉反馈，
 *       让用户知道系统正在处理中，提升用户体验。
 *
 * @调用时机
 *   - Protyle 初始化时（initUI）
 *   - 文档重新加载时（reload）
 *   - 搜索结果预览加载时
 *   - 移动端编辑器切换文档时
 *   - 面包屑操作（如聚焦到某个块）时
 *   - WebSocket 收到 addLoading 指令时
 *   - 闪卡学习界面加载时
 *
 * @问题/改进
 *   - 当前使用内联样式，可考虑提取为 CSS 类以便统一管理
 *   - 延时时间使用 Constants.TIMEOUT_LOAD，如果需要不同场景使用不同延时，
 *     可以考虑将延时作为参数传入
 *
 * @param protyle - Protyle 实例
 * @param msg - 可选的加载提示信息，显示在加载图标下方
 */
export const addLoading = (protyle: IProtyle, msg?: string) => {
    protyle.element.removeAttribute("data-loading");
    // @内联回调 简单的 loading 延时显示
    setTimeout(() => {
        if (protyle.element.getAttribute("data-loading") !== "finished") {
            protyle.element.insertAdjacentHTML("beforeend", `<div style="background-color: var(--b3-theme-background);flex-direction: column;" class="fn__loading wysiwygLoading">
    <img width="48px" src="/stage/loading-pure.svg">
    <div style="color: var(--b3-theme-on-surface);margin-top: 8px;">${msg || ""}</div>
</div>`);
        }
    }, Constants.TIMEOUT_LOAD);
};

/**
 * 移除编辑器上的加载动画。
 *
 * @作用 从 Protyle 编辑器区域移除加载指示器，并标记加载已完成。
 *       通过设置 data-loading="finished" 属性，阻止延时中的 addLoading 再显示加载动画。
 *
 * @意图 当耗时操作完成后，隐藏加载指示器，让用户可以正常操作编辑器。
 *
 * @调用时机
 *   - 文档内容加载完成后
 *   - 渲染操作完成后
 *   - 与 addLoading 成对使用，在操作结束时调用
 *
 * @param protyle - Protyle 实例
 */
export const removeLoading = (protyle: IProtyle) => {
    protyle.element.setAttribute("data-loading", "finished");
    const loadingElements = protyle.element.querySelectorAll(".wysiwygLoading");
    for (const item of Array.from(loadingElements)) {
        item.remove();
    }
};
