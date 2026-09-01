import type {IAVItemInfo} from "./itemInfo.types";

/** 虚拟滚动选中条目信息能力的跨模块注册键。 */
const selectedItemInfosKey = Symbol.for("sforge.av.selectedItemInfos");

/** 未装配虚拟滚动状态时的明确空结果。 */
const ignoreSelectedItemInfos = (_blockElement: HTMLElement): IAVItemInfo[] => [];

/** 校验未知注册值是否为选中条目信息读取器。 */
const isSelectedItemInfos = (value: unknown): value is (blockElement: HTMLElement) => IAVItemInfo[] => {
    return typeof value === "function";
};

/** 读取当前宿主的选中条目信息。 */
export const getSelectedItemInfos = (blockElement: HTMLElement) => {
    const value = Reflect.get(globalThis, selectedItemInfosKey);
    if (isSelectedItemInfos(value)) {
        return value(blockElement);
    }
    return ignoreSelectedItemInfos(blockElement);
};

/** 注册虚拟滚动模块提供的选中条目信息读取器。 */
export const setSelectedItemInfos = (reader: (blockElement: HTMLElement) => IAVItemInfo[]) => {
    if (!Reflect.set(globalThis, selectedItemInfosKey, reader)) {
        throw new Error("Unable to register AV selected item infos");
    }
};
