import type {CustomDomain} from "../layout/dock/custom/custom.types";
import {Plugin} from "../plugin";
import {adaptSiyuanPlugin} from "../plugin/compatibility/adaptSiyuanPlugin";
import {bindAssetTabEvent, genAssetTabHTML, image} from "./assets";

/** 资源配置页签的插件注册组合根；资源渲染模块本身不加载 Plugin class。 */
document.addEventListener("app-ready", () => {
    const plugin = new Plugin({
        app: window.siyuan.ws.app,
        displayName: "资源管理内部插件",
        name: "internal-plugin-image",
        i18n: {},
    });
    plugin.addTab({
        type: "internal-image",
        /** 挂载资源管理页签的完整面板，并绑定其编辑器上下文。 */
        init: (model: CustomDomain) => {
            const tab = model.tab;
            if (tab) {
                tab.panelElement.innerHTML = image.genHTML();
                image.element = tab.panelElement;
                image.bindEvent(window.siyuan.ws.app);
            }
        },
    });
    plugin.addTab({
        type: "internal-image-remove",
        /** 挂载未引用资源页签并绑定其独立列表事件。 */
        init: (model: CustomDomain) => {
            const tab = model.tab;
            if (tab) {
                tab.panelElement.innerHTML = genAssetTabHTML("remove");
                bindAssetTabEvent(tab.panelElement, "remove");
            }
        },
    });
    plugin.addTab({
        type: "internal-image-missing",
        /** 挂载缺失资源页签并绑定其独立列表事件。 */
        init: (model: CustomDomain) => {
            const tab = model.tab;
            if (tab) {
                tab.panelElement.innerHTML = genAssetTabHTML("missing");
                bindAssetTabEvent(tab.panelElement, "missing");
            }
        },
    });
    window.siyuan.ws.app.plugins.push(adaptSiyuanPlugin(plugin));
});
