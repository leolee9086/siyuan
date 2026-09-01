import {focusByRange} from "./selection";
import {fetchSyncPost} from "../../util/network/fetch";
import {Constants} from "../../constants";
import {isBrowser, isElectron} from "../../platform";
import {ipcInvoke, ipcSendSync} from "../../platform/electron/ipcRenderer";
import type {SaveDialogReturnValue} from "electron";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {hideMessage, showMessage} from "../runtime/dialog.port";
import {isMac} from "../../util/platform/hotkey/format";
import {isNotCtrl} from "../../util/platform/hotkey/format";
import {isOnlyMeta} from "../../util/platform/hotkey/format";
import {updateHotkeyAfterTip} from "../../util/platform/hotkey/format";
import {updateHotkeyTip} from "../../util/platform/hotkey/format";
import {getEventName} from "../../util/platform/functions";
import {isIPad} from "../../util/platform/functions";
import {isIPhone} from "../../util/platform/functions";
import {setStorageVal} from "../../util/storage/setStorageVal";
import {getWindowJSAndroid, getWindowJSHarmony, getWindowWebkit} from "../../util/siyuanEnvironments/windowNative.environment";
import {genUUID} from "../../util/platform/genID";
import {buildWebClipboardHTML, getTextSiyuanFromTextHTML} from "./clipboardData";
export {getLocalStorage} from "./localStorage/initialize";

export {encodeBase64, getTextSiyuanFromTextHTML} from "./clipboardData";

export {getEventName};
export {isIPad};
export {isIPhone};
export {isMac};
export {isNotCtrl};
export {isOnlyMeta};
export {updateHotkeyAfterTip};
export {updateHotkeyTip};
export {setStorageVal};

export type TSaveExportFileResult = {
    status: "success" | "canceled" | "error";
    name?: string;
    message?: string;
};

const mobileExportFileRequests = new Map<string, (result: TSaveExportFileResult) => void>();

window.handleSaveExportFileResult = (requestID: string, resultJSON: string) => {
    const resolve = mobileExportFileRequests.get(requestID);
    if (!resolve) {
        return;
    }
    mobileExportFileRequests.delete(requestID);
    try {
        const result = JSON.parse(resultJSON) as TSaveExportFileResult;
        if (["success", "canceled", "error"].includes(result.status)) {
            resolve(result);
            return;
        }
    } catch (e) {
        console.error("parse saveExportFile result failed:", e);
    }
    resolve({status: "error"});
};

const waitMobileExportFile = (callback: (requestID: string) => void) => {
    return new Promise<TSaveExportFileResult>((resolve) => {
        const requestID = genUUID();
        mobileExportFileRequests.set(requestID, resolve);
        try {
            callback(requestID);
        } catch (e) {
            mobileExportFileRequests.delete(requestID);
            console.error("saveExportFile failed:", e);
            resolve({status: "error", message: String(e)});
        }
    });
};

export const isPhablet = () => {
    return /Android|webOS|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) || isIPhone() || isIPad();
};

