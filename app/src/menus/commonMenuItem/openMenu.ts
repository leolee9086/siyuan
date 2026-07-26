import { openExternal } from "../../platform/electron/shell";
import { openAssetNewWindow } from "../../window/openNewWindow";
import type { AppFacade } from "../../app/AppFacade.types";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import {openBy} from "../../platform/localPath/openBy";
import { isElectron } from "../../platform";
import {isInAndroid, isInHarmony} from "../../protyle/util/compatibility";
import {openByMobile} from "../../editor/openLink";
import { getSearch, isMobile } from "../../util/platform/functions";
import { isLocalPath, pathPosix } from "../../util/file/pathName";
import { MenuItem } from "../Menu.Item";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";


// 移动端菜单项生成函数

const generateMobileMenuItems = (src: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() ? "useDefault" : "useBrowserView",
        label: isInAndroid() ? siyuanI18n.useDefault : siyuanI18n.useBrowserView,
        accelerator: showAccelerator ? siyuanI18n.click : "",
        click: () => {
            openByMobile(src);
        }
    }];
};
// 非资源本地文件移动端菜单项生成函数
const generateLocalFileMobileMenuItems = (src: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
        label: isInAndroid() || isInHarmony() ? siyuanI18n.useDefault : siyuanI18n.useBrowserView,
        icon: "",
        accelerator: showAccelerator ? siyuanI18n.click : "",
        click: () => {
            openByMobile(src);
        }
    }];
};
// 外部链接移动端菜单项生成函数
const generateExternalLinkMobileMenuItems = (processedSrc: string, showAccelerator: boolean) => {
    return [{
        id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
        label: isInAndroid() || isInHarmony() ? siyuanI18n.useDefault : siyuanI18n.useBrowserView,
        icon: "",
        accelerator: showAccelerator ? siyuanI18n.click : "",
        click: () => {
            openByMobile(processedSrc);
        }
    }];
};

// 本地资源文件基础菜单项生成函数
const generateAssetBaseMenuItems = (app: AppFacade, src: string, showAccelerator: boolean): IMenu[] => {
    return [
        {
            id: "insertRight",
            icon: "iconLayoutRight",
            label: siyuanI18n.insertRight,
            accelerator: showAccelerator ? siyuanI18n.click : "",
            click() {
                const pageIndexString = getSearch("page", src) || "0";

                app.openAsset({assetPath: src.trim(), page: parseInt(pageIndexString), position: "right"});
            }
        },
        {
            id: "openBy",
            label: siyuanI18n.openBy,
            icon: "iconOpen",
            accelerator: showAccelerator ? "⌥" + siyuanI18n.click : "",
            click() {
                const pageIndexString = getSearch("page", src) || "0";
                app.openAsset({assetPath: src.trim(), page: parseInt(pageIndexString)});
            }
        }
    ];
};

// 本地资源文件桌面端额外菜单项生成函数
const generateAssetDesktopMenuItems = (src: string, showAccelerator: boolean) => {
    return [
        {
            id: "openByNewWindow",
            label: siyuanI18n.openByNewWindow,
            icon: "iconOpenWindow",
            accelerator: "",
            click() {
                openAssetNewWindow(src.trim());
            }
        },
        {
            id: "showInFolder",
            icon: "iconFolder",
            label: siyuanI18n.showInFolder,
            accelerator: showAccelerator ? "⌘" + siyuanI18n.click : "",
            click: () => {
                openBy(src, "folder");
            }
        },
        {
            id: "useDefault",
            label: siyuanI18n.useDefault,
            icon: "",
            accelerator: showAccelerator ? "⇧" + siyuanI18n.click : "",
            click() {
                openBy(src, "app");
            }
        }
    ];
};

// 本地资源文件菜单项生成函数
const generateAssetMenuItems = (app: AppFacade, src: string, showAccelerator: boolean) => {
    const submenu = generateAssetBaseMenuItems(app, src, showAccelerator);
    // 桌面端追加"新窗口打开"、"在文件夹中显示"、"使用默认应用打开"菜单项
    if (isElectron) {
        const desktopSubmenu = generateAssetDesktopMenuItems(src, showAccelerator);
        submenu.push(...desktopSubmenu);
    }
    return submenu;
};

// 非资源本地文件桌面端菜单项生成函数
const generateLocalFileDesktopMenuItems = (src: string, showAccelerator: boolean) => {
    return [
        {
            id: "useDefault",
            label: siyuanI18n.useDefault,
            icon: "",
            accelerator: showAccelerator ? siyuanI18n.click : "",
            click() {
                openBy(src, "app");
            }
        },
        {
            id: "showInFolder",
            icon: "iconFolder",
            label: siyuanI18n.showInFolder,
            accelerator: showAccelerator ? "⌘" + siyuanI18n.click : "",
            click: () => {
                openBy(src, "folder");
            }
        }
    ];
};



// 非资源本地文件菜单项生成函数
const generateLocalFileMenuItems = (src: string, showAccelerator: boolean) => {
    // 桌面端提供"使用默认应用打开"和"在文件夹中显示"，移动端使用系统浏览器打开
    if (isElectron) {
        return generateLocalFileDesktopMenuItems(src, showAccelerator);
    }
    return generateLocalFileMobileMenuItems(src, showAccelerator);
};

// 外部链接桌面端菜单项生成函数
const generateExternalLinkDesktopMenuItems = (processedSrc: string, showAccelerator: boolean) => {
    return [{
        id: "useDefault",
        label: siyuanI18n.useDefault,
        icon: "",
        accelerator: showAccelerator ? siyuanI18n.click : "",
        click: () => {
            openExternal(processedSrc).catch((e) => {
                showMessage(e);
            });
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
    // 桌面端使用 electron shell 打开外部链接，移动端使用系统浏览器
    if (isElectron) {
        return generateExternalLinkDesktopMenuItems(processedSrc, showAccelerator);
    }
    return generateExternalLinkMobileMenuItems(processedSrc, showAccelerator);
};

export const openMenu = (app: AppFacade, src: string, onlyMenu: boolean, showAccelerator: boolean) => {
    let submenu = [];

    if (isMobile()) {
        submenu = generateMobileMenuItems(src, showAccelerator);
    }
    if (!isMobile()) {
        if (isLocalPath(src)) {
            const ext = pathPosix().extname(src).split("?")[0];
            if (Constants.SIYUAN_ASSETS_EXTS.includes(ext || "") &&
                (!src.endsWith(".pdf") ||
                    (src.endsWith(".pdf") && !src.startsWith("file://")))) {
                submenu = generateAssetMenuItems(app, src, showAccelerator);
            } else {
                submenu = generateLocalFileMenuItems(src, showAccelerator);
            }

        }
        if (!isLocalPath(src) && src) {
            submenu = generateExternalLinkMenuItems(src, showAccelerator);
        }
    }

    if (onlyMenu) {
        return submenu;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        submenu
    }).element);
};
