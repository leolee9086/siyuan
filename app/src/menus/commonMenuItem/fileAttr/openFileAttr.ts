import {dayjs} from "./imports";
import {focusByRange} from "./imports";
import {Constants} from "./imports";
import {Dialog} from "./imports";
import {getAllEditor} from "./imports";
import type {ProtyleDomain} from "./imports";
import {hideElements} from "./imports";
import {isMobile} from "./imports";
import {getSiyuanConfig} from "./imports";
import {siyuanI18n} from "./imports";
import {isHTMLInputElement, isHTMLElement} from "./imports";
import {bindAttrInput} from "./bindAttrInput";
import {handleAddCustomAction, handleBookmarkAction, handleRemoveAction, handleTabSwitch} from "./openFileAttr.handlers";



const initializeProtyle = (attrs: IObject, protyle?: IProtyle): { protyle: IProtyle | undefined, ghostProtyle: ProtyleDomain | undefined } => {
    let ghostProtyle: ProtyleDomain | undefined;
    if (!protyle) {
        getAllEditor().find(item => {
            if (attrs.id === item.protyle.block.rootID) {
                protyle = item.protyle;
                return true;
            }
        });
    }

    if (!protyle && attrs.id) {
        ghostProtyle = window.siyuan.ws.app.createProtyle(document.createElement("div"), {
            blockId: attrs.id,
        });
    }
    return { protyle, ghostProtyle };
};

const processAttributes = (attrs: IObject): { customHTML: string, notifyHTML: string, hasAV: boolean } => {
    let customHTML = "";
    let notifyHTML = "";
    let hasAV = false;

    for (const item of Object.keys(attrs)) {
        if (Constants.CUSTOM_RIFF_DECKS === item || item.startsWith("custom-sy-")) {
            continue;
        }
        if (item === Constants.CUSTOM_REMINDER_WECHAT) {
            notifyHTML = `<label class="b3-label b3-label--noborder">
    ${siyuanI18n.wechatReminder}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" type="datetime-local" max="9999-12-31 23:59" readonly data-name="${item}" value="${dayjs(attrs[item]).format("YYYY-MM-DD HH:mm")}">
</label>`;
            continue;
        }
        if (item.indexOf("custom-av") > -1) {
            hasAV = true;
            continue;
        }
        if (item.indexOf("custom") > -1) {
            customHTML += `<label class="b3-label b3-label--noborder">
     <div class="fn__flex">
        <span class="fn__flex-1">${item.replace("custom-", "")}</span>
        <span data-action="remove" class="block__icon block__icon--show"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__hr"></div>
    <textarea style="resize: vertical;" spellcheck="false" class="b3-text-field fn__block" rows="1" data-name="${item}">${attrs[item]}</textarea>
</label>`;
        }
    }

    return { customHTML, notifyHTML, hasAV };
};

/** 生成 Tab 栏 HTML */
const generateTabBarHTML = (hasAV: boolean) => /*html*/ `
    <div class="layout-tab-bar fn__flex" style="flex-shrink:0;border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0">
        <div class="item item--full item--focus" data-type="attr">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.builtIn}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full${hasAV ? "" : " fn__none"}" data-type="NodeAttributeView">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.database}</span>
            <span class="fn__flex-1"></span>
        </div>
        <div class="item item--full" data-type="custom">
            <span class="fn__flex-1"></span>
            <span class="item__text">${siyuanI18n.custom}</span>
            <span class="fn__flex-1"></span>
        </div>
    </div>`;

/** 生成内置属性面板 HTML */
const generateBuiltInAttrHTML = (attrs: IObject, notifyHTML: string) => {
    const spellcheck = getSiyuanConfig().editor.spellcheck;
    return /*html*/ `
        <div class="custom-attr" data-type="attr">
            <label class="b3-label b3-label--noborder">
                <div class="fn__flex">
                    <span class="fn__flex-1">${siyuanI18n.bookmark}</span>
                    <span data-action="bookmark" class="block__icon block__icon--show"><svg><use xlink:href="#iconDown"></use></svg></span>
                </div>
                <div class="fn__hr"></div>
                <input spellcheck="${spellcheck}" class="b3-text-field fn__block" placeholder="${siyuanI18n.attrBookmarkTip}" data-name="bookmark">
            </label>
            <label class="b3-label b3-label--noborder">
                ${siyuanI18n.name}
                <div class="fn__hr"></div>
                <input spellcheck="${spellcheck}" class="b3-text-field fn__block" placeholder="${siyuanI18n.attrNameTip}" data-name="name">
            </label>
            <label class="b3-label b3-label--noborder">
                ${siyuanI18n.alias}
                <div class="fn__hr"></div>
                <input spellcheck="${spellcheck}" class="b3-text-field fn__block" placeholder="${siyuanI18n.attrAliasTip}" data-name="alias">
            </label>
            <label class="b3-label b3-label--noborder">
                ${siyuanI18n.memo}
                <div class="fn__hr"></div>
                <textarea style="resize: vertical" spellcheck="${spellcheck}" class="b3-text-field fn__block" placeholder="${siyuanI18n.attrMemoTip}" rows="2" data-name="memo">${attrs.memo || ""}</textarea>
            </label>
            ${notifyHTML}
        </div>`;
};

