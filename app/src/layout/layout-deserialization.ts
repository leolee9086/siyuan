/**
 * 布局反序列化模块
 * 提供从JSON恢复布局的功能
 * @同步豁免: 遗留代码 - 此模块从 util.ts 迁移，保持原有同步行为以确保兼容性
 */
import type { AppFacade } from "../app/AppFacade.types";
import { Constants } from "../constants";
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import type {ILayoutModel} from "./lifecycle/model.types";
import { afterLayoutReady } from "../plugin/loader";
import {isEncryptedBox} from "../util/file/notebook/store";
import {saveLayout} from "./persistence/saveLayout";
import { JSONToDock } from "./dock-utils";
import {setTabPosition} from "../window/setHeader";
import {
    handleLayoutInstance,
    handleWndInstance,
    handleTabInstance,
} from "./layout-deserialization.handlers";
import { processModelItem } from "./layout-deserialization.model-handlers";
import {
    isLayoutItem,
    isWndItem,
    isTabItem,
    hasArrayChildren,
    getObjectChildrenFromJson,
    isTabInstance,
    isLayoutContainer,
    isWndContainer,
    getEncryptedLayoutNotebookId,
} from "./layout-deserialization.guard";
import {
    getSiyuanLayout,
    getUILayoutConfig,
} from "./layout-deserialization.environment";
import {
    handleMissingPluginTabs,
    handleUrlFileOpen,
    activateInitialTabs,
    handleCloseTabsOnStart,
    handleTabStartupBlank,
    shouldApplyTabStartup,
} from "./layout-deserialization.layout";

/** 存储需要移除的空Tab，在布局恢复完成后统一处理 */
const removedTabs: Tab[] = [];

/** 关闭的加密笔记本不能恢复编辑器或数据库行页签。 */
const shouldRemoveClosedEncryptedTab = (json: Config.TUILayoutItem, layout: Layout | Wnd | Tab | ILayoutModel | undefined) => {
    if (!(layout instanceof Tab)) {
        return false;
    }
    const notebookId = getEncryptedLayoutNotebookId(json);
    const notebook = window.siyuan.notebooks.find((item) => item.id === notebookId);
    if (!notebook?.closed || !isEncryptedBox(notebookId)) {
        return false;
    }
    layout.headElement.removeAttribute("data-init-active");
    removedTabs.push(layout);
    return true;
};

const collapseEmptyDockLayouts = (): void => {
    const layout = getSiyuanLayout();
    if (!layout) {
        return;
    }
    if (layout.rightDock?.layout.children[0].element.classList.contains("fn__none") &&
        layout.rightDock.layout.children[1].element.classList.contains("fn__none")) {
        layout.rightDock.layout.element.style.width = "0px";
    }
    if (layout.leftDock?.layout.children[0].element.classList.contains("fn__none") &&
        layout.leftDock.layout.children[1].element.classList.contains("fn__none")) {
        layout.leftDock.layout.element.style.width = "0px";
    }
    if (layout.bottomDock?.layout.children[0].element.classList.contains("fn__none") &&
        layout.bottomDock.layout.children[1].element.classList.contains("fn__none")) {
        layout.bottomDock.layout.element.style.height = "0px";
    }
};

// JSONToCenter 实例处理分发

/**
 * 处理 Layout 类型实例
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
const processLayoutItem = (
    json: Config.IUILayoutLayout,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined
): Layout | undefined => {
    // 类型守卫确保 layout 是 Layout 或 undefined
    if (layout && !isLayoutContainer(layout)) {
        return undefined;
    }
    return handleLayoutInstance(json, layout);
};

/**
 * 处理 Wnd 类型实例
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
const processWndItem = (
    app: AppFacade,
    json: Config.IUILayoutWnd,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined
): Wnd | undefined => {
    // Wnd 必须添加到 Layout 容器中
    if (!isLayoutContainer(layout)) {
        return undefined;
    }
    return handleWndInstance(app, json, layout);
};

/**
 * 处理 Tab 类型实例
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
const processTabItem = (
    app: AppFacade,
    json: Config.IUILayoutTab,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined
): Tab | undefined => {
    // Tab 必须添加到 Wnd 容器中
    if (!isWndContainer(layout)) {
        return undefined;
    }
    return handleTabInstance(app, json, layout);
};

/**
 * 根据 instance 类型分发处理，返回创建的子元素
 * @同步豁免: UI构建 - 需要同步创建DOM元素
 */
