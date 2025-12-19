/**
 * 构建 Gutter AI 菜单项
 * 从 renderMenu 中拆分出来的 AI 操作菜单
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { openAIActionsMenu } from "../../ai/actions";

/**
 * 构建 AI 菜单项的上下文参数
 */
interface IGutterAiMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
}

/**
 * 构建 Gutter AI 菜单项
 * 
 * @param context - 包含 protyle 和 nodeElement 的上下文
 * @returns AI 菜单项配置，如果不应显示则返回 null
 */
export function buildGutterAiMenu(context: IGutterAiMenuContext): IMenu | null {
    const { protyle, nodeElement } = context;

    // 禁用状态或分割线不显示 AI 菜单
    if (protyle.disabled || nodeElement.classList.contains("hr")) {
        return null;
    }

    return {
        id: "ai",
        icon: "iconSparkles",
        label: siyuanI18n.ai,
        accelerator: getSiyuanConfig().keymap.editor.general.ai.custom,
        click() {
            openAIActionsMenu([nodeElement], protyle);
        }
    };
}
