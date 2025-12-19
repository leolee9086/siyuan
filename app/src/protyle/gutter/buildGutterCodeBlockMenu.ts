/**
 * Gutter 块菜单 - 代码块子菜单构建模块
 * 从 renderMenu 提取的代码块菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中代码块相关子菜单的构建功能
 * @module protyle/gutter/buildGutterCodeBlockMenu
 */

import { fetchPost } from "../../util/fetch";
import { highlightRender } from "../render/highlightRender";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanMenus } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 代码块菜单构建上下文
 * @interface IGutterCodeBlockMenuContext
 */
export interface IGutterCodeBlockMenuContext {
    /** 目标节点元素 */
    nodeElement: Element;
    /** 节点 ID */
    id: string;
}

/**
 * 代码块开关选项配置
 */
interface ICodeBlockSwitchConfig {
    /** 菜单项 ID */
    menuId: string;
    /** 属性名 (linewrap/ligatures/linenumber) */
    attrName: "linewrap" | "ligatures" | "linenumber";
    /** 显示标签（i18n key） */
    labelKey: keyof typeof siyuanI18n;
    /** 编辑器默认配置的属性名 */
    editorConfigKey: "codeLineWrap" | "codeLigatures" | "codeSyntaxHighlightLineNum";
}

/**
 * 代码块开关选项配置列表
 */
const 代码块开关配置列表: ICodeBlockSwitchConfig[] = [
    {
        menuId: "md31",
        attrName: "linewrap",
        labelKey: "md31",
        editorConfigKey: "codeLineWrap"
    },
    {
        menuId: "md2",
        attrName: "ligatures",
        labelKey: "md2",
        editorConfigKey: "codeLigatures"
    },
    {
        menuId: "md27",
        attrName: "linenumber",
        labelKey: "md27",
        editorConfigKey: "codeSyntaxHighlightLineNum"
    }
];

/**
 * 判断开关的初始选中状态
 * @param attrValue 属性当前值
 * @param editorDefaultValue 编辑器默认配置值
 * @returns 是否应该选中
 */
const 计算开关初始状态 = (attrValue: string | null, editorDefaultValue: boolean): boolean => {
    if (attrValue === "true") {
        return true;
    }
    if (attrValue === "false") {
        return false;
    }
    // 没有设置时使用编辑器默认配置
    return editorDefaultValue;
};

/**
 * 创建代码块开关菜单项
 * @param config 开关配置
 * @param ctx 上下文
 * @returns 菜单项配置对象
 */
const 创建代码块开关菜单项 = (
    config: ICodeBlockSwitchConfig,
    ctx: IGutterCodeBlockMenuContext
): IMenu => {
    const attrValue = ctx.nodeElement.getAttribute(config.attrName);
    const siyuanConfig = getSiyuanConfig();
    if (!siyuanConfig?.editor) {
        throw new Error("SiYuan config or editor config is not available");
    }
    const isChecked = 计算开关初始状态(attrValue, siyuanConfig.editor[config.editorConfigKey]);

    return {
        id: config.menuId,
        iconHTML: "",
        label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${siyuanI18n[config.labelKey]}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${isChecked ? " checked" : ""}></div>`,
        bind(element) {
            // @内联回调
            element.addEventListener("click", (event: Event) => {
                const inputElement = element.querySelector("input") as HTMLInputElement;
                if (!inputElement) {
                    return;
                }
                const target = event.target as HTMLElement;
                if (target.tagName !== "INPUT") {
                    inputElement.checked = !inputElement.checked;
                }
                // 更新节点属性
                ctx.nodeElement.setAttribute(config.attrName, inputElement.checked.toString());
                // 重新渲染代码高亮
                const hljsElement = ctx.nodeElement.querySelector(".hljs");
                if (hljsElement) {
                    hljsElement.removeAttribute("data-render");
                }
                highlightRender(ctx.nodeElement);
                // 保存到后端
                fetchPost("/api/attr/setBlockAttrs", {
                    id: ctx.id,
                    attrs: { [config.attrName]: inputElement.checked.toString() }
                });
                // 关闭菜单
                getSiyuanMenus()?.menu?.remove();
            });
        }
    };
};

/**
 * 构建 Gutter 代码块子菜单
 * 
 * @param ctx 代码块菜单构建上下文
 * @returns 代码块子菜单项数组
 * 
 * @example
 * ```typescript
 * const codeMenu = buildGutterCodeBlockMenu({
 *     nodeElement,
 *     id
 * });
 * ```
 */
export const buildGutterCodeBlockMenu = (ctx: IGutterCodeBlockMenuContext): IMenu[] => {
    return 代码块开关配置列表.map(config => 创建代码块开关菜单项(config, ctx));
};
