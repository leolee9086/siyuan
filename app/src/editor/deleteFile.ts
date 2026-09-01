/** 用途：网络请求。使用范围：删除文件/笔记本。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：同步网络请求。使用范围：删除前查询文档信息。解耦评估：通过 ./imports 转发。 */
import { fetchSyncPost } from "./imports";
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
/** 用途：全局常量。使用范围：识别帮助笔记本路径。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
import {checkBlockRef, getBlockRefWarningHTML} from "../util/checkBlockRef";
/** 用途：收集文档树多选删除目标。使用范围：批量删除时区分文档与笔记本。解耦评估：imports 未覆盖，直接引用唯一实现。 */
import {getDocTreeDeleteTargets} from "../menus/navigationSelection";

/**
 * 处理文档信息响应，显示删除确认对话框
 */
function handleDocInfoResponse(response: { data: { name: string; subFileCount: number } }, notebookId: string,
                               pathString: string, hasRef: boolean) {
    const fileName = escapeHtml(response.data.name);
    let tip = buildDeleteTip(fileName, response.data.subFileCount);
    if (hasRef) {
        tip += getBlockRefWarningHTML();
    }
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
    const hasRef = await checkBlockRef({
        scope: "documents",
        paths: [pathString],
    });
    if (hasRef === undefined) {
        return;
    }
    // 无引用时才允许跳过确认；引用检查失败时会保留文档。
    if (getSiyuanConfig().fileTree.removeDocWithoutConfirm && !hasRef) {
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
    const response = await fetchSyncPost("/api/block/getDocInfo", docInfoParam);
    if (response.code !== 0 || !response.data) {
        return;
    }
    handleDocInfoResponse({data: response.data}, notebookId, pathString, hasRef);
};

/**
 * 确认删除单个笔记本
 */
async function confirmDeleteNotebook(itemNotebookId: string) {
    const hasRef = await checkBlockRef({
        scope: "notebook",
        notebook: itemNotebookId,
    });
    if (hasRef === undefined) {
        return;
    }
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    let tip = `${lang.confirmDeleteTip.replace("${x}", Lute.EscapeHTMLStr(getNotebookName(itemNotebookId)))}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
    if (hasRef) {
        tip += getBlockRefWarningHTML();
    }
    confirmDialog(lang.deleteOpConfirm, tip, () => {
        fetchPost("/api/notebook/removeNotebook", { notebook: itemNotebookId, callback: "CB_MOUNT_REMOVE" });
    }, undefined, true);
}

/**
 * 确认删除多个笔记本
 */
export const deleteNotebooks = async (notebookIds: string[]) => {
    const uniqueNotebookIds = Array.from(new Set(notebookIds));
    const refResults = await Promise.all(uniqueNotebookIds.map((notebook) => checkBlockRef({
        scope: "notebook",
        notebook,
    })));
    if (refResults.some((result) => result === undefined)) {
        return;
    }
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    const notebookNames = uniqueNotebookIds.map((notebook) => escapeHtml(getNotebookName(notebook)))
        .join(", ");
    let tip = `${lang.confirmDeleteTip.replace("${x}", notebookNames)}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
    if (refResults.some((result) => result)) {
        tip += getBlockRefWarningHTML();
    }
    confirmDialog(lang.deleteOpConfirm, tip, async () => {
        for (const notebook of uniqueNotebookIds) {
            await fetchPost("/api/notebook/removeNotebook", { notebook, callback: "CB_MOUNT_REMOVE" });
        }
    }, undefined, true);
};

/**
 * 删除文件入口，支持单个元素与多选元素两种模式
 */
export const deleteFiles = async (liElements: Element[]) => {
    if (liElements.length === 1) {
        const itemTopULElement = hasTopClosestByTag(liElements[0], "UL");
        if (!itemTopULElement) {
            return;
        }
        const itemNotebookId = itemTopULElement.getAttribute("data-url") || "";
        if ((liElements[0].getAttribute("data-type") || "") === "navigation-file") {
            await deleteFile(itemNotebookId, liElements[0].getAttribute("data-path") || "");
            return;
        }
        // 帮助笔记本为内置内容，直接移除且不经确认流程
        const isHelpNotebook = Object.values(Constants.HELP_PATH).includes(itemNotebookId);
        if (isHelpNotebook) {
            fetchPost("/api/notebook/removeNotebook", { notebook: itemNotebookId, callback: "CB_MOUNT_REMOVE" });
            return;
        }
        await confirmDeleteNotebook(itemNotebookId);
        return;
    }

    const {notebookIds, paths} = getDocTreeDeleteTargets(liElements);
    if (notebookIds.length > 0 && paths.length === 0) {
        await deleteNotebooks(notebookIds);
        return;
    }
    if (paths.length === 0) {
        // 无有效文档路径时给出提示，保留本地既有的用户反馈行为
        showMessage(getSiyuanLanguages().notBatchRemove);
        return;
    }
    const lang = getSiyuanLanguages();
    const days = getSiyuanConfig().editor.historyRetentionDays;
    if (notebookIds.length > 0) {
        // 同时选中文档与笔记本时分别检查两者的引用情况
        const refResults = await Promise.all([
            checkBlockRef({
                scope: "documents",
                paths,
            }),
            ...notebookIds.map((notebook) => checkBlockRef({
                scope: "notebook",
                notebook,
            })),
        ]);
        if (refResults.some((result) => result === undefined)) {
            return;
        }
        const itemNames = liElements.map((item) => {
            const name = item.querySelector(".b3-list-item__text")?.textContent?.trim();
            if (name) {
                return escapeHtml(name);
            }
            if (item.getAttribute("data-type") === "navigation-root") {
                const notebook = item.closest("ul[data-url]")?.getAttribute("data-url");
                return notebook ? escapeHtml(getNotebookName(notebook)) : "";
            }
            return escapeHtml(getDisplayName(item.getAttribute("data-path") || "", true, true));
        }).filter(Boolean).join(", ");
        let tip = `${lang.confirmDeleteTip.replace("${x}", itemNames)}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
        if (refResults.some((result) => result)) {
            tip += getBlockRefWarningHTML();
        }
        confirmDialog(lang.deleteOpConfirm, tip, async () => {
            await fetchPost("/api/filetree/removeDocs", { paths });
            for (const notebook of notebookIds) {
                await fetchPost("/api/notebook/removeNotebook", { notebook, callback: "CB_MOUNT_REMOVE" });
            }
        }, undefined, true);
        return;
    }
    // 仅选中多个文档时的批量删除确认
    const hasRef = await checkBlockRef({
        scope: "documents",
        paths,
    });
    if (hasRef === undefined) {
        return;
    }
    let tip = `${lang.confirmRemoveAll.replace("${count}", paths.length)}
<div class="fn__hr"></div>
<div class="ft__smaller ft__on-surface">${lang.rollbackTip.replace("${x}", days)}</div>`;
    if (hasRef) {
        tip += getBlockRefWarningHTML();
    }
    confirmDialog(lang.deleteOpConfirm, tip, () => {
        fetchPost("/api/filetree/removeDocs", { paths });
    }, undefined, true);
};
