import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { matchHotKey } from "../util/hotKey";
import { editorContext } from "./types";

export const undoMiddleware = (
    ctx: editorContext
) => {
    const { event, controller, protyle } = ctx;
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.undo.custom, event)) {
        protyle.undo?.undo(protyle);
        event.preventDefault();
        event.stopPropagation();
        controller.abort("编辑器撤销");
    }
};
export const redoMiddleware = (
    ctx: editorContext
) => {
    const { event, controller, protyle } = ctx;
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.undo.custom, event)) {
        protyle.undo?.redo(protyle);
        event.preventDefault();
        event.stopPropagation();
        controller.abort("编辑器重做");
    }
}; 