import { fetchPost } from "../network/fetch";
import { getSearch } from "../platform/functions";
import {unicode2Emoji} from "../../emoji/emoji.render";
import { Constants } from "../../constants";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { isElectron } from "../../platform";
import { showMessage } from "../../dialog/message";
import { isWindows } from "../../protyle/util/compatibility";
import { getLocationHref, getLocationOrigin, getLocationSearch, setLocationHref } from "../siyuanEnvironments/windowLocation.environment";
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";
import { getWindowJSAndroid } from "../siyuanEnvironments/windowNative.environment";
import { generateCountHTML, generateFileItemHTML, generateFlashcardFileItemHTML } from "./fileHtmlGenerator";
import {getAssetExtension, getAssetName, getDisplayName, getDocDisplayName, originalPath, pathPosix} from "./path/operations";
import {
    getNotebookIcon,
    getNotebookName,
    getOpenNotebookCount,
    setNoteBook,
    setNotebookName,
} from "./notebook/store";

/** 保持既有路径工具公共入口；实现由稳定 path 子域唯一持有。 */
export {getAssetExtension, getAssetName, getDisplayName, getDocDisplayName, originalPath, pathPosix};
/** 保持既有笔记本工具公共入口；状态实现由 notebook 子域唯一持有。 */
export {getNotebookIcon, getNotebookName, getOpenNotebookCount, setNoteBook, setNotebookName};

export const useShell = (cmd: "showItemInFolder" | "openPath", filePath: string) => {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_CMD, {
            cmd,
            filePath: filePath
        });
    }
};

export const getIdZoomInByPath = () => {
    const searchParams = new URLSearchParams(getLocationSearch());
    const PWAURL = searchParams.get("url");

    // PWA 捕获 web+siyuan://blocks/20221031001313-rk7sd0e?focus=1
    if (PWAURL && /^web\+siyuan:\/\/blocks\/\d{14}-\w{7}/.test(PWAURL)) {
        return {
            id: PWAURL.substring(20, 20 + 22),
            isZoomIn: getSearch("focus", PWAURL) === "1"
        };
    }

    // PAD 通过思源协议打开
    const jsAndroid = getWindowJSAndroid();
    if (jsAndroid) {
        const SYURL = jsAndroid.getBlockURL();
        return {
            id: getIdFromSYProtocol(SYURL),
            isZoomIn: getSearch("focus", SYURL) === "1"
        };
    }

    // 支持通过 URL 查询字符串参数 `id` 和 `focus` 跳转到 Web 端指定块 https://github.com/siyuan-note/siyuan/pull/7086
    return {
        id: searchParams.get("id"),
        isZoomIn: searchParams.get("focus") === "1"
    };
};

export const isSYProtocol = (url: string) => {
    return /^siyuan:\/\/blocks\/\d{14}-\w{7}/.test(url);
};

export const getIdFromSYProtocol = (url: string) => {
    return url.substring(16, 16 + 22);
};

/* redirect to auth page */
export const redirectToCheckAuth = async (to: string = getLocationHref()) => {
    if (window.siyuan.config.readonly || window.siyuan.isPublish) {
        return;
    }

    const url = new URL(getLocationOrigin());
    url.pathname = "/check-auth";
    url.searchParams.set("to", to);
    setLocationHref(url.href);
};

export const addBaseURL = () => {
    let baseURLElement = document.getElementById("baseURL");
    if (!baseURLElement) {
        baseURLElement = document.createElement("base");
        baseURLElement.id = "baseURL";
    }
    baseURLElement.setAttribute("href", location.origin);
    const headElements = document.getElementsByTagName("head");
    const firstHeadElement = headElements[0];
    if (firstHeadElement) {
        firstHeadElement.appendChild(baseURLElement);
    }
};

export const isLocalPath = (link: string) => {
    if (!link) {
        return false;
    }

    link = link.trim();
    if (1 > link.length) {
        return false;
    }

    link = link.toLowerCase();
    if (link.startsWith("assets/") || link.startsWith("file://") || link.startsWith("\\\\") /* Windows 网络共享路径 */) {
        return true;
    }

    if (isWindows()) {
        const colonIdx = link.indexOf(":");
        return 1 === colonIdx; // 冒号前面只有一个字符认为是 Windows 盘符而不是网络协议
    }
    return link.startsWith("/");
};

/**
 * 检查给定路径是否为任何已存在路径的子路径
 * @param path 要检查的路径
 * @param existingPaths 已存在的路径列表
 * @returns 如果是子路径则返回true，否则返回false
 */
const isChildPath = (path: string, existingPaths: string[]): boolean => {
    return existingPaths.some(existingPath =>
        path.startsWith(existingPath.replace(".sy", ""))
    );
};

