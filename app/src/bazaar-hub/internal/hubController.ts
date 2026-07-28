/** 用途：消息提示能力。使用范围：hub 加载与安装流程。解耦评估：基础 UI 依赖，通过内部网关导入降低路径耦合。 */
import { showMessage } from "./imports";

/** 用途：设置面板打开能力。使用范围：hub 官方设置入口。解耦评估：应用级能力，通过内部网关导入降低路径耦合。 */

/** 用途：平台标识读取能力。使用范围：hub 安装参数 frontend。解耦评估：公共工具依赖，通过内部网关导入降低路径耦合。 */
import { getFrontend } from "./imports";

/** 用途：安全配置读取能力。使用范围：hub 安装参数 mode。解耦评估：环境层依赖，通过内部网关导入降低路径耦合。 */
import { getSafeSiyuanConfig } from "./imports";

/** 用途：读取工作空间接口。使用范围：hub 刷新流程。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { getBazaarWorkspaceBundle } from "./imports";

/** 用途：读取源包索引接口。使用范围：hub 包列表加载。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { getBazaarSourcePackages } from "./imports";

/** 用途：安装包接口。使用范围：hub 安装动作。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { installBazaarPackageFromSource } from "./imports";

/** 用途：hub 外部切源事件名。使用范围：hub 容器事件监听。解耦评估：常量依赖，通过网关统一转发可降低耦合。 */
import { BAZAAR_HUB_SET_SOURCE_EVENT } from "./imports";

/** 用途：打开发布设置能力。使用范围：hub 工具栏动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openBazaarPublishTab } from "./imports";

/** 用途：打开源 Tab 能力。使用范围：hub 源列表与包卡片动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openBazaarSourceTab } from "./imports";

/** 用途：打开本地源 Tab 能力。使用范围：hub 工具栏动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openLocalBazaarSourceTab } from "./imports";

/** 用途：Custom Tab 类型定义。使用范围：hub 初始化入口参数。 */
import type {CustomDomain} from "./imports";

/** 用途：包索引类型定义。使用范围：hub 状态约束。 */
import type { IBazaarPublishedIndex } from "./imports";

/** 用途：工作空间类型定义。使用范围：hub 状态约束。 */
import type { IBazaarWorkspaceBundle } from "./imports";

/** 用途：读取字符串字段工具。使用范围：hub 初始化读取 model.data。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { readStringField } from "./hubView";

/** 用途：读取点击事件 sourceID。使用范围：hub 动作处理。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { readSourceIDFromEvent } from "./hubView";

/** 用途：读取 hub 事件 sourceID。使用范围：hub 外部切源监听。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { readSourceIDFromHubEvent } from "./hubView";

/** 用途：按 ID 查找源配置。使用范围：hub 渲染与动作。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { findSourceByID } from "./hubView";

/** 用途：默认源选择策略。使用范围：hub 刷新后重选 sourceID。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { pickDefaultSource } from "./hubView";

/** 用途：渲染 hub 页面骨架。使用范围：hub 初始化。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { renderHubLayout } from "./hubView";

/** 用途：查询必需 DOM 元素。使用范围：hub 初始化。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { queryRequiredElement } from "./hubView";

/** 用途：查询搜索输入框。使用范围：hub 绑定 input 事件。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { querySearchInput } from "./hubView";

/** 用途：渲染摘要区域。使用范围：hub 刷新与切源。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { renderSummary } from "./hubView";

/** 用途：渲染源列表。使用范围：hub 刷新与切源。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { renderSourceList } from "./hubView";

/** 用途：渲染空态消息。使用范围：hub 包列表加载态和错误态。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { setPackageMessage } from "./hubView";

/** 用途：渲染包列表。使用范围：hub 包索引加载和搜索过滤。解耦评估：同目录视图工具依赖，直接同层导入边界清晰。 */
import { renderPackageList } from "./hubView";

/** 用途：按源配置打开源 Tab。意图：统一 openInTab 校验。调用时机：源列表与包卡片动作。问题/改进：提示文案当前固定中文。 */
const openSourceTabBySource = (model: CustomDomain, source: Config.IBazaarSource) => {
    if (!source.openInTab) {
        showMessage("该源已禁止在 Tab 中打开");
        return;
    }
    void openBazaarSourceTab({
        app: model.app,
        source: {
            id: source.id,
            name: source.name,
            url: source.url,
            openInTab: source.openInTab,
        },
    });
};

/** 用途：按 sourceID 打开源 Tab。意图：封装 sourceID 回退和查找逻辑。调用时机：open-source-tab 动作。问题/改进：未命中源时静默返回。 */
const openSourceTabByID = (model: CustomDomain, state: { bundle: IBazaarWorkspaceBundle | null; sourceID: string }, sourceID: string) => {
    const finalSourceID = sourceID || state.sourceID;
    const source = findSourceByID(state.bundle, finalSourceID);
    if (!source) {
        return;
    }
    openSourceTabBySource(model, source);
};

