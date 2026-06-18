/** 用途：系统常量。使用范围：存储键名。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：存储值设置。使用范围：保存布局状态。解耦评估：通过 ./imports 转发。 */
import { setStorageVal } from "./imports";
/** 用途：安全获取存储。使用范围：读取布局状态。解耦评估：通过 ./imports 转发。 */
import { getSiyuanStorage } from "./imports";
/** 用途：国际化文案。使用范围：排序和布局菜单文案。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";

/** 创建排序菜单项 */
// @柯里化: createSortMenuItems 是 buildSortItems 的柯里化包装，用于统一菜单创建接口
export const createSortMenuItems = async (localData: ISearchAssetOption, cb: () => void) => {
    return sortMenuItemsConfig(localData, cb);
};

/** 排序菜单项配置，按相关度和修改时间升/降序 */
// @内联数组: sortMenuItemsConfig 返回的菜单项数组直接由调用方消费，提取为常量会破坏闭包对 localData/cb 的捕获
const sortMenuItemsConfig = (localData: ISearchAssetOption, cb: () => void) => [{
    iconHTML: "",
    label: siyuanI18n.sortByRankAsc,
    current: localData.sort === 1,
    /** 按相关度升序排序 */
    click() {
        localData.sort = 1;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.sortByRankDesc,
    current: localData.sort === 0,
    /** 按相关度降序排序 */
    click() {
        localData.sort = 0;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.modifiedASC,
    current: localData.sort === 3,
    /** 按修改时间升序排序 */
    click() {
        localData.sort = 3;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.modifiedDESC,
    current: localData.sort === 2,
    /** 按修改时间降序排序 */
    click() {
        localData.sort = 2;
        cb();
    }
}];

/**
 * 用途：处理上下布局的点击
 * 使用范围：createLayoutSubmenu 中布局切换
 */
const handleTopBottomLayoutClick = (element: Element, localData: ISearchAssetOption) => {
    const searchLayoutElement = element.querySelector(".search__layout");
    searchLayoutElement?.classList.remove("search__layout--row");
    const previewElement = element.querySelector("#searchAssetPreview");
    if (!(previewElement instanceof HTMLElement)) {
        return;
    }
    previewElement.style.width = "";
    localData.layout = 0;
    if (!localData.row) {
        previewElement.classList.add("fn__flex-1");
        setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
        return;
    }
    previewElement.style.height = localData.row;
    previewElement.classList.remove("fn__flex-1");
    setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
};

/**
 * 用途：处理左右布局的点击
 * 使用范围：createLayoutSubmenu 中布局切换
 */
const handleLeftRightLayoutClick = (element: Element, localData: ISearchAssetOption) => {
    const previewElement = element.querySelector("#searchAssetPreview");
    if (!(previewElement instanceof HTMLElement)) {
        return;
    }
    const searchLayoutElement = element.querySelector(".search__layout");
    searchLayoutElement?.classList.add("search__layout--row");
    previewElement.style.height = "";
    localData.layout = 1;
    if (!localData.col) {
        previewElement.classList.add("fn__flex-1");
        setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
        return;
    }
    previewElement.style.width = localData.col;
    previewElement.classList.remove("fn__flex-1");
    setStorageVal(Constants.LOCAL_SEARCHASSET, getSiyuanStorage()[Constants.LOCAL_SEARCHASSET]);
};

/** 创建布局子菜单 */
export const createLayoutSubmenu = async (element: Element, localData: ISearchAssetOption) => [{
    iconHTML: "",
    label: siyuanI18n.topBottomLayout,
    current: localData.layout === 0,
    /** 上下布局 */
    click() {
        handleTopBottomLayoutClick(element, localData);
    }
}, {
    iconHTML: "",
    label: siyuanI18n.leftRightLayout,
    current: localData.layout === 1,
    /** 左右布局 */
    click() {
        handleLeftRightLayoutClick(element, localData);
    }
}];

