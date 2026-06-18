/**
 * 用途：布局 Model 基类。
 * 使用范围：Search 类继承。
 * 解耦评估：通过 imports.ts 转发。
 */
import { Model } from "./imports";
/**
 * 用途：布局 Tab 类型。
 * 使用范围：Search 构造参数。
 * 解耦评估：通过 imports.ts 转发。
 */
import { Tab } from "./imports";
/**
 * 用途：Protyle 编辑器类型。
 * 使用范围：Search 编辑器引用。
 * 解耦评估：通过 imports.ts 转发。
 */
import { Protyle } from "./imports";
/**
 * 用途：搜索功能生成器。
 * 使用范围：Search 构造函数中初始化编辑器。
 * 解耦评估：同目录工具函数，直接导入。
 */
import { genSearch } from "./utils/genSearch";
/**
 * 用途：面板焦点设置工具。
 * 使用范围：Search 点击处理时恢复焦点。
 * 解耦评估：通过 imports.ts 转发。
 */
import { setPanelFocus } from "./imports";
/**
 * 用途：App 根实例类型。
 * 使用范围：Search 构造参数。
 * 解耦评估：通过 imports.ts 转发。
 */
import { App } from "./imports";
/**
 * 用途：清理 outline 和 gutter 高亮。
 * 使用范围：Search 点击处理时清除 O/B/G 高亮。
 * 解耦评估：通过 imports.ts 转发。
 */
import { clearOBG } from "./imports";
/**
 * 用途：思源配置读取。
 * 使用范围：Search 构造时判断是否使用当前 Tab 打开文件。
 * 解耦评估：通过 imports.ts 转发。
 */
import { getSiyuanConfig } from "./imports";

/**
 * 用途：处理 Search 面板元素点击——恢复焦点并清除 O/B/G 高亮
 * 调用时机：Search 元素 click 事件触发时
 */
const handleSearchElementClick = (element: HTMLElement) => {
    clearOBG();
    const grandParent = element.parentElement?.parentElement;
    if (grandParent) {
        setPanelFocus(grandParent);
    }
};

/**
 * 用途：选中搜索输入框
 * 使用范围：updateSearch 中空文本时调用
 */
const selectInputField = (element: HTMLElement) => {
    const inputElement = element.querySelector(".b3-text-field");
    // 确保找到的输入框是 HTMLInputElement 类型
    if (inputElement instanceof HTMLInputElement) {
        inputElement.select();
    }
};

// @允许继承: 框架要求 (FrameworkRequired)
/** 用途：搜索面板，管理搜索界面的生命周期和事件。使用范围：布局系统初始化搜索面板时实例化。 */
class Search extends Model {
    public element: HTMLElement;
    public config: Config.IUILayoutTabSearchConfig;
    public editors: { edit: Protyle, unRefEdit: Protyle };

    constructor(options: { tab: Tab, config: Config.IUILayoutTabSearchConfig, app: App }) {
        super({
            app: options.app,
            id: options.tab.id,
        });
        // 设置 Tab 未更新标记（当启用"使用当前标签页打开文件"时）
        if (getSiyuanConfig().fileTree.openFilesUseCurrentTab) {
            options.tab.headElement?.classList.add("item--unupdate");
        }
        const panelElement = options.tab.panelElement;
        if (!(panelElement instanceof HTMLElement)) {
            throw new Error("Search panel element must be an HTMLElement");
        }
        this.element = panelElement;
        this.config = options.config;
        this.editors = genSearch(options.app, this.config, this.element);
        this.element.addEventListener("click", () => {
            handleSearchElementClick(this.element);
        });
    }

    /** 用途：更新搜索文本。调用时机：用户输入搜索关键词或切换搜索模式时。 */
    updateSearch(text: string, replace: boolean) {
        // 空文本时选中输入框并返回
        if (text === "") {
            selectInputField(this.element);
            return;
        }
        const inputElement = this.element.querySelector(".b3-text-field");
        if (!(inputElement instanceof HTMLInputElement)) {
            return;
        }
        const oldText = inputElement.value;
        if (oldText === text) {
            return;
        }
        // 非替换模式下从已有文本中移除新关键词（避免重复）
        if (!replace && oldText.indexOf(text) > -1) {
            text = oldText.replace(text + " ", "").replace(" " + text, "");
        }
        // 非替换模式下将新关键词追加到已有文本后
        if (!replace && oldText.indexOf(text) === -1 && oldText !== "") {
            text = oldText + " " + text;
        }
        inputElement.value = text;
        inputElement.select();
        inputElement.dispatchEvent(new CustomEvent("input"));
    }
}

/** 导出 Search 类，供布局系统初始化搜索面板时使用。 */
export { Search };
