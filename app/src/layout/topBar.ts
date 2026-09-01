import {getWorkspaceName} from "../util/processTitle";
import {
    isInMobileApp,
    setStorageVal,
    updateHotkeyTip
} from "../protyle/util/compatibility";
import {exitSiYuan, processSync} from "../dialog/processSystem";
import {goBack, goForward} from "../util/platform/backForward";
import {syncGuide} from "../sync/syncGuide";
import {workspaceMenu} from "../menus/workspace";
import { MenuItem } from "../menus/Menu.Item";
import {setMode} from "../util/assets/assets";
import {openSearch} from "../search/spread";
import type {AppFacade} from "../app/AppFacade.types";
import {isElectron} from "../platform";
import {ipcSend} from "../platform/electron/ipcRenderer";
import {setZoomFactor} from "../platform/electron/webFrame";
import {Constants} from "../constants";
import {isBrowser, isWindow, setToolbarLeftMac} from "../util/platform/functions";
import {fetchPost} from "../util/network/fetch";
import {needSubscribe} from "../util/platform/needSubscribe";
import * as dayjs from "dayjs";
import {resizeTopBar} from "./util";
import {exportLayout} from "./export/exportLayout";
import {setTabPosition} from "../window/setHeader";
import {commandPanel} from "../boot/globalEvent/command/panel";
import {openTopBarMenu} from "../plugin/openTopBarMenu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { openBazaarHubTab } from "../bazaar-hub/open";
import {setTitle} from "../util/processTitle";

const sendTrafficLightPosition = (zoom: number) => {
    if (!isElectron) {
        return;
    }
    const position = Constants.SIZE_ZOOM.find((item) => item.zoom === zoom)?.position;
    if (!position) {
        return;
    }
    ipcSend(Constants.SIYUAN_CMD, {
        cmd: "setTrafficLightPosition",
        zoom,
        position: {
            x: position.x,
            y: ((window.siyuan.config.appearance.hideToolbar && !isWindow()) ? 5 * zoom : 0) + position.y,
        },
    });
};

/** 同步顶栏隐藏后的布局（运行时切换 hideToolbar 时调用） */
export const syncHideToolbarLayout = () => {
    document.body.classList.toggle("body--toolbar-hide", window.siyuan.config.appearance.hideToolbar);
    resizeTopBar();
    if (!isWindow()) {
        sendTrafficLightPosition(window.siyuan.storage[Constants.LOCAL_ZOOM]);
        if (!window.siyuan.config.appearance.hideToolbar) {
            const title = document.querySelector('.layout-tab-bar .item--focus[data-type="tab-header"] .item__text')?.textContent || "";
            setTitle(title, title ? false : true);
        }
    } else {
        return;
    }
    setTabPosition(false, true);
};

export const updateBarModeIcon = () => {
    document.querySelector("#barMode use")?.setAttribute(
        "xlink:href",
        `#icon${window.siyuan.config.appearance.modeOS ? "Mode" : (window.siyuan.config.appearance.mode === 0 ? "Light" : "Dark")}`
    );
};

