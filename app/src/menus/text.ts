/** 用途：插件菜单类型。使用范围：text 模块构建菜单。解耦评估：通过 imports.ts 转发。 */
import { Menu } from "./imports";
/** 用途：国际化文本。使用范围：text 模块菜单文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";

/**
 * 文本选中右键菜单
 * @作用 为文本选中状态提供复制和全选菜单
 * @调用时机 用户选中文本并右键点击时
 * @同步豁免: UI构建 — 菜单在同步调用栈中构建并弹出
 */
export const textMenu = (target: Element) => {
    const menu = new Menu();
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        /** 执行复制操作 */
        click() {
            const selection = getSelection();
            if ((!selection) || selection.rangeCount === 0) {
                return;
            }
            const range = selection.getRangeAt(0);
            // 无选中内容时选中整个目标元素再复制
            if (!range.toString()) {
                selection.getRangeAt(0).selectNode(target);
            }
            document.execCommand("copy");
        }
    });
    menu.addItem({
        id: "selectAll",
        label: siyuanI18n.selectAll,
        icon: "iconSelect",
        /** 执行全选操作 */
        click() {
            const selection = getSelection();
            if ((!selection) || selection.rangeCount === 0) {
                return;
            }
            selection.getRangeAt(0).selectNode(target);
        }
    });
    return menu;
};