const dispatchInstanceHandler = (
    app: AppFacade,
    json: Config.TUILayoutItem,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined
): Layout | Wnd | Tab | undefined => {
    // Layout 实例（类型守卫收窄为 Config.IUILayoutLayout）
    if (isLayoutItem(json)) {
        return processLayoutItem(json, layout);
    }
    // Wnd 实例（类型守卫收窄为 Config.IUILayoutWnd）
    if (isWndItem(json)) {
        return processWndItem(app, json, layout);
    }
    // Tab 实例（类型守卫收窄为 Config.IUILayoutTab）
    if (isTabItem(json)) {
        return processTabItem(app, json, layout);
    }
    // Model 类型实例（不返回子元素）
    processModelItem(app, json, layout);
    return undefined;
};

/**
 * 处理 children 递归
 * @同步豁免: UI构建 - 需要同步遍历布局树
 */
const processChildren = (
    app: AppFacade,
    json: Config.TUILayoutItem,
    layout: Layout | Wnd | Tab | ILayoutModel | undefined,
    child: Layout | Wnd | Tab | undefined
): void => {
    // 无 children 属性时直接返回
    if (!("children" in json)) {
        return;
    }
    // 数组形式的 children：遍历处理每个子元素
    if (hasArrayChildren(json)) {
        const targetLayout = layout ? child : getSiyuanLayout()?.layout;
        for (const item of json.children) {
            JSONToCenter(app, item, targetLayout);
        }
        return;
    }
    // 对象形式的 children：直接处理（使用安全获取器避免类型收窄问题）
    const objectChildren = getObjectChildrenFromJson(json);
    if (objectChildren) {
        JSONToCenter(app, objectChildren, child);
        return;
    }
    // 空 children 且 child 是 Tab：标记为待移除
    if (isTabInstance(child)) {
        removedTabs.push(child);
    }
};

/**
 * 从JSON恢复中心布局
 * 递归处理布局树，根据instance类型创建对应的UI组件
 * @同步豁免: 遗留代码 - 布局恢复需要同步执行以确保DOM顺序正确
 * @param app - 应用实例
 * @param json - 布局配置JSON
 * @param layout - 父布局容器（首次调用时为undefined）
 */
export const JSONToCenter = (
    app: AppFacade,
    json: Config.TUILayoutItem,
    layout?: Layout | Wnd | Tab | ILayoutModel,
): void => {
    if (shouldRemoveClosedEncryptedTab(json, layout)) {
        return;
    }
    // 分发处理并获取创建的子元素
    const child = dispatchInstanceHandler(app, json, layout);
    // 递归处理子元素
    processChildren(app, json, layout, child);
};

/**
 * 从JSON恢复完整布局
 * 包括中心区域、Dock、Tab激活状态等
 * @同步豁免: 遗留代码 - 布局恢复需要同步执行以确保DOM顺序正确
 * @param app - 应用实例
 * @param isStart - 是否为应用启动时调用
 */
export const JSONToLayout = (app: AppFacade, isStart: boolean): void => {
    const uiLayoutConfig = getUILayoutConfig();
    // 无布局配置时跳过
    if (!uiLayoutConfig?.layout) {
        return;
    }
    // 恢复中心布局
    JSONToCenter(app, uiLayoutConfig.layout, undefined);
    // 恢复Dock布局
    JSONToDock(uiLayoutConfig, app);
    const shouldApply = shouldApplyTabStartup(isStart);
    // 启动时移除未固定的Tab（根据配置，mode 2）
    handleCloseTabsOnStart(isStart, shouldApply);
    // 处理缺失插件的Tab
    handleMissingPluginTabs(app);
    // 处理URL指定的文件打开，或处理空白启动/激活初始Tab
    if (!handleUrlFileOpen(app)) {
        if (!handleTabStartupBlank(app, shouldApply, removedTabs)) {
            activateInitialTabs(removedTabs);
        }
    }
    // 需在 switchTab 后通知布局就绪，否则插件读取到的当前 tab 永远为最后一个。
    afterLayoutReady(app);
    // 保存布局并调整顶栏
    saveLayout();
    collapseEmptyDockLayouts();
    setTimeout(() => {
        setTabPosition();
    }, Constants.TIMEOUT_TRANSITION);
};