export const initBar = (app: AppFacade) => {
    const toolbarElement = document.getElementById("toolbar");
    toolbarElement.innerHTML = `
<div id="barWorkspace" class="ariaLabel toolbar__item" aria-label="${siyuanI18n.mainMenu} ${updateHotkeyTip(window.siyuan.config.keymap.general.mainMenu.custom)}">
    <span class="toolbar__text">${getWorkspaceName()}</span>
    <svg class="toolbar__svg"><use xlink:href="#iconDown"></use></svg>
</div>
<div id="barSync" class="ariaLabel toolbar__item${window.siyuan.config.readonly ? " fn__none" : ""}">
    <svg><use xlink:href="#iconCloudSucc"></use></svg>
</div>
<button id="barBack" class="ariaLabel toolbar__item toolbar__item--disabled" aria-label="${siyuanI18n.goBack} ${updateHotkeyTip(window.siyuan.config.keymap.general.goBack.custom)}">
    <svg><use xlink:href="#iconBack"></use></svg>
</button>
<button id="barForward" class="ariaLabel toolbar__item toolbar__item--disabled" aria-label="${siyuanI18n.goForward} ${updateHotkeyTip(window.siyuan.config.keymap.general.goForward.custom)}">
    <svg><use xlink:href="#iconForward"></use></svg>
</button>
<div class="fn__flex-1 fn__ellipsis" id="drag"><span class="fn__none">开发版，使用前请进行备份 Development version, please backup before use</span></div>
<div id="toolbarVIP" class="fn__flex${window.siyuan.config.readonly ? " fn__none" : ""}"></div>
<div id="barPlugins" class="toolbar__item ariaLabel" aria-label="${siyuanI18n.plugin}">
    <svg><use xlink:href="#iconPlugin"></use></svg>
</div>
<div id="barCommand" class="toolbar__item ariaLabel" aria-label="${siyuanI18n.commandPanel} ${updateHotkeyTip(window.siyuan.config.keymap.general.commandPanel.custom)}">
    <svg><use xlink:href="#iconTerminal"></use></svg>
</div>
<div id="barSearch" class="toolbar__item ariaLabel" aria-label="${siyuanI18n.globalSearch} ${updateHotkeyTip(window.siyuan.config.keymap.general.globalSearch.custom)}">
    <svg><use xlink:href="#iconSearch"></use></svg>
</div>
<div id="barBazaar" class="toolbar__item ariaLabel" aria-label="${siyuanI18n.bazaar} Hub">
    <svg><use xlink:href="#iconBazaar"></use></svg>
</div>
<div id="barZoom" class="toolbar__item ariaLabel${(window.siyuan.storage[Constants.LOCAL_ZOOM] === 1 || isBrowser()) ? " fn__none" : ""}" aria-label="${siyuanI18n.zoom}">
    <svg><use xlink:href="#iconZoom${window.siyuan.storage[Constants.LOCAL_ZOOM] > 1 ? "In" : "Out"}"></use></svg>
</div>
<div id="barMode" class="toolbar__item ariaLabel${window.siyuan.config.readonly ? " fn__none" : ""}" aria-label="${siyuanI18n.appearanceMode}">
    <svg><use xlink:href="#icon${window.siyuan.config.appearance.modeOS ? "Mode" : (window.siyuan.config.appearance.mode === 0 ? "Light" : "Dark")}"></use></svg>
</div>
<div id="barExit" class="ft__error toolbar__item ariaLabel${isInMobileApp() ? "" : " fn__none"}" aria-label="${siyuanI18n.safeQuit}">
    <svg><use xlink:href="#iconQuit"></use></svg>
</div>
<div id="barMore" class="toolbar__item ariaLabel" aria-label="${siyuanI18n.more}">
    <svg><use xlink:href="#iconMore"></use></svg>
</div>
<div class="fn__flex" id="windowControls"></div>`;
    processSync();
    toolbarElement.addEventListener("click", (event: MouseEvent) => {
        let target = event.target as HTMLElement;
        if (typeof event.detail === "string") {
            target = toolbarElement.querySelector("#" + event.detail);
        }
        while (!target.classList.contains("toolbar")) {
            const targetId = typeof event.detail === "string" ? event.detail : target.id;
            if (targetId === "barBack") {
                goBack(app);
                event.stopPropagation();
                break;
            } else if (targetId === "barMore") {
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
                    window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_BAR_MORE) {
                    window.siyuan.menus.menu.remove();
                    return;
                }
                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BAR_MORE);
                (target.getAttribute("data-hideids") || "").split(",").forEach((itemId) => {
                    // data-hideids 可能为空字符串，split(",") 会得到 [""]，导致 querySelector("#") 抛出无效选择器异常
                    if (!itemId) {
                        return;
                    }
                    const hideElement = document.getElementById(itemId);
                    const useElement = hideElement.querySelector("use");
                    const menuOptions: IMenu = {
                        label: itemId === "toolbarVIP" ? siyuanI18n.account : hideElement.getAttribute("aria-label"),
                        icon: itemId === "toolbarVIP" ? "iconAccount" : (useElement ? useElement.getAttribute("xlink:href").substring(1) : undefined),
                        click: () => {
                            if (itemId.startsWith("plugin")) {
                                hideElement.dispatchEvent(new CustomEvent("click"));
                            } else {
                                toolbarElement.dispatchEvent(new CustomEvent("click", {detail: itemId}));
                            }
                        }
                    };
                    if (!useElement && hideElement.querySelector("svg")) {
                        const svgElement = hideElement.querySelector("svg").cloneNode(true) as HTMLElement;
                        svgElement.classList.add("b3-menu__icon");
                        menuOptions.iconHTML = svgElement.outerHTML;
                    }
                    window.siyuan.menus.menu.append(new MenuItem(menuOptions).element);
                });
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
                event.stopPropagation();
                break;
            } else if (targetId === "barForward") {
                goForward(app);
                event.stopPropagation();
                break;
            } else if (targetId === "barSync") {
                syncGuide(app);
                event.stopPropagation();
                break;
            } else if (targetId === "barWorkspace") {
                workspaceMenu(app, target.getBoundingClientRect());
                event.stopPropagation();
                break;
            } else if (targetId === "barExit") {
                event.stopPropagation();
                exportLayout({
                    errorExit: true,
                    cb: exitSiYuan,
                });
                break;
            } else if (targetId === "barMode") {
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
                    window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_BAR_MODE) {
                    window.siyuan.menus.menu.remove();
                    return;
                }
                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BAR_MODE);
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "themeLight",
                    label: siyuanI18n.themeLight,
                    icon: "iconLight",
                    current: window.siyuan.config.appearance.mode === 0 && !window.siyuan.config.appearance.modeOS,
                    click: () => {
                        setMode(0);
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "themeDark",
                    label: siyuanI18n.themeDark,
                    current: window.siyuan.config.appearance.mode === 1 && !window.siyuan.config.appearance.modeOS,
                    icon: "iconDark",
                    click: () => {
                        setMode(1);
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "themeOS",
                    label: siyuanI18n.themeOS,
                    current: window.siyuan.config.appearance.modeOS,
                    icon: "iconMode",
                    click: () => {
                        setMode(2);
                    }
                }).element);
                let rect = target.getBoundingClientRect();
                if (rect.width === 0) {
                    rect = toolbarElement.querySelector("#barMore").getBoundingClientRect();
                }
                window.siyuan.menus.menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
                event.stopPropagation();
                break;
            } else if (targetId === "toolbarVIP") {
                if (!window.siyuan.config.readonly) {
                    app.openSettings("sync");
                }
                event.stopPropagation();
                break;
            } else if (targetId === "barSearch") {
                openSearch({
                    app,
                    hotkey: Constants.DIALOG_GLOBALSEARCH
                });
                event.stopPropagation();
                break;
            } else if (targetId === "barBazaar") {
                void openBazaarHubTab({ app });
                event.stopPropagation();
                break;
            } else if (targetId === "barPlugins") {
                openTopBarMenu(app, target);
                event.stopPropagation();
                break;
            } else if (targetId === "barCommand") {
                commandPanel(app);
                event.stopPropagation();
                break;
            } else if (targetId === "barZoom") {
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
                    window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_BAR_ZOOM) {
                    window.siyuan.menus.menu.remove();
                    return;
                }
                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BAR_ZOOM);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: siyuanI18n.zoomIn,
                    icon: "iconZoomIn",
                    accelerator: "⌘=",
                    click: () => {
                        setZoom("zoomIn");
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: siyuanI18n.zoomOut,
                    accelerator: "⌘-",
                    icon: "iconZoomOut",
                    click: () => {
                        setZoom("zoomOut");
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: siyuanI18n.reset,
                    accelerator: "⌘0",
                    click: () => {
                        setZoom("restore");
                    }
                }).element);
                let rect = target.getBoundingClientRect();
                if (rect.width === 0) {
                    rect = toolbarElement.querySelector("#barMore").getBoundingClientRect();
                }
                window.siyuan.menus.menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
                event.stopPropagation();
                break;
            }
            target = target.parentElement;
        }
    });
    const barSyncElement = toolbarElement.querySelector("#barSync");
    barSyncElement.addEventListener("mouseenter", (event) => {
        event.stopPropagation();
        event.preventDefault();
        fetchPost("/api/sync/getSyncInfo", {}, (response) => {
            let html = "";
            if (!window.siyuan.config.sync.enabled || (0 === window.siyuan.config.sync.provider && needSubscribe(""))) {
                html = response.data.stat;
            } else {
                html = siyuanI18n._kernel[82].replace("%s", dayjs(response.data.synced).format("YYYY-MM-DD HH:mm")) + "<br>";
                html += "&emsp;" + response.data.stat;
                if (response.data.kernels.length > 0) {
                    html += "<br>";
                    html += siyuanI18n.currentKernel + "<br>";
                    html += "&emsp;" + response.data.kernel + "/" + window.siyuan.config.system.kernelVersion + " (" + window.siyuan.config.system.os + "/" + window.siyuan.config.system.name + ")<br>";
                    html += siyuanI18n.otherOnlineKernels + "<br>";
                    response.data.kernels.forEach((item: {
                        os: string;
                        ver: string;
                        hostname: string;
                        id: string;
                    }) => {
                        html += `&emsp;${item.id}/${item.ver} (${item.os}/${item.hostname}) <br>`;
                    });
                }
            }
            barSyncElement.setAttribute("aria-label", html);
        });
    });
    barSyncElement.setAttribute("aria-label", window.siyuan.config.sync.stat || (siyuanI18n.syncNow + " " + updateHotkeyTip(window.siyuan.config.keymap.general.syncNow.custom)));
    if (window.siyuan.config.appearance.hideToolbar) {
        document.body.classList.add("body--toolbar-hide");
    }
};

