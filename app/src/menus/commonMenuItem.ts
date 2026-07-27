import {openExternal} from "../platform/electron/shell";
import {getSearch, isMobile, isValidCustomAttrName} from "../util/functions";
import {isEncryptedBox, isLocalPath, pathPosix} from "../util/pathName";
import {MenuItem} from "./Menu";
import {
    isInAndroid,
    isInHarmony
} from "../protyle/util/compatibility";
import {openByMobile} from "../editor/openLink";
import {fetchPost} from "../util/fetch";
import {showMessage} from "../dialog/message";
import {Dialog} from "../dialog";
import {focusByRange, getEditorRange} from "../protyle/util/selection";
import {openBy} from "../platform/localPath/openBy";
import {replaceFileName} from "../editor/rename";
import * as dayjs from "dayjs";
import {Constants} from "../constants";
import type { AppFacade } from "../app/AppFacade.types";
import {renderAVAttribute} from "../protyle/render/av/blockAttr";
import {openAssetNewWindow} from "../window/openNewWindow";
import {hideElements} from "../protyle/ui/hideElements";
import {Protyle} from "../protyle";
import {getAllEditor} from "../layout/getAll";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {isElectron} from "../platform";

const bindAttrInput = (inputElement: HTMLInputElement, id: string) => {
    inputElement.addEventListener("change", () => {
        fetchPost("/api/attr/setBlockAttrs", {
            id,
            attrs: {[inputElement.dataset.name]: inputElement.value}
        });
    });
};

export const openWechatNotify = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const range = getEditorRange(nodeElement);
    const reminder = nodeElement.getAttribute(Constants.CUSTOM_REMINDER_WECHAT);
    let reminderFormat = "";
    if (reminder) {
        reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
    }
    const dialog = new Dialog({
        width: isMobile() ? "92vw" : "50vw",
        title: window.siyuan.languages.wechatReminder,
        content: `<div class="b3-dialog__content custom-attr">
    <div class="fn__flex">
        <span class="ft__on-surface fn__flex-center" style="text-align: right;white-space: nowrap;width: 100px">${window.siyuan.languages.notifyTime}</span>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" type="datetime-local" max="9999-12-31 23:59" value="${reminderFormat}">
    </div>
    <div class="b3-label__text" style="text-align: center">${window.siyuan.languages.wechatTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.remove}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`,
        destroyCallback() {
            focusByRange(range);
        }
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_WECHATREMINDER);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        if (btnsElement[1].getAttribute("disabled")) {
            return;
        }
        btnsElement[1].setAttribute("disabled", "disabled");
        fetchPost("/api/block/setBlockReminder", {id, timed: "0"}, () => {
            nodeElement.removeAttribute(Constants.CUSTOM_REMINDER_WECHAT);
            dialog.destroy();
        });
    });
    btnsElement[2].addEventListener("click", () => {
        const date = dialog.element.querySelector("input").value;
        if (date) {
            if (new Date(date) <= new Date()) {
                showMessage(window.siyuan.languages.reminderTip);
                return;
            }
            if (btnsElement[2].getAttribute("disabled")) {
                return;
            }
            btnsElement[2].setAttribute("disabled", "disabled");
            const timed = dayjs(date).format("YYYYMMDDHHmmss");
            fetchPost("/api/block/setBlockReminder", {id, timed}, () => {
                nodeElement.setAttribute(Constants.CUSTOM_REMINDER_WECHAT, timed);
                dialog.destroy();
            });
        } else {
            showMessage(window.siyuan.languages.notEmpty);
        }
    });
};

