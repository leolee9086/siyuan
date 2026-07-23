import { movePathToMenu } from "../../menus/commonMenuItem";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { createAddToDatabaseMenuItem, createDeleteMenuItem } from "./openTitleMenu.items";

/**
 * 作用：追加标题菜单中与文件路径相关的操作组。
 * 意图：Box Doc 代表笔记本根，不提供移动和删除文件动作，但仍保留添加到数据库。
 * 调用时机：标题菜单获取文档信息并完成 Box Doc 身份判断后。
 */
// 导出说明：标题菜单的文件操作组构建器。
export const appendFileOperationsMenuItemGroup = (protyle: IProtyle, isBoxDoc: boolean) => {
    // 笔记本根不存在可供用户移动的文件路径。
    if (!isBoxDoc && protyle.path) {
        getSiyuanGlobalMenus().menu.append(movePathToMenu([protyle.path]));
    }
    getSiyuanGlobalMenus().menu.append(createAddToDatabaseMenuItem(protyle).element);
    // 删除 Box Doc 等价于删除笔记本根，该能力不属于文档标题菜单。
    if (!isBoxDoc) {
        getSiyuanGlobalMenus().menu.append(createDeleteMenuItem(protyle).element);
    }
};
