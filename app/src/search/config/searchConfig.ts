/** 用途：搜索配置更新所需的 DOM、存储、输入与文案能力；使用范围：桌面 Search 配置子域；解耦评估：本域网关逐项直达稳定所有者。 */
import {Constants} from "./imports";
/** 用途：转义搜索路径；使用范围：路径展示；解耦评估：经本域网关复用纯函数。 */
import {escapeHtml} from "./imports";
/** 用途：识别局部搜索 Dialog；使用范围：路径继承；解耦评估：经本域网关复用 DOM 查询。 */
import {hasClosestByClassName} from "./imports";
/** 用途：关闭配置来源菜单；使用范围：配置刷新完成后；解耦评估：经本域网关直达菜单环境。 */
import {getSiyuanGlobalMenusMenu} from "./imports";
/** 用途：取得已初始化的搜索存储；使用范围：配置持久化；解耦评估：经本域网关直达严格环境访问器。 */
import {getSiyuanStorage} from "./imports";
/** 用途：验证输入控件；使用范围：写入搜索/替换值前；解耦评估：经本域网关复用共享 DOM 守卫。 */
import {isHTMLInputElement} from "./imports";
/** 用途：持久化搜索配置；使用范围：配置更新收尾；解耦评估：经本域网关直达统一存储。 */
import {setStorageVal} from "./imports";
/** 用途：搜索方法文案；使用范围：语法状态图标；解耦评估：经本域网关读取 i18n。 */
import {siyuanI18n} from "./imports";
/** 用途：完整 Protyle 领域根；使用范围：配置刷新参数；解耦评估：纯类型不加载实现。 */
import type {ProtyleDomain} from "./imports";

/** 读取模板中必须存在的元素；模板与逻辑失配时立即暴露具体 selector。 */
const getRequiredElement = (element: Element, selector: string) => {
    const result = element.querySelector(selector);
    if (!result) {
        throw new TypeError(`Search control is missing: ${selector}`);
    }
    return result;
};

/** 读取模板中必须存在的第二个替换栏标题。 */
const getRequiredReplaceHeader = (element: Element) => {
    const headers = element.querySelectorAll(".search__header");
    const result = headers[1];
    if (!result) {
        throw new TypeError("Search control is missing: .search__header[1]");
    }
    return result;
};

/** 读取控件必须存在的父节点。 */
const getRequiredParent = (element: Element, selector: string) => {
    const parent = getRequiredElement(element, selector).parentElement;
    if (!parent) {
        throw new TypeError(`Search control parent is missing: ${selector}`);
    }
    return parent;
};

/** 读取运行态搜索配置必需的字符串字段。 */
const getRequiredString = (value: string | undefined, field: string) => {
    if (typeof value !== "string") {
        throw new TypeError(`Search config field is missing: ${field}`);
    }
    return value;
};

/** 读取运行态搜索配置必需的数字字段。 */
const getRequiredNumber = (value: number | undefined, field: string) => {
    if (typeof value !== "number") {
        throw new TypeError(`Search config field is missing: ${field}`);
    }
    return value;
};

/** 读取运行态搜索配置必需的路径列表。 */
const getRequiredPaths = (value: string[] | undefined) => {
    if (!value) {
        throw new TypeError("Search config field is missing: idPath");
    }
    return value;
};

/**
 * 生成搜索方法状态图标，供搜索输入和资产搜索共享。
 * @同步豁免: UI构建 - 返回值被模板插值与 outerHTML 在当前调用栈中直接消费，Promise 会破坏 HTML 协议。
 */
export const genQueryHTML = (method: number, id: string) => {
    let methodTip = "";
    let methodIcon = "";
    // 关键字搜索显示精确匹配图标。
    if (method === 0) {
        methodTip = siyuanI18n.keyword;
        methodIcon = "Exact";
    }
    // 查询语法搜索显示引用图标。
    if (method === 1) {
        methodTip = siyuanI18n.querySyntax;
        methodIcon = "Quote";
    }
    // SQL 搜索显示数据库图标。
    if (method === 2) {
        methodTip = "SQL";
        methodIcon = "Database";
    }
    // 正则搜索显示正则图标。
    if (method === 3) {
        methodTip = siyuanI18n.regex;
        methodIcon = "Regex";
    }
    // 语义搜索显示 Sparkles 图标。
    if (method === 4) {
        methodTip = siyuanI18n.semanticSearch;
        methodIcon = "Sparkles";
    }
    return `<span id="${id}" aria-label="${siyuanI18n.searchMethod} ${methodTip}" class="block__icon ariaLabel" data-position="9south">
    <svg><use xlink:href="#icon${methodIcon}"></use></svg>
</span>`;
};

/** 同步搜索路径展示；每条分支只写入一次内容和一次 aria-label。 */
const updateSearchPathControl = (element: Element, hPath: string) => {
    const searchPathInputElement = getRequiredElement(element, "#searchPathInput");
    if (!hPath) {
        searchPathInputElement.innerHTML = "";
        searchPathInputElement.setAttribute("aria-label", "");
        return;
    }
    searchPathInputElement.innerHTML = `${escapeHtml(hPath)}<svg class="search__rmpath"><use xlink:href="#iconCloseRound"></use></svg>`;
    searchPathInputElement.setAttribute("aria-label", escapeHtml(hPath));
};

