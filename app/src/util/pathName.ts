import * as path from "path";

import { fetchPost } from "./fetch";
import { getSearch } from "./functions";
import { unicode2Emoji } from "../emoji";
import { Constants } from "../constants";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { showMessage } from "../dialog/message";
import { isWindows } from "../protyle/util/compatibility";
import { getLocationHref, getLocationOrigin, getLocationSearch, setLocationHref } from "./siyuanEnvironments/windowLocation.environment";

export const useShell = (cmd: "showItemInFolder" | "openPath", filePath: string) => {
    /// #if !BROWSER
    ipcRenderer.send(Constants.SIYUAN_CMD, {
        cmd,
        filePath: filePath
    });
    /// #endif
};

export const getIdZoomInByPath = () => {
    const searchParams = new URLSearchParams(getLocationSearch());
    const PWAURL = searchParams.get("url");

    // PWA 捕获 web+siyuan://blocks/20221031001313-rk7sd0e?focus=1
    if (/^web\+siyuan:\/\/blocks\/\d{14}-\w{7}/.test(PWAURL)) {
        return {
            id: PWAURL.substring(20, 20 + 22),
            isZoomIn: getSearch("focus", PWAURL) === "1"
        };
    }

    // PAD 通过思源协议打开
    if (window.JSAndroid) {
        const SYURL = window.JSAndroid.getBlockURL();
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
export const redirectToCheckAuth = (to: string = getLocationHref()) => {
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
    document.getElementsByTagName("head")[0].appendChild(baseURLElement);
};

export const getDisplayName = (filePath: string, basename = true, removeSY = false) => {
    let name = filePath;
    if (basename) {
        name = pathPosix().basename(filePath);
    }
    if (removeSY && name.endsWith(".sy")) {
        name = name.substr(0, name.length - 3);
    }
    return name;
};

export const getAssetName = (assetPath: string) => {
    return pathPosix().basename(assetPath, pathPosix().extname(assetPath)).replace(/-\d{14}-\w{7}/, "");
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

export const pathPosix = () => {
    if (path.posix) {
        return path.posix;
    }
    return path;
};

export const originalPath = () => {
    return path;
};

export const getTopPaths = (liElements: Element[]) => {
    const fromPaths: string[] = [];
    liElements.forEach((item: HTMLElement) => {
        if (item.getAttribute("data-type") !== "navigation-root") {
            const dataPath = item.getAttribute("data-path");
            const isChild = fromPaths.find(item => {
                if (dataPath.startsWith(item.replace(".sy", ""))) {
                    return true;
                }
            });
            if (!isChild) {
                fromPaths.push(dataPath);
            }
        }
    });
    return fromPaths;
};

export const moveToPath = (fromPaths: string[], toNotebook: string, toPath: string) => {
    fetchPost("/api/filetree/moveDocs", {
        toNotebook,
        fromPaths,
        toPath,
    });
};

export const getLeaf = (liElement: HTMLElement, flashcard: boolean) => {
    const toggleElement = liElement.querySelector(".b3-list-item__arrow");
    if (toggleElement.classList.contains("b3-list-item__arrow--open")) {
        toggleElement.classList.remove("b3-list-item__arrow--open");
        if (liElement.nextElementSibling && liElement.nextElementSibling.tagName === "UL") {
            liElement.nextElementSibling.classList.add("fn__none");
        }
        return;
    }
    if (liElement.nextElementSibling && liElement.nextElementSibling.tagName === "UL") {
        toggleElement.classList.add("b3-list-item__arrow--open");
        liElement.nextElementSibling.classList.remove("fn__none");
        return;
    }

    const notebookId = liElement.getAttribute("data-box");
    fetchPost("/api/filetree/listDocsByPath", {
        notebook: notebookId,
        path: liElement.getAttribute("data-path"),
        flashcard,
        app: Constants.SIYUAN_APPID,
    }, response => {
        if (response.data.files.length === 0) {
            showMessage(window.siyuan.languages.emptyContent);
            return;
        }
        let fileHTML = "";
        response.data.files.forEach((item: IFile) => {
            let countHTML = "";
            if (flashcard) {
                countHTML = `<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardCard}">${item.flashcardCount}</span>`;
            } else if (item.count && item.count > 0) {
                countHTML = `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.ref}">${item.count}</span>`;
            }
            fileHTML += `<li data-box="${notebookId}" class="b3-list-item" data-path="${item.path}">
    <span style="padding-left: ${item.path.split("/").length * 8}px" class="b3-list-item__toggle b3-list-item__toggle--hl${item.subFileCount === 0 ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${unicode2Emoji(item.icon || (item.subFileCount === 0 ? window.siyuan.storage[Constants.LOCAL_IMAGES].file : window.siyuan.storage[Constants.LOCAL_IMAGES].folder), "b3-list-item__graphic", true)}
    <span class="b3-list-item__text ariaLabel" data-position="parentE" aria-label="${getDisplayName(item.name, true, true)} <small class='ft__on-surface'>${item.hSize}</small>${item.bookmark ? "<br>" + window.siyuan.languages.bookmark + " " + item.bookmark : ""}${item.name1 ? "<br>" + window.siyuan.languages.name + " " + item.name1 : ""}${item.alias ? "<br>" + window.siyuan.languages.alias + " " + item.alias : ""}${item.memo ? "<br>" + window.siyuan.languages.memo + " " + item.memo : ""}${item.subFileCount !== 0 ? window.siyuan.languages.includeSubFile.replace("x", item.subFileCount) : ""}<br>${window.siyuan.languages.modifiedAt} ${item.hMtime}<br>${window.siyuan.languages.createdAt} ${item.hCtime}">${getDisplayName(item.name, true, true)}</span>
    ${countHTML}
</li>`;
        });
        if (fileHTML === "") {
            return;
        }
        toggleElement.classList.add("b3-list-item__arrow--open");
        liElement.insertAdjacentHTML("afterend", `<ul class="file-tree__sliderDown">${fileHTML}</ul>`);
        const nextElement = liElement.nextElementSibling;
        setTimeout(() => {
            nextElement.setAttribute("style", `height:${nextElement.childElementCount * liElement.clientHeight}px;`);
            setTimeout(() => {
                nextElement.classList.remove("file-tree__sliderDown");
                nextElement.removeAttribute("style");
            }, 120);
        }, 2);
    });
};

export const getNotebookName = (id: string) => {
    let rootPath = "";
    window.siyuan.notebooks.find((item) => {
        if (item.id === id) {
            rootPath = item.name;
            return true;
        }
    });
    return rootPath;
};

export const getNotebookIcon = (id: string) => {
    let rootPath = "";
    window.siyuan.notebooks.find((item) => {
        if (item.id === id) {
            rootPath = item.icon;
            return true;
        }
    });
    return rootPath;
};

export const setNotebookName = (id: string, name: string) => {
    window.siyuan.notebooks.find((item) => {
        if (item.id === id) {
            item.name = name;
            return true;
        }
    });
};

export const getOpenNotebookCount = () => {
    let count = 0;
    window.siyuan.notebooks.forEach(item => {
        if (!item.closed) {
            count++;
        }
    });
    return count;
};

export const setNoteBook = (cb?: (notebook: INotebook[]) => void, flashcard = false) => {
    fetchPost("/api/notebook/lsNotebooks", {
        flashcard
    }, (response) => {
        if (!flashcard) {
            window.siyuan.notebooks = response.data.notebooks;
        }
        if (cb) {
            cb(response.data.notebooks);
        }
    });
};
