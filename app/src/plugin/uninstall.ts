/** 用途：提供插件卸载流程的应用抽象外观；使用范围：插件集合和生命周期清理；解耦评估：type-only 依赖，不加载完整应用入口。 */
import type {AppFacade} from "../app/AppFacade.types";
import type * as Siyuan from "siyuan";
import {getAllModels} from "../layout/getAll";
import {resizeTopBar} from "../layout/util";
import {setTabPosition} from "../window/setHeader";
import {Constants} from "../constants";
import {setStorageVal} from "../protyle/util/compatibility";
// S-forge: 平台差异经本地封装处理（isMobile/isElectron/ipcSend），上游新增的能力注销与上传、面包屑清理经对应模块接入
import {isMobile} from "../util/platform/functions";
import {getAllEditor} from "../layout/getAll";
import {unregisterCapability} from "../layout/dock/agent/frontendCapabilities";
import {cancelAssetUploadsByPlugin} from "../protyle/upload/pluginEvent";
import {removeBreadcrumbButtons} from "./breadcrumbButton";
import {isElectron} from "../platform";
import {ipcSend} from "../platform/electron/ipcRenderer";

export const uninstall = (app: AppFacade, name: string, isReload: boolean) => {
    app.plugins.find((plugin: Siyuan.Plugin, index) => {
        if (plugin.name === name) {
            cancelAssetUploadsByPlugin(plugin);
            try {
                plugin.onunload();
            } catch (e) {
                console.error(`plugin ${plugin.name} onunload error:`, e);
            }
            try {
                plugin.kernel.destroy();
            } catch (e) {
                console.error(`plugin ${plugin.name} kernel destroy error:`, e);
            }
            if (!isReload) {
                try {
                    plugin.uninstall();
                } catch (e) {
                    console.error(`plugin ${plugin.name} uninstall error:`, e);
                }
                window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS][plugin.name] = {};
                setStorageVal(Constants.LOCAL_PLUGIN_DOCKS, window.siyuan.storage[Constants.LOCAL_PLUGIN_DOCKS]);
            }
            // rm tab
            if (!isMobile()) {
                const modelsKeys = Object.keys(plugin.models);
                getAllModels().custom.forEach(custom => {
                    if (modelsKeys.includes(custom.type)) {
                        if (isReload) {
                            if (custom.update) {
                                custom.update();
                            }
                        } else {
                            custom.parent.parent.removeTab(custom.parent.id);
                        }
                    }
                });
            }
            // rm topBar
            for (let i = 0; i < plugin.topBarIcons.length; i++) {
                const item = plugin.topBarIcons[i];
                item.remove();
                plugin.topBarIcons.splice(i, 1);
                i--;
            }
            removeBreadcrumbButtons(plugin.name);
            // 移除插件注册的 Agent 能力
            plugin.agentCapabilities.forEach((capability) => unregisterCapability(capability.id, capability.generation));
            // 桌面端需要清理状态栏图标、调整顶栏尺寸、移除dock面板
            if (!isMobile()) {
                // rm statusBar
                plugin.statusBarIcons.forEach(item => {
                    item.remove();
                });
                // rm dock
                const docksKeys = Object.keys(plugin.docks);
                docksKeys.forEach(key => {
                    if (window.siyuan.layout.leftDock && Object.keys(window.siyuan.layout.leftDock.data).includes(key)) {
                        window.siyuan.layout.leftDock.remove(key);
                    } else if (window.siyuan.layout.rightDock && Object.keys(window.siyuan.layout.rightDock.data).includes(key)) {
                        window.siyuan.layout.rightDock.remove(key);
                    } else if (window.siyuan.layout.bottomDock && Object.keys(window.siyuan.layout.bottomDock.data).includes(key)) {
                        window.siyuan.layout.bottomDock.remove(key);
                    }
                });
                resizeTopBar();
                setTabPosition(true);
            }
            // rm listen
            Array.from(document.childNodes).find(item => {
                if (item.nodeType === 8 && item.textContent === name) {
                    item.remove();
                    return true;
                }
            });
            // rm plugin
            app.plugins.splice(index, 1);
            // S-forge: 移动端卸载插件后，若无任何插件 dock 则隐藏插件入口图标；若图标处于激活态则回退到可用页签或复位侧面板
            if (isMobile() && app.plugins.every(p => Object.keys(p.docks).length === 0)) {
                const pluginTabElement = document.querySelector("[data-type='sidebar-plugin-tab']");
                pluginTabElement?.classList.add("fn__none");
                if (pluginTabElement?.classList.contains("toolbar__icon--active")) {
                    const fallbackTabElement = pluginTabElement.parentElement.querySelector<HTMLElement>(
                        "[data-type$='-tab']:not(.fn__none)"
                    );
                    if (fallbackTabElement) {
                        fallbackTabElement.dispatchEvent(new MouseEvent("click", {bubbles: true}));
                    } else {
                        pluginTabElement.classList.remove("toolbar__icon--active");
                        document.querySelector("[data-type='sidebar-plugin']")?.classList.add("fn__none");
                        (pluginTabElement.closest(".side-panel") as HTMLElement).style.transform = "";
                    }
                }
            }
            // rm icons
            document.querySelector(`svg[data-name="${plugin.name}"]`)?.remove();
            // rm protyle toolbar
            getAllEditor().forEach(editor => {
                editor.protyle.toolbar.update(editor.protyle);
            });
            // rm style
            document.getElementById("pluginsStyle" + name)?.remove();
            if (isElectron) {
                plugin.commands.forEach(command => {
                    if (command.globalCallback && command.customHotkey) {
                        ipcSend(Constants.SIYUAN_CMD, {
                            cmd: "unregisterGlobalShortcut",
                            accelerator: command.customHotkey
                        });
                    }
                });
            }
            return true;
        }
    });
};
