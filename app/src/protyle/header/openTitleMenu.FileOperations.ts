import { movePathToMenu } from "../../menus/commonMenuItem";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu";
import { createAddToDatabaseMenuItem, createDeleteMenuItem } from "./openTitleMenu.items";

export const appendFileOperationsMenuItemGroup = (protyle: IProtyle) => {
    protyle.path&&getSiyuanGlobalMenus().menu.append(movePathToMenu([protyle.path]));
    getSiyuanGlobalMenus().menu.append(createAddToDatabaseMenuItem(protyle).element);
    getSiyuanGlobalMenus().menu.append(createDeleteMenuItem(protyle).element);
};