/** 生成自定义属性面板 HTML */
const generateCustomAttrHTML = (customHTML: string) => /*html*/ `
        <div data-type="NodeAttributeView" class="fn__none custom-attr"></div>
        <div data-type="custom" class="fn__none custom-attr">
           ${customHTML}
           <div class="b3-label">
               <button data-action="addCustom" class="b3-button b3-button--cancel">
                   <svg><use xlink:href="#iconAdd"></use></svg>${siyuanI18n.addAttr}
               </button>
           </div>
        </div>`;

/** 组合生成完整对话框 HTML */
const generateDialogHTML = (attrs: IObject, customHTML: string, notifyHTML: string, hasAV: boolean) => /*html*/ `<div class="fn__flex-column">
    ${generateTabBarHTML(hasAV)}
    <div class="fn__flex-1">
        ${generateBuiltInAttrHTML(attrs, notifyHTML)}
        ${generateCustomAttrHTML(customHTML)}
    </div>
</div>`;



const initializeDialog = (dialog: Dialog, attrs: IObject, focusName: string) => {
    dialog.element.setAttribute("data-key", Constants.DIALOG_ATTR);
    const bookmarkInput = dialog.element.querySelector('.b3-text-field[data-name="bookmark"]');
    const nameInput = dialog.element.querySelector('.b3-text-field[data-name="name"]');
    const aliasInput = dialog.element.querySelector('.b3-text-field[data-name="alias"]');
    if (isHTMLInputElement(bookmarkInput)) {
        bookmarkInput.value = attrs.bookmark || "";
    }
    if (isHTMLInputElement(nameInput)) {
        nameInput.value = attrs.name || "";
    }
    if (isHTMLInputElement(aliasInput)) {
        aliasInput.value = attrs.alias || "";
    }

    for (const item of dialog.element.querySelectorAll(".b3-text-field")) {
        if (!isHTMLInputElement(item)) {
            continue;
        }
        if (focusName !== "av" && focusName !== "custom" && focusName === item.dataset.name) {
            item.focus();
        }
        if (attrs.id) {
            bindAttrInput(item, attrs.id);
        }
    }

    if (focusName === "av") {
        dialog.element.dispatchEvent(new CustomEvent("click", { detail: "NodeAttributeView" }));
        return;
    }
    if (focusName === "custom") {
        dialog.element.dispatchEvent(new CustomEvent("click", { detail: "custom" }));
    }
};

const handleDialogClick = (
    event: Event | CustomEvent<string>,
    dialog: Dialog,
    attrs: IObject,
    protyle: IProtyle | undefined,
    ghostProtyle: ProtyleDomain | undefined
) => {
    let target = event.target;
    if (event instanceof CustomEvent && typeof event.detail === "string") {
        target = dialog.element.querySelector(`.item--full[data-type="${event.detail}"]`);
    }
    if (!isHTMLElement(target)) {
        return;
    }

    const actionHandlers: Record<string, () => void> = {
        remove: () => handleRemoveAction(target, attrs, event),
        bookmark: () => {
            if (event instanceof MouseEvent) {
                handleBookmarkAction(target, event);
            }
        },
        addCustom: () => {
            if (event instanceof MouseEvent) {
                handleAddCustomAction(target, dialog, attrs, event);
            }
        },
    };

    while (target !== dialog.element) {
        if (target.classList.contains("item--full")) {
            handleTabSwitch(target, dialog, attrs, protyle, ghostProtyle);
            return;
        }

        const type = target.dataset.action;
        const handler = type ? actionHandlers[type] : undefined;
        if (handler) {
            handler();
            return;
        }

        const parent = target.parentElement;
        if (!parent) {
            return;
        }
        target = parent;
    }
};

const createAttrDialog = (ctx: {
    attrs: IObject;
    customHTML: string;
    notifyHTML: string;
    hasAV: boolean;
    range: Range | undefined;
    protyle: IProtyle | undefined;
    ghostProtyle: ProtyleDomain | undefined;
}) => {
    return new Dialog({
        width: isMobile() ? "92vw" : "50vw",
        containerClassName: "b3-dialog__container--theme",
        height: "80vh",
        content: generateDialogHTML(ctx.attrs, ctx.customHTML, ctx.notifyHTML, ctx.hasAV),
        destroyCallback() {
            if (ctx.range) {
                focusByRange(ctx.range);
            }
            if (ctx.protyle) {
                hideElements(["select"], ctx.protyle);
                return;
            }
            if (ctx.ghostProtyle) {
                ctx.ghostProtyle.destroy();
            }
        }
    });
};

export const openFileAttr = (attrs: IObject, focusName = "bookmark", protyle?: IProtyle) => {
    const selection = getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
    const { protyle: initializedProtyle, ghostProtyle } = initializeProtyle(attrs, protyle);
    protyle = initializedProtyle;
    const { customHTML, notifyHTML, hasAV } = processAttributes(attrs);

    const dialog = createAttrDialog({
        attrs,
        customHTML,
        notifyHTML,
        hasAV,
        range,
        protyle: initializedProtyle,
        ghostProtyle
    });

    dialog.element.addEventListener("click", (e) => handleDialogClick(e, dialog, attrs, protyle, ghostProtyle));

    initializeDialog(dialog, attrs, focusName);
};
