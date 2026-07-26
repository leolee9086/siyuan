/** 用途：判断路径是否为本地路径。使用范围：区分本地和外部链接。解耦评估：通过 ./imports 转发。 */
import {isLocalPath} from "./imports";
/** 用途：路径处理工具。使用范围：获取文件扩展名。解耦评估：通过 ./imports 转发。 */
import {pathPosix} from "./imports";
/** 用途：URL 查询参数提取。使用范围：editor 从链接中提取 page 参数。解耦评估：通过 ./imports 转发。 */
import {getSearch} from "./imports";
/** 用途：系统常量。使用范围：CB_GET_FOCUS 等。解耦评估：通过 ./imports 转发。 */
import {Constants} from "./imports";
/** 用途：移动端判断。使用范围：editor 区分平台行为。解耦评估：通过 ./imports 转发。 */
import {isMobile} from "./imports";
/** 用途：Electron 环境判断。使用范围：editor 桌面端特有操作。解耦评估：通过 ./imports 转发。 */
import {isElectron} from "./imports";
/** 用途：Electron Shell 外部打开。使用范围：在桌面端打开外部链接。解耦评估：通过 ./imports 转发。 */
import {openExternal} from "./imports";
/** 用途：通过系统默认方式打开。使用范围：处理文件/文件夹打开。解耦评估：同目录模块。 */
import {openBy} from "../platform/localPath/openBy";
/** 用途：打开资源文件。使用范围：处理本地资源链接。解耦评估：同目录模块。 */
/** 用途：提示消息。使用范围：打开外部链接失败时提示。解耦评估：通过 ./imports 转发。 */
import {showMessage} from "./imports";
/** 用途：浏览器宿主判断。使用范围：决定 siyuan URI 是否由当前窗口接管。解耦评估：平台事实通过 Editor 网关显式登记。 */
import {isBrowser} from "./imports";
/** 用途：Android 宿主判断。使用范围：分派原生打开行为。解耦评估：复用唯一平台判断，不复制宿主检测。 */
import {isInAndroid} from "./imports";
/** 用途：Harmony 宿主判断。使用范围：分派原生打开行为。解耦评估：复用唯一平台判断，不复制宿主检测。 */
import {isInHarmony} from "./imports";
/** 用途：iOS 宿主判断。使用范围：分派原生打开行为。解耦评估：复用唯一平台判断，不复制宿主检测。 */
import {isInIOS} from "./imports";
/** 用途：任意移动应用宿主判断。使用范围：window.open 分流。解耦评估：复用唯一组合判断。 */
import {isInMobileApp} from "./imports";
/** 用途：识别 SiYuan URI。使用范围：window.open 覆盖的协议分流。解耦评估：纯路径协议判断。 */
import {isSiYuanUriProtocol} from "./imports";
/** 用途：安全获取 window 对象。使用范围：避免直接访问全局 window。解耦评估：通过 ./imports 转发。 */
import {getWindow} from "./imports";
/** 用途：读取已初始化配置。使用范围：资产页签分屏策略。解耦评估：Editor 环境网关。 */
import {getSiyuanConfig} from "./imports";
/** 用途：处理 SiYuan 协议链接。使用范围：所有宿主在普通链接分流前统一处理。解耦评估：同目录模块。 */
import {processSiYuanUri} from "./processSiYuanUri";
/** 用途：历史 SiYuan URI 入口别名。使用范围：保留 openLink 旧公共导出。解耦评估：同域静态别名。 */
import {processSYLink} from "./processSiYuanUri";
/** 用途：完整应用外观。使用范围：window.open 覆盖向 URI 命令传递宿主。解耦评估：直接依赖领域根。 */
import type {AppFacade} from "../app/AppFacade.types";

/** 导出当前 SiYuan URI 入口。 */
export {processSiYuanUri};
/** 导出历史 SiYuan URI 入口别名。 */
export {processSYLink};

/** 在 iOS 原生容器中按资产、站内路径和外部地址顺序打开链接。 */
const openByIOS = (runtimeWindow: Window, uri: string) => {
    // 资产相对路径需要保留查询参数，并只编码实际资产路径部分。
    if (uri.startsWith("assets/")) {
        const assetPathAndQuery = uri.substring("assets/".length);
        const queryIndex = assetPathAndQuery.indexOf("?");
        const assetPath = queryIndex < 0 ? assetPathAndQuery : assetPathAndQuery.substring(0, queryIndex);
        const query = queryIndex < 0 ? "" : assetPathAndQuery.substring(queryIndex);
        runtimeWindow.webkit.messageHandlers.openLink.postMessage(
            runtimeWindow.location.origin + "/assets/" + encodeURIComponent(assetPath) + query);
        return;
    }
    // 站内绝对路径直接拼接当前源，避免再次编码已编码的导出地址。
    if (uri.startsWith("/")) {
        runtimeWindow.webkit.messageHandlers.openLink.postMessage(runtimeWindow.location.origin + uri);
        return;
    }
    try {
        new URL(uri);
        runtimeWindow.webkit.messageHandlers.openLink.postMessage(uri);
    } catch (error) {
        runtimeWindow.webkit.messageHandlers.openLink.postMessage("https://" + uri);
    }
};

/**
 * 在当前桌面或移动宿主中打开外部地址。
 * @同步豁免: UI构建
 * 链接点击调用方依赖当前事件栈内完成协议分流和原生桥接派发。
 */
