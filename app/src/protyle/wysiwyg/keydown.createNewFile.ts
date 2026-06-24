import { fetchPost } from "../../ai/imports";
import { newFileContentBySelect } from "../../editor/rename";
import { newFileBySelect } from "../../util/file/newFile";
import { getSavePath } from "../../util/file/getSavePath";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { matchHotKey } from "../util/hotKey";
import { selectAll } from "../util/selection";
import { getContenteditableElement } from "./getBlock";

export const createNamedNewFileMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {

    const selectText = range.toString();
    const isNewNameFile = matchHotKey(getSiyuanConfig().keymap.editor.general.newNameFile.custom, event);
    if (isNewNameFile || matchHotKey(getSiyuanConfig().keymap.editor.general.newNameSettingFile.custom, event)) {
        if (!selectText.trim() && (nodeElement.querySelector("tr") || nodeElement.querySelector("span"))) {
            // 没选中时，都是纯文本就创建子文档 https://ld246.com/article/1663073488381/comment/1664804353295#comments
        } else {
            if (!selectText.trim() &&
                getContenteditableElement(nodeElement)?.textContent  // https://github.com/siyuan-note/siyuan/issues/8099
            ) {
                selectAll(protyle, nodeElement, range);
            }
            // 同步 toolbar.range，避免 DOM 已被其他操作替换后变为 detached
            // https://github.com/siyuan-note/siyuan/issues/17896
            protyle.toolbar.range = range;
            if (isNewNameFile) {
                fetchPost("/api/filetree/getHPathByPath", {
                    notebook: protyle.notebookId,
                    path: protyle.path,
                }, (response) => {
                    if (!protyle.notebookId) {
                        throw new Error("protyle缺少ID");
                    }
                    newFileBySelect(protyle, selectText, nodeElement, response.data, protyle.notebookId);
                });
            } else {
                if (!protyle.path) {
                    throw new Error("protyle缺少path");
                }
                if (!protyle.notebookId) {
                    throw new Error("protyle缺少ID");
                }
                getSavePath(protyle.path, protyle.notebookId, (pathString, targetNotebookId) => {
                    newFileBySelect(protyle, selectText, nodeElement, pathString, targetNotebookId);
                });
            }
        }
        event.preventDefault();
        event.stopPropagation();
        controller.abort("创建命名新文件");
        return;
    }
};
export const createNewFileByContentMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.newContentFile.custom, event)) {
        newFileContentBySelect(protyle);
        event.preventDefault();
        event.stopPropagation();
        controller.abort("根据内容创建新文件");

        return;
    }
};
