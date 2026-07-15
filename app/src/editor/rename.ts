/** 用途：提示消息。使用范围：重命名验证失败时提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：Dialog 对话框。使用范围：重命名输入对话框。解耦评估：通过 ./imports 转发。 */
import { Dialog } from "./imports";
/** 用途：编辑器选区聚焦。使用范围：关闭对话框后还原选区。解耦评估：通过 ./imports 转发。 */
import { focusByRange } from "./imports";
/** 用途：最近块查找。使用范围：新文件内容提取。解耦评估：通过 ./imports 转发。 */
import { hasClosestBlock } from "./imports";
/** 用途：嵌入块移除。使用范围：提取选中内容。解耦评估：通过 ./imports 转发。 */
import { removeEmbed } from "./imports";
/** 用途：移动端判断。使用范围：适配对话框宽度。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：路径名称工具。使用范围：获取资产名和显示名。解耦评估：通过 ./imports 转发。 */
import { getAssetName } from "./imports";
/** 用途：获取显示名称。使用范围：创建文档路径。解耦评估：通过 ./imports 转发。 */
import { getDisplayName } from "./imports";
/** 用途：路径处理工具。使用范围：拼接文件路径。解耦评估：通过 ./imports 转发。 */
import { pathPosix } from "./imports";
/** 用途：设置笔记本名称。使用范围：重命名笔记本后更新缓存。解耦评估：通过 ./imports 转发。 */
import { setNotebookName } from "./imports";
/** 用途：网络请求。使用范围：重命名 API。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：系统常量。使用范围：SIZE_TITLE 等常量。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";

/** 用途：获取所有模型和编辑器。使用范围：重命名后刷新编辑器。解耦评估：通过 ./imports 转发。 */
import { getAllModels } from "./imports";
/** 用途：获取所有编辑器。使用范围：重命名资产后刷新编辑器。解耦评估：通过 ./imports 转发。 */
import { getAllEditor } from "./imports";
/** 用途：获取 SiYuan 国际化文案。使用范围：重命名对话框文案。解耦评估：通过 ./imports 转发。 */
import { getSiyuanLanguages } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：检查只读模式。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";

/** 验证文件名是否合规 */
export const validateName = async (name: string, _targetElement?: HTMLElement) => {
    const lang = getSiyuanLanguages();
    // 检查文件名中的非法字符
    if (/\r\n|\r|\n|\u2028|\u2029|\t/.test(name)) {
        showMessage(lang.fileNameRule);
        return false;
    }
    // 检查文件名长度
    if (name.length > Constants.SIZE_TITLE) {
        const kernelMsgs = lang._kernel;
        showMessage(kernelMsgs["106"]);
        return false;
    }
    return true;
};

