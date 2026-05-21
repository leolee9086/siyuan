import {Constants} from "../constants";
import {genItemPanel} from "./index";
import {keymap} from "./keymap";
import {App} from "../index";
import {isPhablet} from "../protyle/util/compatibility";
import {isHTMLElement, isHTMLInputElement, isInputEvent} from "./search.guard";
import {getSiyuanLanguages} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import {getActiveElement} from "./search.environment";
import {
    EDITOR_KEYS, FILE_TREE_KEYS, FLASHCARD_KEYS, AI_KEYS, EXPORT_KEYS,
    APPEARANCE_KEYS, SEARCH_KEYS, ACCOUNT_KEYS, CLOUD_KEYS, PUBLISH_KEYS,
    ABOUT_KEYS, BAZAAR_KEYS, SKIP_PANEL_FILTER_TYPES
} from "./search.keys";

/** 将国际化键名数组转换为对应的语言文本数组 */
const getLang = (keys: string[]): string[] => {
    const languages = getSiyuanLanguages();
    const langArray: string[] = [];
    for (const key of keys) {
        langArray.push(languages[key]);
    }
    return langArray;
};

/** 双向子串匹配：检查文本与搜索值是否互相包含 */
const matchesSearch = (text: string, searchValue: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerSearch = searchValue.toLowerCase();
    return lowerText.includes(lowerSearch) || lowerSearch.includes(lowerText);
};

/** 构建配置搜索索引：将各标签页的国际化键名转换为语言文本数组 */
const buildConfigIndex = (): string[][] => {
    const keymapKeys = ["keymap", "keymapTip2"]
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.general))
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.editor.general))
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.editor.heading))
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.editor.insert))
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.editor.list))
        .concat(Object.keys(Constants.SIYUAN_KEYMAP.editor.table));
    // @内联数组: 索引顺序必须与标签页DOM顺序一致
    return [
        getLang([...EDITOR_KEYS, "pasteURLAutoConvert", "pasteURLAutoConvertTip"]),
        getLang(FILE_TREE_KEYS),
        getLang(FLASHCARD_KEYS),
        ["AI"].concat(getLang(AI_KEYS)),
        getLang(["assets", "unreferencedAssets", "missingAssets"]),
        getLang(EXPORT_KEYS),
        getLang(APPEARANCE_KEYS),
        getLang(BAZAAR_KEYS),
        getLang(SEARCH_KEYS),
        getLang(keymapKeys),
        getLang(ACCOUNT_KEYS),
        getLang(CLOUD_KEYS),
        getLang(PUBLISH_KEYS),
        getLang(ABOUT_KEYS),
    ];
};

/** 根据搜索值在配置索引中查找匹配的标签页索引列表 */
const buildMatchingIndexList = (configIndex: string[][], inputValue: string): number[] => {
    const indexList: number[] = [];
    for (let index = 0; index < configIndex.length; index++) {
        const item = configIndex[index];
        // 防御性检查：跳过空索引项
        if (!item) {
            continue;
        }
        for (const subItem of item) {
            // 跳过未定义的语言项
            if (!subItem) {
                console.warn("Search config miss language: ", item, index);
                continue;
            }
            // 双向匹配：搜索值包含子项或子项包含搜索值
            if (matchesSearch(subItem, inputValue)) {
                indexList.push(index);
                break;
            }
        }
    }
    return indexList;
};

/** 快捷键面板搜索过滤：将搜索值同步到快捷键面板的搜索框并触发搜索 */
const filterKeymapPanel = (inputValue: string): void => {
    const keymapInputElement = keymap.element.querySelector("#keymapInput");
    const searchByKeyElement = keymap.element.querySelector("#searchByKey");
    // 类型安全检查：确保快捷键面板的搜索元素存在且为输入框
    if (!isHTMLInputElement(keymapInputElement) || !isHTMLInputElement(searchByKeyElement)) {
        return;
    }
    keymapInputElement.value = inputValue;
    searchByKeyElement.value = "";
    keymap.search(keymapInputElement.value, searchByKeyElement.value);
};

/** 搜索面板子项过滤：根据匹配结果显示或隐藏单个子项，返回是否可见 */
const filterSearchSubItem = (labelItem: Element, inputValue: string, showItemParent: boolean): boolean => {
    const parentElement = labelItem.parentElement;
    // 跳过无父元素或已被标记为隐藏的父元素
    if (!parentElement || parentElement.classList.contains("fn__none")) {
        return false;
    }
    // 类型安全检查：确保父元素可设置style
    if (!isHTMLElement(parentElement)) {
        return false;
    }
    const text = labelItem.textContent ?? "";
    // 匹配条件：文本匹配搜索值或父级标题已匹配
    if (matchesSearch(text, inputValue) || showItemParent) {
        parentElement.style.display = "";
        return true;
    }
    parentElement.style.display = "none";
    return false;
};

/** 搜索面板标签项过滤：检查标签项及其子项的匹配状态并设置可见性 */
const filterSearchLabelItem = (itemElement: HTMLElement, inputValue: string): void => {
    // 跳过已被标记为隐藏的元素
    if (itemElement.classList.contains("fn__none")) {
        return;
    }
    const firstChild = itemElement.firstElementChild;
    const itemText = firstChild?.textContent ?? "";
    const showItemParent = matchesSearch(itemText, inputValue);
    let showItemElement = false;
    const subItems = itemElement.querySelectorAll(".fn__flex-1");
    for (const labelItem of subItems) {
        // 累积子项可见性结果
        if (filterSearchSubItem(labelItem, inputValue, showItemParent)) {
            showItemElement = true;
        }
    }
    itemElement.style.display = showItemElement ? "" : "none";
};

