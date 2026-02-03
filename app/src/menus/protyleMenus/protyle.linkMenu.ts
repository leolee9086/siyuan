/**
 * 链接菜单模块
 *
 * 显示针对链接元素的上下文菜单，提供链接编辑、复制、剪切、
 * 删除、重命名、转换等功能。
 */
import * as dayjs from "dayjs";
import { focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { hideTooltip } from "../../dialog/tooltip";
import { emitOpenMenu } from "../../plugin/EventBus";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestBlock, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";

import type { LinkMenuContext } from "./protyle.types";
import { 添加编辑模式菜单项 } from "./protyle.linkMenu.utils";
import {
    添加复制菜单项,
    添加复制链接地址菜单项,
    添加编辑操作菜单项,
    添加链接操作菜单项,
} from "./protyle.linkMenu.items";

// ────────────────────────────────────────────────────────────
// 菜单显示和回调
// ────────────────────────────────────────────────────────────

/** 显示菜单弹窗 */
const 显示菜单弹窗 = (linkElement: HTMLElement, protyle: IProtyle): void => {
    /// #if MOBILE
    getSiyuanGlobalMenusMenu().fullscreen();
    /// #else
    const rect = linkElement.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    const fromValue = popoverElement ? popoverElement.dataset.level + "popover" : "app";
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", fromValue);
};

/** 更新标题属性 */
const 更新标题属性 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }
    const 标题输入框 = ctx.inputElements[2];
    if (!标题输入框) {
        return;
    }
    if (标题输入框.value) {
        const title = Lute.EscapeHTMLStr(标题输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        ctx.linkElement.setAttribute("data-title", title);
        return;
    }
    ctx.linkElement.removeAttribute("data-title");
};

/** 更新链接地址 */
const 更新链接地址 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }
    const 链接地址输入框 = ctx.inputElements[0];
    if (!链接地址输入框) {
        return;
    }
    const dataType = ctx.linkElement.getAttribute("data-type") ?? "";
    if (dataType.indexOf("a") > -1) {
        const href = Lute.EscapeHTMLStr(链接地址输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        ctx.linkElement.setAttribute("data-href", href);
        return;
    }
    ctx.linkElement.removeAttribute("data-href");
};

/** 处理空锚文本 */
const 处理空锚文本 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }
    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    const 标题输入框 = ctx.inputElements[2];
    if (!锚文本输入框 || !链接地址输入框 || !标题输入框) {
        return;
    }
    if (!锚文本输入框.value && (链接地址输入框.value || 标题输入框.value)) {
        ctx.linkElement.textContent = "*";
    }
};

/** 恢复焦点 */
const 恢复焦点 = (ctx: LinkMenuContext): void => {
    const currentRange = getSelection()?.rangeCount === 0 ? undefined : getSelection()?.getRangeAt(0);
    if (currentRange && !ctx.protyle.element.contains(currentRange.startContainer)) {
        ctx.protyle.toolbar.range.selectNodeContents(ctx.linkElement);
        ctx.protyle.toolbar.range.collapse(false);
        focusByRange(ctx.protyle.toolbar.range);
    }
};

/** 处理空链接删除 */
const 处理空链接删除 = (ctx: LinkMenuContext): boolean => {
    if (!ctx.inputElements) {
        return false;
    }
    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    const 标题输入框 = ctx.inputElements[2];
    if (!锚文本输入框 || !链接地址输入框 || !标题输入框) {
        return false;
    }
    if (!锚文本输入框.value && !链接地址输入框.value && !标题输入框.value) {
        ctx.linkElement.remove();
        return true;
    }
    return false;
};

/** 设置菜单关闭时的回调 */
const 设置菜单关闭回调 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }

    getSiyuanGlobalMenusMenu().removeCB = () => {
        更新标题属性(ctx);
        更新链接地址(ctx);
        处理空锚文本(ctx);
        恢复焦点(ctx);
        处理空链接删除(ctx);

        // 保存更改
        if (ctx.html !== ctx.nodeElement.outerHTML) {
            ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(ctx.protyle, ctx.id, ctx.nodeElement.outerHTML, ctx.html);
        }
    };
};

/** 设置初始焦点 */
const 设置初始焦点 = (ctx: LinkMenuContext, focusText: boolean): void => {
    if (!ctx.inputElements) {
        return;
    }

    const 锚文本输入框 = ctx.inputElements[1];
    const 链接地址输入框 = ctx.inputElements[0];
    if (!锚文本输入框 || !链接地址输入框) {
        return;
    }

    const shouldFocusAnchor = focusText ||
        ctx.protyle.lute.GetLinkDest(ctx.linkAddress ?? "") ||
        ctx.linkAddress?.startsWith("assets/");

    if (shouldFocusAnchor) {
        锚文本输入框.select();
        return;
    }
    链接地址输入框.select();
};

// ────────────────────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────────────────────

/**
 * 链接右键菜单
 *
 * 显示针对链接元素的上下文菜单，提供以下功能：
 * - 编辑链接地址、锚文本、标题
 * - 复制、剪切、删除链接
 * - 重命名资源文件
 * - 转换为引用或纯文本
 * - 打开链接
 *
 * @param protyle - Protyle 编辑器实例
 * @param linkElement - 链接元素
 * @param focusText - 是否默认聚焦到锚文本输入框
 */
export const linkMenu = (protyle: IProtyle, linkElement: HTMLElement, focusText = false) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_A);

    const nodeElement = hasClosestBlock(linkElement);
    if (!nodeElement) {
        return;
    }

    hideTooltip();
    hideElements(["util", "toolbar", "hint"], protyle);

    // 创建上下文对象
    const ctx: LinkMenuContext = {
        protyle,
        linkElement,
        nodeElement,
        id: nodeElement.getAttribute("data-node-id") ?? "",
        html: nodeElement.outerHTML,
        linkAddress: linkElement.getAttribute("data-href"),
    };

    // 添加菜单项
    if (!protyle.disabled) {
        添加编辑模式菜单项(ctx);
    }

    添加复制菜单项(linkElement);

    if (protyle.disabled) {
        添加复制链接地址菜单项(ctx.linkAddress);
    }
    if (!protyle.disabled) {
        添加编辑操作菜单项(ctx);
    }

    添加链接操作菜单项(ctx);

    // 触发插件菜单事件
    if (!protyle.disabled && protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-link",
            detail: {
                protyle,
                element: linkElement,
            },
            separatorPosition: "top",
        });
    }

    // 显示菜单
    显示菜单弹窗(linkElement, protyle);

    // 只读模式下直接返回
    if (protyle.disabled) {
        return;
    }

    // 设置初始焦点和关闭回调
    设置初始焦点(ctx, focusText);
    设置菜单关闭回调(ctx);
};
