/** 用途：页签注册、Vue 挂载和 DOM 宿主；使用范围：只读文件预览组合根。 */
import {
    createVueComponentLoader,
    isHTMLElement,
    tabRegistry,
} from "./preview/imports";
import type {CustomDomain} from "./preview/imports";
/** 用途：预览页签数据校验；使用范围：布局恢复与新建页签。 */
import {isFileBrowserPreviewTabData} from "./FileBrowser.guards";
/** 用途：只读文件预览面板；使用范围：Custom 页签内容。 */
import FileBrowserPreviewPanel from "./FileBrowserPreviewPanel.vue";

export const FILE_BROWSER_PREVIEW_TAB_TYPE = "sforge-file-preview";

function initFileBrowserPreview(custom: CustomDomain) {
    if (!isHTMLElement(custom.element) || !isFileBrowserPreviewTabData(custom.data)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-preview-tab");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileBrowserPreviewPanel},
        data: {file: custom.data},
        template: "<FileBrowserPreviewPanel :file=\"file\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 在布局恢复前注册唯一内建预览页签。 */
export function registerFileBrowserPreviewTab() {
    if (tabRegistry.has(FILE_BROWSER_PREVIEW_TAB_TYPE)) {
        return;
    }
    tabRegistry.register({
        type: FILE_BROWSER_PREVIEW_TAB_TYPE,
        init: initFileBrowserPreview,
    });
}