export const saveExportFile = async (uri: string, msgId?: string): Promise<TSaveExportFileResult> => {
    if (!uri) {
        return {status: "error"};
    }
    if (isElectron) {
        let saveErrorMsgId: string | undefined;
        try {
            const resolved = new URL(uri, `${location.origin}/`);
            const pathSeg = resolved.pathname.substring(resolved.pathname.lastIndexOf("/") + 1);
            let fileName: string;
            try {
                fileName = decodeURIComponent(pathSeg);
            } catch {
                fileName = pathSeg;
            }
            if (!fileName) {
                fileName = "download";
            }
            let defaultPath = fileName;
            while (true) {
                const result = await ipcInvoke<SaveDialogReturnValue>(Constants.SIYUAN_GET, {
                    cmd: "showSaveDialog",
                    defaultPath,
                    properties: ["showOverwriteConfirmation"],
                });
                if (result?.canceled || !result?.filePath) {
                    if (msgId) {
                        hideMessage(msgId);
                    }
                    if (saveErrorMsgId) {
                        hideMessage(saveErrorMsgId);
                    }
                    return {status: "canceled"};
                }
                const copyResponse = await (await fetch("/api/export/copyExportFile", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        srcPath: resolved.pathname,
                        dest: result.filePath,
                    }),
                })).json();
                if (copyResponse.code === 0) {
                    break;
                }
                console.error("saveExportFile failed:", new Error(copyResponse.msg));
                if (saveErrorMsgId) {
                    showMessage(siyuanI18n.exportFileSaveFailed, 0, "error", saveErrorMsgId);
                } else {
                    saveErrorMsgId = showMessage(siyuanI18n.exportFileSaveFailed, 0, "error");
                }
                defaultPath = result.filePath;
            }
            if (msgId) {
                hideMessage(msgId);
            }
            if (saveErrorMsgId) {
                hideMessage(saveErrorMsgId);
            }
            showMessage(siyuanI18n.exported);
            return {status: "success", name: fileName};
        } catch (e) {
            if (msgId) {
                hideMessage(msgId);
            }
            console.error("saveExportFile failed:", e);
            if (saveErrorMsgId) {
                showMessage(siyuanI18n.exportFileSaveFailed, 0, "error", saveErrorMsgId);
            } else {
                showMessage(siyuanI18n.exportFileSaveFailed, 0, "error");
            }
            return {status: "error", message: String(e)};
        }
    }
    try {
        let result: TSaveExportFileResult;
        let hasCompletionResult = false;
        if (isInAndroid()) {
            if (window.JSAndroid.saveExportFileV2) {
                result = await waitMobileExportFile((requestID) => {
                    window.JSAndroid.saveExportFileV2(uri, requestID);
                });
                hasCompletionResult = true;
            } else {
                window.JSAndroid.saveExportFile(uri);
                result = {status: "success"};
            }
        } else if (isInIOS()) {
            if (window.webkit.messageHandlers.saveExportFileV2) {
                result = await waitMobileExportFile((requestID) => {
                    window.webkit.messageHandlers.saveExportFileV2.postMessage({uri, requestID});
                });
                hasCompletionResult = true;
            } else {
                window.webkit.messageHandlers.saveExportFile.postMessage(uri);
                result = {status: "success"};
            }
        } else if (isInHarmony()) {
            if (window.JSHarmony.saveExportFileV2) {
                result = await waitMobileExportFile((requestID) => {
                    window.JSHarmony.saveExportFileV2(uri, requestID);
                });
                hasCompletionResult = true;
            } else {
                window.JSHarmony.saveExportFile(uri);
                result = {status: "success"};
            }
        } else {
            const openUrl = new URL(uri, `${location.origin}/`);
            openUrl.searchParams.set("download", "true");
            window.open(openUrl.href);
            result = {status: "success"};
        }
        if (msgId) {
            hideMessage(msgId);
        }
        if (hasCompletionResult && result.status === "success") {
            showMessage(window.siyuan.languages.exported);
        }
        return result;
    } catch (e) {
        if (msgId) {
            hideMessage(msgId);
        }
        showMessage("saveExportFile failed: " + e);
        return {status: "error", message: String(e)};
    }
};

export const saveZipExport = async (zipPath: string, msgId?: string) => {
    if (!zipPath) {
        return;
    }
    await saveExportFile(zipPath, msgId);
};

export const readText = () => {
    if (isInAndroid()) {
        return window.JSAndroid.readClipboard();
    } else if (isInHarmony()) {
        return window.JSHarmony.readClipboard();
    }
    if (typeof navigator.clipboard === "undefined") {
        alert(siyuanI18n.clipboardPermissionDenied);
        return "";
    }
    return navigator.clipboard.readText().catch(() => {
        alert(siyuanI18n.clipboardPermissionDenied);
    }) || "";
};

export const getLocalFiles = async (): Promise<ILocalFiles[]> => {
    if (isBrowser) {
        return [];
    }
    // 不再支持 PC 浏览器 https://github.com/siyuan-note/siyuan/issues/7206
    let localFiles: ILocalFiles[] = [];
    if ("darwin" === getSiyuanConfig().system.os) {
        const xmlString = await ipcSendSync(Constants.SIYUAN_GET, {
            cmd: "clipboardRead",
            format: "NSFilenamesPboardType",
        });
        if (typeof xmlString === "string" && xmlString) {
            const domParser = new DOMParser();
            const xmlDom = domParser.parseFromString(xmlString, "application/xml");
            Array.from(xmlDom.getElementsByTagName("string")).forEach(item => {
                const path = item.childNodes[0]?.nodeValue;
                if (path) {
                    localFiles.push({path, size: 0});
                }
            });
        }
    } else {
        const xmlString = await fetchSyncPost("/api/clipboard/readFilePaths", {});
        if (xmlString.data.length > 0) {
            localFiles = xmlString.data;
        }
    }
    return localFiles;
};

