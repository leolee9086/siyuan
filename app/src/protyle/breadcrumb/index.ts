import { fetchPost } from "../../util/network/fetch";
import { RecordMedia } from "../util/RecordMedia";
import { hideMessage, showMessage } from "../runtime/dialog.port";
import {net2LocalAssets} from "./assets/net2LocalAssets";
import {uploadFiles} from "../upload/transport";
import { isMobile } from "../../platform";
import { Menu } from "../../plugin/Menu";
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
    生成面包屑HTML,
    生成面包屑模板,
    生成平板按钮HTML,
} from "./breadcrumb.helpers";
import type { 录音器上下文 } from "./breadcrumb.types";
import {withEncryptedNotebook} from "../../util/file/notebook/store";

// ==================== 录音相关函数 ====================

/**
 * 创建录音结束回调
 */
function 创建录音结束回调(
    mediaRecorder: RecordMedia,
    messageId: string,
    protyle: IProtyle
): () => void {
    return () => {
        mediaRecorder.stopRecording();
        hideMessage(messageId);
        const file: File = new File(
            [mediaRecorder.buildWavFileBlob()],
            `record${Date.now()}.wav`,
            { type: "video/webm" }
        );
        uploadFiles(protyle, [file]);
    };
}

/**
 * 开始录音
 */
function 开始录音(
    protyle: IProtyle,
    mediaRecorder: RecordMedia | undefined,
    setMessageId: (id: string) => void
): string {
    if (!mediaRecorder) {
        return "";
    }
    const messageId = showMessage(`<div class="fn__flex fn__flex-wrap">
<span class="fn__flex-center">${siyuanI18n.recording}</span><span class="fn__space"></span>
<button class="b3-button b3-button--white">${siyuanI18n.endRecord}</button></div>`, -1) || "";
    setMessageId(messageId);

    const messageButton = document.querySelector(`#message [data-id="${messageId}"] button`);
    if (messageButton) {
        const callback = 创建录音结束回调(mediaRecorder, messageId, protyle);
        messageButton.addEventListener("click", callback);
    }
    mediaRecorder.startRecordingNewWavFile();
    return messageId;
}

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
    showMenu: (p: IProtyle, pos: IPosition) => void
): (event: MouseEvent) => void {
    return (event) => {
        const target = event.target;
        if (!isStylableElement(target)) {
            return;
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
 * 处理渲染响应
 */
function 处理渲染响应(
    breadcrumbElement: HTMLElement,
    protyle: IProtyle,
    response: { data?: IBreadcrumb[] }
) {
    breadcrumbElement.innerHTML = 生成面包屑HTML(protyle, response.data || []);
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

    constructor(protyle: IProtyle) {
        const siyuanConfig = getSiyuanConfig();
        const element = document.createElement("div");
        element.className = "protyle-breadcrumb";

        const padHTML = 生成平板按钮HTML();
        element.innerHTML = 生成面包屑模板(siyuanConfig, padHTML);

        const firstChild = element.firstElementChild;
        if (!isHTMLElement(firstChild)) {
            throw new Error("面包屑元素创建失败");
        }
        this.element = firstChild;

        const clickHandler = 创建点击处理器(element, protyle, (p, pos) => this.showMenu(p, pos));
        element.addEventListener("click", clickHandler);

        if (!isMobile) {
            const mouseleaveHandler = 创建鼠标离开处理器(protyle);
            element.addEventListener("mouseleave", mouseleaveHandler);
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
                this.messageId = 开始录音(p, this.mediaRecorder, (id) => {
                    this.messageId = id;
                });
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

    public render(protyle: IProtyle, update = false, nodeElement?: Element | false) {
        if (isMobile) {
            return;
        }
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
