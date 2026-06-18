/** 用途：保存发布配置接口。使用范围：publish 表单保存与发布前同步。解耦评估：同目录 API 依赖，通过内部网关导入保持边界清晰。 */
import { setBazaarPublishConfig } from "./imports";

/** 用途：工作空间类型定义。使用范围：publish 表单构建与回写。 */
import type { IBazaarWorkspaceBundle } from "./imports";

/** 用途：安全统计类型定义。使用范围：sync 函数状态参数签名。 */
import type { IBazaarSecurityStats } from "./imports";

/** 用途：安全解析数字输入。意图：避免 NaN 进入配置。调用时机：构建保存 payload。问题/改进：当前仅做 NaN 兜底。 */
const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    return parsed;
};

/** 用途：查询 input 节点。意图：统一查询与类型校验。调用时机：读取发布和源表单。问题/改进：返回 null 由调用方保护。 */
const queryInput = (container: HTMLElement, selector: string) => {
    const element = container.querySelector(selector);
    if (element instanceof HTMLInputElement) {
        return element;
    }
    return null;
};

/** 用途：查询 select 节点。意图：统一查询与类型校验。调用时机：读取默认源下拉。问题/改进：返回 null 由调用方保护。 */
const querySelect = (container: HTMLElement, selector: string) => {
    const element = container.querySelector(selector);
    if (element instanceof HTMLSelectElement) {
        return element;
    }
    return null;
};

/** 用途：读取源表单节点集。意图：减少动作流程重复查询。调用时机：保存/清空/回填源表单。问题/改进：字段新增时需同步。 */
const readSourceForm = (container: HTMLElement) => {
    const idInput = queryInput(container, "#bazaarSourceID");
    const nameInput = queryInput(container, "#bazaarSourceName");
    const urlInput = queryInput(container, "#bazaarSourceURL");
    const tokenInput = queryInput(container, "#bazaarSourceToken");
    const enabledInput = queryInput(container, "#bazaarSourceEnabled");
    const allowInstallInput = queryInput(container, "#bazaarSourceAllowInstall");
    const openInTabInput = queryInput(container, "#bazaarSourceOpenInTab");
    if (!idInput || !nameInput || !urlInput || !tokenInput || !enabledInput || !allowInstallInput || !openInTabInput) {
        return null;
    }
    return { idInput, nameInput, urlInput, tokenInput, enabledInput, allowInstallInput, openInTabInput };
};

/** 用途：构建保存配置 payload。意图：统一读取 publish/security/hub 三组表单。调用时机：保存配置和发布前同步。问题/改进：当前直接读 DOM。 */
const buildPublishPayloadFromForm = (container: HTMLElement, bundle: IBazaarWorkspaceBundle) => {
    const publishEnabled = queryInput(container, "#bazaarPublishEnabled")?.checked || false;
    const requireAuth = queryInput(container, "#bazaarPublishRequireAuth")?.checked || false;
    const minExpose = queryInput(container, "#bazaarPublishMinExpose")?.checked || false;
    const allowCollision = queryInput(container, "#bazaarPublishAllowCollision")?.checked || false;
    const authToken = queryInput(container, "#bazaarPublishAuthToken")?.value || "";

    const enableRateLimit = queryInput(container, "#bazaarSecurityEnableRateLimit")?.checked || false;
    const requestsPerMinute = parseNumber(queryInput(container, "#bazaarSecurityRPM")?.value || "", 120);
    const burst = parseNumber(queryInput(container, "#bazaarSecurityBurst")?.value || "", 30);
    const windowSeconds = parseNumber(queryInput(container, "#bazaarSecurityWindowSeconds")?.value || "", 60);

    const showOfficial = queryInput(container, "#bazaarHubShowOfficial")?.checked || false;
    const defaultSourceID = querySelect(container, "#bazaarHubDefaultSource")?.value || "";

    return {
        publish: {
            ...bundle.workspace.publish,
            enabled: publishEnabled,
            requireAuth,
            minExpose,
            allowOfficialNameCollision: allowCollision,
            authToken,
        },
        security: {
            ...bundle.workspace.security,
            enableRateLimit,
            requestsPerMinute,
            burst,
            windowSeconds,
        },
        hub: {
            ...bundle.workspace.hub,
            showOfficial,
            defaultSourceID,
        },
    };
};

/** 用途：同步保存发布配置并回写状态。意图：复用保存逻辑给保存按钮和发布前同步。调用时机：publish 控制器动作流程。问题/改进：当前只回写 workspace。 */
/** 导出 syncPublishConfigFromForm 供 publish 控制器复用 */
export const syncPublishConfigFromForm = async (container: HTMLElement, state: {
    bundle: IBazaarWorkspaceBundle | null;
    stats: IBazaarSecurityStats | null;
}, showSavedMessage: boolean, showMessage: (message: string) => void) => {
    if (!state.bundle) {
        return false;
    }
    const payload = buildPublishPayloadFromForm(container, state.bundle);
    const workspace = await setBazaarPublishConfig(payload);
    state.bundle = { ...state.bundle, workspace };
    if (showSavedMessage) {
        showMessage("发布配置已保存");
    }
    return true;
};

/** 用途：重置源表单。意图：统一清空和默认勾选状态。调用时机：保存源后与点击清空时。问题/改进：默认值目前固定。 */
/** 导出 resetSourceForm 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const resetSourceForm = (container: HTMLElement) => {
    const form = readSourceForm(container);
    if (!form) {
        return;
    }
    form.idInput.value = "";
    form.nameInput.value = "";
    form.urlInput.value = "";
    form.tokenInput.value = "";
    form.enabledInput.checked = true;
    form.allowInstallInput.checked = true;
    form.openInTabInput.checked = true;
};

/** 用途：回填源表单。意图：编辑源时填入已有配置。调用时机：edit-source 动作。问题/改进：会覆盖未保存输入。 */
/** 导出 fillSourceForm 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const fillSourceForm = (container: HTMLElement, source: Config.IBazaarSource) => {
    const form = readSourceForm(container);
    if (!form) {
        return;
    }
    form.idInput.value = source.id;
    form.nameInput.value = source.name || "";
    form.urlInput.value = source.url || "";
    form.tokenInput.value = source.token || "";
    form.enabledInput.checked = !!source.enabled;
    form.allowInstallInput.checked = !!source.allowInstall;
    form.openInTabInput.checked = !!source.openInTab;
};

/** 用途：读取“启用发布”勾选状态。意图：发布动作前做开关校验。调用时机：publish-package 动作。问题/改进：当前直接读 DOM。 */
/** 导出 readPublishEnabled 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const readPublishEnabled = (container: HTMLElement) => {
    return queryInput(container, "#bazaarPublishEnabled")?.checked || false;
};

/** 用途：读取源表单提交数据。意图：保存源动作统一收口表单解析。调用时机：save-source 动作。问题/改进：若节点缺失返回 null 交由控制器处理。 */
/** 导出 readSourceFormPayload 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const readSourceFormPayload = (container: HTMLElement) => {
    const form = readSourceForm(container);
    if (!form) {
        return null;
    }
    return {
        id: form.idInput.value.trim(),
        name: form.nameInput.value.trim(),
        url: form.urlInput.value.trim(),
        token: form.tokenInput.value.trim(),
        enabled: form.enabledInput.checked,
        allowInstall: form.allowInstallInput.checked,
        openInTab: form.openInTabInput.checked,
    };
};
