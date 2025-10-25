
/**
 * 复制菜单相关功能模块
 * 提供各种复制操作的菜单项生成功能
 *
 * @fileoverview 包含块引用、块嵌入、协议链接等多种复制方式的菜单项
 * @module commonMenuItem.copy
 */

import { writeText } from "../protyle/util/compatibility";
import { fetchSyncPost } from "../util/fetch";
import { focusBlock } from "../protyle/util/selection";
import { copyTextByType } from "../protyle/toolbar/util";

/**
 * 复制菜单上下文数据接口
 * @todo 不同类型的菜单上下文应该整理归并,菜单应该以更加声明式的形式实现
 * @interface copyMenuCtxData
 */
interface copyMenuCtxData {
    /** 要复制的块ID数组 */
    ids: string[]
    /** 是否显示快捷键 */
    showAccelerator: boolean
    /** 聚焦元素，复制完成后会重新聚焦到此元素 */
    focusElement?: Element,
    /** 标准Markdown ID，用于导出Markdown内容 */
    stdMarkdownId?: string
}

/**
 * 创建复制块引用菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} 块引用复制菜单项配置对象
 */
const copyBlockRefItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyBlockRef",
        iconHTML: "",
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyBlockRef.custom : undefined,
        label: window.siyuan.languages.copyBlockRef,
        click: () => {
            copyTextByType(ctx.ids, "ref");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}


/**
 * 创建复制块嵌入菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} 块嵌入复制菜单项配置对象
 */
const copyBlockEmbedItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyBlockEmbed",
        iconHTML: "",
        label: window.siyuan.languages.copyBlockEmbed,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyBlockEmbed.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "blockEmbed");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 创建复制协议链接菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} 协议链接复制菜单项配置对象
 */
const copyProtocolItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyProtocol",
        iconHTML: "",
        label: window.siyuan.languages.copyProtocol,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyProtocol.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "protocol");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 创建复制Markdown格式协议链接菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} Markdown格式协议链接复制菜单项配置对象
 */
const copyProtocolInMdItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyProtocolInMd",
        iconHTML: "",
        label: window.siyuan.languages.copyProtocolInMd,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyProtocolInMd.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "protocolMd");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 创建复制文档层级路径菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} 文档层级路径复制菜单项配置对象
 */
const copyHPathItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyHPath",
        iconHTML: "",
        label: window.siyuan.languages.copyHPath,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyHPath.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "hPath");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 创建复制块ID菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} 块ID复制菜单项配置对象
 */
const copyIDItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyID",
        iconHTML: "",
        label: window.siyuan.languages.copyID,
        accelerator: ctx.showAccelerator ? window.siyuan.config.keymap.editor.general.copyID.custom : undefined,
        click: () => {
            copyTextByType(ctx.ids, "id");
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 创建复制Markdown内容菜单项
 * @param {copyMenuCtxData} ctx - 复制菜单上下文数据
 * @returns {Object} Markdown内容复制菜单项配置对象
 */
const copyMarkdownItem = (ctx: copyMenuCtxData) => {
    return {
        id: "copyMarkdown",
        iconHTML: "",
        label: window.siyuan.languages.copyMarkdown,
        accelerator: "" ,
        click: async () => {
            if (!ctx.stdMarkdownId) return;
            const response = await fetchSyncPost("/api/export/exportMdContent", {
                id: ctx.stdMarkdownId,
                refMode: 3,
                embedMode: 1,
                yfm: false,
                fillCSSVar: false,
                adjustHeadingLevel: false
            });
            const text = response.data.content;
            writeText(text);
            if (ctx.focusElement) {
                focusBlock(ctx.focusElement);
            }
        }
    }
}

/**
 * 生成复制子菜单项列表
 * @param {string[]} ids - 要复制的块ID数组
 * @param {boolean} [showAccelerator=true] - 是否显示快捷键
 * @param {Element} [focusElement] - 聚焦元素，复制完成后会重新聚焦到此元素
 * @param {string} [stdMarkdownId] - 标准Markdown ID，用于导出Markdown内容
 * @returns {Object[]} 复制菜单项配置对象数组
 *
 * @example
 * ```typescript
 * const menuItems = copySubMenu(
 *   ["20231001120000-abcdefg"],
 *   true,
 *   document.getElementById("target-element"),
 *   "20231001120000-xyz123"
 * );
 * ```
 */
export const copySubMenu = (ids: string[], showAccelerator = true, focusElement?: Element, stdMarkdownId?: string) => {
    const ctx = {
        ids, showAccelerator, focusElement, stdMarkdownId
    }
    const menuItems = [
        copyBlockRefItem(ctx),
        copyBlockEmbedItem(ctx),
        copyProtocolItem(ctx),
        copyProtocolInMdItem(ctx),
        copyHPathItem(ctx),
        copyIDItem(ctx)
    ];
    if (ctx.stdMarkdownId) {
        menuItems.push(copyMarkdownItem(ctx));
    }
    return menuItems;
};