/** 将单个 class 设为确定状态，避免 toggle 受控件原状态影响。 */
const setClassEnabled = (element: Element, className: string, enabled: boolean) => {
    if (enabled) {
        element.classList.add(className);
        return;
    }
    element.classList.remove(className);
};

/** 同步 Search Dialog 的路径、替换栏和分组控件；配置更新入口在持久化前调用。 */
const updatePathAndGroupControls = (
    element: Element,
    item: Config.IUILayoutTabSearchConfig,
    config: Config.IUILayoutTabSearchConfig,
) => {
    const dialogElement = hasClosestByClassName(element, "b3-dialog--open");
    // 局部文档搜索继续继承原配置的路径范围。
    if (dialogElement && dialogElement.getAttribute("data-key") === Constants.DIALOG_SEARCH) {
        item.hPath = getRequiredString(config.hPath, "hPath");
        item.idPath = [...getRequiredPaths(config.idPath)];
    }
    // 仅在替换模式发生变化时更新替换栏可见性。
    if (config.hasReplace !== item.hasReplace) {
        setClassEnabled(getRequiredReplaceHeader(element), "fn__none", !item.hasReplace);
    }
    updateSearchPathControl(element, getRequiredString(item.hPath, "hPath"));
    // 仅在分组模式变化时更新展开按钮容器。
    if (config.group !== item.group) {
        setClassEnabled(getRequiredParent(element, "#searchExpand"), "fn__none", item.group === 0);
    }
};

/** 同步“包含子文档”图标与禁用态；路径控件更新后、输入控件更新前调用。 */
const updateIncludeChildControl = (element: Element, item: Config.IUILayoutTabSearchConfig) => {
    let includeChild = true;
    let enableIncludeChild = false;
    for (const pathItem of getRequiredPaths(item.idPath)) {
        // 具体文档路径不包含其子文档。
        if (pathItem.endsWith(".sy")) {
            includeChild = false;
        }
        // 至少一个非根路径时允许用户切换子文档范围。
        if (pathItem.split("/").length > 1) {
            enableIncludeChild = true;
        }
    }
    const searchIncludeElement = getRequiredElement(element, "#searchInclude");
    const searchIncludeIcon = searchIncludeElement.firstElementChild;
    if (!searchIncludeIcon) {
        throw new TypeError("Search control child is missing: #searchInclude");
    }
    setClassEnabled(searchIncludeIcon, "ft__primary", includeChild);
    if (enableIncludeChild) {
        searchIncludeElement.removeAttribute("disabled");
        return;
    }
    searchIncludeElement.setAttribute("disabled", "disabled");
};

/** 获取必须存在的搜索输入控件；模板失配时保持失败可见。 */
const getRequiredInput = (element: Element, selector: string) => {
    const input = element.querySelector(selector);
    if (!isHTMLInputElement(input)) {
        throw new TypeError(`Search input is missing: ${selector}`);
    }
    return input;
};

/** 同步搜索、替换与语法控件；配置持久化和搜索刷新前调用。 */
const updateInputControls = (element: Element, item: Config.IUILayoutTabSearchConfig, clear: boolean) => {
    // 有关键词或明确清空时才覆盖搜索输入框。
    if (item.k || clear) {
        getRequiredInput(element, "#searchInput").value = getRequiredString(item.k, "k");
    }
    getRequiredInput(element, "#replaceInput").value = getRequiredString(item.r, "r");
    const searchSyntaxCheck = getRequiredElement(element, "#searchSyntaxCheck");
    searchSyntaxCheck.outerHTML = genQueryHTML(getRequiredNumber(item.method, "method"), "searchSyntaxCheck");
};

/**
 * 更新桌面 Search 配置、对应控件、持久化状态与搜索结果。
 * @同步豁免: 遗留代码 - 调用方依赖同一事件栈中的 DOM、storage、inputEvent 与菜单关闭顺序。
 */
export const updateConfig = ({
    element,
    item,
    config,
    edit,
    refresh,
    clear = false,
}: {
    element: Element;
    item: Config.IUILayoutTabSearchConfig;
    config: Config.IUILayoutTabSearchConfig;
    edit: ProtyleDomain;
    refresh: (element: Element, config: Config.IUILayoutTabSearchConfig, edit: ProtyleDomain) => void;
    clear?: boolean;
}) => {
    updatePathAndGroupControls(element, item, config);
    updateIncludeChildControl(element, item);
    updateInputControls(element, item, clear);
    config = JSON.parse(JSON.stringify(item));
    const storage = getSiyuanStorage();
    storage[Constants.LOCAL_SEARCHDATA] = JSON.parse(JSON.stringify(item));
    setStorageVal(Constants.LOCAL_SEARCHDATA, storage[Constants.LOCAL_SEARCHDATA]);
    refresh(element, config, edit);
    getSiyuanGlobalMenusMenu().remove();
};