export const setZoom = (type: "zoomIn" | "zoomOut" | "restore") => {
    if (!isElectron) {
        return;
    }
    let zoom = 1;
    if (type === "zoomIn") {
        Constants.SIZE_ZOOM.find((item, index) => {
            if (item.zoom === window.siyuan.storage[Constants.LOCAL_ZOOM]) {
                zoom = Constants.SIZE_ZOOM[index + 1]?.zoom || 3;
                return true;
            }
        });
    } else if (type === "zoomOut") {
        Constants.SIZE_ZOOM.find((item, index) => {
            if (item.zoom === window.siyuan.storage[Constants.LOCAL_ZOOM]) {
                zoom = Constants.SIZE_ZOOM[index - 1]?.zoom || 0.67;
                return true;
            }
        });
    }

    setZoomFactor(zoom);
    setToolbarLeftMac(zoom);
    sendTrafficLightPosition(zoom);
    window.siyuan.storage[Constants.LOCAL_ZOOM] = zoom;
    setStorageVal(Constants.LOCAL_ZOOM, zoom);
    if (!isWindow()) {
        const barZoomElement = document.getElementById("barZoom");
        if (zoom === 1) {
            barZoomElement.classList.add("fn__none");
        } else {
            if (zoom > 1) {
                barZoomElement.querySelector("use").setAttribute("xlink:href", "#iconZoomIn");
            } else {
                barZoomElement.querySelector("use").setAttribute("xlink:href", "#iconZoomOut");
            }
            barZoomElement.classList.remove("fn__none");
        }
    }
};
