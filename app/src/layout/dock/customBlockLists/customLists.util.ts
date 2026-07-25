import type { ICustomList } from "./customLists.types";
import type {DockDomain} from "../dock.types";
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

export const handleRemoveFromStorage = (
    id: string,
    listData: ICustomList,
    dock: DockDomain | undefined,
    saveCustomLists: (customLists: Record<string, ICustomList>) => void,
) => {
    const storage = window.siyuan.storage;
    const customLists = storage?.["local-customlists"];
    if (customLists) {
        delete customLists[id];
        saveCustomLists(customLists);
    }
    const key = `custom_list:${listData.type}:${id}`;
    if (dock) {
        dock.remove(key);
    }
};

export const handleRemoveItemFromList = (
    id: string,
    listData: ICustomList,
    saveCustomLists: (customLists: Record<string, ICustomList>) => void,
) => {
    if (listData.type !== "static") {
        return false;
    }
    const ids = listData.target;
    const index = ids.indexOf(id);
    if (index === -1) {
        return false;
    }
    ids.splice(index, 1);
    listData.target = ids;
    const storage = window.siyuan.storage;
    const customLists = storage?.["local-customlists"];
    if (customLists && customLists[listData.id]) {
        customLists[listData.id] = listData;
        saveCustomLists(customLists);
    }
    return true; // Indicates update needed
};
