import { shell } from "electron";
import { App } from "..";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { openAsset } from "../editor/util.openAsset";
import { openBy } from "../editor/utils.openBy";
import { isInAndroid, openByMobile, isInHarmony } from "../protyle/util/compatibility";
import { getSearch } from "../util/functions";
import { isLocalPath, pathPosix } from "../util/pathName";
import { openAssetNewWindow } from "../window/openNewWindow";
import { MenuItem } from "./Menu.Item";


// 移动端菜单项生成函数
const generateMobileMenuItems = (src: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() ? "useDefault" : "useBrowserView",
        label: isInAndroid() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
        accelerator: showAccelerator ? window.siyuan.languages.click : "",
        click: () => {
            openByMobile(src);
        }
    }];
};

// 本地资源文件基础菜单项生成函数
const generateAssetBaseMenuItems = (app: App, src: string, showAccelerator: boolean) => {
    return [
        {
            id: "insertRight",
            icon: "iconLayoutRight",
            label: window.siyuan.languages.insertRight,
            accelerator: showAccelerator ? window.siyuan.languages.click : "",
            click() {
                openAsset(app, src.trim(), parseInt(getSearch("page", src)), "right");
            }
        },
        {
            id: "openBy",
            label: window.siyuan.languages.openBy,
            icon: "iconOpen",
            accelerator: showAccelerator ? "⌥" + window.siyuan.languages.click : "",
            click() {
                openAsset(app, src.trim(), parseInt(getSearch("page", src)));
            }
        }
    ];
};

// 本地资源文件桌面端额外菜单项生成函数
const generateAssetDesktopMenuItems = (src: string, showAccelerator: boolean) => {
    return [
        {
            id: "openByNewWindow",
            label: window.siyuan.languages.openByNewWindow,
            icon: "iconOpenWindow",
            accelerator: "",
            click() {
                openAssetNewWindow(src.trim());
            }
        },
        {
            id: "showInFolder",
            icon: "iconFolder",
            label: window.siyuan.languages.showInFolder,
            accelerator: showAccelerator ? "⌘" + window.siyuan.languages.click : "",
            click: () => {
                openBy(src, "folder");
            }
        },
        {
            id: "useDefault",
            label: window.siyuan.languages.useDefault,
            icon: "",
            accelerator: showAccelerator ? "⇧" + window.siyuan.languages.click : "",
            click() {
                openBy(src, "app");
            }
        }
    ];
};

// 本地资源文件菜单项生成函数
const generateAssetMenuItems = (app: App, src: string, showAccelerator: boolean) => {
    const submenu = generateAssetBaseMenuItems(app, src, showAccelerator);
    /// #if !BROWSER
    submenu.push(...generateAssetDesktopMenuItems(src, showAccelerator));
    /// #endif
    return submenu;
};

// 非资源本地文件桌面端菜单项生成函数
const generateLocalFileDesktopMenuItems = (src: string, showAccelerator: boolean) => {
    return [
        {
            id: "useDefault",
            label: window.siyuan.languages.useDefault,
            icon: "",
            accelerator: showAccelerator ? window.siyuan.languages.click : "",
            click() {
                openBy(src, "app");
            }
        },
        {
            id: "showInFolder",
            icon: "iconFolder",
            label: window.siyuan.languages.showInFolder,
            accelerator: showAccelerator ? "⌘" + window.siyuan.languages.click : "",
            click: () => {
                openBy(src, "folder");
            }
        }
    ];
};

// 非资源本地文件移动端菜单项生成函数
const generateLocalFileMobileMenuItems = (src: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
        label: isInAndroid() || isInHarmony() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
        icon: "",
        accelerator: showAccelerator ? window.siyuan.languages.click : "",
        click: () => {
            openByMobile(src);
        }
    }];
};

// 非资源本地文件菜单项生成函数
const generateLocalFileMenuItems = (src: string, showAccelerator: boolean) => {
    /// #if !BROWSER
    return generateLocalFileDesktopMenuItems(src, showAccelerator);
    /// #else
    return generateLocalFileMobileMenuItems(src, showAccelerator);
    /// #endif
};

// 外部链接桌面端菜单项生成函数
const generateExternalLinkDesktopMenuItems = (processedSrc: string, showAccelerator: boolean) => {
    return [{
        id: "useDefault",
        label: window.siyuan.languages.useDefault,
        icon: "",
        accelerator: showAccelerator ? window.siyuan.languages.click : "",
        click: () => {
            shell.openExternal(processedSrc).catch((e) => {
                showMessage(e);
            });
        }
    }];
};

// 外部链接移动端菜单项生成函数
const generateExternalLinkMobileMenuItems = (processedSrc: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
        label: isInAndroid() || isInHarmony() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
        icon: "",
        accelerator: showAccelerator ? window.siyuan.languages.click : "",
        click: () => {
            openByMobile(processedSrc);
        }
    }];
};

// 外部链接菜单项生成函数
const generateExternalLinkMenuItems = (src: string, showAccelerator: boolean) => {
    let processedSrc = src;
    if (0 > src.indexOf(":")) {
        // 使用 : 判断，不使用 :// 判断 Open external application protocol invalid https://github.com/siyuan-note/siyuan/issues/10075
        // Support click to open hyperlinks like `www.foo.com` https://github.com/siyuan-note/siyuan/issues/9986
        processedSrc = `https://${src}`;
    }
    
    /// #if !BROWSER
    return generateExternalLinkDesktopMenuItems(processedSrc, showAccelerator);
    /// #else
    return generateExternalLinkMobileMenuItems(processedSrc, showAccelerator);
    /// #endif
};

export const openMenu = (app: App, src: string, onlyMenu: boolean, showAccelerator: boolean) => {
    let submenu = [];
    
    /// #if MOBILE
    submenu = generateMobileMenuItems(src, showAccelerator);
    /// #else
    if (isLocalPath(src)) {
        if (Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(src).split("?")[0]) &&
            (!src.endsWith(".pdf") ||
                (src.endsWith(".pdf") && !src.startsWith("file://")))) {
            submenu = generateAssetMenuItems(app, src, showAccelerator);
        } else {
            submenu = generateLocalFileMenuItems(src, showAccelerator);
        }
    } else if (src) {
        submenu = generateExternalLinkMenuItems(src, showAccelerator);
    }
    /// #endif
    
    if (onlyMenu) {
        return submenu;
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "openBy",
        label: window.siyuan.languages.openBy,
        icon: "iconOpen",
        submenu
    }).element);
};
