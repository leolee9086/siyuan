/** 用途：读取键盘工具栏生命周期状态；使用范围：隐藏流程的计时器和 util 模式；解耦评估：状态由统一注册表拥有。 */
import {getMobileKeyboardLifecycleState} from "./MobileKeyboardLifecycleRegistry";
/** 用途：取得当前移动编辑器；使用范围：恢复容器 padding 并通知插件；解耦评估：经本域 imports 访问稳定宿主查询。 */
import {getCurrentEditor} from "./imports";

/** 隐藏移动键盘工具栏、取消待执行滚动并通知插件，供原生桥接和编辑器生命周期同步调用。 @同步豁免: UI构建 */
export const hideKeyboardToolbar = () => {
    const state = getMobileKeyboardLifecycleState();
    clearTimeout(state.renderToolbarTimeout);
    clearTimeout(state.scrollSelectionIntoViewTimeout);
    window.dispatchEvent(new CustomEvent("siyuan-mobile-keyboard-change", {detail: false}));
    if (state.showUtil) {
        return;
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    if (!toolbarElement) {
        throw new Error("Mobile keyboard toolbar element is missing");
    }
    const toolbarHidden = toolbarElement.classList.contains("fn__none");
    toolbarElement.classList.add("fn__none");
    toolbarElement.style.height = "";
    const editor = getCurrentEditor();
    const editorContainer = editor?.protyle.element.parentElement;
    if (editor && !editorContainer) {
        throw new Error("Mobile editor container is missing");
    }
    if (editorContainer) {
        editorContainer.style.paddingBottom = "";
    }
    // 仅从可见状态切换到隐藏时通知插件，避免重复 hide 事件。
    if (editor && !toolbarHidden) {
        for (const item of editor.protyle.app.plugins) {
            item.eventBus.emit("mobile-keyboard-hide");
        }
    }
    const modelElement = document.getElementById("model");
    if (!modelElement) {
        throw new Error("Mobile model element is missing");
    }
    // 底部模型面板打开时同步撤销为键盘预留的 padding。
    if (modelElement.style.transform === "translateY(0px)") {
        modelElement.style.paddingBottom = "";
    }
};
