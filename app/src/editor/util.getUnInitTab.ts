/** 用途：应用常量定义。使用范围：editor 模块页签动作配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：获取所有已打开页签。使用范围：getUnInitTab 查找未初始化页签。解耦评估：通过 imports.ts 转发。 */
import { getAllTabs } from "./imports";
/** 用途：对象相等性比较。使用范围：getUnInitTab 比较 custom 配置。解耦评估：通过 imports.ts 转发。 */
import { objEquals } from "./imports";
/** 用途：页签类型定义。使用范围：getUnInitTab 返回值类型。解耦评估：通过 imports.ts 转发。 */
import type {LayoutTab} from "./imports";
/** 用途：页签初始化数据类型。使用范围：getUnInitTab 内部类型检查。解耦评估：同目录类型文件，直接同层导入。 */
import type { ITabInitData } from "./types";
/** 用途：页签初始化数据类型守卫。使用范围：getUnInitTab JSON 解析后验证。解耦评估：同目录守卫文件，直接同层导入。 */
import { isDatabaseRowTabData, isTabInitData } from "./editor.guard";

/**
 * 查找并更新未初始化的页签
 *
 * 作用：在所有页签中查找尚未初始化的页签（即只有初始化数据但没有实际模型实例的页签），
 *       如果找到匹配的页签，则更新其初始化数据并切换到该页签。
 *
 * 意图：当用户尝试打开一个文件时，如果已经存在一个尚未初始化的页签（例如之前打开但未加载的页签），
 *       则复用该页签而不是创建新的页签，这样可以避免重复打开相同的文档。
 *
 * 调用时机：在打开文件之前调用，用于检查是否可以复用现有的未初始化页签。
 *
 * 问题/改进：当前实现通过遍历所有页签来查找匹配项，如果页签数量很多可能会有性能问题。
 *            可以考虑使用 Map 或其他数据结构来优化查找性能。
 *
 * @param options - 打开文件的选项参数
 * @returns 找到的匹配页签，如果没有找到则返回 undefined
 * @同步豁免: 生命周期 — 在打开文件前同步检查可复用的未初始化页签
 */
export const getUnInitTab = (options: IOpenFileOptions) => {
    return getAllTabs().find(isMatchingUnInitTab(options));
};

/** 判断已存在的自定义页签是否与打开请求表示同一对象。 */
export const isSameCustomTab = (type: string | undefined, data: unknown, options: IOpenFileOptions) => {
    if (!options.custom || (options.custom.id && options.custom.id !== type)) {
        return false;
    }
    if (type === "siyuan-database-row") {
        return isDatabaseRowTabData(data) && isDatabaseRowTabData(options.custom.data) &&
            data.avID === options.custom.data.avID && data.itemID === options.custom.data.itemID;
    }
    return objEquals(data, options.custom.data);
};

/**
 * 判断页签是否为匹配的未初始化页签
 *
 * 作用：检查给定的页签是否为未初始化状态，并且其初始化数据与指定的选项匹配。
 *
 * 意图：将复杂的匹配逻辑提取为独立函数，提高代码可读性和可维护性。
 *
 * 调用时机：由 getUnInitTab 函数在遍历页签时调用。
 *
 * @param options - 打开文件的选项参数
 * @returns 返回一个谓词函数，用于判断页签是否匹配
 */
const isMatchingUnInitTab = (options: IOpenFileOptions) => {
    return (item: LayoutTab) => {
        const initData = item.headElement?.getAttribute("data-initdata");
        if (!initData) {
            return false;
        }

        const initObj = JSON.parse(initData);
        if (!isTabInitData(initObj)) {
            return false;
        }

        // 处理 Editor 类型的页签
        if (initObj.instance === "Editor" &&
            (initObj.rootId === options.rootID || initObj.blockId === options.rootID)) {
            return handleEditorTab(item, initObj, options);
        }

        // 处理 Custom 类型的页签
        if (initObj.instance === "Custom" && isSameCustomTab(initObj.customModelType, initObj.customModelData, options)) {
            item.parent.switchTab(item.headElement);
            return true;
        }

        return false;
    };
};

/**
 * 处理 Editor 类型的未初始化页签
 *
 * 作用：更新 Editor 类型页签的初始化数据，并切换到该页签。
 *
 * 意图：将 Editor 页签的处理逻辑提取为独立函数，遵循单一职责原则。
 *
 * 调用时机：当检测到页签为 Editor 类型且匹配时调用。
 *
 * @param item - 要处理的页签
 * @param initObj - 页签的初始化数据对象
 * @param options - 打开文件的选项参数
 * @returns 始终返回 true，表示已找到匹配的页签
 */
const handleEditorTab = (item: LayoutTab, initObj: ITabInitData, options: IOpenFileOptions) => {
    initObj.blockId = options.id;
    initObj.mode = options.mode;
    initObj.scrollPosition = options.scrollPosition;

    // 使用卫语句设置 action
    if (options.zoomIn) {
        initObj.action = [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS];
        item.headElement.setAttribute("data-initdata", JSON.stringify(initObj));
        item.parent.switchTab(item.headElement);
        return true;
    }

    initObj.action = options.action;
    item.headElement.setAttribute("data-initdata", JSON.stringify(initObj));
    item.parent.switchTab(item.headElement);
    return true;
};