export const readClipboard = async () => {
    const text: IClipboardData = { textPlain: "", textHTML: "", siyuanHTML: "" };
    if (isInAndroid()) {
        text.textPlain = window.JSAndroid.readClipboard();
        text.textHTML = window.JSAndroid.readHTMLClipboard();
        const textObj = getTextSiyuanFromTextHTML(text.textHTML);
        text.textHTML = textObj.textHtml;
        text.siyuanHTML = textObj.textSiyuan;
        if (!text.siyuanHTML) {
            text.siyuanHTML = window.JSAndroid.readSiYuanHTMLClipboard();
        }
        return text;
    }
    if (isInHarmony()) {
        text.textPlain = window.JSHarmony.readClipboard();
        text.textHTML = window.JSHarmony.readHTMLClipboard();
        const textObj = getTextSiyuanFromTextHTML(text.textHTML);
        text.textHTML = textObj.textHtml;
        text.siyuanHTML = textObj.textSiyuan;
        if (!text.siyuanHTML) {
            text.siyuanHTML = window.JSHarmony.readSiYuanHTMLClipboard();
        }
        return text;
    }
    if (typeof navigator.clipboard === "undefined") {
        alert(siyuanI18n.clipboardPermissionDenied);
        return text;
    }
    try {
        const clipboardContents = await navigator.clipboard.read().catch(() => {
            alert(siyuanI18n.clipboardPermissionDenied);
        });
        if (!clipboardContents) {
            return text;
        }
        for (const item of clipboardContents) {
            if (item.types.includes("text/html")) {
                const blob = await item.getType("text/html");
                text.textHTML = await blob.text();
                const textObj = getTextSiyuanFromTextHTML(text.textHTML);
                text.textHTML = textObj.textHtml;
                text.siyuanHTML = textObj.textSiyuan;
            }
            if (item.types.includes("text/plain")) {
                const blob = await item.getType("text/plain");
                text.textPlain = await blob.text();
            }
            if (item.types.includes("image/png")) {
                const blob = await item.getType("image/png");
                text.files = [new File([blob], "image.png", { type: "image/png", lastModified: Date.now() })];
            }
        }
        if (isElectron && !text.textHTML && !text.files) {
            text.localFiles = await getLocalFiles();
        }
        return text;
    } catch (e) {
        return text;
    }
};

const writeTextWithDocumentCommand = (text: string, range?: Range) => {
    const textElement = document.createElement("textarea");
    textElement.value = text;
    textElement.style.position = "fixed"; // Avoid scrolling to bottom.
    document.body.appendChild(textElement);
    textElement.focus();
    textElement.select();
    const written = document.execCommand("copy");
    document.body.removeChild(textElement);
    if (range) {
        focusByRange(range);
    }
    return written;
};

/**
 * Writes plain text and reports whether the active platform accepted it. This
 * is used by mutation flows, which must not change the document after a failed
 * clipboard operation.
 */
export const writeTextAndConfirm = async (text: string) => {
    const selection = window.getSelection();
    let range: Range | undefined;
    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0).cloneRange();
    }
    try {
        // Native bridges are synchronous APIs: a completed call is their acknowledgement.
        if (isInAndroid()) {
            const bridge = getWindowJSAndroid();
            if (!bridge) {
                return false;
            }
            bridge.writeClipboard(text);
            return true;
        }
        if (isInHarmony()) {
            const bridge = getWindowJSHarmony();
            if (!bridge) {
                return false;
            }
            bridge.writeClipboard(text);
            return true;
        }
        if (isInIOS()) {
            const webkit = getWindowWebkit();
            if (!webkit?.messageHandlers?.setClipboard) {
                return false;
            }
            webkit.messageHandlers.setClipboard.postMessage(text);
            return true;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        return writeTextWithDocumentCommand(text, range);
    } catch (error) {
        console.error("Clipboard text write failed", error);
        return false;
    }
};

/** A platform-neutral representation of copied BlockDOM content. */
export interface IBlockDOMClipboardContent {
    text: string;
    html: string;
    siyuanHTML?: string;
}

/**
 * Writes BlockDOM clipboard data and resolves only after the browser clipboard
 * promise has succeeded. Native bridge variants remain explicit because the
 * Gutter flow intentionally preserves raw BlockDOM while Outline/Mobile retain
 * their existing two-format clipboard payload.
 */
