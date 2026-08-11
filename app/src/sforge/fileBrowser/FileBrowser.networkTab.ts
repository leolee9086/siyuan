/** 用途：网络文本页签注册；使用范围：只读 Monaco 网络资源入口。 */
import {createVueComponentLoader, isHTMLElement, tabRegistry} from "./networkTab/imports";
import type {CustomDomain} from "./networkTab/imports";
import FileBrowserNetworkPanel from "./FileBrowserNetworkPanel.vue";
import {isFileBrowserNetworkTabData} from "./FileBrowser.guards";
import {FILE_BROWSER_NETWORK_TAB_TYPE} from "./FileBrowser.network.constants";

/**
 * 网络资源页签只创建只读模型。
 * 致谢：Zuoqiu-Yingyi/siyuan-plugin-monaco-editor network handler。
 */
function initFileBrowserNetworkTab(custom: CustomDomain) {
    if (!isHTMLElement(custom.element) || !isFileBrowserNetworkTabData(custom.data)) {
        return;
    }
    custom.element.classList.add("fn__flex-column", "sforge-file-network-tab");
    const vueApp = createVueComponentLoader(custom.element, {
        components: {FileBrowserNetworkPanel},
        data: {file: custom.data},
        template: "<FileBrowserNetworkPanel :file=\"file\" />",
    });
    custom.destroy = () => vueApp.unmount();
}

/** 在布局恢复前注册网络只读页签。 */
export function registerFileBrowserNetworkTab() {
    if (tabRegistry.has(FILE_BROWSER_NETWORK_TAB_TYPE)) {
        return;
    }
    tabRegistry.register({type: FILE_BROWSER_NETWORK_TAB_TYPE, init: initFileBrowserNetworkTab});
}
