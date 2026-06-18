/** 用途：路径和协议解析工具。使用范围：editor 处理链接协议。解耦评估：通过 ./imports 转发。 */
/** 用途：从 siyuan:// 协议 URL 中提取块 ID。使用范围：处理协议链接。解耦评估：通过 ./imports 转发。 */
import { getIdFromSYProtocol } from "./imports";
/** 用途：判断路径是否为本地路径。使用范围：区分本地和外部链接。解耦评估：通过 ./imports 转发。 */
import { isLocalPath } from "./imports";
/** 用途：判断 URL 是否为 siyuan:// 协议。使用范围：协议拦截。解耦评估：通过 ./imports 转发。 */
import { isSYProtocol } from "./imports";
/** 用途：路径处理工具。使用范围：获取文件扩展名。解耦评估：通过 ./imports 转发。 */
import { pathPosix } from "./imports";
/** 用途：URL 查询参数提取。使用范围：editor 从链接中提取 page 参数。解耦评估：通过 ./imports 转发。 */
import { getSearch } from "./imports";
/** 用途：系统常量。使用范围：CB_GET_FOCUS 等。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：移动端判断。使用范围：editor 区分平台行为。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：Electron 环境判断。使用范围：editor 桌面端特有操作。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";
/** 用途：Electron Shell 外部打开。使用范围：在桌面端打开外部链接。解耦评估：通过 ./imports 转发。 */
import { openExternal } from "./imports";
/** 用途：Electron IPC 发送。使用范围：发送窗口前置命令。解耦评估：通过 ./imports 转发。 */
import { ipcSend } from "./imports";
/** 用途：打开编辑器页签。使用范围：处理自定义页签打开。解耦评估：同目录模块。 */
import { openFile } from "./util";
/** 用途：通过 ID 打开文件。使用范围：处理 siyuan:// 协议链接。解耦评估：同目录模块。 */
import { openFileById } from "./utils.openFileById";
/** 用途：通过系统默认方式打开。使用范围：处理文件/文件夹打开。解耦评估：同目录模块。 */
import { openBy } from "./utils.openBy";
/** 用途：打开资源文件。使用范围：处理本地资源链接。解耦评估：同目录模块。 */
import { openAsset } from "./util.openAsset";
/** 用途：提示消息。使用范围：打开外部链接失败时提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：移动端链接打开。使用范围：移动端打开链接。解耦评估：通过 ./imports 转发。 */
import { openByMobile } from "./imports";
/** 用途：应用实例类型。使用范围：processSYLink 参数。解耦评估：通过 ./imports 转发。 */
import { App } from "./imports";
/** 用途：网络请求。使用范围：检查块是否存在。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：检查折叠状态。使用范围：打开链接时确定聚焦行为。解耦评估：通过 ./imports 转发。 */
import { checkFold } from "./imports";
/** 用途：移动端通过 ID 打开文件。使用范围：移动端打开块链接。解耦评估：通过 ./imports 转发。 */
import { openMobileFileById } from "./imports";
/** 用途：安全获取 window 对象。使用范围：避免直接访问全局 window。解耦评估：通过 ./imports 转发。 */
import { getWindow } from "./imports";

/** 匹配插件协议 */
function matchPluginProtocol(plugin: { name: string; eventBus: { emit: (event: string, data: unknown) => void } }, url: string, urlObj: URL, app: App, pluginNameType: string) {
    if (!pluginNameType.startsWith(plugin.name)) {
        return;
    }
    plugin.eventBus.emit("open-siyuan-url-plugin", { url });
    const splitName = pluginNameType.split("/");
const isCustomTab = !isMobile && splitName[0] !== plugin.name;
    if (isCustomTab) {
        openCustomPluginTab(app, urlObj, pluginNameType);
    }
    return true;
}

/** 打开自定义插件页签 */
function openCustomPluginTab(app: App, urlObj: URL, pluginNameType: string) {
    let data = urlObj.searchParams.get("data");
    try {
        data = JSON.parse(data || "{}");
    } catch (e) {
        console.log("Error open plugin tab with protocol:", e);
    }
    openFile({
        app,
        custom: {
            title: urlObj.searchParams.get("title"),
            icon: urlObj.searchParams.get("icon"),
            data,
            id: pluginNameType,
        },
    });
}

/** 处理折叠后定位 */
function handleFoldResult(zoomIn: boolean, app: App, id: string, focus: boolean) {
    const hasFocus = zoomIn || focus;
    const action = hasFocus
        ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HL, Constants.CB_GET_ALL]
        : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
    if (isMobile) {
        openMobileFileById(app, id, action);
        return;
    }
    openFileById({ app, id, action, zoomIn: hasFocus });
}

/** 处理块存在响应 */
function handleBlockExistResponse(existResponse: { data: boolean }, app: App, url: string, id: string, focus: boolean) {
    if (existResponse.data) {
        checkFold(id, (zoomIn) => {
            handleFoldResult(zoomIn, app, id, focus);
        });
    }
    // Electron 环境下将窗口前置
    if (isElectron && existResponse.data) {
        ipcSend(Constants.SIYUAN_CMD, "show");
    }
    for (const plugin of app.plugins) {
        plugin.eventBus.emit("open-siyuan-url-block", { url, id, focus, exist: existResponse.data });
    }
}

