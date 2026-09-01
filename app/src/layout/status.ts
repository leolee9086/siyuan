import {getDockByType} from "./query/dockByType";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { fetchPost } from "../util/network/fetch";
import { mountHelp } from "../util/file/mount";
import { isMobile, isElectron } from "../platform";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { MenuItem } from "../menus/Menu.Item";
import { Constants } from "../constants";
import { toggleDockBar } from "./dock/util";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import {escapeAriaLabel} from "../util/DOM/escape";
import {openLink} from "../editor/openLink";
import { 渲染所有状态栏按钮 } from "../registry/StatusBarRegistry";
import {resolveStatusElement} from "./statusPort";
import type {StatusElementTarget} from "./statusPort";
import {setProtyleStatusPort} from "../protyle/runtime/status.port";
import type {IProtyleStatusPort} from "../protyle/runtime/status.types";

export const initStatus = (isWindow = false, status: StatusElementTarget = "status") => {
    if (isMobile) {
        return;
    }
    const statusElement = resolveStatusElement(status);
    if (!statusElement) {
        return;
    }
    let barDockHTML = "";
    if (!isWindow) {
        barDockHTML = `<div id="barDock" class="toolbar__item ariaLabel${window.siyuan.config.readonly || isWindow ? " fn__none" : ""}" aria-label="${window.siyuan.languages.toggleDock} ${updateHotkeyTip(window.siyuan.config.keymap.general.toggleDock.custom)}">
    <svg>
        <use xlink:href="#${window.siyuan.config.uiLayout.hideDock ? "iconDock" : "iconHideDock"}"></use>
    </svg>
</div>`;
    }
    statusElement.innerHTML = `${barDockHTML}
<div class="status__msg"></div>
<div class="fn__flex-1"></div>
<div class="status__backgroundtask fn__none"></div>
<div class="status__counter"></div>
<div id="statusHelp" class="toolbar__item ariaLabel" aria-label="${window.siyuan.languages.help}">
    <svg><use xlink:href="#iconHelp"></use></svg>
</div>`;
    statusElement.addEventListener("click", (event) => {
        let target = event.target as HTMLElement | null;
        while (target && target.id !== "status") {
            if (target.id === "barDock") {
                toggleDockBar(target.firstElementChild.firstElementChild);
                event.stopPropagation();
                break;
            } else if (target.classList.contains("status__backgroundtask")) {
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
                    window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_STATUS_BACKGROUND_TASK) {
                    window.siyuan.menus.menu.remove();
                    return;
                }
                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_STATUS_BACKGROUND_TASK);
                JSON.parse(target.getAttribute("data-tasks")).forEach((item: { action: string }) => {
                    window.siyuan.menus.menu.append(new MenuItem({
                        type: "readonly",
                        iconHTML: "",
                        label: item.action
                    }).element);
                });
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({ x: rect.right, y: rect.top, isLeft: true });
                event.stopPropagation();
                break;
            } else if (target.id === "statusHelp") {
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
                    window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_STATUS_HELP) {
                    window.siyuan.menus.menu.remove();
                    return;
                }
                window.siyuan.menus.menu.remove();
                window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_STATUS_HELP);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: window.siyuan.languages.userGuide,
                    icon: "iconHelp",
                    ignore: window.siyuan.config.readonly,
                    click: () => {
                        mountHelp();
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: window.siyuan.languages.feedback,
                    icon: "iconFeedback",
                    click: () => {
                        if ("zh-CN" === window.siyuan.config.lang) {
                            openLink(window.siyuan.ws.app, "https://ld246.com/article/1649901726096");
                        } else {
                            openLink(window.siyuan.ws.app, "https://liuyun.io/article/1686530886208");
                        }
                    }
                }).element);
                if (isElectron) {
                    window.siyuan.menus.menu.append(new MenuItem({
                        label: window.siyuan.languages.debug,
                        icon: "iconBug",
                        click: () => {
                            ipcSend(Constants.SIYUAN_CMD, "toggleDevTools");
                        }
                    }).element);
                }
                window.siyuan.menus.menu.append(new MenuItem({
                    label: window.siyuan.languages["_trayMenu"].officialWebsite,
                    icon: "iconSiYuan",
                    click: () => {
                        openLink(window.siyuan.ws.app, "https://b3log.org/siyuan");
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    label: window.siyuan.languages["_trayMenu"].openSource,
                    icon: "iconGithub",
                    click: () => {
                        openLink(window.siyuan.ws.app, "https://github.com/siyuan-note/siyuan");
                    }
                }).element);
                const rect = target.getBoundingClientRect();
                window.siyuan.menus.menu.popup({ x: rect.right, y: rect.top, isLeft: true });
                event.stopPropagation();
                break;
            } else if (target.classList.contains("b3-menu__item")) {
                const type = target.getAttribute("data-type");
                getDockByType(type).toggleModel(type);
                if (type === "file" && getSelection().rangeCount > 0) {
                    const range = getSelection().getRangeAt(0);
                    const wysiwygElement = hasClosestByClassName(range.startContainer, "protyle-wysiwyg", true);
                    if (wysiwygElement) {
                        wysiwygElement.blur();
                    }
                }
                target.parentElement.classList.add("fn__none");
                event.stopPropagation();
                break;
            }
            target = target.parentElement;
        }
    });
    if (window.siyuan.config.appearance.hideStatusBar) {
        statusElement.classList.add("fn__none");
    }
    // 渲染通过 StatusBarRegistry 注册的按钮
    渲染所有状态栏按钮();
};