/** 搜索面板过滤：遍历搜索面板中的所有标签项并应用过滤 */
const filterSearchPanel = (panelElement: Element, type: string, inputValue: string): void => {
    const selector = `.config__tab-container[data-name="${type}"] .b3-label`;
    for (const itemElement of panelElement.querySelectorAll(selector)) {
        // 类型安全检查：确保元素可操作style属性
        if (!isHTMLElement(itemElement)) {
            continue;
        }
        filterSearchLabelItem(itemElement, inputValue);
    }
};

/** 通用面板过滤：根据文本匹配显示或隐藏面板中的标签项 */
const filterGenericPanel = (panelElement: Element, type: string, inputValue: string): void => {
    const selector = `.config__tab-container[data-name="${type}"] .b3-label`;
    for (const itemElement of panelElement.querySelectorAll(selector)) {
        // 类型安全检查：确保元素可操作style属性
        if (!isHTMLElement(itemElement)) {
            continue;
        }
        // 跳过已被标记为隐藏的元素
        if (itemElement.classList.contains("fn__none")) {
            continue;
        }
        const text = itemElement.textContent ?? "";
        itemElement.style.display = matchesSearch(text, inputValue) ? "" : "none";
    }
};

/** 确保面板内容已生成：若面板为空则调用genItemPanel初始化 */
const ensurePanelContent = (type: string, panelElement: Element, app: App): void => {
    // 面板内容为空时需要初始化
    if (panelElement.innerHTML === "") {
        genItemPanel(type, panelElement, app);
    }
};

/** 按类型分发面板过滤逻辑：快捷键/搜索/通用三种过滤策略 */
const dispatchPanelFilter = (type: string, panelElement: Element, inputValue: string): void => {
    // 快捷键面板使用专用搜索逻辑
    if (type === "keymap") {
        filterKeymapPanel(inputValue);
        return;
    }
    // 搜索面板需要子项级别的精细过滤
    if (type === "search") {
        filterSearchPanel(panelElement, type, inputValue);
        return;
    }
    filterGenericPanel(panelElement, type, inputValue);
};

/** 处理单个匹配的标签项：确保面板内容已生成并应用过滤 */
const processMatchedTabItem = (
    item: HTMLElement, element: HTMLElement, app: App, inputValue: string
): void => {
    const type = item.getAttribute("data-name") ?? "";
    item.style.display = "";
    // 特殊面板类型不需要内容过滤
    if (SKIP_PANEL_FILTER_TYPES.includes(type)) {
        return;
    }
    const panelElement = element.querySelector(`.config__tab-container[data-name="${type}"]`);
    // 面板元素不存在时跳过
    if (!panelElement) {
        return;
    }
    ensurePanelContent(type, panelElement, app);
    dispatchPanelFilter(type, panelElement, inputValue);
};

/** 激活匹配的标签页或隐藏所有面板：有匹配时点击第一个匹配标签，无匹配时隐藏全部 */
const activateMatchedTab = (element: HTMLElement, currentTabElement: HTMLElement | undefined): void => {
    const tabPanelElements = element.querySelectorAll(".config__tab-container");
    // 有匹配标签时激活第一个
    if (currentTabElement) {
        currentTabElement.click();
        return;
    }
    // 无匹配时隐藏所有面板
    for (const panel of tabPanelElements) {
        panel.classList.add("fn__none");
    }
};

/** 更新标签页可见性：根据匹配索引列表显示/隐藏标签并触发面板过滤 */
const updateTab = (
    element: HTMLElement, configIndex: string[][], inputElement: HTMLInputElement, app: App
): void => {
    const inputValue = inputElement.value;
    const indexList = buildMatchingIndexList(configIndex, inputValue);
    let currentTabElement: HTMLElement | undefined;
    const tabItems = element.querySelectorAll(".config__side .b3-list-item");
    for (let index = 0; index < tabItems.length; index++) {
        const item = tabItems[index];
        // 类型安全检查：确保标签项为HTMLElement
        if (!isHTMLElement(item)) {
            continue;
        }
        // 不在匹配列表中的标签项隐藏
        if (!indexList.includes(index)) {
            item.style.display = "none";
            continue;
        }
        // 记录第一个匹配的标签项用于后续激活
        if (!currentTabElement) {
            currentTabElement = item;
        }
        processMatchedTabItem(item, element, app, inputValue);
    }
    activateMatchedTab(element, currentTabElement);
    inputElement.focus();
};

/** 输入事件处理：非组合输入时触发标签页更新 */
const handleSearchInput = (
    event: Event,
    element: HTMLElement,
    configIndex: string[][],
    inputElement: HTMLInputElement,
    app: App
): void => {
    // 组合输入（如中文输入法）期间不触发搜索
    if (isInputEvent(event) && event.isComposing) {
        return;
    }
    updateTab(element, configIndex, inputElement, app);
};

/**
 * 初始化配置搜索功能：构建搜索索引并绑定输入事件
 * @同步豁免: UI构建
 */
export const initConfigSearch = (element: HTMLElement, app: App): void => {
    const configIndex = buildConfigIndex();
    const inputElement = element.querySelector(".b3-form__icon input");
    // 输入框不存在时无法初始化搜索
    if (!isHTMLInputElement(inputElement)) {
        return;
    }
    // 非平板设备自动聚焦搜索框
    if (!isPhablet()) {
        inputElement.focus();
    }
    const activeElement = getActiveElement();
    if (isPhablet() && isHTMLElement(activeElement)) {
        activeElement.blur();
    }

    inputElement.addEventListener("compositionend", () => {
        updateTab(element, configIndex, inputElement, app);
    });
    // 普通输入时触发搜索
    inputElement.addEventListener("input", (event: Event) => {
        handleSearchInput(event, element, configIndex, inputElement, app);
    });
};
