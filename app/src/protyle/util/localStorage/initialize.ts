/** 用途：本地存储协议键。使用范围：默认值创建与逐键迁移；解耦评估：经本目录 imports.ts 直达唯一常量实现。 */
import {Constants} from "./imports";
/** 用途：搜索块子类型默认值。使用范围：首次初始化及旧数据补齐；解耦评估：经本目录 imports.ts 直达搜索默认值领域。 */
import {getDefaultSubType} from "./imports";
/** 用途：搜索主类型默认值。使用范围：首次初始化；解耦评估：经本目录 imports.ts 直达搜索默认值领域。 */
import {getDefaultType} from "./imports";
/** 用途：异步读取内核本地存储。使用范围：getLocalStorage 初始化入口；解耦评估：经本目录 imports.ts 直达网络实现并由本领域守卫校验。 */
import {fetchSyncPost} from "./imports";
/** 用途：验证内核返回的可迁移存储对象。使用范围：写入全局状态前；解耦评估：同领域外部输入守卫无需参数化。 */
import {isLocalStoragePayload} from "./localStorage.guard";

/** @同步豁免: 纯数据构建 - 搜索默认值必须在单次存储迁移中按确定顺序写入同一对象。 */
const addSearchDefaults = (defaults: NonNullable<ISiyuan["storage"]>) => {
    defaults[Constants.LOCAL_SEARCHASSET] = {
        keys: [], col: "", row: "", layout: 0, method: 0, types: {}, sort: 0, k: "",
    };
    const assetSearch = defaults[Constants.LOCAL_SEARCHASSET];
    for (const type of Constants.SIYUAN_ASSETS_SEARCH) {
        assetSearch.types[type] = true;
    }
    defaults[Constants.LOCAL_SEARCHUNREF] = {col: "", row: "", layout: 0};
    defaults[Constants.LOCAL_SEARCHKEYS] = {
        keys: [], replaceKeys: [], col: "", row: "", layout: 0, colTab: "", rowTab: "", layoutTab: 0,
    };
    defaults[Constants.LOCAL_SEARCHDATA] = {
        removed: true,
        page: 1,
        sort: 0,
        group: 0,
        hasReplace: false,
        method: 0,
        hPath: "",
        idPath: [],
        k: "",
        r: "",
        types: getDefaultType(),
        subTypes: getDefaultSubType(),
        replaceTypes: Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES),
    };
    defaults[Constants.LOCAL_SEMANTIC_SEARCH] = {datasets: [], topK: 10, threshold: 0, lastQuery: ""};
};

/** @同步豁免: 纯数据构建 - 导出默认值属于同一次本地存储迁移事务。 */
const addExportDefaults = (defaults: NonNullable<ISiyuan["storage"]>) => {
    defaults[Constants.LOCAL_EXPORTWORD] = {removeAssets: false, mergeSubdocs: false};
    defaults[Constants.LOCAL_EXPORTPDF] = {
        landscape: false,
        marginType: "0",
        scale: 1,
        pageSize: "A4",
        removeAssets: true,
        keepFold: false,
        mergeSubdocs: false,
        watermark: false,
        paged: true,
    };
    defaults[Constants.LOCAL_EXPORTIMG] = {keepFold: false, watermark: false, ratio: "auto", background: ""};
};

/** @同步豁免: 纯数据构建 - 界面默认值属于同一次本地存储迁移事务。 */
const addInterfaceDefaults = (defaults: NonNullable<ISiyuan["storage"]>) => {
    defaults[Constants.LOCAL_LAYOUTS] = [];
    defaults[Constants.LOCAL_AI] = [];
    defaults[Constants.LOCAL_PLUGIN_DOCKS] = {};
    defaults[Constants.LOCAL_PLUGINTOPUNPIN] = [];
    defaults[Constants.LOCAL_OUTLINE] = {keepCurrentExpand: false, expandLevel: 6};
    defaults[Constants.LOCAL_FILEPOSITION] = {};
    defaults[Constants.LOCAL_DIALOGPOSITION] = {};
    defaults[Constants.LOCAL_FLASHCARD] = {fullscreen: false};
    defaults[Constants.LOCAL_BAZAAR] = {theme: "0", template: "0", icon: "0", widget: "0"};
    defaults[Constants.LOCAL_DOCINFO] = {id: ""};
    defaults[Constants.LOCAL_IMAGES] = {file: "1f4c4", note: "1f5c3", folder: "1f4d1"};
    defaults[Constants.LOCAL_EMOJIS] = {currentTab: "emoji"};
    defaults[Constants.LOCAL_FONTSTYLES] = [];
    defaults[Constants.LOCAL_CLOSED_TABS] = [];
    defaults[Constants.LOCAL_FILESPATHS] = [];
    defaults[Constants.LOCAL_ZOOM] = 1;
    defaults[Constants.LOCAL_MOVE_PATH] = {keys: [], k: ""};
    defaults[Constants.LOCAL_RECENT_DOCS] = {type: "viewedAt"};
};

