/** 用途：Dialog 构造器。使用范围：资产重命名 UI 组合；解耦评估：具体 class 仅用于初始化和生命周期。 */
import {Dialog} from "./imports";
/** 用途：移动宿主判断。使用范围：宽度和桌面模型更新；解耦评估：稳定平台事实。 */
import {isMobile} from "./imports";
/** 用途：资产名解析。使用范围：输入框初值；解耦评估：稳定 path 唯一实现。 */
import {getAssetName} from "./imports";
/** 用途：资产重命名请求。使用范围：确认操作；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "./imports";
/** 用途：Dialog 身份常量。使用范围：资产重命名窗口；解耦评估：稳定配置值。 */
import {Constants} from "./imports";
/** 用途：完整模型集合查询。使用范围：更新打开的 Asset；解耦评估：不依赖具体 Asset class。 */
import {getAllModels} from "./imports";
/** 用途：完整 Editor 集合查询。使用范围：重命名后刷新；解耦评估：不依赖具体 Editor class。 */
import {getAllEditor} from "./imports";
/** 用途：国际化文案。使用范围：Dialog 内容；解耦评估：稳定环境读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：类型安全按钮查询。使用范围：Dialog 事件绑定；解耦评估：共享唯一 DOM 实现。 */
import {getButtonElement} from "./imports";
/** 用途：类型安全输入框查询。使用范围：Dialog 事件绑定；解耦评估：共享唯一 DOM 实现。 */
import {getInputElement} from "./imports";

/** 更新已打开的桌面 Asset 模型路径。 */
const updateAssetPath = (assetPath: string, newPath: string) => {
    if (isMobile()) {
        return;
    }
    for (const item of getAllModels().asset) {
        // 仅更新指向原路径的已打开资产模型。
        if (item.path === assetPath) {
            item.update(newPath);
        }
    }
};

/** 按既有顺序同步模型、刷新编辑器并销毁对话框。 */
const onRenameAssetSuccess = (assetPath: string, newPath: string, dialog: Dialog) => {
    updateAssetPath(assetPath, newPath);
    for (const item of getAllEditor()) {
        item.reload(false);
    }
    dialog.destroy();
};

/** 提交有效的新资产名称。 */
const handleAssetConfirmClick = (
    assetPath: string,
    dialog: Dialog,
    inputElement: HTMLInputElement,
    oldName: string,
) => {
    // 名称未变化或为空时保持原语义：关闭对话框且不发送请求。
    if (inputElement.value === oldName || !inputElement.value) {
        dialog.destroy();
        return false;
    }
    fetchPost("/api/asset/renameAsset", {
        oldPath: assetPath,
        newName: inputElement.value,
    }, (response) => {
        onRenameAssetSuccess(assetPath, response.data.newPath, dialog);
    });
};

/** 创建并绑定资产重命名对话框。 */
const buildAssetRenameDialog = (assetPath: string) => {
    const lang = getSiyuanLanguages();
    const title = lang.rename;
    const cancelLabel = lang.cancel;
    const confirmLabel = lang.confirm;
    // Dialog 的三项基础文案缺失说明宿主尚未正确初始化，必须显式终止。
    if (typeof title !== "string" || typeof cancelLabel !== "string" || typeof confirmLabel !== "string") {
        throw new Error("Asset rename dialog labels are unavailable");
    }
    const dialog = new Dialog({
        title,
        content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${cancelLabel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${confirmLabel}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_RENAMEASSETS);
    const inputElement = getInputElement(dialog.element);
    const btnCancel = getButtonElement(dialog.element, ".b3-button--cancel");
    const btnConfirm = getButtonElement(dialog.element, ".b3-button--text");
    if (!inputElement || !btnCancel || !btnConfirm) {
        return;
    }
    dialog.bindInput(inputElement, () => {
        btnConfirm.click();
    });
    const oldName = getAssetName(assetPath);
    inputElement.value = oldName;
    inputElement.focus();
    inputElement.select();
    btnCancel.addEventListener("click", () => {
        dialog.destroy();
    });
    btnConfirm.addEventListener("click", () => {
        handleAssetConfirmClick(assetPath, dialog, inputElement, oldName);
    });
};

/** 打开资产重命名对话框；保留历史 Promise API。 */
export const renameAsset = async (assetPath: string) => {
    buildAssetRenameDialog(assetPath);
};
