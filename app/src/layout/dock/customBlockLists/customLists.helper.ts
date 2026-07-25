/** 用途：自定义列表数据类型。使用范围：目标持久化 helper；解耦评估：仅类型依赖，不加载 CustomLists class。 */
import type {ICustomList} from "./customLists.types";
/** 用途：保存本地自定义列表。使用范围：目标配置更新；解耦评估：基础存储能力由 helper 直接调用，菜单不依赖 Dock class。 */
import {setStorageVal} from "../../../protyle/util/compatibility";

/**
 * 用途：DOM 冒泡查询工具函数。使用范围：沿 DOM 树向上查找匹配 CSS 类名的祖先元素。解耦评估：纯 DOM 操作，无业务依赖。
 */
/** @同步豁免: DOM访问 - DOM 遍历操作必须同步执行 */
/**
 * 沿 DOM 树向上查找匹配 CSS 类名的祖先元素
 * @param element - 起始元素
 * @param boundary - 冒泡边界
 * @param className - 要匹配的 CSS 类名
 */
export const getClosestByClassUpward = (element: HTMLElement | null, boundary: HTMLElement, className: string) => {
    let target = element;
    while (target && !target.isEqualNode(boundary)) {
        if (target.classList.contains(className)) {
            return target;
        }
        target = target.parentElement;
    }
    return null;
};

/**
 * 用途：生成自定义列表的 dock key。使用范围：CustomLists.ts 和 customLists.util.ts。解耦评估：纯字符串拼接。
 */
/** @同步豁免: 性能考虑 - 纯字符串拼接，无需异步 */
export const getCustomListKey = (type: string, id: string) => `custom_list:${type}:${id}`;

/** 持久化动态列表目标配置，供菜单保存条件后复用。 */
/** @同步豁免: 生命周期 */
export const updateListTarget = (listData: ICustomList) => {
    const storage = window.siyuan.storage;
    const customLists = storage?.["local-customlists"];
    if (customLists && customLists[listData.id]) {
        customLists[listData.id] = listData;
        setStorageVal("local-customlists", customLists);
    }
};
