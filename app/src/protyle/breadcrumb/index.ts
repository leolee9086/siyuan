import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { RecordMedia, RecordMediaInputEndedError } from "../util/RecordMedia";
import { hideMessage, showMessage } from "../runtime/dialog.port";
import {net2LocalAssets} from "./assets/net2LocalAssets";
import {uploadFiles} from "../upload";
import { isMobile } from "../../platform";
import { Menu } from "../../plugin/Menu";
import { MenuItem } from "../../menus/Menu.Item";
import { Constants } from "../../constants";
import { getIconByType } from "../../editor/getIcon";
import { improveBreadcrumbAppearance } from "../wysiwyg/renderBacklink";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, setSiyuanHideBreadcrumb } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { 显示面包屑菜单 } from "./menu/showBreadcrumbMenu";
import { 处理面包屑点击 } from "./breadcrumb.events";
import { isHTMLElement, isStylableElement } from "./imports";
import {
    查找焦点块元素,
    获取默认块元素,
    确定渲染块元素,
    判断是否为当前项,
    更新活动状态,
    获取排除类型,
    生成面包屑模板,
    生成平板按钮HTML,
} from "./breadcrumb.helpers";
import type { 录音器上下文 } from "./breadcrumb.types";
import {withEncryptedNotebook} from "../../util/file/notebook/store";
import {hasClosestBlock} from "../util/hasClosest";
import {focusByRange} from "../util/selection";
import {refreshUndoButtons} from "../undo/globalUndo";
import {getAllEditor} from "../../layout/getAll";
import {decodeHTML, escapeAttr, escapeAriaLabel, escapeHtml} from "../../util/DOM/escape";
import {mountBreadcrumbButtons} from "../../plugin/breadcrumbButton";
import {isInAndroid, isInHarmony} from "../util/compatibility";

// 仅转义非搜索高亮的 < 字符，保留内核插入的 <mark> 高亮标签
const escapeSearchHighlight = (html: string) => {
    return html.replace(/<(?!\/?mark>)/g, "&lt;");
};

// ==================== 菜单相关函数 ====================

/**
 * 处理移动端菜单响应
 */
function 处理移动端菜单响应(
    protyle: IProtyle,
    menu: Menu,
    response: { data?: IBreadcrumb[] }
) {
    const breadcrumbData = response.data || [];
    for (const item of breadcrumbData) {
        const isCurrent = 判断是否为当前项(protyle, item.id);
        menu.addItem({
            current: isCurrent,
            icon: getIconByType(item.type, item.subType),
            label: item.name,
            click() {
                protyle.getInstance().zoomOut({id: item.id});
            }
        });
    }
}

/**
 * 生成移动端菜单
 */
function 生成移动端菜单(protyle: IProtyle) {
    // 多选模式下不弹出面包屑菜单，避免与块多选操作冲突
    if (protyle.toolbar.isMultiSelectMode()) {
        return;
    }
    const menu = new Menu(Constants.MENU_BREADCRUMB_MOBILE_PATH);
    let blockElement = 查找焦点块元素(protyle);
    if (!blockElement) {
        blockElement = 获取默认块元素(protyle);
    }
    if (!blockElement) {
        return;
    }
    const id = blockElement.getAttribute("data-node-id") || "";
    const breadcrumbParam = withEncryptedNotebook(protyle.notebookId, {id, excludeTypes: []});
    fetchPost("/api/block/getBlockBreadcrumb", breadcrumbParam, (response) => {
        处理移动端菜单响应(protyle, menu, response);
    });
    if (!protyle.disabled) {
        const siyuanConfig = getSiyuanConfig();
        menu.addItem({
            id: "netImg2LocalAsset",
            label: siyuanI18n.netImg2LocalAsset,
            icon: "iconImgDown",
            accelerator: siyuanConfig.keymap.editor.general.netImg2LocalAsset.custom,
            click() {
                net2LocalAssets(protyle, "Img");
            }
        });
        menu.addItem({
            id: "netAssets2LocalAssets",
            label: siyuanI18n.netAssets2LocalAssets,
            icon: "iconDownloadAssets",
            accelerator: siyuanConfig.keymap.editor.general.netAssets2LocalAssets.custom,
            click() {
                net2LocalAssets(protyle, "Assets");
            }
        });
    }
    menu.fullscreen("bottom");
}

// ==================== 事件处理函数 ====================

