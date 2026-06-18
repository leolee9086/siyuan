/** 用途：DOM 守卫能力。使用范围：publish 点击分发目标校验。解耦评估：基础工具依赖，通过内部网关导入降低路径耦合。 */
import { isHTMLElement } from "./imports";

/** 用途：确认弹窗能力。使用范围：publish 删除源动作。解耦评估：基础 UI 依赖，通过内部网关导入降低路径耦合。 */
import { confirmDialog } from "./imports";

/** 用途：消息提示能力。使用范围：publish 保存/测试/发布/删除动作反馈。解耦评估：基础 UI 依赖，通过内部网关导入降低路径耦合。 */
import { showMessage } from "./imports";

/** 用途：读取工作空间接口。使用范围：publish 初始化和刷新。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { getBazaarWorkspaceBundle } from "./imports";

/** 用途：读取安全统计接口。使用范围：publish 初始化和刷新。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { getBazaarSecurityStats } from "./imports";

/** 用途：新增或更新源接口。使用范围：publish 保存源动作。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { upsertBazaarSource } from "./imports";

/** 用途：测试源接口。使用范围：publish 测试源动作。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { testBazaarSource } from "./imports";

/** 用途：移除源接口。使用范围：publish 删除源动作。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { removeBazaarSource } from "./imports";

/** 用途：发布包接口。使用范围：publish 发布动作。解耦评估：同目录 API 依赖，通过网关保持边界清晰。 */
import { publishBazaarPackage } from "./imports";

/** 用途：打开 hub Tab 能力。使用范围：publish 顶部动作与浏览源动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openBazaarHubTab } from "./imports";

/** 用途：打开源 Tab 能力。使用范围：publish 源表格动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openBazaarSourceTab } from "./imports";

/** 用途：打开本地源 Tab 能力。使用范围：publish 顶部动作。解耦评估：同目录业务能力复用，通过网关保持边界清晰。 */
import { openLocalBazaarSourceTab } from "./imports";

/** 用途：Custom Tab 类型定义。使用范围：publish 挂载入口参数。 */
import type { Custom } from "./imports";

/** 用途：工作空间类型定义。使用范围：publish 状态与动作参数。 */
import type { IBazaarWorkspaceBundle } from "./imports";

/** 用途：安全统计类型定义。使用范围：publish 状态。 */
import type { IBazaarSecurityStats } from "./imports";

/** 用途：视图加载态渲染。使用范围：publish 刷新流程。解耦评估：视图职责与控制器解耦，通过同层模块依赖保持边界清晰。 */
import { renderLoading } from "./publishView";

/** 用途：视图主渲染。使用范围：publish 刷新完成后。解耦评估：视图职责与控制器解耦，通过同层模块依赖保持边界清晰。 */
import { renderPublishPage } from "./publishView";

/** 用途：同步保存发布配置。使用范围：save-config 与 publish-package 流程。解耦评估：表单构建细节下沉到 publishForm，控制器只编排流程。 */
import { syncPublishConfigFromForm } from "./publishForm";

/** 用途：重置源表单。使用范围：reset-source 与 save-source 成功后。解耦评估：表单细节下沉到 publishForm，控制器只编排流程。 */
import { resetSourceForm } from "./publishForm";

/** 用途：回填源表单。使用范围：edit-source 动作。解耦评估：表单细节下沉到 publishForm，控制器只编排流程。 */
import { fillSourceForm } from "./publishForm";

/** 用途：读取“启用发布”状态。使用范围：publish-package 前置校验。解耦评估：表单细节下沉到 publishForm，控制器只编排流程。 */
import { readPublishEnabled } from "./publishForm";

/** 用途：读取源表单提交数据。使用范围：save-source 动作。解耦评估：表单细节下沉到 publishForm，控制器只编排流程。 */
import { readSourceFormPayload } from "./publishForm";

/** 用途：错误对象转字符串。意图：统一 catch 分支消息。调用时机：所有异步动作异常分支。问题/改进：后续可扩展错误码映射。 */
const toErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
};

/** 用途：读取 sourceID。意图：统一 data-source-id 提取。调用时机：源相关动作。问题/改进：依赖 data-source-id 属性。 */
const readSourceID = (event: Event) => {
    if (!isHTMLElement(event.target)) {
        return "";
    }
    const sourceElement = event.target.closest("[data-source-id]");
    if (!isHTMLElement(sourceElement)) {
        return "";
    }
    return (sourceElement.getAttribute("data-source-id") || "").trim();
};

/** 用途：按 ID 查找源配置。意图：避免重复遍历 sources。调用时机：编辑/测试/打开源动作。问题/改进：当前线性查找。 */
const findSourceByID = (bundle: IBazaarWorkspaceBundle | null, sourceID: string) => {
    if (!bundle) {
        return null;
    }
    return bundle.workspace.sources.find((item) => item.id === sourceID) || null;
};