/** 处理 siyuan:// 协议块链接 */
function handleSiyuanProtocol(app: App, url: string, urlObj: URL) {
    const id = getIdFromSYProtocol(url);
    const focus = urlObj.searchParams.get("focus") === "1";
    getWindow().siyuan.editorIsFullscreen = urlObj.searchParams.get("fullscreen") === "1";
    fetchPost("/api/block/checkBlockExist", { id }, (existResponse) => {
        handleBlockExistResponse(existResponse, app, url, id, focus);
    });
}

/** 在桌面端打开非资产本地路径 */
function openLocalPathDesktop(linkAddress: string, ctrlIsPressed: boolean) {
    if (ctrlIsPressed) {
        openBy(linkAddress, "folder");
        return;
    }
    openBy(linkAddress, "app");
}

/** 在桌面端打开资产链接 */
function openAssetDesktop(protyle: IProtyle, linkAddress: string, event: MouseEvent | undefined, ctrlIsPressed: boolean, pdfParams: string | number | undefined) {
    // Alt+Click 直接打开资产
    if (event?.altKey) {
        openAsset(protyle.app, linkAddress, pdfParams);
        return;
    }
    // Shift+Click 用系统默认程序打开
    if (event?.shiftKey) {
        openBy(linkAddress, "app");
        return;
    }
    if (ctrlIsPressed) {
        openBy(linkAddress, "folder");
        return;
    }
    const noSplitScreen = getWindow().siyuan.config.fileTree.noSplitScreenWhenOpenTab;
    openAsset(protyle.app, linkAddress, pdfParams, !noSplitScreen ? "right" : null);
}

/** 打开外部链接 */
function openExternalLink(linkAddress: string) {
    const normalizedLink = linkAddress.indexOf(":") < 0 ? `https://${linkAddress}` : linkAddress;
    if (isElectron) {
        openExternal(normalizedLink).catch((e: unknown) => {
            showMessage(e);
        });
        return;
    }
    openByMobile(normalizedLink);
}

/** 提取 PDF 参数 */
function extractPdfParams(linkAddress: string) {
    const pdfAddress = linkAddress.split("/");
    const pdfName = pdfAddress[1];
    const pdfId = pdfAddress[2];
    if (pdfAddress.length === 3 && pdfAddress[0] === "assets" && pdfName?.endsWith(".pdf") && /\d{14}-\w{7}/.test(pdfId)) {
        return { link: `assets/${pdfName}`, params: pdfId };
    }
    const page = parseInt(getSearch("page", linkAddress));
    const cleanLink = linkAddress.split("?page")[0];
    return { link: cleanLink, params: page || undefined };
}

/** 处理插件协议链接 */
function handlePluginProtocol(app: App, url: string, urlObj: URL) {
    const pathParts = urlObj.pathname.split("/");
const pluginNameType = pathParts[1];
    if (!pluginNameType) {
        return;
    }
    app.plugins.find((plugin: Record<string, unknown>) => matchPluginProtocol(plugin, url, urlObj, app, pluginNameType));
}

/**
 * 处理 SiYuan 内部协议链接
 */
export const processSYLink = async (app: App, url: string) => {
    let urlObj: URL;
    try {
        urlObj = new URL(url);
    } catch (error) {
        return false;
    }
    if (urlObj.protocol !== "siyuan:") {
        return false;
    }

    // 处理插件协议链接
    if (urlObj.hostname === "plugins") {
        handlePluginProtocol(app, url, urlObj);
        return true;
    }

    // 处理块协议链接
    if (isSYProtocol(url)) {
        handleSiyuanProtocol(app, url, urlObj);
        return true;
    }
    return false;
};

/**
 * 打开链接
 */
export const openLink = async (protyle: IProtyle, aLink: string, event?: MouseEvent, ctrlIsPressed = false) => {
    let linkAddress = Lute.UnEscapeHTMLStr(aLink);
    let pdfParams: string | number | undefined;

    const isPdfLink = isLocalPath(linkAddress) && !linkAddress.startsWith("file://") && linkAddress.indexOf(".pdf") > -1;
    if (isPdfLink) {
        const result = extractPdfParams(linkAddress);
        linkAddress = result.link;
        pdfParams = result.params;
    }

    // 移动端统一使用移动端打开方式
    if (isMobile) {
        openByMobile(linkAddress);
        return;
    }

    // 非本地路径视为外部链接
    if (!isLocalPath(linkAddress) && linkAddress) {
        openExternalLink(linkAddress);
        return;
    }
    if (!isLocalPath(linkAddress)) {
        return;
    }

    // 是思源可识别的资产文件
    const isSiyuanAsset = Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(linkAddress));
    const isPdfFromAssets = linkAddress.endsWith(".pdf") && linkAddress.startsWith("assets/");
    // 是思源可识别的资产文件（PDF 仅限 assets/ 开头）
    if (isSiyuanAsset && (!linkAddress.endsWith(".pdf") || isPdfFromAssets)) {
        openAssetDesktop(protyle, linkAddress, event, ctrlIsPressed, pdfParams);
        return;
    }

    // 其他本地路径
    openLocalPathDesktop(linkAddress, ctrlIsPressed);
};

