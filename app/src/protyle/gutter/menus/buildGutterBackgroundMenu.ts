/**
 * 构建 Gutter 背景菜单项
 * 复用题头图与导出图片的背景来源能力，为单块/多块提供统一的背景设置入口。
 */

/**
 * 用途：国际化文本。
 * 使用范围：背景菜单入口标签。
 * 解耦评估：通过 imports.ts 转发后，菜单构建层无需直接感知上层 i18n 文件结构。
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：背景来源对话框打开函数。
 * 使用范围：点击菜单入口后打开背景来源选择。
 * 解耦评估：界面编排已拆分到独立模块，当前文件仅保留菜单构建职责。
 */
import { openBlockBackgroundSourceDialog } from "./blockBackground.dialogs";
/**
 * 用途：块元素归一化函数。
 * 使用范围：把 gutter 菜单传入的 Element[] 过滤为可编辑的 HTMLElement[]。
 * 解耦评估：样式模块已集中处理块背景相关数据准备，菜单层只复用结果。
 */
import { normalizeBlockBackgroundNodeElements } from "./blockBackground.style";

/**
 * 作用：构建块背景菜单项。
 * 意图：为单块和多块 gutter 菜单提供统一的背景入口，复用现有背景图来源与样式写回链路。
 * 调用时机：构建单块菜单和多块菜单时。
 * 问题/改进：当前入口文案复用 `showHideBg`，若后续增加更精确 i18n 文案可直接替换。
 */
/** @同步豁免: UI构建 - 菜单构建函数必须同步返回 IMenu 配置对象，调用方需要立即渲染菜单结构。 @显式返回类型原因: IMenu | null 的联合返回类型让调用方明确需要处理 null 分支（无可用块时），显式标注确保调用侧不会遗漏空值兜底。 */
export function buildGutterBackgroundMenu(nodeElements: Element[], protyle: IProtyle): IMenu | null {
    const editableNodeElements = normalizeBlockBackgroundNodeElements(nodeElements);
    if (editableNodeElements.length === 0) {
        return null;
    }

    return {
        id: "blockBackground",
        icon: "iconImage",
        label: siyuanI18n.showHideBg,
        /**
         * 作用：打开块背景来源对话框。
         * 意图：把实际的背景来源选择与样式应用逻辑交给独立模块处理，保持菜单构建层足够薄。
         * 调用时机：用户点击 gutter 菜单中的“背景”入口时。
         * 问题/改进：若后续需要根据块类型定制入口，可在这里追加前置过滤。
         */
        click() {
            openBlockBackgroundSourceDialog({
                protyle,
                nodeElements: editableNodeElements
            });
        }
    };
}