/** 用途：全量加载 publish 数据。意图：统一刷新 bundle 与 stats。调用时机：初始化和关键动作后。问题/改进：当前为全量刷新。 */
const loadAll = async (container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    renderLoading(container);
    try {
        const [bundle, stats] = await Promise.all([
            getBazaarWorkspaceBundle(),
            getBazaarSecurityStats(),
        ]);
        state.bundle = bundle;
        state.stats = stats;
        renderPublishPage(container, state);
    } catch (error) {
        showMessage(toErrorMessage(error, "load bazaar publish failed"));
        renderPublishPage(container, state);
    }
};

/** 用途：保存配置动作。意图：封装保存并刷新流程。调用时机：save-config。问题/改进：保存后当前走全量刷新。 */
const handleSaveConfig = async (container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    const saved = await syncPublishConfigFromForm(container, state, true, showMessage);
    if (!saved) {
        return;
    }
    await loadAll(container, state);
};

/** 用途：保存源动作。意图：封装表单读取、保存、提示和刷新。调用时机：save-source。问题/改进：URL 合法性依赖后端校验。 */
const handleSaveSource = async (container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    const payload = readSourceFormPayload(container);
    if (!payload) {
        return;
    }
    await upsertBazaarSource(payload);
    showMessage("集市源已保存");
    resetSourceForm(container);
    await loadAll(container, state);
};

/** 用途：测试源动作。意图：封装查找源与测试接口调用。调用时机：test-source。问题/改进：当前仅展示包数量。 */
const handleTestSource = async (bundle: IBazaarWorkspaceBundle | null, event: Event) => {
    const sourceID = readSourceID(event);
    const source = findSourceByID(bundle, sourceID);
    if (!source) {
        return;
    }
    const count = await testBazaarSource({ sourceID: source.id });
    showMessage(`源测试通过，可访问 ${count} 个包`);
};

/** 用途：打开源 Tab 动作。意图：封装 openInTab 校验和打开参数构造。调用时机：open-source-tab。问题/改进：禁用时仅提示。 */
const handleOpenSourceTab = (bundle: IBazaarWorkspaceBundle | null, model: Custom, event: Event) => {
    const sourceID = readSourceID(event);
    const source = findSourceByID(bundle, sourceID);
    if (!source) {
        return;
    }
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

/** 用途：删除源并刷新。意图：将确认回调内异步流程外提。调用时机：remove-source 确认后。问题/改进：当前无细粒度错误分类。 */
const removeSourceAndReload = async (sourceID: string, container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    await removeBazaarSource(sourceID);
    showMessage("已移除第三方源");
    await loadAll(container, state);
};

/** 用途：发布包并刷新。意图：封装发布前同步、发布执行和按钮状态。调用时机：publish-package。问题/改进：当前发布期间仅禁用当前按钮。 */
const publishPackageAndReload = async (container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }, packageElement: HTMLElement) => {
    const packageType = packageElement.getAttribute("data-package-type") || "";
    const packageName = packageElement.getAttribute("data-package-name") || "";
    if (!packageType || !packageName) {
        return;
    }
    /** 发布动作必须在“启用发布”开关开启后执行，避免误触发后端发布接口。 */
    if (!readPublishEnabled(container)) {
        showMessage("请先启用“启用发布”并保存配置");
        return;
    }

    packageElement.setAttribute("disabled", "disabled");
    try {
        const saved = await syncPublishConfigFromForm(container, state, false, showMessage);
        if (!saved) {
            return;
        }
        const result = await publishBazaarPackage(packageType, packageName);
        if (result.warning) {
            showMessage(result.warning);
        }
        if (!result.warning) {
            showMessage(`已发布 ${packageName} v${result.record.version}`);
        }
        await loadAll(container, state);
    } finally {
        packageElement.removeAttribute("disabled");
    }
};

/** 用途：处理顶部基础动作。意图：分离基础导航动作。调用时机：click 分发优先处理。问题/改进：动作目前固定。 */
const handleSimpleAction = (type: string, model: Custom, container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    /** 处理“刷新发布页”动作 */
    if (type === "refresh-publish") {
        void loadAll(container, state);
        return true;
    }
    /** 处理“打开广场”动作 */
    if (type === "open-hub") {
        void openBazaarHubTab({ app: model.app });
        return true;
    }
    /** 处理“打开本地源页”动作 */
    if (type === "open-local-source-page") {
        void openLocalBazaarSourceTab({ app: model.app });
        return true;
    }
    /** 处理“重置源表单”动作 */
    if (type === "reset-source") {
        resetSourceForm(container);
        return true;
    }
    return false;
};