/** 用途：定位安装动作按钮。意图：集中目标节点合法性校验。调用时机：install-package 动作分发。问题/改进：仅支持 data-type 节点链路。 */
const getInstallActionElement = (target: HTMLElement) => {
    const element = target.closest('[data-type="install-package"]');
    if (element instanceof HTMLElement) {
        return element;
    }
    return null;
};

/** 用途：执行安装动作。意图：封装安装接口调用与按钮禁用状态。调用时机：点击安装按钮后。问题/改进：成功后仅提示消息，不做增量刷新。 */
const installPackageFromAction = async (actionElement: HTMLElement) => {
    const sourceID = actionElement.getAttribute("data-source-id") || "";
    const packageType = actionElement.getAttribute("data-package-type") || "";
    const packageName = actionElement.getAttribute("data-package-name") || "";
    const version = actionElement.getAttribute("data-version") || "";
    if (!sourceID || !packageType || !packageName) {
        return;
    }

    actionElement.setAttribute("disabled", "disabled");
    try {
        const mode = getSafeSiyuanConfig()?.appearance?.mode || 0;
        await installBazaarPackageFromSource({
            sourceID,
            packageType,
            packageName,
            version,
            mode,
            frontend: getFrontend(),
        });
        showMessage(`已安装 ${packageName}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : "install bazaar package failed";
        showMessage(message);
    } finally {
        actionElement.removeAttribute("disabled");
    }
};

/** 用途：加载当前源包索引。意图：统一源校验、加载和错误提示流程。调用时机：刷新工作空间和切源后。问题/改进：失败后保留错误提示。 */
const loadSourcePackages = async (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, packageListElement: HTMLElement) => {
    const source = findSourceByID(state.bundle, state.sourceID);
    if (!source) {
        state.packageIndex = null;
        renderPackageList(state, packageListElement);
        return;
    }
    if (!source.enabled) {
        state.packageIndex = { updatedAt: Date.now(), packages: [] };
        renderPackageList(state, packageListElement);
        setPackageMessage(packageListElement, "当前源已禁用。");
        return;
    }

    setPackageMessage(packageListElement, "正在读取源包索引...");
    try {
        state.packageIndex = await getBazaarSourcePackages(source.id);
        renderPackageList(state, packageListElement);
    } catch (error) {
        state.packageIndex = null;
        const message = error instanceof Error ? error.message : "load source packages failed";
        setPackageMessage(packageListElement, `读取失败：${message}`);
    }
};

/** 用途：刷新工作空间。意图：串联拉取 bundle、重选默认源和重渲染。调用时机：初始化与刷新动作。问题/改进：当前为全量刷新流程。 */
const refreshWorkspace = async (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, elements: { sourceListElement: HTMLElement; summaryElement: HTMLElement; packageListElement: HTMLElement }) => {
    try {
        state.bundle = await getBazaarWorkspaceBundle();
        state.sourceID = pickDefaultSource(state.bundle, state.sourceID);
        renderSourceList(state, elements.sourceListElement);
        renderSummary(state, elements.summaryElement);
        await loadSourcePackages(state, elements.packageListElement);
    } catch (error) {
        const message = error instanceof Error ? error.message : "load bazaar hub failed";
        showMessage(message);
        renderSourceList(state, elements.sourceListElement);
        renderSummary(state, elements.summaryElement);
        setPackageMessage(elements.packageListElement, "集市广场加载失败。");
    }
};

/** 用途：处理基础导航动作。意图：通过动作表减少分发器复杂度。调用时机：click 分发时优先执行。问题/改进：动作表当前为静态配置。 */
const handleSimpleAction = (type: string, model: CustomDomain, state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, elements: { sourceListElement: HTMLElement; summaryElement: HTMLElement; packageListElement: HTMLElement }) => {
    /** 处理“打开发布设置”动作 */
    if (type === "open-publish") {
        void openBazaarPublishTab({ app: model.app });
        return true;
    }
    /** 处理“打开本地源”动作 */
    if (type === "open-local-source-page") {
        void openLocalBazaarSourceTab({ app: model.app });
        return true;
    }
    /** 处理“打开官方设置”动作 */
    if (type === "open-official-config") {
        const dialog = model.app.openSettings();
        const bazaarTab = dialog?.element.querySelector('.b3-tab-bar [data-name="bazaar"]');
        bazaarTab?.dispatchEvent(new CustomEvent("click"));
        return true;
    }
    /** 处理“刷新广场”动作 */
    if (type === "refresh-hub") {
        void refreshWorkspace(state, elements);
        return true;
    }
    return false;
};

/** 用途：处理源切换动作。意图：更新 sourceID 并刷新列表与摘要。调用时机：select-source 动作。问题/改进：当前切换后立即加载索引。 */
const handleSelectSource = (event: Event, state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, elements: { sourceListElement: HTMLElement; summaryElement: HTMLElement; packageListElement: HTMLElement }) => {
    const nextSourceID = readSourceIDFromEvent(event);
    if (!nextSourceID || nextSourceID === state.sourceID) {
        return;
    }
    state.sourceID = nextSourceID;
    renderSourceList(state, elements.sourceListElement);
    renderSummary(state, elements.summaryElement);
    void loadSourcePackages(state, elements.packageListElement);
};

/** 用途：处理打开源动作。意图：统一解析 sourceID 并打开对应源页签。调用时机：open-source-tab 动作。问题/改进：未命中 source 时静默返回。 */
const handleOpenSourceTabAction = (event: Event, model: CustomDomain, state: { bundle: IBazaarWorkspaceBundle | null; sourceID: string }) => {
    const sourceID = readSourceIDFromEvent(event);
    openSourceTabByID(model, state, sourceID);
};

/** 用途：处理安装动作。意图：定位安装按钮并触发异步安装流程。调用时机：install-package 动作。问题/改进：当前仅禁用当前按钮。 */
const handleInstallAction = (event: Event) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const actionElement = getInstallActionElement(event.target);
    if (!actionElement) {
        return;
    }
    void installPackageFromAction(actionElement);
};

/** 用途：Hub 点击分发器。意图：按 data-type 路由到对应动作处理。调用时机：容器 click 事件。问题/改进：动作集合后续可抽到独立注册表。 */
const handleHubClick = (event: Event, model: CustomDomain, state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, elements: { sourceListElement: HTMLElement; summaryElement: HTMLElement; packageListElement: HTMLElement }) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const actionElement = event.target.closest("[data-type]");
    if (!(actionElement instanceof HTMLElement)) {
        return;
    }

    const type = actionElement.getAttribute("data-type") || "";
    if (!type) {
        return;
    }
    if (handleSimpleAction(type, model, state, elements)) {
        return;
    }

    /** 处理“切换源”动作 */
    if (type === "select-source") {
        handleSelectSource(event, state, elements);
        return;
    }
    /** 处理“打开源 Tab”动作 */
    if (type === "open-source-tab") {
        handleOpenSourceTabAction(event, model, state);
        return;
    }
    /** 处理“安装包”动作 */
    if (type === "install-package") {
        handleInstallAction(event);
    }
};

/** 用途：处理搜索输入。意图：更新关键字并重渲染包列表。调用时机：input 事件。问题/改进：当前未做节流。 */
const handleHubSearchInput = (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, packageListElement: HTMLElement, searchInput: HTMLInputElement) => {
    state.keyword = searchInput.value;
    renderPackageList(state, packageListElement);
};

/** 用途：处理外部切源事件。意图：支持已打开 hub 按 sourceID 切换源。调用时机：hub set-source 事件。问题/改进：当前仅支持 sourceID 字段。 */
const handleSetSourceEvent = (event: Event, state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, elements: { sourceListElement: HTMLElement; summaryElement: HTMLElement; packageListElement: HTMLElement }) => {
    const nextSourceID = readSourceIDFromHubEvent(event);
    if (!nextSourceID || nextSourceID === state.sourceID) {
        return;
    }
    state.sourceID = nextSourceID;
    renderSourceList(state, elements.sourceListElement);
    renderSummary(state, elements.summaryElement);
    void loadSourcePackages(state, elements.packageListElement);
};

/** 用途：挂载 hub 页面逻辑。意图：初始化状态、绑定事件并触发首次刷新。调用时机：根 initHub 入口。问题/改进：状态当前以局部对象维护。 */
/** 导出 mountBazaarHub 供根 initHub 入口调用 */
/** @同步豁免: UI构建 */
export const mountBazaarHub = (model: CustomDomain) => {
    const container = model.element;
    container.classList.add("bazaar-hub");
    renderHubLayout(container);

    const state: {
        bundle: IBazaarWorkspaceBundle | null;
        sourceID: string;
        packageIndex: IBazaarPublishedIndex | null;
        keyword: string;
    } = {
        bundle: null,
        sourceID: readStringField(model.data, "sourceID"),
        packageIndex: null,
        keyword: "",
    };

    const elements = {
        sourceListElement: queryRequiredElement(container, ".bazaar-hub__source-list"),
        summaryElement: queryRequiredElement(container, ".bazaar-hub__summary"),
        packageListElement: queryRequiredElement(container, ".bazaar-hub__package-list"),
    };

    container.addEventListener("click", (event) => {
        handleHubClick(event, model, state, elements);
    });

    const searchInput = querySearchInput(container);
    searchInput?.addEventListener("input", () => {
        handleHubSearchInput(state, elements.packageListElement, searchInput);
    });

    container.addEventListener(BAZAAR_HUB_SET_SOURCE_EVENT, (event) => {
        handleSetSourceEvent(event, state, elements);
    });

    void refreshWorkspace(state, elements);
};
