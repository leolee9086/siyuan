/** 用途：复用 Custom、Vue 挂载和宿主守卫；使用范围：文件浏览器 Dock 组合根。 */
import {
    createVueComponentLoader,
    Custom,
    isHTMLElement,
} from "./dock/imports";
/** 用途：文件浏览器 Vue 面板；使用范围：原生 Dock 内容。 */
import FileBrowserPanel from "./FileBrowserPanel.vue";
/** 用途：共享选择驱动的文件属性面板；使用范围：独立属性 Dock。 */
import FilePropertiesPanel from "./FilePropertiesPanel.vue";
/** 用途：独立标签树 Dock 宿主；使用范围：资源管理侧栏标签面板。 */
import FileTagTreeDock from "./FileTagTreeDock.vue";
/** 用途：注册只读文件预览页签；使用范围：布局恢复和文件打开。 */
import {registerFileBrowserPreviewTab} from "./FileBrowser.preview";
/** 用途：注册独立文件瀑布流页签；使用范围：内建文件浏览初始化。 */
import {registerFileBrowserGalleryTab} from "./FileBrowser.gallery";
/** 用途：注册本地文本编辑页签；使用范围：文件树打开和布局恢复。 */
import {registerFileBrowserEditorTab} from "./FileBrowser.editor";
/** 用途：应用和页签宿主类型；使用范围：Dock 工厂参数。 */
import type {AppFacade, CustomDomain, Tab} from "./dock/imports";
/** 用途：文件浏览领域的 Dock 身份；使用范围：模型工厂和布局注册。 */
import {
    FILE_BROWSER_DOCK_TYPE,
    FILE_PROPERTIES_DOCK_TYPE,
    FILE_TAG_TREE_DOCK_TYPE,
} from "./FileBrowser.docks";

export {FILE_BROWSER_DOCK_TYPE, FILE_PROPERTIES_DOCK_TYPE, FILE_TAG_TREE_DOCK_TYPE};

registerFileBrowserPreviewTab();
registerFileBrowserGalleryTab();
registerFileBrowserEditorTab();

/** 将共享文件浏览面板挂载到既有 Custom model，并把销毁交还布局生命周期。 */
function initFileBrowserDock(custom: CustomDomain) {
    if (!isHTMLElement(custom.element)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-browser-dock");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileBrowserPanel},
        data: {app: custom.app},
        template: "<FileBrowserPanel :app=\"app\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 创建唯一的 S-Forge 文件浏览 Dock model。 */
export function createFileBrowserDockModel(app: AppFacade, tab: Tab) {
    return new Custom({
        app,
        tab,
        type: FILE_BROWSER_DOCK_TYPE,
        data: {},
        init: initFileBrowserDock,
    });
}

/** 将文件属性面板挂载到既有 Custom model。 */
function initFilePropertiesDock(custom: CustomDomain) {
    if (!isHTMLElement(custom.element)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-properties-dock");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FilePropertiesPanel},
        template: "<FilePropertiesPanel />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 创建共享文件选择驱动的独立属性 Dock model。 */
export function createFilePropertiesDockModel(app: AppFacade, tab: Tab) {
    return new Custom({
        app,
        tab,
        type: FILE_PROPERTIES_DOCK_TYPE,
        data: {},
        init: initFilePropertiesDock,
    });
}

/** 将独立标签树挂载到既有 Custom model，标签结果仍打开共享瀑布流页签。 */
function initFileTagTreeDock(custom: CustomDomain) {
    if (!isHTMLElement(custom.element)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-tags-dock");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileTagTreeDock},
        data: {app: custom.app},
        template: "<FileTagTreeDock :app=\"app\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 创建独立文件标签 Dock model，避免标签树嵌入任务目录树。 */
export function createFileTagTreeDockModel(app: AppFacade, tab: Tab) {
    return new Custom({
        app,
        tab,
        type: FILE_TAG_TREE_DOCK_TYPE,
        data: {},
        init: initFileTagTreeDock,
    });
}
