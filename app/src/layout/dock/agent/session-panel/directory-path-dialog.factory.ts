/** 用途：使用统一 Dialog 和主题控件；使用范围：Web/移动端目录路径输入；解耦评估：跨目录依赖由本目录网关集中转发。 */
import * as imports from "./imports";
/** 用途：约束 Promise 与 Dialog 的局部状态；使用范围：本文件事件处理；解耦评估：纯类型契约。 */
import type {AgentTaskDirectoryPathDialogState} from "./types";

const PATH_DIALOG_CONTENT = /*html*/`<div class="b3-dialog__content agent-task-directory-dialog">
    <label class="agent-task-directory-dialog__label" for="agentTaskDirectoryPath">任务目录绝对路径</label>
    <div class="agent-task-directory-dialog__field">
        <svg aria-hidden="true"><use xlink:href="#iconFolder"></use></svg>
        <input id="agentTaskDirectoryPath" class="b3-text-field fn__block agent-task-directory-dialog__input"
               autocomplete="off" spellcheck="false" placeholder="D:\\projects\\task 或 /srv/projects/task">
    </div>
    <div class="agent-task-directory-dialog__hint">路径位于 s-forge 主机</div>
</div>
<div class="b3-dialog__action">
    <button type="button" class="b3-button b3-button--cancel" data-action="cancel">取消</button>
    <div class="fn__space"></div>
    <button type="button" class="b3-button b3-button--text" data-action="confirm">确定</button>
</div>`;

/** 只完成一次路径 Promise，关闭按钮和确认按钮共享该收口。 */
function settleAgentTaskDirectoryPath(state: AgentTaskDirectoryPathDialogState, path: string) {
    if (state.settled) {
        return;
    }
    state.settled = true;
    state.resolve(path);
}

/** 输入变化后移除空值错误态。 */
function clearAgentTaskDirectoryPathError(state: AgentTaskDirectoryPathDialogState) {
    state.input?.classList.remove("agent-task-directory-dialog__input--invalid");
    state.input?.removeAttribute("aria-invalid");
}

/** 校验路径并关闭对话框；真实目录和授权仍由后端验证。 */
function confirmAgentTaskDirectoryPath(state: AgentTaskDirectoryPathDialogState) {
    const path = state.input?.value.trim() || "";
    if (!path) {
        state.input?.classList.add("agent-task-directory-dialog__input--invalid");
        state.input?.setAttribute("aria-invalid", "true");
        state.input?.focus();
        return;
    }
    settleAgentTaskDirectoryPath(state, path);
    state.dialog?.destroy({confirmed: true});
}

/** 创建标准路径输入对话框并绑定确认、取消和回车行为。 */
function initializeAgentTaskDirectoryPathDialog(resolve: (path: string) => void) {
    const state: AgentTaskDirectoryPathDialogState = {dialog: null, input: null, resolve, settled: false};
    const dialog = new imports.Dialog({
        title: "选择任务目录",
        content: PATH_DIALOG_CONTENT,
        width: "520px",
        destroyCallback: settleAgentTaskDirectoryPath.bind(null, state, ""),
    });
    state.dialog = dialog;
    const input = dialog.element.querySelector<HTMLInputElement>("#agentTaskDirectoryPath");
    const cancel = dialog.element.querySelector<HTMLElement>('[data-action="cancel"]');
    const confirm = dialog.element.querySelector<HTMLElement>('[data-action="confirm"]');
    // 任一固定控件缺失都表示模板未完整创建，此时关闭对话框并以取消结果收口。
    if (!input || !cancel || !confirm) {
        dialog.destroy();
        return;
    }
    state.input = input;
    dialog.listen(input, "input", clearAgentTaskDirectoryPathError.bind(null, state));
    dialog.listen(cancel, "click", dialog.destroy.bind(dialog));
    dialog.listen(confirm, "click", confirmAgentTaskDirectoryPath.bind(null, state));
    dialog.bindInput(input, confirmAgentTaskDirectoryPath.bind(null, state));
    input.focus();
}

/** 在 Web/移动端请求 kernel 主机上的绝对任务目录路径。 */
export async function requestAgentTaskDirectoryPath() {
    return new Promise<string>(initializeAgentTaskDirectoryPathDialog);
}