/** @同步豁免: 纯数据构建 - 历史和 PDF 默认值必须先于逐键迁移创建。 */
const addDocumentDefaults = (defaults: NonNullable<ISiyuan["storage"]>) => {
    defaults[Constants.LOCAL_PDFTHEME] = {light: "light", dark: "dark", annoColor: "var(--b3-pdf-background1)"};
    defaults[Constants.LOCAL_HISTORY] = {
        notebookId: "%",
        type: 0,
        operation: "all",
        sideWidth: "256px",
        sideDocWidth: "256px",
        sideDiffWidth: "256px",
    };
};

/** @同步豁免: 纯数据构建 - 聚合各子域默认值，不执行 I/O。 */
const createDefaultStorage = () => {
    const defaults: NonNullable<ISiyuan["storage"]> = {};
    addSearchDefaults(defaults);
    addExportDefaults(defaults);
    addInterfaceDefaults(defaults);
    addDocumentDefaults(defaults);
    return defaults;
};

/** @同步豁免: 迁移事务 - 单个键必须在继续下一个键前完成解析或回填。 */
const migrateStorageValue = (
    storage: NonNullable<ISiyuan["storage"]>,
    defaults: NonNullable<ISiyuan["storage"]>,
    key: string,
) => {
    const value = storage[key];
    if (typeof value === "undefined") {
        storage[key] = defaults[key];
        return;
    }
    if (typeof value !== "string") {
        return;
    }
    try {
        const parsed = JSON.parse(value);
        storage[key] = typeof parsed === "number" ? parsed : Object.assign(defaults[key], parsed);
    } catch (error) {
        console.warn(`[local-storage] failed to migrate ${key}; using defaults`, error);
        storage[key] = defaults[key];
    }
};

/** @同步豁免: 迁移事务 - 逐项生成固定协议键，避免在模块作用域保留可变数组。 */
function* migratedStorageKeys() {
    yield Constants.LOCAL_EXPORTIMG;
    yield Constants.LOCAL_SEARCHKEYS;
    yield Constants.LOCAL_PDFTHEME;
    yield Constants.LOCAL_BAZAAR;
    yield Constants.LOCAL_EXPORTWORD;
    yield Constants.LOCAL_EXPORTPDF;
    yield Constants.LOCAL_DOCINFO;
    yield Constants.LOCAL_FONTSTYLES;
    yield Constants.LOCAL_SEARCHDATA;
    yield Constants.LOCAL_ZOOM;
    yield Constants.LOCAL_LAYOUTS;
    yield Constants.LOCAL_AI;
    yield Constants.LOCAL_PLUGINTOPUNPIN;
    yield Constants.LOCAL_SEARCHASSET;
    yield Constants.LOCAL_FLASHCARD;
    yield Constants.LOCAL_DIALOGPOSITION;
    yield Constants.LOCAL_SEARCHUNREF;
    yield Constants.LOCAL_HISTORY;
    yield Constants.LOCAL_OUTLINE;
    yield Constants.LOCAL_FILEPOSITION;
    yield Constants.LOCAL_FILESPATHS;
    yield Constants.LOCAL_IMAGES;
    yield Constants.LOCAL_PLUGIN_DOCKS;
    yield Constants.LOCAL_EMOJIS;
    yield Constants.LOCAL_MOVE_PATH;
    yield Constants.LOCAL_RECENT_DOCS;
    yield Constants.LOCAL_CLOSED_TABS;
    yield Constants.LOCAL_SEMANTIC_SEARCH;
}

/** @同步豁免: 迁移事务 - 所有受管键必须在回调观察全局存储前完成。 */
const migrateStoredValues = (
    storage: NonNullable<ISiyuan["storage"]>,
    defaults: NonNullable<ISiyuan["storage"]>,
) => {
    for (const key of migratedStorageKeys()) {
        migrateStorageValue(storage, defaults, key);
    }
};

/** @同步豁免: 迁移事务 - 搜索兼容字段必须原子补齐后再开放后续启动步骤。 */
const ensureSearchCompatibility = (storage: NonNullable<ISiyuan["storage"]>) => {
    const searchData = storage[Constants.LOCAL_SEARCHDATA];
    // 旧版本没有 replaceTypes，或迁移后为空时，补齐当前默认替换类型集合。
    if (!searchData.replaceTypes || Object.keys(searchData.replaceTypes).length === 0) {
        searchData.replaceTypes = Object.assign({}, Constants.SIYUAN_DEFAULT_REPLACETYPES);
    }
    // 旧版本没有 subTypes，或迁移后为空时，补齐当前默认块子类型集合。
    if (!searchData.subTypes || Object.keys(searchData.subTypes).length === 0) {
        searchData.subTypes = getDefaultSubType();
    }
};

/**
 * 加载并迁移主应用本地存储。
 * 调用方获得的 Promise 只会在存储和兼容字段全部写入全局状态后兑现。
 */
export const getLocalStorage = async () => {
    const response = await fetchSyncPost("/api/storage/getLocalStorage");
    if (!isLocalStoragePayload(response.data)) {
        throw new TypeError("/api/storage/getLocalStorage returned a non-object payload");
    }
    const storage = response.data;
    const defaults = createDefaultStorage();
    migrateStoredValues(storage, defaults);
    ensureSearchCompatibility(storage);
    window.siyuan.storage = storage;
};
