/** 用途：执行多块合并 transaction；使用范围：Gutter TurnInto 点击回调；解耦评估：同域网关显式暴露唯一 transaction 实现，继续参数注入会重复贯穿全部菜单构建器。 */
import {turnsIntoOneTransaction} from "./imports";
/** 用途：执行批量类型转换 transaction；使用范围：Gutter TurnInto 点击回调；解耦评估：同域网关显式暴露唯一 transaction 实现，继续参数注入会重复贯穿全部菜单构建器。 */
import {turnsIntoTransaction} from "./imports";
/** 用途：执行单块类型转换 transaction；使用范围：Gutter TurnInto 点击回调；解耦评估：同域网关显式暴露唯一 transaction 实现，继续参数注入会重复贯穿全部菜单构建器。 */
import {turnsOneInto} from "./imports";
import {turnsIntoGroupsTransaction} from "./imports";

/** 生成将单个块转换为目标类型的菜单项。 @同步豁免: UI构建 - 菜单树必须在打开事件内同步返回，实际转换仍在点击回调中执行。 */
export const genTurnsOneInto = (options: {
    menuId?: string,
    id: string,
    icon: string,
    label: string,
    protyle: IProtyle,
    nodeElement: Element,
    type: string,
    level?: number,
    accelerator?: string
}) => {
    const item: IMenu = {
        icon: options.icon,
        label: options.label,
        /** 用户选择菜单项时执行单块转换。 */
        click() {
            turnsOneInto(options);
        }
    };
    if (options.menuId) {
        item.id = options.menuId;
    }
    if (options.accelerator) {
        item.accelerator = options.accelerator;
    }
    return item;
};

/** 生成将多个块合并转换为单一块的菜单项。 @同步豁免: UI构建 - 菜单树必须在打开事件内同步返回，实际转换仍在点击回调中执行。 */
export const genTurnsIntoOne = (options: {
    menuId?: string,
    accelerator?: string,
    icon?: string,
    label: string,
    protyle: IProtyle,
    selectsElement: Element[],
    type: TTurnIntoOne,
    level?: TTurnIntoOneSub,
}) => {
    const item: IMenu = {
        label: options.label,
        /** 用户选择菜单项时执行多块合并转换。 */
        click() {
            turnsIntoOneTransaction(options);
        }
    };
    if (options.icon) {
        item.icon = options.icon;
    }
    if (options.menuId) {
        item.id = options.menuId;
    }
    if (options.accelerator) {
        item.accelerator = options.accelerator;
    }
    return item;
};

/** 生成批量块类型转换菜单项。 @同步豁免: UI构建 - 菜单树必须在打开事件内同步返回，实际转换仍在点击回调中执行。 */
export const genTurnsInto = (options: {
    menuId?: string,
    icon?: string,
    label: string,
    protyle: IProtyle,
    selectsElement: Element[],
    type: TTurnInto,
    level?: number,
    isContinue?: boolean,
    accelerator?: string,
}) => {
    const item: IMenu = {
        label: options.label,
        /** 用户选择菜单项时执行批量类型转换。 */
        click() {
            turnsIntoTransaction(options);
        }
    };
    if (options.icon) {
        item.icon = options.icon;
    }
    if (options.menuId) {
        item.id = options.menuId;
    }
    if (options.accelerator) {
        item.accelerator = options.accelerator;
    }
    return item;
};

/** 生成非连续块组转换菜单项（保留分组语义）。 */
export const genTurnsIntoGroups = (options: {
    menuId?: string,
    icon?: string,
    label: string,
    protyle: IProtyle,
    selectsElementGroups: Element[][],
    type: Exclude<TTurnIntoOne, "BlocksMergeSuperBlock">,
    accelerator?: string,
}) => {
    const item: IMenu = {
        label: options.label,
        click() {
            turnsIntoGroupsTransaction(options);
        }
    };
    if (options.icon) {
        item.icon = options.icon;
    }
    if (options.menuId) {
        item.id = options.menuId;
    }
    if (options.accelerator) {
        item.accelerator = options.accelerator;
    }
    return item;
};
