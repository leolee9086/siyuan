import {isEncryptedBox} from "./notebook/store";

/** 判断文件移动目标是否满足加密笔记本的隔离规则。 */
export const isMoveTargetAllowed = (sourceNotebookIds: string[] = [], targetNotebookId: string) => {
    const sourceIds = Array.from(new Set(sourceNotebookIds.filter(Boolean)));
    if (sourceIds.length === 0) {
        return true;
    }
    const encryptedSourceIds = sourceIds.filter(isEncryptedBox);
    if (encryptedSourceIds.length > 0) {
        return encryptedSourceIds.length === sourceIds.length &&
            sourceIds.length === 1 && sourceIds[0] === targetNotebookId;
    }
    return !isEncryptedBox(targetNotebookId);
};
