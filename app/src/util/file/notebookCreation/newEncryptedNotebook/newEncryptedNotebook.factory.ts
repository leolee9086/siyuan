/** 用途：实例化标准对话框；使用范围：加密创建组合边界；解耦评估：具体类仅停留在工厂。 */
import {Dialog} from "./imports";
/** 用途：检查加密能力状态；使用范围：加密创建命令；解耦评估：经本域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：等待原子创建结果；使用范围：加密创建提交；解耦评估：经本域网关直达网络实现。 */
import {fetchSyncPost} from "./imports";
/** 用途：读取真实语言表；使用范围：加密创建文案；解耦评估：经本域网关直达严格环境入口。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：判定移动布局；使用范围：对话框尺寸；解耦评估：经本域网关直达平台环境。 */
import {isMobile} from "./imports";
/** 用途：规范笔记本名称；使用范围：加密创建提交；解耦评估：经本域网关直达名称规则。 */
import {replaceFileName} from "./imports";
/** 用途：显示状态与口令提示；使用范围：加密创建流程；解耦评估：经本域网关直达通知实现。 */
import {showMessage} from "./imports";
/** 用途：读取加密创建文案；使用范围：创建对话框；解耦评估：经本域网关直达国际化环境。 */
/** 用途：校验笔记本名称；使用范围：加密创建提交；解耦评估：经本域网关直达名称规则。 */
import {validateName} from "./imports";
/** 用途：描述完整 Dialog；使用范围：提交生命周期；解耦评估：依赖完整抽象而非具体类。 */
import type {IDialog} from "./imports";

/** 校验输入并执行内核原子加密创建请求。 */
const submitEncryptedNotebook = async (
    dialog: IDialog,
    confirmButton: HTMLButtonElement,
    inputs: NodeListOf<HTMLInputElement>,
) => {
    const nameInput = inputs[0];
    const passwordInput = inputs[1];
    if (!nameInput || !passwordInput) {
        throw new Error("Encrypted notebook dialog inputs disappeared before submission");
    }
    const name = nameInput.value;
    const password = passwordInput.value;
    if (!validateName(name)) {
        return false;
    }
    if (!password) {
        showMessage(getSiyuanLanguages().masterPassword);
        return false;
    }
    confirmButton.disabled = true;
    const response = await fetchSyncPost("/api/notebook/createEncryptedNotebook", {
        name: replaceFileName(name),
        password,
    });
    // 内核原子完成创建与挂载后即可关闭对话框；失败则恢复提交能力。
    if (response.code === 0) {
        dialog.destroy();
        return;
    }
    confirmButton.disabled = false;
};

/**
 * 作用：创建并绑定加密笔记本名称、口令及提交对话框。
 * 意图：在功能状态检查通过后集中维护原子创建交互。
 * 调用时机：后端确认加密功能已启用时调用。
 */
const openEncryptedNotebookCreationDialog = () => {
    const languages = getSiyuanLanguages();
    const dialog = new Dialog({
            title: languages.newEncryptedNotebook,
            content: `<div class="b3-dialog__content">
    <input placeholder="${languages.notebookName}" class="b3-text-field fn__block">
    <div class="fn__hr"></div>
    <input type="password" placeholder="${languages.masterPassword}" class="b3-text-field fn__block">
    <div class="fn__hr--b"></div>
    <div>${languages.encryptedNotebookRiskTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${languages.confirm}</button>
</div>`,
            width: isMobile() ? "92vw" : "520px",
    });
    const buttons = dialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
    const inputs = dialog.element.querySelectorAll<HTMLInputElement>("input");
    const cancelButton = buttons[0];
    const confirmButton = buttons[1];
    const nameInput = inputs[0];
    const passwordInput = inputs[1];
    // 模板与绑定契约不一致时销毁半初始化实例并显式失败。
    if (!cancelButton || !confirmButton || !nameInput || !passwordInput) {
        dialog.destroy();
        throw new Error("Encrypted notebook dialog is missing required controls");
    }
    dialog.bindInput(nameInput, () => confirmButton.dispatchEvent(new CustomEvent("click")));
    cancelButton.addEventListener("click", () => dialog.destroy());
    confirmButton.addEventListener("click", () => submitEncryptedNotebook(dialog, confirmButton, inputs));
};

/** 根据后端状态进入创建流程或提示配置要求。 */
const handleEncryptedNotebookStatus = (statusResponse: IWebSocketData) => {
    // 功能启用后才展示可提交的创建对话框。
    if (statusResponse.data.enabled) {
        openEncryptedNotebookCreationDialog();
        return;
    }
    showMessage(getSiyuanLanguages().encryptedNotebookTip, 6000);
};

/** @同步豁免: UI构建 */
// @柯里化 领域命令固定加密能力端点、请求体和状态处理器，保持既有同步 void 调用表面与回调时序。
export const newEncryptedNotebook = () => {
    fetchPost("/api/notebook/getEncryptedNotebookStatus", {}, handleEncryptedNotebookStatus);
};
