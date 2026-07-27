/** 用途：读取搜索协议和运行环境；使用范围：复用或创建全局 Search；解耦评估：经 global 子域网关集中隔离布局与环境依赖。 */
import {Constants} from "./imports";
/** 用途：查找现有 Search 模型；使用范围：复用第一个全局搜索；解耦评估：布局查询经子域网关隔离，不暴露给调用方。 */
import {getAllModels} from "./imports";
/** 用途：读取 AI 与文件树配置；使用范围：搜索方法和分屏决策；解耦评估：严格环境访问经子域网关隔离。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取中心布局；使用范围：分屏决策；解耦评估：严格环境访问经子域网关隔离。 */
import {getSiyuanLayout} from "./imports";
/** 用途：读取本地搜索偏好；使用范围：新建全局搜索；解耦评估：严格环境访问经子域网关隔离。 */
import {getSiyuanStorage} from "./imports";
/** 用途：约束搜索宿主完整能力；使用范围：创建 Search 页签；解耦评估：纯类型经子域网关直达 AppFacade。 */
import type {AppFacade} from "./imports";

/** 复用现有 Search 并同步更新其查询。 */
const updateExistingSearch = (text: string, replace: boolean) => {
    const searchModel = getAllModels().search.find((item) => {
        item.parent.parent.switchTab(item.parent.headElement);
        item.updateSearch(text, replace);
        return true;
    });
    return Boolean(searchModel);
};

/** 创建全局搜索数据，保留本地偏好与嵌入搜索可用性规则。 */
const createGlobalSearchData = (searchData?: Config.IUILayoutTabSearchConfig) => {
    const localData = getSiyuanStorage()[Constants.LOCAL_SEARCHDATA];
    if (!localData) {
        throw new TypeError("Global search preferences are missing");
    }
    const config = getSiyuanConfig();
    const method = searchData ? searchData.method :
        (localData.method === 4 && !config.ai.embedding.enabled ? 0 : localData.method);
    return {
        k: "",
        r: "",
        hasReplace: false,
        method,
        hPath: "",
        idPath: [],
        group: localData.group,
        sort: localData.sort,
        types: Object.assign({}, localData.types),
        subTypes: Object.assign({}, localData.subTypes),
        replaceTypes: Object.assign({}, localData.replaceTypes),
        removed: localData.removed,
        page: 1,
    };
};

/** 决定新 Search 是否沿用桌面分屏打开语义。 */
const getGlobalSearchPosition = () => {
    const config = getSiyuanConfig();
    const layout = getSiyuanLayout();
    const centerLayout = layout.centerLayout;
    if (!centerLayout) {
        throw new TypeError("Global search requires an initialized center layout");
    }
    return !config.fileTree.noSplitScreenWhenOpenTab &&
        (centerLayout.children.length > 1 || window.innerWidth > 1024) ? "right" as const : undefined;
};

/**
 * 打开全局搜索：已有 Search 时同步复用，否则通过完整 AppFacade 创建 Search 页签。
 * @同步豁免: UI构建 - 既有调用方在点击和命令事件栈内立即切换 Search 并更新查询；新页签 Promise 继续沿用不等待语义。
 */
export const openGlobalSearch = (app: AppFacade, options: {
    text: string;
    replace: boolean;
    searchData?: Config.IUILayoutTabSearchConfig | undefined;
}) => {
    const text = options.text.trim();
    if (updateExistingSearch(text, options.replace)) {
        return;
    }
    const searchData = createGlobalSearchData(options.searchData);
    searchData.k = text;
    void app.openTab({searchData, position: getGlobalSearchPosition()});
};
