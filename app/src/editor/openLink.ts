/** 用途：判断路径是否为本地路径。使用范围：区分本地和外部链接。解耦评估：通过 ./imports 转发。 */
import {isLocalPath} from "./imports";
/** 用途：URL 查询参数提取。使用范围：editor 从链接中提取 page 参数。解耦评估：通过 ./imports 转发。 */
import {getSearch} from "./imports";
/** 用途：系统常量。使用范围：SIYUAN_ASSETS_EXTS 等资产扩展名判断。解耦评估：通过 ./imports 转发。 */
import {Constants} from "./imports";
/** 用途：移动端判断。使用范围：editor 区分平台行为。解耦评估：通过 ./imports 转发。 */
import {isMobile} from "./imports";
/** 用途：Electron 环境判断。使用范围：editor 桌面端特有操作。解耦评估：通过 ./imports 转发。 */
import {isElectron} from "./imports";
/** 用途：Electron Shell 外部打开。使用范围：在桌面端打开外部链接。解耦评估：通过 ./imports 转发。 */
import {openExternal} from "./imports";
/** 用途：通过系统默认方式打开。使用范围：处理文件/文件夹打开。解耦评估：同目录模块。 */
import {openBy} from "../platform/localPath/openBy";
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
/** 用途：读取已初始化配置。使用范围：资产页签分屏策略与资产打开动作配置。解耦评估：Editor 环境网关。 */
import {getSiyuanConfig} from "./imports";
/** 用途：完整应用外观。使用范围：window.open 覆盖向 URI 命令传递宿主。解耦评估：直接依赖领域根。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 用途：资产文件扩展名解析。使用范围：识别可预览资产。解耦评估：上游合并新增的路径工具。 */
import {getAssetExtension} from "../util/file/path/operations";
/** 用途：浏览器可渲染图片路径判断。使用范围：可预览资产识别。解耦评估：上游合并新增的图像工具。 */
import {isBrowserRenderableImagePath} from "../util/imageURL";
/** 用途：资产打开动作配置解析。使用范围：按用户配置与修饰键解析资产打开方式。解耦评估：上游合并新增的同目录模块。 */
import {
    DEFAULT_ASSET_OPEN,
    resolveAssetOpenAction,
    resolveExecutableAssetOpenAction,
} from "./assetOpen";
/** 用途：链接与资产的插件可取消事件。使用范围：打开前派发事件并支持拦截。解耦评估：上游合并新增的同目录模块。 */
import {emitOpenAsset, emitOpenLink, resolveOpenLinkEvent} from "./openLinkEvent";
/** 用途：独立新窗口打开资产。使用范围：new-window 动作派发。解耦评估：窗口领域既有实现。 */
import {openAssetNewWindow} from "../window/openNewWindow";

/** 通过完整应用外观处理 SiYuan URI，保留原公共函数签名。 */
export const processSiYuanUri = (app: AppFacade, uri: string) => app.processSiYuanUri(uri);
/** @deprecated 使用 processSiYuanUri。 */
export const processSYLink = processSiYuanUri;

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

/** 判断资产路径是否可在当前查看器中预览（图片类资产以及 assets/ 下的 PDF）。 */
const isPreviewableAsset = (assetPath: string) => {
    const extension = getAssetExtension(assetPath).toLowerCase();
    return Constants.SIYUAN_ASSETS_EXTS.includes(extension) &&
        isBrowserRenderableImagePath(assetPath) &&
        (extension !== ".pdf" || assetPath.startsWith("assets/"));
};

/**
 * 作用：按当前宿主、用户配置和修饰键解析资产打开动作。
 * 意图：将动作解析从链接流程中分离，保持浏览器宿主的系统应用降级策略集中且可审计。
 * 调用时机：openLink 已完成 PDF 参数提取、准备派发插件事件前。
 * 问题/改进：非资产链接仍使用默认动作，仅用于保留既有后续分流参数。
 */
const resolveLinkAssetOpenAction = (options: {
    linkAddress: string,
    isAsset: boolean,
    event?: MouseEvent,
    ctrlIsPressed: boolean,
}) => {
    let assetOpenConfig = DEFAULT_ASSET_OPEN;
    // 浏览器宿主不能执行桌面资产动作，并且非资产链接无需读取资产动作配置。
    if (options.isAsset && !isBrowser) {
        assetOpenConfig = getSiyuanConfig().editor.assetOpen;
    }
    const configuredAction = resolveAssetOpenAction(assetOpenConfig, {
        altKey: options.event?.altKey,
        shiftKey: options.event?.shiftKey,
        ctrlKey: options.ctrlIsPressed,
    });
    const action = resolveExecutableAssetOpenAction(configuredAction, {
        previewable: isPreviewableAsset(options.linkAddress),
        noSplitScreen: getSiyuanConfig().fileTree.noSplitScreenWhenOpenTab,
    });
    const browserRequiresSystemApplication = isBrowser && (action === "folder" || action === "new-window");
    // 浏览器宿主无法调用系统 Shell 或独立窗口，必须退回系统默认应用动作。
    if (browserRequiresSystemApplication) {
        return "app";
    }
    return action;
};

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

/**
 * 按已解析的动作在桌面或移动宿主中打开资产。
 * 上游合并新增的公开 API：current/right/bottom 走应用外观，
 * background/new-window/folder/app 分别交给对应能力，浏览器宿主降级为移动分流。
 */
