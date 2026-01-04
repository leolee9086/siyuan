/**
 * protyle.asset 模块类型守卫
 */

import { assetItem } from "./protyle.asset.types";

/**
 * 检查一个值是否符合 assetItem 结构
 * @param value 待检查的值
 * @returns 是否为 assetItem 类型
 */
export const isAssetItem = (value: unknown): value is assetItem => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return typeof obj.path === "string" && typeof obj.hName === "string";
};

/**
 * 检查一个数组是否为 assetItem[] 类型
 * @param value 待检查的值
 * @returns 是否为 assetItem[] 类型
 */
export const isAssetItemArray = (value: unknown): value is assetItem[] => {
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every(isAssetItem);
};
