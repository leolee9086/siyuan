import { Menu } from "../plugin/Menu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

export const textMenu = (target: Element) => {
    const menu = new Menu();
    if (menu.isOpen) {
        return;
    }
    menu.addItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            const selection = getSelection()
            if ((!selection) || selection.rangeCount === 0) {
                return;
            }
            const range = selection.getRangeAt(0);
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
        click() {
            const selection = getSelection()
            if ((!selection) || selection.rangeCount === 0) {
                return;
            }
            selection.getRangeAt(0).selectNode(target);
        }
    });
    return menu;
};
