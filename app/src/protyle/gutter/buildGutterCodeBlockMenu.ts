/**
 * Gutter 块菜单 - 代码块子菜单构建模块
 * 从 renderMenu 提取的代码块菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中代码块相关子菜单的构建功能
 * @module protyle/gutter/buildGutterCodeBlockMenu
 */

/**
 * 用途：后端 API 调用，用于保存代码块属性和导出代码块文件
 * 使用范围：代码块开关切换后保存属性、另存为文件
 * 解耦评估：网络层基础能力，通过 imports.ts 网关导入
 */
import { fetchPost } from "./imports";
/**
 * 用途：代码语法高亮渲染，切换代码块开关后重新渲染
 * 使用范围：代码块开关切换后触发
 * 解耦评估：渲染引擎依赖，通过 imports.ts 网关导入
 */
import { highlightRender } from "./imports";
/**
 * 用途：国际化文本
 * 使用范围：菜单标签显示
 * 解耦评估：全局环境配置，通过 imports.ts 网关导入
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：显示消息提示对话框
 * 使用范围：导出代码块文件时的加载提示
 * 解耦评估：UI 基础设施，通过 imports.ts 网关导入
 */
import { showMessage } from "./imports";
/**
 * 用途：隐藏消息提示对话框
 * 使用范围：导出完成后关闭提示
 * 解耦评估：UI 基础设施，与 showMessage 配对使用
 */
import { hideMessage } from "./imports";
/**
 * 用途：保存导出文件，触发 Electron 系统保存对话框或浏览器下载
 * 使用范围：代码块另存为文件操作
 * 解耦评估：平台兼容性工具，通过 imports.ts 网关导入
 */
import { saveExportFile } from "./imports";
/**
 * 用途：获取系统配置
 * 使用范围：获取编辑器默认开关状态
 * 解耦评估：全局配置访问，通过 imports.ts 网关导入
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：获取全局菜单实例
 * 使用范围：代码块开关切换后关闭菜单
 * 解耦评估：全局菜单管理，通过 imports.ts 网关导入
 */
import { getSiyuanMenus } from "./imports";
/**
 * 用途：代码块菜单构建上下文类型
 * 使用范围：buildGutterCodeBlockMenu 函数参数类型
 * 解耦评估：类型定义，无运行时依赖
 */
import type { IGutterCodeBlockMenuContext } from "./gutter.types";
/**
 * 用途：代码块开关选项配置类型
 * 使用范围：配置列表类型标注
 * 解耦评估：类型定义，无运行时依赖
 */
import type { ICodeBlockSwitchConfig } from "./gutter.types";

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
const 计算开关初始状态 = (attrValue: string | null, editorDefaultValue: boolean) => {
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
) => {
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
        /** @同步豁免: UI构建 - bind 回调需要同步绑定 DOM 事件，无法异步 */
        bind(element: HTMLElement) {
            // @内联回调
            element.addEventListener("click", (event: Event) => {
                const inputElement = element.querySelector("input");
                if (!(inputElement instanceof HTMLInputElement)) {
                    return;
                }
                const target = event.target;
                // 点击 Switch 自身时不翻转（Switch 会自动切换），点击标签文字才翻转
                if (target instanceof HTMLElement && target.tagName !== "INPUT") {
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
/** @同步豁免: UI构建 - 菜单构建函数必须同步返回 IMenu 配置对象，调用方期望立即获得菜单结构用于渲染 */
export const buildGutterCodeBlockMenu = (ctx: IGutterCodeBlockMenuContext) => {
    const menus: object[] = 代码块开关配置列表.map(config => 创建代码块开关菜单项(config, ctx));
    menus.push({
        id: "saveCodeBlockAsFile",
        iconHTML: "",
        label: "另存为文件",
        /** @同步豁免: UI构建 - click 回调用于构建菜单项配置，点击时才触发异步导出流程 */
        click() {
            const msgId = showMessage(siyuanI18n.exporting, -1);
            fetchPost("/api/export/exportCodeBlock", { id: ctx.id }, (response) => {
                hideMessage(msgId);
                saveExportFile(response.data.path);
            });
        }
    });
    return menus;
};