/**
 * 创建面包屑点击事件处理器
 */
function 创建点击处理器(
    element: HTMLElement,
    protyle: IProtyle,
    showMenu: (p: IProtyle, pos: IPosition) => void,
    打开下级菜单: (p: IProtyle, id: string, pos: IPosition) => void
): (event: MouseEvent) => void {
    return (event) => {
        const target = event.target;
        if (!isStylableElement(target)) {
            return;
        }
        // 插件按钮区域自行处理点击，不触发面包屑逻辑
        if (event.composedPath().some((item) => item instanceof HTMLElement && item.hasAttribute("data-plugin-name"))) {
            return;
        }
        // 点击交互式箭头按钮时展开下级块菜单
        const arrowElement = target.closest(".protyle-breadcrumb__arrow");
        if (arrowElement && element.contains(arrowElement)) {
            const itemElement = arrowElement.previousElementSibling;
            if (itemElement && itemElement.classList.contains("protyle-breadcrumb__item")) {
                const targetRect = arrowElement.getBoundingClientRect();
                打开下级菜单(protyle, itemElement.getAttribute("data-node-id") || "", {
                    x: targetRect.left,
                    y: targetRect.bottom,
                    isLeft: false,
                });
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }
        let currentElement: HTMLElement | SVGElement = target;
        while (currentElement && !currentElement.isEqualNode(element)) {
            const handled = 处理面包屑点击({
                event,
                target: currentElement,
                protyle,
                breadcrumb: {
                    genMobileMenu: (p: IProtyle) => 生成移动端菜单(p),
                    showMenu,
                },
            });
            if (handled) {
                break;
            }
            const nextTarget = currentElement.parentElement;
            if (!isStylableElement(nextTarget)) {
                break;
            }
            currentElement = nextTarget;
        }
    };
}

/**
 * 创建鼠标离开事件处理器
 */
function 创建鼠标离开处理器(protyle: IProtyle): () => void {
    return () => {
        const items = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--hl");
        if (!items) {
            return;
        }
        for (const item of items) {
            item.classList.remove("protyle-wysiwyg--hl");
        }
    };
}

/**
 * 处理渲染响应：构建带无障碍属性与交互式箭头的面包屑项
 */
function 处理渲染响应(
    breadcrumbElement: HTMLElement,
    protyle: IProtyle,
    response: { data?: IBreadcrumb[] }
) {
    const data = response.data || [];
    let html = "";
    data.forEach((item: IBreadcrumb, index: number) => {
        const isCurrent = 判断是否为当前项(protyle, item.id);
        if (index === 0 && !protyle.options.render.breadcrumbDocName) {
            html += `<span class="protyle-breadcrumb__item${isCurrent ? " protyle-breadcrumb__item--active" : ""}" data-node-id="${item.id}" role="button" tabindex="-1" aria-label="${escapeAriaLabel(item.name || window.siyuan.languages.untitled)}"${data.length === 1 ? ' style="max-width:none"' : ""}>
    <svg class="popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>
</span>`;
        } else {
            html += `<span class="protyle-breadcrumb__item${isCurrent ? " protyle-breadcrumb__item--active" : ""}" data-node-id="${item.id}" role="button" tabindex="-1" aria-label="${escapeAriaLabel(item.name || window.siyuan.languages.untitled)}"${(data.length === 1 || index === 0) ? ' style="max-width:none"' : ""}>
    <svg class="popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>
    ${item.name ? `<span class="protyle-breadcrumb__text" title="${escapeAttr(escapeHtml(decodeHTML(item.name)))}">${escapeSearchHighlight(item.name)}</span>` : ""}
</span>`;
        }
        if (index !== data.length - 1) {
            html += `<button class="protyle-breadcrumb__arrow protyle-breadcrumb__arrow--interactive ariaLabel" aria-label="${window.siyuan.languages.expand}" type="button" tabindex="-1"><svg><use xlink:href="#iconRight"></use></svg></button>`;
        }
    });
    breadcrumbElement.innerHTML = html;
    if (breadcrumbElement.parentElement) {
        improveBreadcrumbAppearance(breadcrumbElement.parentElement);
    }
}

// ==================== Breadcrumb 类 ====================

export class Breadcrumb {
    public element: HTMLElement;
    public mediaRecorder: RecordMedia | undefined;
    public id: string = "";
    public messageId: string = "";
    private recordUploadMessageIds = new Map<File, string>();
    private pendingRecordFiles = new Set<File>();
    private uploadingRecordFiles = new Set<File>();
    private startingRecord = false;
    private stoppingRecord = false;
    private previousFocusElement: HTMLElement | undefined;
    private previousRange: Range | undefined;

    constructor(protyle: IProtyle) {
        const siyuanConfig = getSiyuanConfig();
        const element = document.createElement("div");
        element.className = "protyle-breadcrumb";

        const padHTML = 生成平板按钮HTML();
        element.innerHTML = 生成面包屑模板(siyuanConfig, padHTML);

        // 插入插件按钮容器（上游新增的面包屑插件扩展点）
        const pluginContainer = document.createElement("div");
        pluginContainer.className = "protyle-breadcrumb__plugin";
        const exitFocusTemplateElement = element.querySelector('[data-type="exit-focus"]');
        if (exitFocusTemplateElement?.parentElement) {
            exitFocusTemplateElement.parentElement.insertBefore(pluginContainer, exitFocusTemplateElement);
        } else {
            element.appendChild(pluginContainer);
        }

        const firstChild = element.firstElementChild;
        if (!isHTMLElement(firstChild)) {
            throw new Error("面包屑元素创建失败");
        }
        this.element = firstChild;
        mountBreadcrumbButtons(protyle, pluginContainer);

        const clickHandler = 创建点击处理器(element, protyle, (p, pos) => this.showMenu(p, pos), (p, id, pos) => {
            void this.openChildrenMenu(p, id, pos);
        });
        element.addEventListener("click", clickHandler);

        if (!isMobile) {
            const mouseleaveHandler = 创建鼠标离开处理器(protyle);
            element.addEventListener("mouseleave", mouseleaveHandler);
            this.element.addEventListener("contextmenu", (event) => {
                const itemElement = (event.target as HTMLElement).closest(".protyle-breadcrumb__item");
                if (!itemElement || !this.element.contains(itemElement)) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                void this.openChildrenMenu(protyle, itemElement.getAttribute("data-node-id") || "", {
                    x: event.clientX,
                    y: event.clientY,
                    isLeft: false,
                });
            });
            this.element.addEventListener("keydown", (event) => {
                if (event.isComposing || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
                    return;
                }
                const itemElement = (event.target as HTMLElement).closest(".protyle-breadcrumb__item") as HTMLElement;
                if (!itemElement || !this.element.contains(itemElement)) {
                    return;
                }
                if (!window.siyuan.menus.menu.element.classList.contains("fn__none")) {
                    return;
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    const nextItemElement = this.getSiblingItem(itemElement, event.key === "ArrowRight");
                    if (nextItemElement) {
                        this.focusItem(nextItemElement);
                    }
                    event.preventDefault();
                    event.stopPropagation();
                } else if (event.key === "ArrowDown" || event.key === "Enter") {
                    const itemRect = itemElement.getBoundingClientRect();
                    void this.openChildrenMenu(protyle, itemElement.getAttribute("data-node-id") || "", {
                        x: itemRect.left,
                        y: itemRect.bottom,
                        isLeft: false,
                    }, true);
                    event.preventDefault();
                    event.stopPropagation();
                } else if (event.key === "Escape") {
                    this.restoreEditorFocus(protyle);
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
            this.element.addEventListener("wheel", (event) => {
                this.element.scrollLeft = this.element.scrollLeft + event.deltaY;
            }, { passive: true });
        }
    }

    public toggleExit(hide: boolean) {
        const exitFocusElement = this.element.parentElement?.querySelector('[data-type="exit-focus"]');
        if (!exitFocusElement) {
            return;
        }
        if (hide) {
            exitFocusElement.classList.add("fn__none");
            return;
        }
        exitFocusElement.classList.remove("fn__none");
    }

    public showMenu(protyle: IProtyle, position: IPosition) {
        const 录音上下文: 录音器上下文 = {
            mediaRecorder: this.mediaRecorder,
            messageId: this.messageId,
            startRecord: (p: IProtyle) => {
                void this.startRecord(p);
            },
            setMediaRecorder: (recorder) => {
                this.mediaRecorder = recorder;
            },
            setMessageId: (id) => {
                this.messageId = id;
            }
        };
        显示面包屑菜单(protyle, position, 录音上下文);
    }

    public focus(range?: Range) {
        if (!this.element.isConnected || this.element.getClientRects().length === 0) {
            return false;
        }
        const itemElement = this.element.querySelector(".protyle-breadcrumb__item--active") as HTMLElement ||
            this.element.querySelector(".protyle-breadcrumb__item:last-of-type") as HTMLElement;
        if (!itemElement) {
            return false;
        }
        this.element.classList.remove("protyle-breadcrumb__bar--hide");
        window.siyuan.menus.menu.remove();
        if (!this.element.contains(document.activeElement)) {
            this.previousFocusElement = document.activeElement as HTMLElement;
            this.previousRange = range?.cloneRange();
        }
        this.focusItem(itemElement);
        return true;
    }

    private restoreEditorFocus(protyle: IProtyle) {
        const focusElement = this.previousFocusElement?.isConnected ? this.previousFocusElement : protyle.wysiwyg.element;
        focusElement.focus({preventScroll: true});
        if (this.previousRange) {
            focusByRange(this.previousRange);
        }
        this.previousFocusElement = undefined;
        this.previousRange = undefined;
    }

    private getSiblingItem(itemElement: HTMLElement, forward: boolean) {
        let siblingElement = forward ? itemElement.nextElementSibling : itemElement.previousElementSibling;
        while (siblingElement && !siblingElement.classList.contains("protyle-breadcrumb__item")) {
            siblingElement = forward ? siblingElement.nextElementSibling : siblingElement.previousElementSibling;
        }
        return siblingElement as HTMLElement;
    }

    private focusItem(itemElement: HTMLElement) {
        this.element.querySelectorAll(".protyle-breadcrumb__item").forEach((item) => {
            item.setAttribute("tabindex", item === itemElement ? "0" : "-1");
        });
        itemElement.focus({preventScroll: true});
        itemElement.scrollIntoView({block: "nearest", inline: "nearest"});
    }

    private async openChildrenMenu(protyle: IProtyle, id: string, position: IPosition, keyboard = false) {
        if (!id) {
            return;
        }

        const keyboardItemElement = keyboard ? document.activeElement : undefined;
        const menuName = `${Constants.MENU_BREADCRUMB_CHILDREN}-${id}`;
        const menu = new Menu(menuName);
        if (menu.isOpen) {
            return;
        }

        const currentPathIDs = new Set<string>();
        this.element.querySelectorAll(".protyle-breadcrumb__item").forEach((item) => {
            const itemID = item.getAttribute("data-node-id");
            if (itemID) {
                currentPathIDs.add(itemID);
            }
        });
        let currentBlockElement = this.id ?
            protyle.wysiwyg.element.querySelector(`[data-node-id="${this.id}"]`) as HTMLElement : undefined;
        while (currentBlockElement) {
            const currentBlockID = currentBlockElement.getAttribute("data-node-id");
            if (currentBlockID) {
                currentPathIDs.add(currentBlockID);
            }
            const parentBlockElement = hasClosestBlock(currentBlockElement.parentElement) as HTMLElement;
            if (!parentBlockElement || !protyle.wysiwyg.element.contains(parentBlockElement)) {
                break;
            }
            currentBlockElement = parentBlockElement;
        }
        const excludeTypes = 获取排除类型(this.element);

        let items: IMenu[];
        try {
            items = await this.genChildrenMenuItems(protyle, id, currentPathIDs, excludeTypes);
        } catch (e) {
            console.warn("get breadcrumb children failed", e);
            if (window.siyuan.menus.menu.element.getAttribute("data-name") === menuName) {
                window.siyuan.menus.menu.remove();
            }
            return;
        }
        if (keyboard && document.activeElement !== keyboardItemElement) {
            if (window.siyuan.menus.menu.element.getAttribute("data-name") === menuName) {
                window.siyuan.menus.menu.remove();
            }
            return;
        }
        if (window.siyuan.menus.menu.element.getAttribute("data-name") !== menuName) {
            return;
        }
        if (items.length === 0) {
            window.siyuan.menus.menu.remove();
            return;
        }

        items.forEach((item) => {
            menu.addItem(item);
        });
        menu.open(position);
        if (keyboard) {
            menu.element.querySelector(".b3-menu__item:not([disabled])")?.classList.add("b3-menu__item--current");
        }
    }

    private async genChildrenMenuItems(protyle: IProtyle, id: string, currentPathIDs: Set<string>,
                                       excludeTypes: string[], offset = 0): Promise<IMenu[]> {
        const request = withEncryptedNotebook(protyle.notebookId, {
            id,
            offset,
            limit: 64,
            excludeTypes,
        });
        const response = await fetchSyncPost("/api/block/getBlockBreadcrumbChildren", request);
        const data = response.data as {
            items: IBreadcrumb[],
            hasMore: boolean,
        };
        if (!data?.items) {
            return [];
        }

        const items = data.items.map((item) => {
            const menuItem: IMenu = {
                id: item.id,
                icon: getIconByType(item.type, item.subType),
                label: item.name,
                current: currentPathIDs.has(item.id),
                click: () => {
                    protyle.getInstance().zoomOut({id: item.id});
                },
            };
            if (item.hasChildren) {
                menuItem.loadSubmenu = () => this.genChildrenMenuItems(protyle, item.id, currentPathIDs,
                    excludeTypes);
            }
            return menuItem;
        });

        if (data.hasMore) {
            items.push({
                icon: "iconMore",
                label: window.siyuan.languages.loadMore,
                click: (element) => {
                    element.setAttribute("disabled", "disabled");
                    this.genChildrenMenuItems(protyle, id, currentPathIDs, excludeTypes,
                        offset + data.items.length)
                        .then((nextItems) => {
                            if (!element.isConnected) {
                                return;
                            }
                            let firstNextElement: HTMLElement | undefined;
                            nextItems.forEach((item) => {
                                const nextElement = new MenuItem(item).element;
                                if (!firstNextElement) {
                                    firstNextElement = nextElement;
                                }
                                element.before(nextElement);
                            });
                            const moveCurrent = element.classList.contains("b3-menu__item--current");
                            element.remove();
                            if (moveCurrent && firstNextElement) {
                                firstNextElement.classList.add("b3-menu__item--current");
                                firstNextElement.scrollIntoView({block: "nearest"});
                            }
                            window.siyuan.menus.menu.resetPosition();
                        }).catch(() => {
                            element.removeAttribute("disabled");
                        });
                    return true;
                },
            });
        }
        return items;
    }

    private async startRecord(protyle: IProtyle, mediaStream?: MediaStream) {
        if (this.startingRecord || this.stoppingRecord) {
            return;
        }
        this.startingRecord = true;
        let recorder = this.mediaRecorder;
        try {
            if (!recorder) {
                let stream = mediaStream;
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: isInAndroid() || isInHarmony() ? {
                            autoGainControl: false,
                            echoCancellation: false,
                            noiseSuppression: false,
                        } : true,
                    });
                }
                recorder = new RecordMedia(stream);
                this.mediaRecorder = recorder;
            }
            await recorder.startRecording();
        } catch (error) {
            if (recorder) {
                recorder.dispose();
                if (this.mediaRecorder === recorder) {
                    this.mediaRecorder = undefined;
                }
            }
            showMessage(error instanceof RecordMediaInputEndedError ?
                window.siyuan.languages.recordInterrupted : window.siyuan.languages["record-tip"]);
            return;
        } finally {
            this.startingRecord = false;
        }
        if (!recorder) {
            return;
        }
        recorder.onerror = (error) => {
            if (this.mediaRecorder !== recorder) {
                return;
            }
            recorder.dispose();
            this.mediaRecorder = undefined;
            hideMessage(this.messageId);
            showMessage(error instanceof RecordMediaInputEndedError ?
                window.siyuan.languages.recordInterrupted : window.siyuan.languages["record-tip"]);
        };
        const recordingMessageId = showMessage(`<div class="fn__flex fn__flex-wrap">
<span class="fn__flex-center">${siyuanI18n.recording}</span><span class="fn__space"></span>
<button class="b3-button b3-button--white">${siyuanI18n.endRecord}</button></div>`, -1);
        this.messageId = typeof recordingMessageId === "string" ? recordingMessageId : "";
        const endButton = document.querySelector(`#message [data-id="${this.messageId}"] button`);
        endButton?.addEventListener("click", () => {
            void this.stopRecord(protyle);
        });
    }

    private async stopRecord(protyle: IProtyle) {
        if (this.stoppingRecord || !this.mediaRecorder?.isRecording) {
            return;
        }
        this.stoppingRecord = true;
        const recorder = this.mediaRecorder;
        // 显式结束后的后续错误不再提示（exactOptionalPropertyTypes 下不能直接赋 undefined）
        recorder.onerror = () => {
            // 忽略
        };
        hideMessage(this.messageId);
        try {
            const blob = await recorder.stopRecording();
            const file = new File([blob], `record${Date.now()}.mp3`, {type: "audio/mpeg"});
            this.pendingRecordFiles.add(file);
            this.uploadRecord(protyle, file, protyle.block?.rootID);
        } catch (error) {
            showMessage(error instanceof RecordMediaInputEndedError ?
                window.siyuan.languages.recordInterrupted : window.siyuan.languages["record-tip"]);
        } finally {
            recorder.dispose();
            if (this.mediaRecorder === recorder) {
                this.mediaRecorder = undefined;
            }
            this.stoppingRecord = false;
        }
    }

    private uploadRecord(protyle: IProtyle, file: File, rootID: string) {
        if (!this.pendingRecordFiles.has(file) || this.uploadingRecordFiles.has(file)) {
            return;
        }
        hideMessage(this.recordUploadMessageIds.get(file));
        this.recordUploadMessageIds.delete(file);
        const uploadProtyle = this.findRecordUploadProtyle(protyle, rootID);
        if (!uploadProtyle) {
            this.showRecordUploadRetry(protyle, file, rootID);
            return;
        }

        this.uploadingRecordFiles.add(file);
        try {
            uploadFiles(uploadProtyle, [file], undefined, undefined, (succeeded) => {
                this.uploadingRecordFiles.delete(file);
                if (!this.pendingRecordFiles.has(file)) {
                    return;
                }
                if (succeeded) {
                    this.pendingRecordFiles.delete(file);
                    return;
                }
                this.showRecordUploadRetry(uploadProtyle, file, rootID);
            }, {source: "programmatic", target: "editor"});
        } catch (error) {
            this.uploadingRecordFiles.delete(file);
            this.showRecordUploadRetry(uploadProtyle, file, rootID);
        }
    }

    private findRecordUploadProtyle(protyle: IProtyle, rootID: string) {
        if (document.body.contains(protyle.element) && (!rootID || protyle.block?.rootID === rootID)) {
            return protyle;
        }
        return getAllEditor().find((editor) => {
            return document.body.contains(editor.protyle.element) &&
                (!rootID || editor.protyle.block?.rootID === rootID);
        })?.protyle;
    }

    private showRecordUploadRetry(protyle: IProtyle, file: File, rootID: string) {
        if (!this.pendingRecordFiles.has(file)) {
            return;
        }
        const retryMessageId = showMessage(`<div class="fn__flex fn__flex-wrap">
<span class="fn__flex-center">${window.siyuan.languages.uploadError}</span><span class="fn__space"></span>
<button class="b3-button b3-button--white">${window.siyuan.languages.retry}</button></div>`, -1);
        const messageId = typeof retryMessageId === "string" ? retryMessageId : "";
        this.recordUploadMessageIds.set(file, messageId);
        document.querySelector(`#message [data-id="${messageId}"] button`)?.addEventListener("click", () => {
            this.uploadRecord(protyle, file, rootID);
        });
    }

    public render(protyle: IProtyle, update = false, nodeElement?: Element | false) {
        if (isMobile) {
            return;
        }
        // 永久禁用的编辑器不渲染面包屑
        if (protyle.element.getAttribute("disabled-forever") === "true") {
            return;
        }
        refreshUndoButtons(protyle);
        let blockElement = 确定渲染块元素(protyle, nodeElement);
        if (!blockElement) {
            blockElement = 获取默认块元素(protyle);
        }
        if (!blockElement) {
            // 浮窗删除单个块后，面包屑无法获取到 blockElement，直接返回即可
            return;
        }
        const id = blockElement.getAttribute("data-node-id") || "";

        if (id === this.id && !update) {
            更新活动状态(protyle);
            return;
        }
        this.id = id;

        const excludeTypes = 获取排除类型(this.element);

        const breadcrumbParam = withEncryptedNotebook(protyle.notebookId, {id, excludeTypes});
        fetchPost("/api/block/getBlockBreadcrumb", breadcrumbParam, (response) => {
            处理渲染响应(this.element, protyle, response);
        });
    }

    public hide() {
        if (isMobile) {
            return;
        }
        this.element.classList.add("protyle-breadcrumb__bar--hide");
        setSiyuanHideBreadcrumb(true);
    }
}
