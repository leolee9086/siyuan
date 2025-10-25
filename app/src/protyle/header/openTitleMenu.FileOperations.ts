import { movePathToMenu } from "../../menus/commonMenuItem";
import { createAddToDatabaseMenuItem, createDeleteMenuItem } from "./openTitleMenu.items";

export const appendFileOperationsMenuItemGroup = (protyle: IProtyle) => {
    window.siyuan.menus.menu.append(movePathToMenu([protyle.path]));
    window.siyuan.menus.menu.append(createAddToDatabaseMenuItem(protyle).element);
    window.siyuan.menus.menu.append(createDeleteMenuItem(protyle).element);
};