/** 用途：处理编辑源动作。意图：封装 sourceID 解析与表单回填。调用时机：edit-source。问题/改进：未命中源时静默返回。 */
const handleEditSourceAction = (container: HTMLElement, bundle: IBazaarWorkspaceBundle | null, event: Event) => {
    const sourceID = readSourceID(event);
    const source = findSourceByID(bundle, sourceID);
    if (!source) {
        return;
    }
    fillSourceForm(container, source);
};

/** 用途：处理浏览源包动作。意图：封装 sourceID 校验与跳转广场。调用时机：browse-source。问题/改进：空 sourceID 时静默返回。 */
const handleBrowseSourceAction = (model: Custom, event: Event) => {
    const sourceID = readSourceID(event);
    if (!sourceID) {
        return;
    }
    void openBazaarHubTab({
        app: model.app,
        sourceID,
    });
};

/** 用途：处理移除源动作。意图：封装 sourceID 校验、确认弹窗和删除流程。调用时机：remove-source。问题/改进：当前确认文案固定。 */
const handleRemoveSourceAction = (event: Event, container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    const sourceID = readSourceID(event);
    if (!sourceID) {
        return;
    }
    confirmDialog("⚠️ 移除第三方源", `确认移除源 ${sourceID} 吗？`, () => {
        void removeSourceAndReload(sourceID, container, state).catch((error) => {
            showMessage(toErrorMessage(error, "remove bazaar source failed"));
        });
    });
};

/** 用途：处理 publish 高级动作。意图：拆分点击分发器，控制单函数行数并保持职责清晰。调用时机：基础动作未命中后调用。问题/改进：返回值表示是否命中动作。 */
const handlePublishAdvancedAction = (type: string, event: Event, actionElement: HTMLElement, model: Custom, container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    /** 处理“保存配置”动作 */
    if (type === "save-config") {
        void handleSaveConfig(container, state).catch((error) => {
            showMessage(toErrorMessage(error, "save bazaar publish config failed"));
        });
        return true;
    }
    /** 处理“保存源”动作 */
    if (type === "save-source") {
        void handleSaveSource(container, state).catch((error) => {
            showMessage(toErrorMessage(error, "save bazaar source failed"));
        });
        return true;
    }
    /** 处理“编辑源”动作 */
    if (type === "edit-source") {
        handleEditSourceAction(container, state.bundle, event);
        return true;
    }
    /** 处理“测试源”动作 */
    if (type === "test-source") {
        void handleTestSource(state.bundle, event).catch((error) => {
            showMessage(toErrorMessage(error, "test bazaar source failed"));
        });
        return true;
    }
    /** 处理“打开源 Tab”动作 */
    if (type === "open-source-tab") {
        handleOpenSourceTab(state.bundle, model, event);
        return true;
    }
    /** 处理“浏览源包”动作 */
    if (type === "browse-source") {
        handleBrowseSourceAction(model, event);
        return true;
    }
    /** 处理“移除源”动作 */
    if (type === "remove-source") {
        handleRemoveSourceAction(event, container, state);
        return true;
    }
    /** 处理“发布包”动作 */
    if (type === "publish-package") {
        void publishPackageAndReload(container, state, actionElement).catch((error) => {
            showMessage(toErrorMessage(error, "publish bazaar package failed"));
        });
        return true;
    }
    return false;
};

/** 用途：publish 点击分发器。意图：按 data-type 路由动作处理。调用时机：容器 click 事件。问题/改进：动作增多时可改注册表分发。 */
const handlePublishClick = (event: Event, model: Custom, container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    if (!isHTMLElement(event.target)) {
        return;
    }
    const actionElement = event.target.closest("[data-type]");
    if (!isHTMLElement(actionElement)) {
        return;
    }

    const type = actionElement.getAttribute("data-type") || "";
    if (!type) {
        return;
    }
    if (handleSimpleAction(type, model, container, state)) {
        return;
    }
    handlePublishAdvancedAction(type, event, actionElement, model, container, state);
};

/** 用途：挂载 publish 页面逻辑。意图：初始化状态、绑定事件并触发首次加载。调用时机：根 initPublish 入口。问题/改进：当前状态对象为局部内存态。 */
/** 导出 mountBazaarPublish 供根 initPublish 入口调用 */
/** @同步豁免: UI构建 */
export const mountBazaarPublish = (model: Custom) => {
    const container = model.element;
    container.classList.add("bazaar-publish");

    const state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null } = {
        bundle: null,
        stats: null,
    };

    container.addEventListener("click", (event) => {
        handlePublishClick(event, model, container, state);
    });

    void loadAll(container, state);
};