export const openByMobile = (uri: string) => {
    if (!uri) {
        return;
    }
    const runtimeWindow = getWindow();
    if (isMobile && processSiYuanUri(runtimeWindow.siyuan.ws.app, uri)) {
        return;
    }
    // iOS WebView 通过原生消息通道打开链接。
    if (isInIOS()) {
        openByIOS(runtimeWindow, uri);
        return;
    }
    // Android 宿主使用 JSAndroid 桥接外部浏览器。
    if (isInAndroid()) {
        runtimeWindow.JSAndroid.openExternal(uri);
        return;
    }
    // Harmony 宿主使用 JSHarmony 桥接外部浏览器。
    if (isInHarmony()) {
        runtimeWindow.JSHarmony.openExternal(uri);
        return;
    }
    runtimeWindow.open(uri);
};

/**
 * 在应用启动阶段安装统一的 window.open URI 分流。
 * @同步豁免: 生命周期
 * 覆盖必须在后续页面代码首次调用 window.open 前完成。
 */
export const initWindowOpenOverride = (app: AppFacade, openExternalURL?: (url: string) => void) => {
    const runtimeWindow = getWindow();
    const originalOpen = runtimeWindow.open;
    runtimeWindow.open = function (url?: string | URL, target?: string, features?: string) {
        const urlStr = typeof url === "string" ? url : (url ? String(url) : "");
        // 当前宿主应接管的 SiYuan URI 直接进入应用命令，不再交给浏览器导航。
        if (isSiYuanUriProtocol(urlStr) && (!isBrowser || isInMobileApp() || target !== "_blank")) {
            processSiYuanUri(app, urlStr);
            return null;
        }
        // 移动应用中的普通外链由宿主提供的外部打开能力处理。
        if (isInMobileApp() && urlStr && openExternalURL) {
            openExternalURL(urlStr);
            return null;
        }
        return originalOpen.call(runtimeWindow, url, target, features);
    };
};

/** 在桌面端打开非资产本地路径 */
function openLocalPathDesktop(linkAddress: string, ctrlIsPressed: boolean) {
    if (ctrlIsPressed) {
        void openBy(linkAddress, "folder");
        return;
    }
    void openBy(linkAddress, "app");
}

/** 在桌面端按修饰键语义打开资产链接。 */
function openAssetDesktop(options: {
    protyle: IProtyle;
    linkAddress: string;
    event?: MouseEvent;
    ctrlIsPressed: boolean;
    pdfParams?: string | number;
}) {
    // Alt 点击在当前宿主中直接打开资产。
    if (options.event?.altKey) {
        options.protyle.app.openAsset({assetPath: options.linkAddress, page: options.pdfParams});
        return;
    }
    // Shift 点击明确交给系统默认应用。
    if (options.event?.shiftKey) {
        void openBy(options.linkAddress, "app");
        return;
    }
    if (options.ctrlIsPressed) {
        void openBy(options.linkAddress, "folder");
        return;
    }
    const noSplitScreen = getSiyuanConfig().fileTree.noSplitScreenWhenOpenTab;
    options.protyle.app.openAsset({
        assetPath: options.linkAddress,
        page: options.pdfParams,
        position: noSplitScreen ? null : "right",
    });
}

/** 打开外部链接 */
function openExternalLink(linkAddress: string) {
    const normalizedLink = linkAddress.indexOf(":") < 0 ? `https://${linkAddress}` : linkAddress;
    if (isElectron) {
        openExternal(normalizedLink).catch((error: unknown) => {
            showMessage(error instanceof Error ? error.message : String(error));
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
    if (pdfAddress.length === 3 && pdfAddress[0] === "assets" && pdfName?.endsWith(".pdf") &&
        typeof pdfId === "string" && /\d{14}-\w{7}/.test(pdfId)) {
        return {link: `assets/${pdfName}`, params: pdfId};
    }
    const page = parseInt(getSearch("page", linkAddress) ?? "");
    const cleanLink = linkAddress.split("?page")[0] ?? linkAddress;
    return {link: cleanLink, params: page || undefined};
}

/**
 * 打开链接
 * @同步豁免: UI构建
 * 点击处理必须在当前事件栈内决定是否阻止浏览器默认导航。
 * @参数豁免: 遗留代码
 * 该公开 API 的四参数签名被编辑器点击、预览和插件调用，改为对象参数会破坏现有调用协议。
 */
export function openLink(protyle: IProtyle, aLink: string, event?: MouseEvent, ctrlIsPressed = false) {
    let linkAddress = Lute.UnEscapeHTMLStr(aLink);
    let pdfParams: string | number | undefined;

    const isPdfLink = isLocalPath(linkAddress) && !linkAddress.startsWith("file://") && linkAddress.indexOf(".pdf") > -1;
    if (isPdfLink) {
        const result = extractPdfParams(linkAddress);
        linkAddress = result.link;
        pdfParams = result.params;
    }

    if (processSiYuanUri(protyle.app, linkAddress)) {
        return;
    }
    if (isMobile) {
        openByMobile(linkAddress);
        return;
    }

    // 非本地地址交给当前桌面或移动宿主的外部链接能力。
    if (!isLocalPath(linkAddress) && linkAddress) {
        openExternalLink(linkAddress);
        return;
    }
    if (!isLocalPath(linkAddress)) {
        return;
    }

    const isSiyuanAsset = Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(linkAddress));
    const isPdfFromAssets = linkAddress.endsWith(".pdf") && linkAddress.startsWith("assets/");
    // 思源资产由内建资产查看器处理，普通 PDF 相对路径保留原分流语义。
    if (isSiyuanAsset && (!linkAddress.endsWith(".pdf") || isPdfFromAssets)) {
        openAssetDesktop({
            protyle,
            linkAddress,
            ...(event ? {event} : {}),
            ctrlIsPressed,
            ...(typeof pdfParams === "undefined" ? {} : {pdfParams}),
        });
        return;
    }

    openLocalPathDesktop(linkAddress, ctrlIsPressed);
}
