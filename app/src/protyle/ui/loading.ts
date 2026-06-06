/** 用途：全局常量配置。使用范围：加载动画定时器 TIMEOUT_LOAD 值。解耦评估：通过目录 imports.ts 转发，符合架构规范。 */
import { Constants } from "./imports";

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
 * @AIDONE 使用 AbortController 实现确定性的 loading 显示/隐藏控制。
 *         当 removeLoading 被调用时，会立即中止待执行的定时器，
 *         避免竞态条件和不必要的 DOM 操作。
 *
 * @AIDONE 将 AbortController 存储在 Protyle 实例的 loadingController 属性上，
 *         而非使用模块级别的 WeakMap 注册表。这样数据与实例绑定，
 *         生命周期自动管理，符合项目规范。
 *
 * @param protyle - Protyle 实例
 * @param msg - 可选的加载提示信息，显示在加载图标下方
 */
 /** @同步豁免: UI构建 - 加载动画的添加和移除需要在 UI 线程同步执行，异步化会导致动画闪烁或延迟。 */
export const addLoading = (protyle: IProtyle, msg?: string) => {
    // 取消之前可能存在的待执行 loading（处理快速连续调用的场景）
    if (protyle.loadingController) {
        protyle.loadingController.abort();
    }

    // 创建新的 AbortController 用于本次 loading，并存储在 Protyle 实例上
    const controller = new AbortController();
    protyle.loadingController = controller;

    // @内联回调 简单的 loading 延时显示
    setTimeout(() => {
        // 使用 signal.aborted 检查是否已被取消（由 removeLoading 触发）
        if (!controller.signal.aborted) {
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
 * @作用 从 Protyle 编辑器区域移除加载指示器，并通过 AbortController 取消待执行的 loading 显示。
 *       这种确定性的取消机制比之前的 data-loading 属性检查更可靠。
 *
 * @意图 当耗时操作完成后，隐藏加载指示器，让用户可以正常操作编辑器。
 *       同时确保不会有延迟的 loading 动画在操作完成后才显示出来。
 *
 * @调用时机
 *   - 文档内容加载完成后
 *   - 渲染操作完成后
 *   - 与 addLoading 成对使用，在操作结束时调用
 *
 * @param protyle - Protyle 实例
 */
/** @同步豁免: UI构建 - 移除加载动画是同步 DOM 操作，异步化会与其他 UI 操作产生竞态。 */
export const removeLoading = (protyle: IProtyle) => {
    // 取消待执行的 loading 显示定时器
    if (protyle.loadingController) {
        protyle.loadingController.abort();
        protyle.loadingController = undefined;
    }

    // 移除已显示的 loading 元素
    const loadingElements = protyle.element.querySelectorAll(".wysiwygLoading");
    for (const item of Array.from(loadingElements)) {
        item.remove();
    }
};
