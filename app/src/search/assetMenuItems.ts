import { Constants } from "../constants";
import { setStorageVal } from "../protyle/util/compatibility";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

/** 创建排序菜单项 */
export const createSortMenuItems = (localData: ISearchAssetOption, cb: () => void) => [{
    iconHTML: "",
    label: siyuanI18n.sortByRankAsc,
    current: localData.sort === 1,
    click() {
        localData.sort = 1;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.sortByRankDesc,
    current: localData.sort === 0,
    click() {
        localData.sort = 0;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.modifiedASC,
    current: localData.sort === 3,
    click() {
        localData.sort = 3;
        cb();
    }
}, {
    iconHTML: "",
    label: siyuanI18n.modifiedDESC,
    current: localData.sort === 2,
    click() {
        localData.sort = 2;
        cb();
    }
}];

/** 创建布局子菜单 */
export const createLayoutSubmenu = (element: Element, localData: ISearchAssetOption) => [{
    iconHTML: "",
    label: siyuanI18n.topBottomLayout,
    current: localData.layout === 0,
    click() {
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
    }
}, {
    iconHTML: "",
    label: siyuanI18n.leftRightLayout,
    current: localData.layout === 1,
    click() {
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
    }
}];