export const openFileWechatNotify = (protyle: IProtyle) => {
    const docInfoParam: IObject = {
        id: protyle.block.rootID
    };
    if (isEncryptedBox(protyle.notebookId)) {
        docInfoParam.notebook = protyle.notebookId;
    }
    fetchPost("/api/block/getDocInfo", docInfoParam, (response) => {
        const reminder = response.data.ial[Constants.CUSTOM_REMINDER_WECHAT];
        let reminderFormat = "";
        if (reminder) {
            reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
        }
        const dialog = new Dialog({
            width: isMobile() ? "92vw" : "50vw",
            title: window.siyuan.languages.wechatReminder,
            content: `<div class="b3-dialog__content custom-attr">
    <div class="fn__flex">
        <span class="ft__on-surface fn__flex-center" style="text-align: right;white-space: nowrap;width: 100px">${window.siyuan.languages.notifyTime}</span>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" type="datetime-local" max="9999-12-31 23:59" value="${reminderFormat}">
    </div>
    <div class="b3-label__text" style="text-align: center">${window.siyuan.languages.wechatTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.remove}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_WECHATREMINDER);
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            fetchPost("/api/block/setBlockReminder", {id: protyle.block.rootID, timed: "0"}, () => {
                dialog.destroy();
            });
        });
        btnsElement[2].addEventListener("click", () => {
            const date = dialog.element.querySelector("input").value;
            if (date) {
                if (new Date(date) <= new Date()) {
                    showMessage(window.siyuan.languages.reminderTip);
                    return;
                }
                fetchPost("/api/block/setBlockReminder", {
                    id: protyle.block.rootID,
                    timed: dayjs(date).format("YYYYMMDDHHmmss")
                }, () => {
                    dialog.destroy();
                });
            } else {
                showMessage(window.siyuan.languages.notEmpty);
            }
        });
    });
};

export const openFileAttr = (attrs: Record<string, string>, focusName = "bookmark", protyle?: IProtyle) => {
    let customHTML = "";
    let notifyHTML = "";
    let hasAV = false;
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;
    let ghostProtyle: Protyle;
    if (!protyle) {
        getAllEditor().find(item => {
            if (attrs.id === item.protyle.block.rootID) {
                protyle = item.protyle;
                return true;
            }
        });
        if (!protyle) {
            ghostProtyle = new Protyle(window.siyuan.ws.app, document.createElement("div"), {
                blockId: attrs.id,
            });
        }
    }
    Object.keys(attrs).forEach(item => {
        if (Constants.CUSTOM_RIFF_DECKS === item || item.startsWith("custom-sy-")) {
            return;
        }
        if (item === Constants.CUSTOM_REMINDER_WECHAT) {
            notifyHTML = `<label class="b3-label b3-label--noborder">
    ${window.siyuan.languages.wechatReminder}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" type="datetime-local" max="9999-12-31 23:59" readonly data-name="${item}" value="${dayjs(attrs[item]).format("YYYY-MM-DD HH:mm")}">
</label>`;
        } else if (item.indexOf("custom-av") > -1) {
            hasAV = true;
        } else if (item.indexOf("custom") > -1) {
            customHTML += `<label class="b3-label b3-label--noborder">
     <div class="fn__flex">
        <span class="fn__flex-1">${item.replace("custom-", "")}</span>
        <span data-action="remove" class="block__icon block__icon--show"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__hr"></div>
    <textarea style="resize: vertical;" spellcheck="false" class="b3-text-field fn__block" rows="1" data-name="${item}"></textarea>
</label>`;
        }
    });
    const dialog = new Dialog({
        width: isMobile() ? "100vw" : "50vw",
        containerClassName: "b3-dialog__container--theme",
        height: isMobile() ? "100vh" : "80vh",
        content: `<div class="fn__flex-column">
    <div class="layout-tab-bar fn__flex" style="${isMobile() ? "padding-right: 38px;" : ""}flex-shrink:0;border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0">
        <div class="item item--full item--focus" data-type="attr">
            <span class="fn__flex-1"></span>
            <span class="item__text">${window.siyuan.languages.builtIn}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full${hasAV ? "" : " fn__none"}" data-type="NodeAttributeView">
            <span class="fn__flex-1"></span>
            <span class="item__text">${window.siyuan.languages.database}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="custom">
            <span class="fn__flex-1"></span>
            <span class="item__text">${window.siyuan.languages.custom}</span>
            <span class="fn__flex-1"></span>
        </div>
    </div>
    <div class="fn__flex-1">
        <div class="custom-attr" data-type="attr">
            <label class="b3-label b3-label--noborder">
                <div class="fn__flex">
                    <span class="fn__flex-1">${window.siyuan.languages.bookmark}</span>
                    <span data-action="bookmark" class="block__icon block__icon--show"><svg><use xlink:href="#iconDown"></use></svg></span>
                </div>
                <div class="fn__hr"></div>
                <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrBookmarkTip}" data-name="bookmark">
            </label>
            <label class="b3-label b3-label--noborder">
                ${window.siyuan.languages.name}
                <div class="fn__hr"></div>
                <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrNameTip}" data-name="name">
            </label>
            <label class="b3-label b3-label--noborder">
                ${window.siyuan.languages.alias}
                <div class="fn__hr"></div>
                <input spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrAliasTip}" data-name="alias">
            </label>
            <label class="b3-label b3-label--noborder">
                ${window.siyuan.languages.memo}
                <div class="fn__hr"></div>
                <textarea style="resize: vertical" spellcheck="${window.siyuan.config.editor.spellcheck}" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.attrMemoTip}" rows="2" data-name="memo"></textarea>
            </label>
            ${notifyHTML}
        </div>
        <div data-type="NodeAttributeView" class="fn__none custom-attr"></div>
        <div data-type="custom" class="fn__none custom-attr">
           ${customHTML}
           <div class="b3-label">
               <button data-action="addCustom" class="b3-button b3-button--cancel">
                   <svg><use xlink:href="#iconAdd"></use></svg>${window.siyuan.languages.addAttr}
               </button>
           </div>
        </div>
    </div>
</div>`,
        destroyCallback() {
            focusByRange(range);
            if (protyle) {
                hideElements(["select"], protyle);
            } else {
                ghostProtyle.destroy();
            }
        }
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_ATTR);
    (dialog.element.querySelector('.b3-text-field[data-name="bookmark"]') as HTMLInputElement).value = attrs.bookmark || "";
    (dialog.element.querySelector('.b3-text-field[data-name="name"]') as HTMLInputElement).value = attrs.name || "";
    (dialog.element.querySelector('.b3-text-field[data-name="alias"]') as HTMLInputElement).value = attrs.alias || "";
    (dialog.element.querySelector('.b3-text-field[data-name="memo"]') as HTMLInputElement).value = attrs.memo || "";
    dialog.element.querySelectorAll('.custom-attr[data-type="custom"] textarea.b3-text-field').forEach((item: HTMLTextAreaElement) => {
        item.value = attrs[item.dataset.name];
    });
    dialog.element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        if (typeof event.detail === "string") {
            target = dialog.element.querySelector(`.item--full[data-type="${event.detail}"]`);
        }
        while (target !== dialog.element) {
            const type = target.dataset.action;
            if (target.classList.contains("item--full")) {
                target.parentElement.querySelector(".item--focus").classList.remove("item--focus");
                target.classList.add("item--focus");
                dialog.element.querySelectorAll(".custom-attr").forEach((item: HTMLElement) => {
                    if (item.dataset.type === target.dataset.type) {
                        if (item.dataset.type === "NodeAttributeView" && item.innerHTML === "") {
                            renderAVAttribute(item, attrs.id, protyle || ghostProtyle.protyle);
                        }
                        item.classList.remove("fn__none");
                    } else {
                        item.classList.add("fn__none");
                    }
                });
            } else if (type === "remove") {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: attrs.id,
                    attrs: {["custom-" + target.previousElementSibling.textContent]: ""}
                });
                target.parentElement.parentElement.remove();
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "bookmark") {
                fetchPost("/api/attr/getBookmarkLabels", {}, (response) => {
                    window.siyuan.menus.menu.remove();
                    if (response.data.length === 0) {
                        window.siyuan.menus.menu.append(new MenuItem({
                            id: "emptyContent",
                            iconHTML: "",
                            label: window.siyuan.languages.emptyContent,
                            type: "readonly",
                        }).element);
                    } else {
                        response.data.forEach((item: string) => {
                            window.siyuan.menus.menu.append(new MenuItem({
                                label: item,
                                click() {
                                    const bookmarkInputElement = target.parentElement.parentElement.querySelector("input");
                                    bookmarkInputElement.value = item;
                                    bookmarkInputElement.dispatchEvent(new CustomEvent("change"));
                                }
                            }).element);
                        });
                    }
                    window.siyuan.menus.menu.element.classList.add("b3-menu--list");
                    window.siyuan.menus.menu.popup({x: event.clientX, y: event.clientY + 16, w: 16});
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            } else if (type === "addCustom") {
                const addDialog = new Dialog({
                    title: window.siyuan.languages.attrName,
                    content: `<div class="b3-dialog__content"><input spellcheck="false" class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`,
                    width: isMobile() ? "92vw" : "520px",
                });
                addDialog.element.setAttribute("data-key", Constants.DIALOG_SETCUSTOMATTR);
                const inputElement = addDialog.element.querySelector("input") as HTMLInputElement;
                const btnsElement = addDialog.element.querySelectorAll(".b3-button");
                addDialog.bindInput(inputElement, () => {
                    (btnsElement[1] as HTMLButtonElement).click();
                });
                inputElement.focus();
                inputElement.select();
                btnsElement[0].addEventListener("click", () => {
                    addDialog.destroy();
                });
                btnsElement[1].addEventListener("click", () => {
                    const value = inputElement.value.toLowerCase();
                    if (!isValidCustomAttrName(value)) {
                        showMessage(window.siyuan.languages._kernel[25]);
                        return false;
                    }
                    let existElement: HTMLElement | false;
                    Array.from(dialog.element.querySelectorAll('.custom-attr[data-type="custom"] .b3-label .fn__flex-1')).find((labelItem: HTMLElement) => {
                        if (labelItem.textContent === value) {
                            existElement = hasClosestByClassName(labelItem, "b3-label");
                            return true;
                        }
                    });
                    if (existElement) {
                        showMessage(window.siyuan.languages.hasAttrName.replace("${x}", value));
                    } else {
                        target.parentElement.insertAdjacentHTML("beforebegin", `<div class="b3-label b3-label--noborder">
    <div class="fn__flex">
        <span class="fn__flex-1">${value}</span>
        <span data-action="remove" class="block__icon block__icon--show"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__hr"></div>
    <textarea style="resize: vertical" spellcheck="false" data-name="custom-${value}" class="b3-text-field fn__block" rows="1" placeholder="${window.siyuan.languages.attrValue1}"></textarea>
</div>`);
                        const newInputElement = target.parentElement.previousElementSibling.querySelector(".b3-text-field") as HTMLInputElement;
                        newInputElement.focus();
                        bindAttrInput(newInputElement, attrs.id);
                        addDialog.destroy();
                    }
                });
                event.stopPropagation();
                event.preventDefault();
                break;
            }
            target = target.parentElement;
        }
    });
    dialog.element.querySelectorAll(".b3-text-field").forEach((item: HTMLInputElement) => {
        if (focusName !== "av" && focusName !== "custom" && focusName === item.getAttribute("data-name")) {
            item.focus();
        }
        bindAttrInput(item, attrs.id);
    });
    if (focusName === "av") {
        dialog.element.dispatchEvent(new CustomEvent("click", {detail: "NodeAttributeView"}));
        (document.activeElement as HTMLElement)?.blur();
    } else if (focusName === "custom") {
        dialog.element.dispatchEvent(new CustomEvent("click", {detail: "custom"}));
    }
};

export const openAttr = (nodeElement: Element, focusName = "bookmark", protyle: IProtyle) => {
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    fetchPost("/api/attr/getBlockAttrs", {id}, (response) => {
        openFileAttr(response.data, focusName, protyle);
    });
};

export const openMenu = (app: AppFacade, src: string, onlyMenu: boolean, showAccelerator: boolean) => {
    const submenu = [];
    if (isMobile()) {
        submenu.push({
            id: isInAndroid() ? "useDefault" : "useBrowserView",
            label: isInAndroid() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
            accelerator: showAccelerator ? window.siyuan.languages.click : "",
            click: () => {
                openByMobile(src);
            }
        });
    } else if (isLocalPath(src)) {
        if (Constants.SIYUAN_ASSETS_EXTS.includes(pathPosix().extname(src).split("?")[0]) &&
            (!src.endsWith(".pdf") ||
                (src.endsWith(".pdf") && !src.startsWith("file://")))
        ) {
            submenu.push({
                id: "insertRight",
                icon: "iconLayoutRight",
                label: window.siyuan.languages.insertRight,
                accelerator: showAccelerator ? window.siyuan.languages.click : "",
                click() {
                    app.openAsset({assetPath: src.trim(), page: parseInt(getSearch("page", src)), position: "right"});
                }
            });
            submenu.push({
                id: "openBy",
                label: window.siyuan.languages.openBy,
                icon: "iconOpen",
                accelerator: showAccelerator ? "⌥" + window.siyuan.languages.click : "",
                click() {
                    app.openAsset({assetPath: src.trim(), page: parseInt(getSearch("page", src))});
                }
            });
            if (isElectron) {
                submenu.push({
                    id: "openByNewWindow",
                    label: window.siyuan.languages.openByNewWindow,
                    icon: "iconOpenWindow",
                    click() {
                        openAssetNewWindow(src.trim());
                    }
                });
                submenu.push({
                    id: "showInFolder",
                    icon: "iconFolder",
                    label: window.siyuan.languages.showInFolder,
                    accelerator: showAccelerator ? "⌘" + window.siyuan.languages.click : "",
                    click: () => {
                        openBy(src, "folder");
                    }
                });
                submenu.push({
                    id: "useDefault",
                    label: window.siyuan.languages.useDefault,
                    accelerator: showAccelerator ? "⇧" + window.siyuan.languages.click : "",
                    click() {
                        openBy(src, "app");
                    }
                });
            }
        } else {
            if (isElectron) {
                submenu.push({
                    id: "useDefault",
                    label: window.siyuan.languages.useDefault,
                    accelerator: showAccelerator ? window.siyuan.languages.click : "",
                    click() {
                        openBy(src, "app");
                    }
                });
                submenu.push({
                    id: "showInFolder",
                    icon: "iconFolder",
                    label: window.siyuan.languages.showInFolder,
                    accelerator: showAccelerator ? "⌘" + window.siyuan.languages.click : "",
                    click: () => {
                        openBy(src, "folder");
                    }
                });
            } else {
                submenu.push({
                    id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
                    label: isInAndroid() || isInHarmony() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
                    accelerator: showAccelerator ? window.siyuan.languages.click : "",
                    click: () => {
                        openByMobile(src);
                    }
                });
            }
        }
    } else if (src) {
        if (0 > src.indexOf(":")) {
            // 使用 : 判断，不使用 :// 判断 Open external application protocol invalid https://github.com/siyuan-note/siyuan/issues/10075
            // Support click to open hyperlinks like `www.foo.com` https://github.com/siyuan-note/siyuan/issues/9986
            src = `https://${src}`;
        }
        if (isElectron) {
            submenu.push({
                id: "useDefault",
                label: window.siyuan.languages.useDefault,
                accelerator: showAccelerator ? window.siyuan.languages.click : "",
                click: () => {
                    if (app.processSiYuanUri(src)) {
                        return;
                    }
                    openExternal(src).catch((e) => {
                        showMessage(e);
                    });
                }
            });
        } else {
            submenu.push({
                id: isInAndroid() || isInHarmony() ? "useDefault" : "useBrowserView",
                label: isInAndroid() || isInHarmony() ? window.siyuan.languages.useDefault : window.siyuan.languages.useBrowserView,
                accelerator: showAccelerator ? window.siyuan.languages.click : "",
                click: () => {
                    openByMobile(src);
                }
            });
        }
    }
    if (onlyMenu) {
        return submenu;
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "openBy",
        label: window.siyuan.languages.openBy,
        icon: "iconOpen",
        submenu
    }).element);
};
