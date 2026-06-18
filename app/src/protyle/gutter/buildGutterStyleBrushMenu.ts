/**
 * buildGutterStyleBrushMenu.ts - 格式刷菜单项构建模块
 * 
 * 提供 Gutter 块菜单中格式刷相关菜单项的构建功能
 * 
 * @module protyle/gutter/buildGutterStyleBrushMenu
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { 提取块样式, 提取DOM样式, 注册并激活自定义样式刷子 } from "../../triggers/styleBrush";
import type { IGutterCommonMenuContext } from "./buildGutterCommonMenu";

/**
 * 创建格式刷菜单项
 * 
 * 仅当目标块存在 style 属性时显示此菜单项
 * 
 * @param ctx 菜单构建上下文
 * @returns 菜单项配置，若块无样式则返回 null
 */
export function 创建格式刷菜单项(ctx: IGutterCommonMenuContext): IMenu | null {
    const style = 提取DOM样式(ctx.nodeElement);

    // 块没有样式时不显示格式刷选项
    if (!style) {
        return null;
    }

    return {
        id: "styleBrush",
        icon: "iconFormat",
        label: siyuanI18n.copy + siyuanI18n.appearance, // "复制外观" 或类似
        /**
         * 作用：处理菜单点击事件
         * 意图：异步获取块的精确样式并激活刷子模式
         * 调用时机：用户点击格式刷菜单项时
         */
        click: async (_element: HTMLElement, event: MouseEvent) => {
            const finalStyle = await 提取块样式(ctx.nodeElement);
            if (finalStyle) {
                // 使用新函数：注册一个专属刷子并激活
                await 注册并激活自定义样式刷子(finalStyle, ctx.id, {
                    protyle: ctx.protyle,
                    originalEvent: event
                });
            }
        }
    };
}

/**
 * 添加格式刷菜单项到菜单列表
 * 
 * @param ctx 菜单构建上下文
 * @param menuItems 菜单项列表
 */
export function 添加格式刷菜单(ctx: IGutterCommonMenuContext, menuItems: IMenu[]): void {
    const menuItem = 创建格式刷菜单项(ctx);
    if (menuItem) {
        menuItems.push(menuItem);
    }
}
