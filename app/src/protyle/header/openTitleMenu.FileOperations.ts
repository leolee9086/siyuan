import { movePathToMenu } from "../../menus/commonMenuItem";
import { getGlobalMenus } from "../../util/siyuanEnvironments/getMenu";
import { createAddToDatabaseMenuItem, createDeleteMenuItem } from "./openTitleMenu.items";

export const appendFileOperationsMenuItemGroup = (protyle: IProtyle) => {
    protyle.path&&getGlobalMenus().menu.append(movePathToMenu([protyle.path]));
    getGlobalMenus().menu.append(createAddToDatabaseMenuItem(protyle).element);
    getGlobalMenus().menu.append(createDeleteMenuItem(protyle).element);
};
