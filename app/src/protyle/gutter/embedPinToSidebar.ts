/**
 * 固定嵌入块到侧边栏的功能
 */
import { genUUID } from "../../util/genID";
import { setStorageVal } from "../util/compatibility";
import { forgeI18n } from "../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanStorage, getSiyuanLayout } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isRecordObject } from "./embedPinToSidebar.guard";

/**
 * 获取嵌入块内所有搜索结果的块ID
 */
export const getEmbedResultIds = (nodeElement: Element): string[] => {
    const embedItems = nodeElement.querySelectorAll(".protyle-wysiwyg__embed[data-id]");
    const ids: string[] = [];
    for (const item of embedItems) {
        const id = item.getAttribute("data-id");
        if (id) {
            ids.push(id);
        }
    }
    return ids;
};

/**
 * 获取嵌入块的SQL查询语句
 * 嵌入块的查询内容存储在元素自身的data-content属性中
 */
export const getEmbedSqlQuery = (nodeElement: Element): string => {
    const rawContent = nodeElement.getAttribute("data-content");
    if (!rawContent) {
        return "";
    }
    // 使用Lute解码HTML转义字符
    return Lute.UnEscapeHTMLStr(rawContent);
};

/**
 * 根据嵌入块查询内容生成标题
 */
const generateEmbedTitle = (sqlQuery: string): string => {
    if (!sqlQuery) {
        return siyuanI18n.blockEmbed || "Embed Block";
    }
    // JS脚本以//!js开头
    if (sqlQuery.startsWith("//!js")) {
        return siyuanI18n.blockEmbed || "Embed Script";
    }
    // SQL查询以select开头
    if (sqlQuery.toLowerCase().startsWith("select")) {
        return "SQL: " + sqlQuery.slice(0, 30).replace(/\s+/g, " ");
    }
    return sqlQuery.slice(0, 30).replace(/\s+/g, " ");
};

/**
 * 保存自定义列表到存储
 */
const saveCustomListToStorage = (uuid: string, listData: {
    id: string;
    title: string;
    icon: string;
    type: "static" | "dynamic";
    target: string | string[];
}) => {
    // 直接获取storage对象引用以确保修改能同步
    const storage = getSiyuanStorage();
    if (!storage) {
        return;
    }
    const customListsKey = "local-customlists";

    // 确保local-customlists存在
    if (!storage[customListsKey]) {
        storage[customListsKey] = {};
    }

    // 获取现有列表对象并添加新项
    const customLists = storage[customListsKey];
    if (isRecordObject(customLists)) {
        customLists[uuid] = listData;
    }

    // 异步保存到持久化存储
    setStorageVal(customListsKey, storage[customListsKey]);
};

/**
 * 添加自定义dock项
 */
const addCustomDockItem = (type: string, title: string, icon: string) => {
    const layout = getSiyuanLayout();
    if (!layout) {
        return;
    }
    const dock = layout.leftDock || layout.rightDock;
    if (dock) {
        dock.addCustomItem({
            type: type,
            title: title,
            icon: icon,
            show: true,
            size: { width: 300, height: 0 },
            hotkey: "",
            hotkeyLangId: "",
        });
    }
};

/**
 * 固定嵌入块结果到侧边栏（静态列表）
 */
export const pinEmbedResultToSidebar = (ids: string[], title: string) => {
    if (ids.length === 0) {
        return;
    }
    const uuid = genUUID();
    const type = "custom_list:static:" + uuid;

    saveCustomListToStorage(uuid, {
        id: uuid,
        title: title,
        icon: "iconList",
        type: "static",
        target: ids
    });

    addCustomDockItem(type, title, "iconList");
};

/**
 * 固定嵌入块查询到侧边栏（动态列表）
 */
export const pinEmbedQueryToSidebar = (sqlQuery: string, title: string) => {
    if (!sqlQuery) {
        return;
    }
    const uuid = genUUID();
    const type = "custom_list:dynamic:" + uuid;

    saveCustomListToStorage(uuid, {
        id: uuid,
        title: title,
        icon: "iconSearch",
        type: "dynamic",
        target: sqlQuery
    });

    addCustomDockItem(type, title, "iconSearch");
};

/**
 * 构建"固定到侧边栏"子菜单
 */
export const buildPinToDockMenu = (nodeElement: Element): IMenu => {
    const customListI18n = getCustomListI18n();
    const ids = getEmbedResultIds(nodeElement);
    const sqlQuery = getEmbedSqlQuery(nodeElement);

    // 生成有意义的标题
    const title = generateEmbedTitle(sqlQuery);

    return {
        id: "pinToDock",
        icon: "iconPin",
        label: siyuanI18n.pin || "Pin to Sidebar",
        type: "submenu",
        submenu: [
            {
                id: "pinEmbedResult",
                iconHTML: "",
                label: customListI18n.pinEmbedResult || "Pin Results to Sidebar",
                disabled: ids.length === 0,
                click: () => pinEmbedResultToSidebar(ids, title)
            },
            {
                id: "pinEmbedQuery",
                iconHTML: "",
                label: customListI18n.pinEmbedQuery || "Pin Query to Sidebar",
                disabled: !sqlQuery,
                click: () => pinEmbedQueryToSidebar(sqlQuery, title)
            }
        ]
    };
};

/**
 * 获取customList的i18n
 */
const getCustomListI18n = (): { pinEmbedResult?: string; pinEmbedQuery?: string } => {
    const i18n = forgeI18n;
    const isValidI18n = i18n && typeof i18n === "object" && "customList" in i18n;
    if (!isValidI18n) {
        return {};
    }
    const customList = i18n.customList;
    const isValidCustomList = customList && typeof customList === "object";
    if (!isValidCustomList) {
        return {};
    }
    return customList;
};