export const writeBlockDOMClipboard = async (content: IBlockDOMClipboardContent) => {
    try {
        if (isInAndroid()) {
            const bridge = getWindowJSAndroid();
            if (!bridge) {
                return false;
            }
            if (content.siyuanHTML !== undefined) {
                bridge.writeSiYuanHTMLClipboard(content.text, content.html, content.siyuanHTML);
            } else {
                bridge.writeHTMLClipboard(content.text, content.html);
            }
            return true;
        }
        if (isInHarmony()) {
            const bridge = getWindowJSHarmony();
            if (!bridge) {
                return false;
            }
            if (content.siyuanHTML !== undefined) {
                bridge.writeSiYuanHTMLClipboard(content.text, content.html, content.siyuanHTML);
            } else {
                bridge.writeHTMLClipboard(content.text, content.html);
            }
            return true;
        }
        if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
            await navigator.clipboard.write([new ClipboardItem({
                "text/plain": content.text,
                "text/html": content.html,
            })]);
            return true;
        }
        return await writeTextAndConfirm(content.html);
    } catch (error) {
        console.error("BlockDOM clipboard write failed", error);
        return false;
    }
};

/** Retains the fire-and-forget copy API for non-mutating callers. */
export const writeText = (text: string) => {
    void writeTextAndConfirm(text).then((written) => {
        if (!written) {
            console.error("Clipboard text write was not accepted by the active platform");
        }
    });
};

const writePlainTextFallback = async (text: string) => {
    try {
        if (isInAndroid()) {
            window.JSAndroid.writeClipboard(text);
            return true;
        }
        if (isInHarmony()) {
            window.JSHarmony.writeClipboard(text);
            return true;
        }
        if (isInIOS()) {
            window.webkit.messageHandlers.setClipboard.postMessage(text);
            return true;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        console.log("Write plain text clipboard error:", e);
    }

    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0).cloneRange();
    }
    const textElement = document.createElement("textarea");
    textElement.value = text;
    textElement.style.position = "fixed";
    document.body.appendChild(textElement);
    textElement.focus();
    textElement.select();
    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch (e) {
        console.log("Copy plain text clipboard error:", e);
    }
    document.body.removeChild(textElement);
    if (range) {
        focusByRange(range);
    }
    return copied;
};

export interface IClipboardWriteData {
    textPlain: string;
    textHTML?: string;
    textSiyuan?: string;
}

export type TClipboardWriteStatus = "rich" | "plain" | "failed";

export interface IClipboardWriteResult {
    status: TClipboardWriteStatus;
    error?: unknown;
}

export interface IClipboardWriteOptions {
    fallbackToPlainText?: boolean;
}

export const writeClipboardData = async (data: IClipboardWriteData, options: IClipboardWriteOptions = {}): Promise<IClipboardWriteResult> => {
    const textPlain = data.textPlain || "";
    const textHTML = data.textHTML || "";
    const textSiyuan = data.textSiyuan || "";
    const fallbackToPlainText = options.fallbackToPlainText !== false;
    try {
        if (isInAndroid()) {
            if (textSiyuan) {
                window.JSAndroid.writeSiYuanHTMLClipboard(textPlain, textHTML, textSiyuan);
                return {status: "rich"};
            }
            if (textHTML) {
                window.JSAndroid.writeHTMLClipboard(textPlain, textHTML);
                return {status: "rich"};
            }
            window.JSAndroid.writeClipboard(textPlain);
            return {status: "plain"};
        }
        if (isInHarmony()) {
            if (textSiyuan) {
                window.JSHarmony.writeSiYuanHTMLClipboard(textPlain, textHTML, textSiyuan);
                return {status: "rich"};
            }
            if (textHTML) {
                window.JSHarmony.writeHTMLClipboard(textPlain, textHTML);
                return {status: "rich"};
            }
            window.JSHarmony.writeClipboard(textPlain);
            return {status: "plain"};
        }
        if (isInIOS()) {
            window.webkit.messageHandlers.setClipboard.postMessage(textPlain || textHTML);
            return {status: "plain"};
        }
        if (textHTML && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
            const clipboardItem: Record<string, Blob> = {};
            if (textPlain) {
                clipboardItem["text/plain"] = new Blob([textPlain], {type: "text/plain"});
            }
            const webHTML = buildWebClipboardHTML(textHTML, textSiyuan);
            clipboardItem["text/html"] = new Blob([webHTML], {type: "text/html"});
            await navigator.clipboard.write([new ClipboardItem(clipboardItem)]);
            return {status: "rich"};
        }
        if (!textHTML && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(textPlain);
            return {status: "plain"};
        }
    } catch (error) {
        if (fallbackToPlainText && await writePlainTextFallback(textPlain || textHTML)) {
            return {status: "plain", error};
        }
        return {status: "failed", error};
    }
    if (fallbackToPlainText && await writePlainTextFallback(textPlain || textHTML)) {
        return {status: "plain"};
    }
    return {status: "failed"};
};

