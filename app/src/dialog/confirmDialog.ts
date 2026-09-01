/**
 * 用途：判断当前确认对话框是否运行在移动端，以便选择更合适的弹窗宽度。
 * 使用范围：仅用于本文件在创建确认对话框时决定宽度，不参与按钮事件或业务回调逻辑。
 * 解耦评估：平台判断属于环境基础能力，理论上可由调用方预先传入，但当前 [`confirmDialog()`](app/src/dialog/confirmDialog.ts:67) 已承担 UI 构建职责，继续通过同目录网关导入比向所有调用点扩散平台参数更稳妥。
 */
import { isMobile } from "./imports";
/**
 * 用途：提供确认对话框所依赖的 [`Dialog`](app/src/dialog/index.ts:24) 基础组件。
 * 使用范围：仅用于本文件实例化确认对话框并注册点击事件，不负责更高层的业务确认流程。
 * 解耦评估：[`confirmDialog()`](app/src/dialog/confirmDialog.ts:91) 本身就是对 [`Dialog`](app/src/dialog/index.ts:24) 的轻量封装，短期内不适合再通过依赖注入拆散；这里直接依赖同目录基础组件即可，无需通过外部依赖网关转发内部模块。
 */
import { Dialog } from "./index";
/**
 * 用途：提供确认对话框写入 `data-key` 所需的对话框常量，避免在本文件硬编码标识值。
 * 使用范围：仅用于本文件在对话框 DOM 上设置确认框标记，供对话框管理流程识别。
 * 解耦评估：常量属于跨模块共享契约，不能再用新的硬编码替代；当前通过同目录网关导入可降低路径耦合，若未来抽出更明确的 dialog 常量域，可只调整网关实现。
 */
import { Constants } from "./imports";
/**
 * 用途：提供确认框按钮文案所需的国际化文本。
 * 使用范围：仅用于本文件渲染取消、确认/删除按钮标签，不负责业务侧消息内容生成。
 * 解耦评估：国际化环境读取属于运行时基础设施，理论上可由调用方直接传入完整文案，但当前大多数调用方只传标题与正文；保留在组件层通过同目录网关读取能减少重复拼接与参数负担。
 */
import { siyuanI18n } from "./imports";

/**
 * 创建对话框点击事件处理器。
 *
 * 作用：生成处理确认对话框点击及快捷键事件的闭包函数。
 * 意图：统一管理“确认”和“取消”操作的触发逻辑，并将对话框实例及回调函数封装，便于事件监听引用。
 * 调用时机：在 `confirmDialog` 初始化时，绑定到对话框元素的 `click` 事件。
 *
 * @param {Dialog} dialog - 对话框实例。
 * @param {(dialog?: Dialog) => void} [confirm] - 用户点击确认或按下 Enter 后的回调。
 * @param {(dialog: Dialog) => void} [cancel] - 用户点击取消或按下 Escape 后的回调。
 * @returns {(event: MouseEvent) => void} 返回事件处理函数。
 */
const createDialogClickHandler = (
    dialog: Dialog,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void
) => (event: MouseEvent) => {
    const isDispatch = typeof event.detail === "string";
    // 对话框基础设施会把快捷键动作为字符串 detail 的 click 事件派发到容器上；当收到 Escape 时，需要复用统一取消逻辑而不是再单独监听一套键盘分支。
    if (isDispatch && event.detail === "Escape") {
        cancel?.(dialog);
        dialog.destroy();
        return;
    }
    // 同上，Enter 会被转译成字符串 detail；这里直接走确认回调，确保键盘确认与鼠标点击确认共享完全一致的销毁与回调时序。
    if (isDispatch && event.detail === "Enter") {
        confirm?.(dialog);
        dialog.destroy();
        return;
    }

    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    let target: HTMLElement | null = event.target;
    while (target && target !== dialog.element) {
        // 点击事件可能落在按钮内的文本节点或其他嵌套元素上，因此需要沿父链回溯，命中取消按钮后统一触发取消回调并关闭对话框。
        if (target.id === "cancelDialogConfirmBtn") {
            cancel?.(dialog);
            dialog.destroy();
            break;
        }
        // 与取消分支相同，确认按钮也依赖事件委托回溯命中，避免仅点击按钮外层元素时才生效的交互缺陷。
        if (target.id === "confirmDialogConfirmBtn") {
            confirm?.(dialog);
            dialog.destroy();
            break;
        }
        target = target.parentElement;
    }
};

/**
 * 弹出确认对话框。
 *
 * 作用：显示一个带有标题、消息文本以及确认和取消按钮的交互式对话框。
 * 意图：简化常用的用户确认流程，支持普通确认和破坏性确认（如删除）的视觉区分。
 * 调用时机：在任何需要执行前置确认的任务中调用，如删除文档、重置设置等。
 * @同步豁免:UI构建 该函数直接创建并显示对话框，且回调函数由调用者提供，符合预期的同步交互模式，无需额外的异步处理。
 * @param {string} title - 对话框显示的标题。
 * @param {string} text - 对话框显示的正文内容（支持 HTML 字串）。
 * @param {(dialog?: Dialog) => void} [confirm] - 点击确定按钮或按下 Enter 键的回调。
 * @param {(dialog: Dialog) => void} [cancel] - 点击取消按钮、按下 Escape 或关闭对话框的回调。
 * @param {boolean} [isDelete=false] - 是否标记为“删除”操作，为 true 时确定按钮会呈现红色（危险动作标识）。
 */
export const confirmDialog = (
    title: string,
    text: string,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void,
    isDelete = false
) => {
    // 当调用方仅传入确认回调、未提供任何标题和正文时，无需渲染空白确认框，直接执行确认逻辑。
    // 该分支通常用于“有条件弹窗”：上层先构造提示文案，若最终没有任何需要展示的信息，则退化为直接继续原操作。
    if (!text && !title && confirm) {
        confirm();
        return;
    }
    const previousActiveElement = document.activeElement as HTMLElement;
    let handled = false;
    const handleCancel = () => {
        if (handled) {
            return;
        }
        handled = true;
        cancel?.(dialog);
    };
    // 确认路径同样纳入一次性守卫：确认发生后立即标记 handled，使随后的销毁流程不再把本次交互误报为取消。
    const handleConfirm = () => {
        handled = true;
        confirm?.(dialog);
    };
    const dialog = new Dialog({
        title,
        content: /*html */`<div class="b3-dialog__content">
    <div class="ft__breakword">${text}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" id="cancelDialogConfirmBtn">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button ${isDelete ? "b3-button--remove" : "b3-button--text"}" id="confirmDialogConfirmBtn">${siyuanI18n[isDelete ? "delete" : "confirm"]}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
        destroyCallback: () => {
            handleCancel();
            if (!previousActiveElement?.isConnected) {
                return;
            }
            const activeElement = document.activeElement as HTMLElement;
            if (!activeElement || activeElement === document.body) {
                previousActiveElement.focus({preventScroll: true});
            }
        },
    });

    // 点击与快捷键事件统一交给 createDialogClickHandler 生成的处理器；确认走 handleConfirm、取消走 handleCancel，共用 handled 一次性守卫。
    dialog.element.addEventListener("click", createDialogClickHandler(dialog, handleConfirm, handleCancel));
    dialog.element.setAttribute("data-key", Constants.DIALOG_CONFIRM);
    (dialog.element.querySelector("#confirmDialogConfirmBtn") as HTMLButtonElement).focus({preventScroll: true});
};
