/** 用途：替换所需模型、网络、消息、渲染、历史和文案能力；使用范围：Search 替换子域；解耦评估：经本域网关逐项直达真实所有者。 */
import {fetchPost} from "./imports";
/** 用途：定位受替换影响的已打开编辑器；使用范围：单项替换成功响应；解耦评估：本域网关直达布局查询。 */
import {getAllModels} from "./imports";
/** 用途：读取当前结果的查询键；使用范围：关键字和查询语法替换；解耦评估：本域网关直达结果实现。 */
import {getKeyByLiElement} from "./imports";
/** 用途：刷新替换后的搜索结果；使用范围：成功响应；解耦评估：本域网关直达输入编排。 */
import {inputEvent} from "./imports";
/** 用途：刷新已打开文档；使用范围：单项替换成功响应；解耦评估：本域网关直达 Protyle 操作。 */
import {reloadProtyle} from "./imports";
/** 用途：保存替换词历史；使用范围：请求前；解耦评估：本域网关直达历史实现。 */
import {saveKeyList} from "./imports";
/** 用途：显示替换提示与错误；使用范围：禁用方法和内核错误；解耦评估：本域网关直达消息实现。 */
import {showMessage} from "./imports";
/** 用途：提供替换禁用文案；使用范围：SQL/语义搜索；解耦评估：本域网关直达 i18n 环境。 */
import {siyuanI18n} from "./imports";
/** 用途：完整 Protyle 领域根；使用范围：搜索刷新参数；解耦评估：纯类型。 */
import type {ProtyleDomain} from "./imports";

/** 读取替换流程必须存在的 DOM 元素。 */
const getRequiredElement = <T extends Element>(element: Element, selector: string) => {
    const result = element.querySelector<T>(selector);
    if (!result) {
        throw new TypeError(`Search replace control is missing: ${selector}`);
    }
    return result;
};

/** 计算单项替换后的下一焦点 ID。 */
const getNextFocusId = (currentList: HTMLElement, config: Config.IUILayoutTabSearchConfig) => {
    if (currentList.nextElementSibling) {
        return currentList.nextElementSibling.getAttribute("data-node-id");
    }
    if (currentList.previousElementSibling) {
        return currentList.previousElementSibling.getAttribute("data-node-id");
    }
    const newId = currentList.getAttribute("data-node-id");
    if (config.group !== 1 || newId) {
        return newId;
    }
    const parent = currentList.parentElement;
    const nextDocElement = parent?.nextElementSibling || parent?.previousElementSibling?.previousElementSibling?.previousElementSibling;
    return nextDocElement?.nextElementSibling?.firstElementChild?.getAttribute("data-node-id") ?? newId;
};

/** 刷新当前打开且包含被替换块的编辑器。 */
const reloadAffectedEditors = (currentList: HTMLElement) => {
    const rootId = currentList.getAttribute("data-root-id");
    for (const item of getAllModels().editor) {
        // 只刷新正在展示本次替换所属根文档的编辑器。
        if (rootId === item.editor.protyle.block.rootID) {
            reloadProtyle(item.editor.protyle, false);
        }
    }
};

/** 恢复加载态，并按全量或单项替换更新搜索结果。 */
const finishReplace = ({response, loadElement, isAll, element, config, edit, currentList, currentId}: {
    response: IWebSocketData;
    loadElement: Element;
    isAll: boolean;
    element: Element;
    config: Config.IUILayoutTabSearchConfig;
    edit: ProtyleDomain;
    currentList: HTMLElement;
    currentId: string | null;
}) => {
    loadElement.classList.add("fn__none");
    // 内核业务错误恢复加载态后直接显示消息，不刷新搜索结果。
    if (response.code === 1) {
        showMessage(response.msg);
        return;
    }
    if (isAll) {
        inputEvent(element, config, edit, false);
        return;
    }
    reloadAffectedEditors(currentList);
    inputEvent(element, config, edit, false, {currentId, newId: getNextFocusId(currentList, config)});
};

/** 执行搜索替换，并在响应后恢复搜索列表状态。 */
/** @同步豁免: UI构建 - 点击处理依赖当前调用栈立即设置加载态并启动既有回调式请求。 */
export const replace = ({element, config, edit, isAll}: {
    element: Element;
    config: Config.IUILayoutTabSearchConfig;
    edit: ProtyleDomain;
    isAll: boolean;
}) => {
    // SQL 与语义搜索不支持文本替换，命中时只显示既有内核提示。
    if (config.method === 2 || config.method === 4) {
        showMessage(siyuanI18n._kernel[132]);
        return;
    }
    const searchPanelElement = getRequiredElement(element, "#searchList");
    const replaceInputElement = getRequiredElement<HTMLInputElement>(element, "#replaceInput");
    const searchInputElement = getRequiredElement<HTMLInputElement>(element, "#searchInput");
    const loadElement = getRequiredElement(element, "svg.fn__rotate");
    if (!loadElement.classList.contains("fn__none")) {
        return;
    }
    saveKeyList("replaceKeys", replaceInputElement.value);
    const currentList = searchPanelElement.querySelector<HTMLElement>(".b3-list-item--focus");
    if (!currentList || currentList.dataset.type === "search-new") {
        return;
    }
    loadElement.classList.remove("fn__none");
    const currentId = currentList.getAttribute("data-node-id");
    fetchPost("/api/search/findReplace", {
        k: config.method === 0 || config.method === 1 ? getKeyByLiElement(currentList) : searchInputElement.value,
        r: replaceInputElement.value,
        method: config.method,
        types: config.types,
        subTypes: config.subTypes,
        paths: config.idPath || [],
        groupBy: config.group,
        orderBy: config.sort,
        page: config.page,
        ids: isAll ? [] : [currentId],
        replaceTypes: config.replaceTypes,
    }, response => finishReplace({response, loadElement, isAll, element, config, edit, currentList, currentId}));
};
