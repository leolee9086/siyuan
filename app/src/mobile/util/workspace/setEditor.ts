/** 用途：同步更新移动端文档标题；使用范围：编辑器挂载完成后的工作区显隐切换；解耦评估：经本子域网关直达标题唯一实现，标题、顶栏与固定宿主节点必须在同一 DOM 提交中更新。 */
import {setTitle} from "./imports";

/** 将移动工作区从空状态切换到已经挂载的编辑器。
 * @同步豁免: 需要绝对同步的DOM访问 - Protyle 挂载回调返回前必须同时提交标题、工具栏、编辑区和空状态显隐。
 */
export const setEditor = () => {
    // 从空状态切回编辑器时恢复顶栏；只读标题的最终显隐由 updateMobileTitleReadonly 依据 fn__none 控制
    document.getElementById("mobileTopBar")?.classList.remove("fn__none");
    const toolbarNameElement = document.getElementById("toolbarName");
    const editorElement = document.getElementById("editor");
    const emptyElement = document.getElementById("empty");
    if (!(toolbarNameElement instanceof HTMLInputElement) || !editorElement || !emptyElement) {
        throw new Error("Mobile editor workspace is not initialized");
    }
    setTitle(toolbarNameElement.value);
    toolbarNameElement.classList.remove("fn__hidden");
    document.getElementById("toolbarNameReadonly")?.classList.remove("fn__hidden");
    editorElement.classList.remove("fn__none");
    emptyElement.classList.add("fn__none");
};