let countTimeout: number;
let countAbortController: AbortController | null = null;
let lastRootId: string;

const scheduleStatusStat = (rootID: string, content?: string, ids?: string[], statusElement?: HTMLElement) => {
    clearTimeout(countTimeout);
    if (countAbortController) {
        countAbortController.abort();
        countAbortController = null;
    }
    countTimeout = window.setTimeout(() => {
        countAbortController = new AbortController();
        const signal = countAbortController.signal;
        const capturedController = countAbortController;

        const finishRequest = () => {
            if (countAbortController === capturedController) {
                countAbortController = null;
            }
        };
        const onFetched = (response: IWebSocketData) => {
            if (signal.aborted) {
                return;
            }
            renderStatusbarCounter(response.data.stat, undefined, undefined, statusElement);
            finishRequest();
        };

        if (content) {
            fetchPost("/api/block/getContentWordCount", {content}, onFetched, undefined, undefined, signal);
            lastRootId = null;
        } else if (ids && ids.length > 0) {
            fetchPost("/api/block/getBlocksWordCount", {ids}, onFetched, undefined, undefined, signal);
            lastRootId = null;
        } else if (rootID && lastRootId !== rootID) {
            lastRootId = rootID;
            fetchPost("/api/block/getTreeStat", {id: rootID}, (response) => {
                if (signal.aborted) {
                    return;
                }
                renderStatusbarCounter(response.data.stat, undefined, undefined, statusElement);
                if (!response.data.containsEmbed) {
                    finishRequest();
                    return;
                }
                fetchPost("/api/block/getTreeStat", {id: rootID, includeEmbed: true}, (embedResponse) => {
                    if (signal.aborted) {
                        return;
                    }
                    renderStatusbarCounter(
                        embedResponse.data.stat,
                        embedResponse.data.statWithEmbed,
                        embedResponse.data.embedStat,
                        statusElement
                    );
                    finishRequest();
                }, undefined, undefined, signal);
            }, undefined, undefined, signal);
        } else {
            lastRootId = null;
            finishRequest();
        }
    }, Constants.TIMEOUT_COUNT);
};

export const countSelectWord = (range: Range, rootID?: string, status?: StatusElementTarget) => {
    if (isMobile) {
        return;
    }
    const statusElement = resolveStatusElement(status);
    if (!statusElement || statusElement.classList.contains("fn__none")) {
        return;
    }
    scheduleStatusStat(rootID, range.toString(), undefined, statusElement);
};

