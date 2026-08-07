/** 用途：TabRegistry、Vue 挂载和页签数据守卫；使用范围：独立文件瀑布流页签。 */
import {createVueComponentLoader, isHTMLElement, tabRegistry} from "./gallery/imports";
import type {CustomDomain} from "./gallery/imports";
import FileBrowserGalleryTab from "./FileBrowserGalleryTab.vue";
import {isFileBrowserGalleryTabData} from "./FileBrowser.guards";
import {FILE_BROWSER_GALLERY_TAB_TYPE} from "./FileBrowser.gallery.constants";

export {FILE_BROWSER_GALLERY_TAB_TYPE};

function initFileBrowserGallery(custom: CustomDomain) {
    if (!isHTMLElement(custom.element) || !isFileBrowserGalleryTabData(custom.data)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-gallery-tab");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileBrowserGalleryTab},
        data: {app: custom.app, file: custom.data},
        template: "<FileBrowserGalleryTab :app=\"app\" :file=\"file\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 在布局恢复前注册唯一内建资源瀑布流页签。 */
export function registerFileBrowserGalleryTab() {
    if (tabRegistry.has(FILE_BROWSER_GALLERY_TAB_TYPE)) {
        return;
    }
    tabRegistry.register({type: FILE_BROWSER_GALLERY_TAB_TYPE, init: initFileBrowserGallery});
}
