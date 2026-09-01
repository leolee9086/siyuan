/** 用途：实例化标准对话框；使用范围：加密笔记本访问组合边界；解耦评估：具体类仅停留在工厂。 */
import {Dialog} from "./imports";
/** 用途：执行原子解锁挂载；使用范围：口令提交；解耦评估：经本域网关直达网络实现。 */
import {fetchSyncPost} from "./imports";
/** 用途：读取真实语言表；使用范围：解锁对话框；解耦评估：经本域网关直达严格环境入口。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：判定移动布局；使用范围：对话框尺寸；解耦评估：经本域网关直达平台环境。 */
import {isMobile} from "./imports";
/** 用途：编码动态笔记本名；使用范围：解锁对话框标题。 */
import {escapeHtml} from "./imports";
/** 用途：描述完整 Dialog；使用范围：解锁提交生命周期；解耦评估：行为依赖完整抽象而非具体类。 */
import type {IDialog} from "./imports";

/** 校验口令并执行内核原子解锁挂载请求。 */
const submitEncryptedNotebookAccess = async (
    dialog: IDialog,
    confirmButton: HTMLButtonElement,
    inputElement: HTMLInputElement,
) => {
    const password = inputElement.value;
    if (!password) {
        return false;
    }
    const notebookId = dialog.element.getAttribute("data-notebook-id");
    if (!notebookId) {
        throw new Error("Encrypted notebook access dialog lost its notebook identity");
    }
    confirmButton.disabled = true;
    const response = await fetchSyncPost("/api/notebook/unlockAndOpenNotebook", {
        notebook: notebookId,
        password,
    });
    // 原子解锁并挂载成功后关闭；失败时恢复输入并重新聚焦。
    if (response.code === 0) {
        dialog.destroy();
        return;
    }
    confirmButton.disabled = false;
    inputElement.value = "";
    inputElement.focus();
};

/** @同步豁免: UI构建 */
export const openEncryptedNotebook = (notebookId: string, name: string) => {
    const dialogKey = "encryptedNotebook-" + notebookId;
    if (window.siyuan.dialogs.some((item) => item.element.getAttribute("data-key") === dialogKey)) {
        return;
    }
    const languages = getSiyuanLanguages();
    const dialog = new Dialog({
        title: languages.unlockEncryptedNotebook.replace("${x}", escapeHtml(name)),
        content: `<div class="b3-dialog__content">
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
    dialog.element.setAttribute("data-key", dialogKey);
    dialog.element.setAttribute("data-notebook-id", notebookId);
    const buttons = dialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
    const cancelButton = buttons[0];
    const confirmButton = buttons[1];
    const inputElement = dialog.element.querySelector<HTMLInputElement>("input");
    // 模板与绑定契约不一致时销毁半初始化实例并显式失败。
    if (!cancelButton || !confirmButton || !inputElement) {
        dialog.destroy();
        throw new Error("Encrypted notebook access dialog is missing required controls");
    }
    dialog.bindInput(inputElement, () => confirmButton.dispatchEvent(new CustomEvent("click")));
    cancelButton.addEventListener("click", () => dialog.destroy());
    confirmButton.addEventListener("click", () => submitEncryptedNotebookAccess(dialog, confirmButton, inputElement));
};
