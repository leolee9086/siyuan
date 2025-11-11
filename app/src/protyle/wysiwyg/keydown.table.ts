import { fixTable } from "../util/table";
import { editorContext } from "./types";

export const fixTableMiddleware = (
    ctx: editorContext
) => {
    const {protyle,event,range,controller} = ctx
    if (fixTable(protyle, event, range)) {
        event.preventDefault();
        controller.abort()
    }
}