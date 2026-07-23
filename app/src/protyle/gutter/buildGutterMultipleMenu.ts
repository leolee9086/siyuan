/**
 * 多选块菜单构建模块
 * 从 index.ts 的 renderMultipleMenu 方法拆分而来
 */
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { 检查选中元素状态, 构建转换菜单 } from "./buildMultipleTurnIntoMenu";
import { 构建复制菜单 } from "./buildMultipleCopyMenu";
import { 构建编辑操作菜单 } from "./buildMultipleEditMenu";
import { 构建Agent菜单, 构建AI菜单, 构建外观菜单, 构建闪卡菜单, 触发插件菜单 } from "./buildMultipleAppearanceMenu";

/**
 * 多选块菜单的上下文参数
 */
export interface IGutterMultipleMenuContext {
    protyle: IProtyle;
    selectsElement: Element[];
}

/**
 * 构建多选块的右键菜单
 * @param ctx 多选块菜单上下文
 * @returns 菜单对象
 */
export const buildGutterMultipleMenu = (ctx: IGutterMultipleMenuContext) => {
    const { protyle, selectsElement } = ctx;
    const { isList, isContinue } = 检查选中元素状态(selectsElement);

    // 1. 转换为菜单
    构建转换菜单(protyle, selectsElement, isList, isContinue);

    // 2. AI 菜单
    构建AI菜单(protyle, selectsElement);
    构建Agent菜单(protyle, selectsElement);

    // 3. 复制菜单
    构建复制菜单(protyle, selectsElement);

    // 4. 编辑操作菜单
    构建编辑操作菜单(protyle, selectsElement);

    // 5. 外观菜单
    构建外观菜单(protyle, selectsElement);

    // 6. 闪卡菜单
    构建闪卡菜单(protyle, selectsElement);

    // 7. 插件菜单
    触发插件菜单(protyle, selectsElement);

    return getSiyuanGlobalMenus().menu;
};
