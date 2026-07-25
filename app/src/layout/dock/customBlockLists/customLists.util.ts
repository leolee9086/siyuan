import type { ICustomList } from "./customLists.types";
import { getDockByType } from "../../tabUtil";
import { setStorageVal } from "../../../protyle/util/compatibility";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const getCustomListIcon = (type: "dynamic" | "static") => {
    return type === "dynamic" ? "iconSearch" : "iconList";
};

export const getTopExtHTML = (type: "dynamic" | "static") => {
    if (type === "static") {
        return `<span class="b3-list-item__action b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.remove}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span>`;
    }
    return "";
};

export const handleRemoveFromStorage = (id: string, listData: ICustomList) => {
    const storage = window.siyuan.storage;
    const customLists = storage?.["local-customlists"];
    if (customLists) {
        delete customLists[id];
        setStorageVal("local-customlists", customLists);
    }
    const key = `custom_list:${listData.type}:${id}`;
    const dock = getDockByType(key);
    if (dock) {
        dock.remove(key);
    }
};

export const handleRemoveItemFromList = (id: string, listData: ICustomList) => {
    const ids = listData.target as string[];
    const index = ids.indexOf(id);
    if (index > -1) {
        ids.splice(index, 1);
        listData.target = ids;
        const storage = window.siyuan.storage;
        const customLists = storage?.["local-customlists"];
        if (customLists && customLists[listData.id]) {
            customLists[listData.id] = listData;
            setStorageVal("local-customlists", customLists);
        }
        return true; // Indicates update needed
    }
    return false;
};
