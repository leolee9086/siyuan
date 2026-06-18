/** 用途：菜单项构造器。使用范围：block 模块构建菜单项。解耦评估：同目录组件，直接同层导入。 */
import { MenuItem } from "./Menu.Item";
/** 用途：全局菜单容器。使用范围：block 模块追加菜单项。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：国际化文本。使用范围：block 模块菜单文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：块引用转移对话框。使用范围：block 模块块操作。解耦评估：通过 imports.ts 转发。 */
import { openTransferBlockRefDialog } from "./imports";

/**
 * 块引用转移菜单
 * @作用 为块添加引用转移菜单项
 * @调用时机 用户右键点击块时
 * @同步豁免: UI构建 — 菜单在同步调用栈中追加菜单项
 */
export const transferBlockRef = (id: string) => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "transferBlockRef",
        label: siyuanI18n.transferBlockRef,
        icon: "iconScrollHoriz",
        /** 打开块引用转移对话框 */
        click: () => openTransferBlockRefDialog(id)
    }).element);
};