export const getTopPaths = (liElements: Element[]) => {
    const fromPaths: string[] = [];

    for (const element of liElements) {
        // 确保元素是HTMLElement类型
        if (!(element instanceof HTMLElement)) {
            continue;
        }

        // 检查是否为非根导航元素
        if (element.getAttribute("data-type") === "navigation-root") {
            continue;
        }

        // 获取data-path属性并检查是否为null
        const dataPath = element.getAttribute("data-path");
        if (!dataPath) {
            continue;
        }

        // 检查是否为子路径，如果不是则添加到结果中
        if (!isChildPath(dataPath, fromPaths)) {
            fromPaths.push(dataPath);
        }
    }

    return fromPaths;
};

export const moveToPath = (fromPaths: string[], toNotebook: string, toPath: string) => {
    fetchPost("/api/filetree/moveDocs", {
        toNotebook,
        fromPaths,
        toPath,
    });
};


/**
 * 设置元素高度并移除样式
 * @param element 目标元素
 * @param height 高度值
 */
const setElementHeightAndRemoveStyle = (element: Element, height: number): void => {
    element.setAttribute("style", `height:${height}px;`);
    setTimeout(() => {
        element.classList.remove("file-tree__sliderDown");
        element.removeAttribute("style");
    }, 120);
};

const handleLeafResponse = (response: IWebSocketData, liElement: HTMLElement, notebookId: string, toggleElement: Element | null, flashcard: boolean) => {
    if (response.data.files.length === 0) {
        showMessage(siyuanI18n.emptyContent);
        return;
    }

    let fileHTML = "";
    for (const item of response.data.files) {
        if (flashcard) {
            fileHTML += generateFlashcardFileItemHTML(item, notebookId);
            continue;
        }
        fileHTML += generateFileItemHTML(item, notebookId);
    }
    if (fileHTML === "") {
        return;
    }
    if (!toggleElement) {
        return;
    }
    toggleElement.classList.add("b3-list-item__arrow--open");
    liElement.insertAdjacentHTML("afterend", `<ul class="file-tree__sliderDown">${fileHTML}</ul>`);
    const nextElement = liElement.nextElementSibling;
    if (!nextElement) {
        return;
    }

    setTimeout(() => {
        setElementHeightAndRemoveStyle(nextElement, nextElement.childElementCount * liElement.clientHeight);
    }, 2);
};

/**
 * 处理已打开的文件项
 * @param liElement 列表元素
 * @param toggleElement 切换元素
 */
const handleOpenedLeaf = (liElement: HTMLElement, toggleElement: Element): void => {
    toggleElement.classList.remove("b3-list-item__arrow--open");
    const nextElement = liElement.nextElementSibling;
    if (nextElement?.tagName === "UL") {
        nextElement.classList.add("fn__none");
    }
};

/**
 * 处理已关闭但存在的文件项
 * @param toggleElement 切换元素
 * @param nextElement 下一个元素
 */
const handleClosedExistingLeaf = (toggleElement: Element, nextElement: Element): void => {
    toggleElement.classList.add("b3-list-item__arrow--open");
    nextElement.classList.remove("fn__none");
};

export const getLeaf = (liElement: HTMLElement, flashcard: boolean) => {
    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    if (!toggleElement) {
        return;
    }

    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
        handleOpenedLeaf(liElement, toggleElement);
        return;
    }

    const nextElement = liElement.nextElementSibling;
    if (nextElement?.tagName === "UL") {
        handleClosedExistingLeaf(toggleElement, nextElement);
        return;
    }
    if (liElement.getAttribute("data-loading") === "true") {
        return;
    }
    liElement.setAttribute("data-loading", "true");
    const notebookId = liElement.getAttribute("data-box") || "";
    fetchPost("/api/filetree/listDocsByPath", {
        notebook: notebookId,
        path: liElement.getAttribute("data-path") || "",
        flashcard,
        app: Constants.SIYUAN_APPID,
    }, response => {
        liElement.removeAttribute("data-loading");
        handleLeafResponse(response, liElement, notebookId, toggleElement, flashcard);
    });
};

/**
 * 规范化并校验相对路径：允许子目录，但禁止通过 ".." 穿越到根外。
 * 用于插件存储，确保路径不逃出指定根目录。
 * @returns 规范化后的相对路径（使用 /），若路径非法则返回替换后的合法路径
 */
export const normalizeStoragePath = (storageName: string): string | null => {
    const parts = storageName.replace(/\\/g, "/").split("/");
    const resolved: string[] = [];
    for (const part of parts) {
        if (part === "..") {
            if (resolved.length > 0) {
                resolved.pop();
            }
        } else if (part && part !== ".") {
            resolved.push(part);
        }
    }
    return resolved.length > 0 ? resolved.join("/") : storageName.replace(/[\/\\]+/g, "");
};