export const copyPlainText = (text: string) => {
    text = text.replace(new RegExp(Constants.ZWSP, "g"), ""); // `复制纯文本` 时移除所有零宽空格 https://github.com/siyuan-note/siyuan/issues/6674
    writeText(text);
};

export const isHuawei = () => {
    return getSiyuanConfig().system.osPlatform.toLowerCase().indexOf("huawei") > -1;
};

export const isDisabledFeature = (feature: string): boolean => {
    return getSiyuanConfig().system.disabledFeatures?.indexOf(feature) > -1;
};

export const isSafari = () => {
    const userAgent = navigator.userAgent;
    return userAgent.includes("Safari") && !userAgent.includes("Chrome") && !userAgent.includes("Chromium");
};

export const isWin11 = async () => {
    if (!(navigator as any).userAgentData || !(navigator as any).userAgentData.getHighEntropyValues) {
        return false;
    }
    const ua = await (navigator as any).userAgentData.getHighEntropyValues(["platformVersion"]);
    if ((navigator as any).userAgentData.platform === "Windows") {
        if (parseInt(ua.platformVersion.split(".")[0]) >= 13) {
            return true;
        }
    }
    return false;
};

export const getScreenWidth = () => {
    if (isInAndroid()) {
        return window.JSAndroid.getScreenWidthPx();
    } else if (isInHarmony()) {
        return window.JSHarmony.getScreenWidthPx();
    }
    return window.outerWidth;
};

export const isWindows = () => {
    return navigator.platform.toUpperCase().indexOf("WIN") > -1;
};

export const isInAndroid = () => {
    return getSiyuanConfig().system.container === "android" && window.JSAndroid;
};

export const isInIOS = () => {
    return getSiyuanConfig().system.container === "ios" && window.webkit?.messageHandlers;
};

export const isInMobileApp = () => {
    if (isInAndroid() || isInHarmony() || isInIOS()) {
        return true;
    }
    return false;
};

export const isInHarmony = () => {
    return getSiyuanConfig().system.container === "harmony" && window.JSHarmony;
};

export const isInEdge = () => {
    const ua = navigator.userAgent;
    return ua.indexOf("EdgA/") > -1 || ua.indexOf("Edge/") > -1;
};

export function isChromeBrowser(): boolean {
    const nav = window.navigator as Navigator & {
        userAgentData: {
            brands: {
                brand: string;
                version: string;
            }[]
        }
    };
    if (nav.userAgentData && Array.isArray(nav.userAgentData.brands)) {
        const brands = nav.userAgentData.brands.map((b) => b.brand);
        // Edge、Opera 等 Chromium 内核浏览器 brands 中同样包含 Chromium，需与 userAgent 回退逻辑一致排除
        if (brands.some((brand) => /Edge|Opera|OPR/i.test(brand))) {
            return false;
        }
        return brands.some((brand) => /Chrome|Chromium/i.test(brand));
    }
    // 回退到 userAgent
    const ua = nav.userAgent || "";
    const isChromium = /\bChrome\/\d+/i.test(ua) || /\bChromium\/\d+/i.test(ua);
    const isEdge = /\bEdg(e|A|iOS)?\/\d+/i.test(ua); // Edge Chromium
    const isOpera = /\b(OPR|Opera)\/\d+/i.test(ua);

    return isChromium && !isEdge && !isOpera;
}

export const initNativeDialogOverride = () => {
    if (isBrowser) {
        return;
    }
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = function (message: string) {
        try {
            ipcSendSync(Constants.SIYUAN_ALERT_DIALOG, {
                title: window.siyuan.languages.siyuanNote,
                message,
                buttons: [window.siyuan.languages.confirm],
                noLink: true,
            });
            return undefined;
        } catch (error) {
            return originalAlert.call(this, message);
        }
    };

    window.confirm = function (message?: string): boolean {
        try {
            const buttonIndex = ipcSendSync(Constants.SIYUAN_CONFIRM_DIALOG, {
                title: window.siyuan?.languages?.siyuanNote || "SiYuan",
                message,
                buttons: [window.siyuan?.languages?.cancel || "Cancel", window.siyuan?.languages?.confirm || "OK"],
                cancelId: 0,
                defaultId: 1,
                noLink: true,
            });
            return buttonIndex === 1;
        } catch (error) {
            return originalConfirm.call(this, message);
        }
    };
};