export const countBlockWord = (ids: string[], rootID?: string, clearCache = false, status?: StatusElementTarget) => {
    if (isMobile) {
        return;
    }
    const statusElement = resolveStatusElement(status);
    if (!statusElement || statusElement.classList.contains("fn__none")) {
        return;
    }
    if (clearCache) {
        lastRootId = null;
    }
    if (ids.length > 0) {
        scheduleStatusStat(rootID, undefined, ids, statusElement);
        return;
    }
    const selectText = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0).toString() : "";
    if (selectText) {
        scheduleStatusStat(rootID, selectText, undefined, statusElement);
        return;
    }
    scheduleStatusStat(rootID, undefined, undefined, statusElement);
};

export const clearCounter = (status?: StatusElementTarget) => {
    lastRootId = null;
    clearTimeout(countTimeout);
    if (countAbortController) {
        countAbortController.abort();
        countAbortController = null;
    }
    resolveStatusElement(status)?.querySelector(".status__counter")?.replaceChildren();
};

export interface IBlockStat {
    runeCount: number;
    wordCount: number;
    linkCount: number;
    imageCount: number;
    refCount: number;
    blockCount: number;
}

export interface IEmbedStat {
    complete: boolean;
    queryEmbedCount: number;
    jsEmbedCount: number;
    resultCount: number;
    failedQueryCount: number;
    failedResultCount: number;
    truncatedQueryCount: number;
    cycleCount: number;
    depthLimitCount: number;
}

export const genEmbedStatTip = (label: string, value: number, embedStat?: IEmbedStat) => {
    const prefix = embedStat && !embedStat.complete ? "≈" : "";
    const incompleteTip = embedStat && !embedStat.complete ? ` ${window.siyuan.languages.embedStatIncomplete}` : "";
    return `${prefix}${label} ${value}${incompleteTip}`;
};

export const renderStatusbarCounter = (stat: IBlockStat, statWithEmbed?: IBlockStat, embedStat?: IEmbedStat, status?: StatusElementTarget) => {
    const statusElement = resolveStatusElement(status);
    if (!stat || !statusElement) {
        return;
    }
    const runeEmbedAttrs = statWithEmbed ? ` class="ft__on-surface ariaLabel" data-position="north" aria-label="${escapeAriaLabel(genEmbedStatTip(window.siyuan.languages.runeCountWithEmbed, statWithEmbed.runeCount, embedStat))}"` : " class=\"ft__on-surface\"";
    const wordEmbedAttrs = statWithEmbed ? ` class="ft__on-surface ariaLabel" data-position="north" aria-label="${escapeAriaLabel(genEmbedStatTip(window.siyuan.languages.wordCountWithEmbed, statWithEmbed.wordCount, embedStat))}"` : " class=\"ft__on-surface\"";
    let html = `<span${runeEmbedAttrs}>${window.siyuan.languages.runeCount}</span>&nbsp;${stat.runeCount}<span class="fn__space"></span>
<span${wordEmbedAttrs}>${window.siyuan.languages.wordCount}</span>&nbsp;${stat.wordCount}<span class="fn__space"></span>`;
    if (0 < stat.linkCount) {
        html += `<span class="ft__on-surface">${window.siyuan.languages.linkCount}</span>&nbsp;${stat.linkCount}<span class="fn__space"></span>`;
    }
    if (0 < stat.imageCount) {
        html += `<span class="ft__on-surface">${window.siyuan.languages.imgCount}</span>&nbsp;${stat.imageCount}<span class="fn__space"></span>`;
    }
    if (0 < stat.refCount) {
        html += `<span class="ft__on-surface">${window.siyuan.languages.refCount}</span>&nbsp;${stat.refCount}<span class="fn__space"></span>`;
    }
    if (0 < stat.blockCount) {
        html += `<span class="ft__on-surface">${window.siyuan.languages.blockCount}</span>&nbsp;${stat.blockCount}<span class="fn__space"></span>`;
    }
    statusElement.querySelector(".status__counter")?.replaceChildren(document.createRange().createContextualFragment(html));
};

/**
 * 完整思源 App 的状态统计适配器。
 *
 * Protyle 不再直接导入本模块；本适配器只在完整 App 加载状态栏模块时注册，
 * 将原有统计行为保留在主应用边界内。
 */
const appStatusPort: IProtyleStatusPort = {
    countSelection: countSelectWord,
    countBlocks: countBlockWord,
    clear: clearCounter,
};

setProtyleStatusPort(appStatusPort);