/** 替换文件名中的非法字符；函数无异步依赖，必须保持字符串返回值，避免标题收到 Promise。 */
export const replaceFileName = (name: string) => {
    // 替换文件名中的斜杠为全角斜杠
    if (name.indexOf("/") > -1) {
        showMessage(getSiyuanLanguages().fileNameRule);
        name = name.replace(/\//g, "／");
    }
    return name.replace(/\r\n|\r|\n|\u2028|\u2029|\t|/g, "").substring(0, Constants.SIZE_TITLE);
};

/** @同步豁免: 类型守卫 - 纯字符串转换，无异步操作 */
/** 替换文件路径中的非法字符，用于生成安全的本地路径组件 */
export const replaceLocalPath = (name: string) => {
    return name.replace(/[<>:"\/\\|?*]/g, "").replace(/\s+/g, "_").substring(0, Constants.SIZE_TITLE) || "_";
};


/** 执行重命名请求 */


/** 执行重命名请求 */
function executeRename(options: { notebookId: string; path: string; type: string }, name: string, lang: Record<string, string>) {
    // 笔记本重命名需要额外处理名称和缓存
    if (options.type !== "notebook") {
        fetchPost("/api/filetree/renameDoc", {
            notebook: options.notebookId,
            path: options.path,
            title: name,
        });
        return;
    }
    if (!name) {
        name = lang.untitled;
    }
    fetchPost("/api/notebook/renameNotebook", {
        notebook: options.notebookId,
        name,
    }, () => {
            setNotebookName(options.notebookId, name);
    });
}

/** 构建重命名对话框并绑定事件 */
/** 确认按钮点击处理 */
function handleConfirmClick(dialog: Dialog, inputElement: HTMLInputElement, initialName: string, options: { notebookId: string; path: string; type: string }, lang: Record<string, string>) {
    if (!validateName(inputElement.value)) {
        return false;
    }
    const name = replaceFileName(inputElement.value.trim());
    // 名称未变化时直接关闭对话框
    if (name === initialName) {
        dialog.destroy();
        return false;
    }
    executeRename(options, name, lang);
    dialog.destroy();
}

/** 对话框关闭回调 */
function handleDialogDestroy(options: { range?: Range }) {
    if (options.range) {
        focusByRange(options.range);
    }
}

/** 安全获取输入框元素，避免 as 断言 */
function getInputElement(parent: HTMLElement) {
    const el = parent.querySelector("input");
    return el instanceof HTMLInputElement ? el : null;
}

/** 安全获取按钮元素，避免 as 断言 */
function getButtonElement(parent: HTMLElement, selector: string) {
    const el = parent.querySelector(selector);
    return el instanceof HTMLButtonElement ? el : null;
}

/** 构建对话框并绑定事件 */
function buildRenameDialog(lang: Record<string, string>, options: { notebookId: string; path: string; type: string; range?: Range }, initialName: string) {
    const dialog = new Dialog({
        title: lang.rename,
        content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${lang.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${lang.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
        /** 对话框关闭时还原编辑器选区 */
        destroyCallback() {
            handleDialogDestroy(options);
        },
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_RENAME);
    const inputElement = getInputElement(dialog.element);
    const btnCancel = getButtonElement(dialog.element, ".b3-button--cancel");
    const btnConfirm = getButtonElement(dialog.element, ".b3-button--text");
    if (!inputElement || !btnCancel || !btnConfirm) {
        return;
    }
    dialog.bindInput(inputElement, () => {
        btnConfirm.click();
    });
    inputElement.value = initialName;
    inputElement.focus();
    inputElement.select();
    btnCancel.addEventListener("click", () => {
        dialog.destroy();
    });
    btnConfirm.addEventListener("click", () => {
        handleConfirmClick(dialog, inputElement, initialName, options, lang);
    });
}

/** 重命名文件或笔记本 */
export const rename = async (options: {
    path: string;
    notebookId: string;
    name: string;
    type: "notebook" | "file";
    empty?: boolean;
    range?: Range;
}) => {
    const lang = getSiyuanLanguages();
    const config = getSiyuanConfig();
    if (config.readonly) {
        return;
    }

    const initialName = options.empty ? "" : options.name;
    const dialog = buildRenameDialog(lang, options, initialName);
};

/** 构建资产重命名对话框并绑定事件 */
/** 确认按钮点击处理（资产重命名） */
/** 处理资产重命名成功响应 */
function onRenameAssetSuccess(assetPath: string, newPath: string, dialog: Dialog) {
    updateAssetPath(assetPath, newPath);
    for (const item of getAllEditor()) {
        item.reload(false);
    }
    dialog.destroy();
}

/** 资产重命名确认按钮处理 */
function handleAssetConfirmClick(assetPath: string, dialog: Dialog, inputElement: HTMLInputElement, oldName: string) {
    // 名称未变化或为空时直接关闭
    if (inputElement.value === oldName || !inputElement.value) {
        dialog.destroy();
        return false;
    }
    const newName = inputElement.value;
    fetchPost("/api/asset/renameAsset", { oldPath: assetPath, newName }, (response) => {
        onRenameAssetSuccess(assetPath, response.data.newPath, dialog);
    });
}

/** 构建资产重命名对话框 */
function buildAssetRenameDialog(lang: Record<string, string>, assetPath: string) {
    const dialog = new Dialog({
        title: lang.rename,
        content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${lang.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${lang.confirm}</button>
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
}

/** 处理资产重命名响应 */
/** 更新资产模型中的路径 */
function updateAssetPath(assetPath: string, newPath: string) {
    if (isMobile()) {
        return;
    }
    const models = getAllModels();
    for (const item of models.asset) {
        // 匹配到目标资产时更新路径
        if (item.path === assetPath) {
            item.update(newPath);
        }
    }
}

/** 重命名资产文件 */
export const renameAsset = async (assetPath: string) => {
    const lang = getSiyuanLanguages();
    buildAssetRenameDialog(lang, assetPath);
};

/** 从选中内容创建新文件 */
export const newFileContentBySelect = async (protyle: IProtyle) => {
    if (getSelection().rangeCount === 0) {
        return;
    }
    const range = getSelection().getRangeAt(0);
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return;
    }
    let nodeElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    // 无选中元素时使用最近的块
    if (nodeElements.length === 0) {
        nodeElements = [nodeElement];
    }
    let html = "";
    let fileNameShort = range.toString();
    // 有选中文本时使用克隆内容
    if (fileNameShort !== "") {
        const tempElement = document.createElement("div");
        tempElement.appendChild(range.cloneContents());
        html = tempElement.innerHTML;
    }
    // 无选中文本时使用块内容作为文件名
    if (fileNameShort === "") {
        const firstNode = nodeElements[0];
        fileNameShort = firstNode.textContent;
        for (const item of nodeElements) {
            html += removeEmbed(item);
        }
    }
    if (!fileNameShort) {
        return;
    }
    // 文件名过长时截断
    if (fileNameShort.length > 10) {
        fileNameShort = fileNameShort.substr(0, 10) + "...";
    }
    fileNameShort = replaceFileName(fileNameShort);
    fetchPost("/api/filetree/createDoc", {
        notebook: protyle.notebookId,
        path: pathPosix().join(getDisplayName(protyle.path, false, true), Lute.NewNodeID() + ".sy"),
        title: fileNameShort,
        md: protyle.lute.BlockDOM2StdMd(html),
    });
};
