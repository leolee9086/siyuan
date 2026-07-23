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
import {openBy} from "./utils.openBy";
/** 用途：打开资源文件。使用范围：处理本地资源链接。解耦评估：同目录模块。 */
import {openAsset} from "./util.openAsset";
/** 用途：提示消息。使用范围：打开外部链接失败时提示。解耦评估：通过 ./imports 转发。 */
import {showMessage} from "./imports";
/** 用途：移动端链接打开。使用范围：editor 移动端打开链接。解耦评估：兼容层统一处理原生容器。 */
import {openByMobile} from "../protyle/util/compatibility";
/** 用途：安全获取 window 对象。使用范围：避免直接访问全局 window。解耦评估：通过 ./imports 转发。 */
import {getWindow} from "./imports";
/** 用途：处理 SiYuan 协议链接。使用范围：所有宿主在普通链接分流前统一处理。解耦评估：同目录模块。 */
import {processSiYuanUri} from "./processSiYuanUri";

export {processSiYuanUri, processSYLink} from "./processSiYuanUri";

/** 在桌面端打开非资产本地路径 */
function openLocalPathDesktop(linkAddress: string, ctrlIsPressed: boolean) {
    if (ctrlIsPressed) {
        void openBy(linkAddress, "folder");
        return;
    }
    void openBy(linkAddress, "app");
}

/** 在桌面端打开资产链接 */
function openAssetDesktop(protyle: IProtyle, linkAddress: string, event: MouseEvent | undefined, ctrlIsPressed: boolean, pdfParams: string | number | undefined) {
    if (event?.altKey) {
        openAsset(protyle.app, linkAddress, pdfParams);
        return;
    }
    if (event?.shiftKey) {
        void openBy(linkAddress, "app");
        return;
    }
    if (ctrlIsPressed) {
        void openBy(linkAddress, "folder");
        return;
    }
    const noSplitScreen = getWindow().siyuan.config.fileTree.noSplitScreenWhenOpenTab;
    openAsset(protyle.app, linkAddress, pdfParams, noSplitScreen ? null : "right");
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
        return {link: `assets/${pdfName}`, params: pdfId};
    }
    const page = parseInt(getSearch("page", linkAddress));
    const cleanLink = linkAddress.split("?page")[0];
    return {link: cleanLink, params: page || undefined};
}

/**
 * 打开链接
 */
export const openLink = (protyle: IProtyle, aLink: string, event?: MouseEvent, ctrlIsPressed = false) => {
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

    if (!isLocalPath(linkAddress) && linkAddress) {
        openExternalLink(linkAddress);
        return;
    }
    if (!isLocalPath(linkAddress)) {
        return;
    }

    const isSiyuanAsset = Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(linkAddress));
    const isPdfFromAssets = linkAddress.endsWith(".pdf") && linkAddress.startsWith("assets/");
    if (isSiyuanAsset && (!linkAddress.endsWith(".pdf") || isPdfFromAssets)) {
        openAssetDesktop(protyle, linkAddress, event, ctrlIsPressed, pdfParams);
        return;
    }

    openLocalPathDesktop(linkAddress, ctrlIsPressed);
};

export {openByMobile};
