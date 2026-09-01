import {hideElements} from "../ui/hideElements";
import {resize} from "./resize";
import {updateProtyleOutline} from "../runtime/layout.port";
import {isMobile} from "../../util/platform/functions";

export const updateMobileTitleReadonly = (protyle: IProtyle) => {
    const inputElement = document.getElementById("toolbarName") as HTMLInputElement;
    const readonlyElement = document.getElementById("toolbarNameReadonly");
    if (!inputElement || !readonlyElement) {
        return;
    }
    const readonly = protyle.disabled || !protyle.preview.element.classList.contains("fn__none");
    if (readonly && !inputElement.readOnly && document.activeElement === inputElement) {
        inputElement.blur();
    }
    inputElement.readOnly = readonly;
    readonlyElement.textContent = inputElement.value;
    inputElement.classList.toggle("fn__none", readonly);
    readonlyElement.classList.toggle("fn__none", !readonly);
};

// @内联数组 setEditMode 切换时需要隐藏的 UI 元素类型
const HIDE_ELEMENT_TYPES: Parameters<typeof hideElements>[0] = ["gutterOnly", "toolbar", "select", "hint", "util"];

/**
 * 作用：确保 protyle 的 wysiwyg 编辑区域可见，并同步更新相关 UI 组件状态
 * 意图：preview 模式已剥离为独立页签后，此函数仅负责确保 wysiwyg 模式的 UI 正确显示
 * 调用时机：initUI 初始化时调用，确保编辑器内容区域可见
 * @同步豁免: UI构建 - 需要同步操作 DOM 元素的显示/隐藏状态，确保编辑器初始化的原子性
 */
export const setEditMode = (protyle: IProtyle, _type: TEditorMode) => {
    // 内容区域已经可见时无需重复操作
    if (!protyle.contentElement?.classList.contains("fn__none")) {
        return;
    }
    protyle.contentElement.classList.remove("fn__none");
    // 同步滚动条组件的可见性与位置状态（组件内部依据滚动渲染开关与内容可见性自行判定）
    protyle.scroll?.update(protyle);
    // 启用了面包屑渲染时，同步显示面包屑并更新退出按钮状态
    if (protyle.options.render?.breadcrumb) {
        protyle.breadcrumb?.element.classList.remove("fn__none");
        protyle.breadcrumb?.toggleExit(!protyle.block.showAll);
    }
    updateProtyleOutline(protyle, true);
    resize(protyle);
    if (isMobile()) {
        // 移动端同步顶部标题栏的只读显示状态
        updateMobileTitleReadonly(protyle);
    }
    hideElements(HIDE_ELEMENT_TYPES, protyle);
    // @breaking-change: preview模式已剥离为独立的export-preview页签，
    // 此事件现在仅在wysiwyg初始化时触发，不再有preview模式切换语义。
    // 插件如需监听导出预览页签，应使用TabRegistry的custom页签事件。
    for (const item of protyle.app.plugins) {
        item.eventBus.emit("switch-protyle-mode", {protyle});
    }
};