export const openAssetByAction = (
    protyle: IProtyle,
    assetPath: string,
    page?: number | string,
    action?: Config.TAssetOpenAction,
) => {
    if (isMobile) {
        openByMobile(assetPath);
        return;
    }
    const resolvedAction = resolveExecutableAssetOpenAction(action ?? DEFAULT_ASSET_OPEN.click, {
        previewable: isPreviewableAsset(assetPath),
        noSplitScreen: getSiyuanConfig().fileTree.noSplitScreenWhenOpenTab,
    });
    if (resolvedAction === "current") {
        protyle.app.openAsset({assetPath, page});
        return;
    }
    if (resolvedAction === "right") {
        protyle.app.openAsset({assetPath, page, position: "right"});
        return;
    }
    if (resolvedAction === "bottom") {
        protyle.app.openAsset({assetPath, page, position: "bottom"});
        return;
    }
    if (resolvedAction === "background") {
        // keepCursor 让 openFile 创建后台页签并保留当前编辑器光标。
        protyle.app.openAsset({assetPath, page: page ?? "", keepCursor: true});
        return;
    }
    if (resolvedAction === "new-window" && isBrowser) {
        openByMobile(assetPath);
        return;
    }
    if (resolvedAction === "new-window") {
        openAssetNewWindow(assetPath, {}, page);
        return;
    }
    if (resolvedAction === "folder" && isBrowser) {
        openByMobile(assetPath);
        return;
    }
    if (resolvedAction === "folder") {
        void openBy(assetPath, "folder");
        return;
    }
    if (isBrowser) {
        openByMobile(assetPath);
        return;
    }
    void openBy(assetPath, "app");
};

/**
 * 作用：在默认打开前向插件派发资产或普通链接事件，并返回可继续处理的最终地址。
 * 意图：集中取消处理和普通链接规范化，防止 openLink 同时承担协议投影与宿主打开流程。
 * 调用时机：openLink 完成 PDF 参数和资产动作解析后。
 * 问题/改进：事件拒绝时使用 shouldOpen 表示控制流，避免用空字符串混淆合法空地址。
 */
const notifyPluginsBeforeOpen = (options: {
    protyle: IProtyle,
    originalHref: string,
    originalLinkAddress: string,
    linkAddress: string,
    isAsset: boolean,
    action: Config.TAssetOpenAction,
    event?: MouseEvent,
}) => {
    const openLinkEvent = resolveOpenLinkEvent({
        href: options.linkAddress,
        originalHref: options.originalHref,
        isAsset: options.isAsset,
        isLocal: isLocalPath(options.linkAddress),
        event: options.event,
    });
    // 资产事件保留解码后的原始路径和已解析动作，供插件在默认资产打开前取消。
    if (options.isAsset) {
        const shouldOpen = emitOpenAsset({
            app: options.protyle.app,
            path: options.originalLinkAddress,
            action: options.action,
            event: options.event,
        });
        return {shouldOpen, linkAddress: options.linkAddress};
    }
    // 空链接没有可派发的普通链接事件，仍交由调用方保持原有后续空值处理。
    if (!openLinkEvent) {
        return {shouldOpen: true, linkAddress: options.linkAddress};
    }
    const shouldOpen = emitOpenLink(options.protyle.app, openLinkEvent);
    return {shouldOpen, linkAddress: openLinkEvent.href};
};

/**
 * 打开链接
 * @同步豁免: UI构建
 * 点击处理必须在当前事件栈内决定是否阻止浏览器默认导航。
 * @参数豁免: 遗留代码
 * 该公开 API 的四参数签名被编辑器点击、预览和插件调用，改为对象参数会破坏现有调用协议。
 */
export function openLink(protyle: IProtyle, aLink: string, event?: MouseEvent, ctrlIsPressed = false) {
    let linkAddress = Lute.UnEscapeHTMLStr(aLink);
    const originalLinkAddress = linkAddress;
    const isAsset = linkAddress.startsWith("assets/");
    let pdfParams: string | number | undefined;

    const isPdfLink = isLocalPath(linkAddress) && !linkAddress.startsWith("file://") && linkAddress.indexOf(".pdf") > -1;
    if (isPdfLink) {
        const result = extractPdfParams(linkAddress);
        linkAddress = result.link;
        pdfParams = result.params;
    }

    const action = resolveLinkAssetOpenAction({
        linkAddress,
        isAsset,
        event,
        ctrlIsPressed,
    });

    // 插件事件先行：资产与普通链接分别派发可取消事件，任一事件被拦截即终止默认打开流程。
    const pluginDispatch = notifyPluginsBeforeOpen({
        protyle,
        originalHref: aLink,
        originalLinkAddress,
        linkAddress,
        isAsset,
        action,
        event,
    });
    if (!pluginDispatch.shouldOpen) {
        return;
    }
    linkAddress = pluginDispatch.linkAddress;

    if (processSiYuanUri(protyle.app, linkAddress)) {
        return;
    }
    if (isMobile) {
        openByMobile(linkAddress);
        return;
    }

    if (isLocalPath(linkAddress)) {
        openAssetByAction(protyle, linkAddress, pdfParams, action);
        return;
    }
    if (linkAddress) {
        openExternalLink(linkAddress);
    }
}
