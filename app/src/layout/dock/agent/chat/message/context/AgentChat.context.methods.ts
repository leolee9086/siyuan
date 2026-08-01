import type {ProtyleDomain} from "./imports";
import {getAllEditor} from "./imports";
import {isMobile} from "./imports";
import {buildEditorContext} from "./AgentChat.context.helpers";
import {collectSelectedBlockIDs} from "./AgentChat.context.helpers";
import {findContextEditor} from "./AgentChat.context.helpers";

/** 读取当前可见编辑器的发送上下文。 @同步豁免: 需要绝对同步的DOM访问 - 发送请求在当前事件内读取选区快照。 */
export function captureEditorContext() {
    const mobileEditor = isMobile ? window.siyuan.mobile?.editor || window.siyuan.mobile?.popEditor : undefined;
    if (mobileEditor?.protyle && !mobileEditor.protyle.element.classList.contains("fn__none")) {
        return readEditorContext(mobileEditor);
    }
    if (isMobile) {
        return undefined;
    }
    const editors = getAllEditor();
    if (!editors || editors.length === 0) {
        return undefined;
    }
    const allSelected = collectSelectedBlockIDs(editors);
    const candidate = findContextEditor(editors);
    const context = candidate ? readEditorContext(candidate) : undefined;
    if ((!context?.selectedBlockIDs?.length) && allSelected.length > 0) {
        return {...context, selectedBlockIDs: allSelected};
    }
    return context;
}

/** 从指定编辑器读取块、文档和选区上下文。 @同步豁免: 需要绝对同步的DOM访问 - 选区状态必须在调用时读取。 */
export function readEditorContext(editor: ProtyleDomain) {
    if (!editor.protyle) {
        return undefined;
    }
    return buildEditorContext(editor);
}
