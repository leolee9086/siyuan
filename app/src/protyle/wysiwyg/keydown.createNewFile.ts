import { newFileBySelectRange } from "../../util/file/newFile";
import { newFileContentBySelect } from "../../editor/rename";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { matchHotKey } from "../util/hotKey";

export const createNamedNewFileMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    _nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {

    const isNewNameFile = matchHotKey(getSiyuanConfig().keymap.editor.general.newNameFile.custom, event);
    if (isNewNameFile || matchHotKey(getSiyuanConfig().keymap.editor.general.newNameSettingFile.custom, event)) {
        // 使用快照上下文，避免异步过程中选区被移动或文档切换导致错误插入（issue 16972）
        newFileBySelectRange(protyle, range, isNewNameFile ? "subDoc" : "configured");
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
