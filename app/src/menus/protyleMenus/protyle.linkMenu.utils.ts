/**
 * 链接菜单工具函数模块
 *
 * 包含链接编辑区域的HTML生成和事件绑定功能。
 */
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import { electronUndo } from "../../protyle/undo";
import { writeText } from "../../protyle/util/compatibility";
import { isMobile } from "../../util/functions";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "../Menu.Item";
import type { LinkMenuContext } from "./protyle.types";

// 重导出类型
export type { LinkMenuContext } from "./protyle.types";

// ────────────────────────────────────────────────────────────
// HTML 模板生成
// ────────────────────────────────────────────────────────────

/**
 * 生成链接编辑区域的 HTML 模板
 * 包含链接地址、锚文本、标题三个输入框
 */
export const 生成链接编辑区域HTML = (): string => {
    const width = isMobile() ? "100%" : "360px";
    return `<div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.link}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea spellcheck="false" rows="1" 
style="margin:4px 0;width: ${width}" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.anchor}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${width};margin: 4px 0;" rows="1" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.title}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${width};margin: 4px 0;" rows="1" class="b3-text-field"></textarea>`;
};

// ────────────────────────────────────────────────────────────
// 输入框事件处理
// ────────────────────────────────────────────────────────────

/** 处理输入框的通用键盘事件（Enter/Escape关闭菜单） */
const 处理关闭菜单按键 = (event: KeyboardEvent): boolean => {
    if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        getSiyuanGlobalMenusMenu().remove();
        return true;
    }
    return false;
};

/** 处理链接输入框键盘事件 */
const 处理链接输入框按键 = (
    event: KeyboardEvent,
    nextInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    if (event.key === "Tab" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        nextInputElement.focus();
        return;
    }
    electronUndo(event);
};

/** 绑定链接地址输入框的事件 */
const 绑定链接输入框事件 = (
    inputElement: HTMLTextAreaElement,
    nextInputElement: HTMLTextAreaElement
): void => {
    // @内联回调
    inputElement.addEventListener("keydown", (event) => {
        处理链接输入框按键(event, nextInputElement);
    });
};

/** 处理锚文本输入框键盘事件 */
const 处理锚文本输入框按键 = (
    event: KeyboardEvent,
    prevInputElement: HTMLTextAreaElement,
    nextInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    if (event.key === "Tab" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        const targetInput = event.shiftKey ? prevInputElement : nextInputElement;
        targetInput.focus();
        return;
    }
    electronUndo(event);
};

/** 绑定锚文本输入框的事件 */
const 绑定锚文本输入框事件 = (
    inputElement: HTMLTextAreaElement,
    linkElement: HTMLElement,
    prevInputElement: HTMLTextAreaElement,
    nextInputElement: HTMLTextAreaElement
): void => {
    // 处理中文输入法完成事件
    inputElement.addEventListener("compositionend", () => {
        const value = inputElement.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
        linkElement.innerHTML = Lute.EscapeHTMLStr(value || "*");
    });

    // @内联回调
    inputElement.addEventListener("input", () => {
        // compositionend 已处理输入法事件，这里只处理非输入法输入
        const value = inputElement.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
        linkElement.innerHTML = Lute.EscapeHTMLStr(value) || "*";
    });

    // 处理键盘事件
    // @内联回调
    inputElement.addEventListener("keydown", (event) => {
        处理锚文本输入框按键(event, prevInputElement, nextInputElement);
    });
};

/** 处理标题输入框键盘事件 */
const 处理标题输入框按键 = (
    event: KeyboardEvent,
    prevInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    if (event.key === "Tab" && event.shiftKey && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        prevInputElement.focus();
        return;
    }
    electronUndo(event);
};

/** 绑定标题输入框的事件 */
const 绑定标题输入框事件 = (
    inputElement: HTMLTextAreaElement,
    prevInputElement: HTMLTextAreaElement
): void => {
    // @内联回调
    inputElement.addEventListener("keydown", (event) => {
        处理标题输入框按键(event, prevInputElement);
    });
};

/** 处理复制按钮点击 */
const 处理复制按钮点击 = (event: MouseEvent): void => {
    let target = event.target;
    while (target instanceof HTMLElement) {
        if (target.dataset?.action !== "copy") {
            target = target.parentElement;
            continue;
        }
        const textarea = target.parentElement?.nextElementSibling;
        if (!(textarea instanceof HTMLTextAreaElement)) {
            break;
        }
        writeText(textarea.value);
        showMessage(siyuanI18n.copied);
        break;
    }
};

// ────────────────────────────────────────────────────────────
// 输入区域绑定主函数
// ────────────────────────────────────────────────────────────

/**
 * 设置链接编辑输入区域的绑定逻辑
 * 包括初始化输入框值和绑定所有事件
 */
export const 绑定链接编辑区域 = (
    element: HTMLElement,
    ctx: LinkMenuContext
): NodeListOf<HTMLTextAreaElement> => {
    element.style.maxWidth = "none";
    const inputElements = element.querySelectorAll("textarea");

    const 链接输入框 = inputElements[0];
    const 锚文本输入框 = inputElements[1];
    const 标题输入框 = inputElements[2];

    if (!链接输入框 || !锚文本输入框 || !标题输入框) {
        return inputElements;
    }

    // 初始化链接地址输入框
    链接输入框.value = Lute.UnEscapeHTMLStr(ctx.linkAddress) || "";
    绑定链接输入框事件(链接输入框, 锚文本输入框);

    // 初始化锚文本输入框
    // https://github.com/siyuan-note/siyuan/issues/6798
    let anchor = ctx.linkElement.textContent?.replace(Constants.ZWSP, "") ?? "";
    const needsDefaultAnchor = !anchor && ctx.linkAddress;
    if (needsDefaultAnchor && ctx.linkAddress) {
        anchor = decodeURIComponent(ctx.linkAddress.replace("https://", "").replace("http://", ""));
    }
    const exceedsMaxLength = needsDefaultAnchor && anchor.length > Constants.SIZE_LINK_TEXT_MAX;
    if (exceedsMaxLength) {
        anchor = anchor.substring(0, Constants.SIZE_LINK_TEXT_MAX) + "...";
    }
    if (needsDefaultAnchor) {
        ctx.linkElement.innerHTML = Lute.EscapeHTMLStr(anchor);
    }
    锚文本输入框.value = anchor;
    绑定锚文本输入框事件(锚文本输入框, ctx.linkElement, 链接输入框, 标题输入框);

    // 初始化标题输入框
    标题输入框.value = Lute.UnEscapeHTMLStr(ctx.linkElement.getAttribute("data-title") || "");
    绑定标题输入框事件(标题输入框, 锚文本输入框);

    // 复制按钮点击事件
    element.addEventListener("click", 处理复制按钮点击);

    return inputElements;
};

// ────────────────────────────────────────────────────────────
// 可编辑模式菜单项
// ────────────────────────────────────────────────────────────

/** 添加编辑模式下的所有菜单项 */
export const 添加编辑模式菜单项 = (ctx: LinkMenuContext): void => {
    // 添加链接编辑区域
    let inputElements: NodeListOf<HTMLTextAreaElement> | undefined;

    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "linkAndAnchorAndTitle",
        iconHTML: "",
        type: "readonly",
        label: 生成链接编辑区域HTML(),
        /** @简洁函数 简单的绑定回调，初始化输入区域 */
        bind(element) {
            inputElements = 绑定链接编辑区域(element, ctx);
            ctx.inputElements = inputElements;
        }
    }).element);

    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
};
