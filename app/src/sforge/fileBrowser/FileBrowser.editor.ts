/** 用途：本地文件编辑页签注册；使用范围：文件树双击和布局恢复。 */
import {createVueComponentLoader, isHTMLElement, tabRegistry} from "./editor/imports";
import type {CustomDomain} from "./editor/imports";
import FileBrowserEditorPanel from "./FileBrowserEditorPanel.vue";
import {isFileBrowserEditorTabData} from "./FileBrowser.guards";
import {FILE_BROWSER_EDITOR_TAB_TYPE} from "./FileBrowser.editor.constants";

/**
 * Monaco 编辑器页签类型。
 * 致谢：Zuoqiu-Yingyi/siyuan-plugin-monaco-editor
 * https://github.com/Zuoqiu-Yingyi/siyuan-plugin-monaco-editor
 */
function initFileBrowserEditor(custom: CustomDomain) {
    if (!isHTMLElement(custom.element) || !isFileBrowserEditorTabData(custom.data)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-editor-tab");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileBrowserEditorPanel},
        data: {file: custom.data},
        template: "<FileBrowserEditorPanel :file=\"file\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 在布局恢复前注册本地文本编辑页签。 */
export function registerFileBrowserEditorTab() {
    if (tabRegistry.has(FILE_BROWSER_EDITOR_TAB_TYPE)) {
        return;
    }
    tabRegistry.register({type: FILE_BROWSER_EDITOR_TAB_TYPE, init: initFileBrowserEditor});
}
