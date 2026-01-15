import { commonHotkey } from "./commonHotkey/commonHotkey";
import { editorContext } from "./types";

export const commonHotkeyMiddleware = (
    ctx: editorContext
) => {
    if (commonHotkey(ctx.protyle, ctx.event, ctx.nodeElement)) {
        ctx.controller.abort("通用快捷键触发");
    }
};