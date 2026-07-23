/** 用途：网络请求。使用范围：删除文件/笔记本。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：获取文件显示名称。使用范围：删除确认时的路径显示。解耦评估：通过 ./imports 转发。 */
import { getDisplayName } from "./imports";
/** 用途：获取笔记本名称。使用范围：删除笔记本确认文案。解耦评估：通过 ./imports 转发。 */
import { getNotebookName } from "./imports";
/** 用途：确认对话框。使用范围：删除前用户确认。解耦评估：通过 ./imports 转发。 */
import { confirmDialog } from "./imports";
/** 用途：DOM 标签查找。使用范围：获取列表元素属性。解耦评估：通过 ./imports 转发。 */
import { hasTopClosestByTag } from "./imports";
/** 用途：提示消息。使用范围：批量删除提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：HTML 转义。使用范围：文件名安全显示。解耦评估：通过 ./imports 转发。 */
import { escapeHtml } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取删除确认配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：获取 SiYuan 国际化文案。使用范围：删除确认对话框文案。解耦评估：通过 ./imports 转发。 */
import { getSiyuanLanguages } from "./imports";
/** 用途：判断加密笔记本。使用范围：文档信息查询附带 notebook 上下文。解耦评估：通过 ./imports 转发唯一实现。 */
import { isEncryptedBox } from "./imports";

/**
 * 处理文档信息响应，显示删除确认对话框
 */
function handleDocInfoResponse(response: { data: { name: string; subFileCount: number } }, notebookId: string, pathString: string) {
    const fileName = escapeHtml(response.data.name);
    const tip = buildDeleteTip(fileName, response.data.subFileCount);
    confirmDialog(getSiyuanLanguages().deleteOpConfirm, tip, () => {
        fetchPost("/api/filetree/removeDoc", { notebook: notebookId, path: pathString });
    }, undefined, true);
}

/**
 * 构建删除确认对话框的提示内容
 */
function buildDeleteTip(fileName: string, subFileCount: number) {
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    const rollbackHtml = `<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;

    if (subFileCount > 0) {
        return `${lang.andSubFile.replace("${x}", fileName).replace("${y}", subFileCount)}
${rollbackHtml}`;
    }
    return `${lang.confirmDeleteTip.replace("${x}", fileName)}
${rollbackHtml}`;
}

/**
 * 删除单个文件
 */
export const deleteFile = async (notebookId: string, pathString: string) => {
    // 配置为无需确认时直接删除
    if (getSiyuanConfig().fileTree.removeDocWithoutConfirm) {
        fetchPost("/api/filetree/removeDoc", { notebook: notebookId, path: pathString });
        return;
    }
    const docInfoParam: {id: string; notebook?: string} = {
        id: getDisplayName(pathString, true, true),
    };
    // 加密笔记本的块树与内容位于 InBox 数据源，查询必须携带 notebook 以选择正确存储边界。
    if (isEncryptedBox(notebookId)) {
        docInfoParam.notebook = notebookId;
    }
    fetchPost("/api/block/getDocInfo", docInfoParam, (response) => {
        if (!response.data) {
            return;
        }
        handleDocInfoResponse({ data: response.data }, notebookId, pathString);
    });
};

/**
 * 确认删除笔记本
 */
function confirmDeleteNotebook(itemNotebookId: string) {
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    const tip = `${lang.confirmDeleteTip.replace("${x}", Lute.EscapeHTMLStr(getNotebookName(itemNotebookId)))}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
    confirmDialog(lang.deleteOpConfirm, tip, () => {
        fetchPost("/api/notebook/removeNotebook", { notebook: itemNotebookId, callback: "CB_MOUNT_REMOVE" });
    }, undefined, true);
}

/**
 * 确认批量删除文件
 */
function confirmBatchDelete(paths: string[]) {
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    const tip = `${lang.confirmRemoveAll.replace("${count}", paths.length)}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
    confirmDialog(lang.deleteOpConfirm, tip, () => {
        fetchPost("/api/filetree/removeDocs", { paths });
    }, undefined, true);
}

/**
 * 删除多个文件
 */
export const deleteFiles = async (liElements: Element[]) => {
    // 非单个元素时进入批量处理模式
    if (liElements.length !== 1) {
        const paths = collectBatchPaths(liElements);
        confirmBatchDeleteIfAny(paths);
        return;
    }

    const firstElement = liElements[0];
    if (!firstElement) {
        return;
    }
    const itemTopULElement = hasTopClosestByTag(firstElement, "UL");
    if (!itemTopULElement) {
        return;
    }

    const itemNotebookId = itemTopULElement.getAttribute("data-url") || "";
    const itemType = firstElement.getAttribute("data-type") || "";
    // 普通文件调用 deleteFile，笔记本调用 confirmDeleteNotebook
    if (itemType === "navigation-file") {
        deleteFile(itemNotebookId, firstElement.getAttribute("data-path") || "");
        return;
    }
    confirmDeleteNotebook(itemNotebookId);
};

/**
 * 有批量路径时执行确认删除，否则提示无有效文件
 */
function confirmBatchDeleteIfAny(paths: string[]) {
    // 有有效路径时执行批量删除
    if (paths.length > 0) {
        confirmBatchDelete(paths);
        return;
    }
    showMessage(getSiyuanLanguages().notBatchRemove);
}

/**
 * 收集批量删除的文件路径
 */
function collectBatchPaths(liElements: Element[]) {
    const paths: string[] = [];
    for (const item of liElements) {
        const dataPath = item.getAttribute("data-path");
        // 排除根目录和空值
        if (dataPath && dataPath !== "/") {
            paths.push(dataPath);
        }
    }
    return paths;
}
