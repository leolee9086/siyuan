/** 用途：定义运行时模型选择与推理强度操作所需的类型；使用范围：模型选项刷新、推理强度初始化。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：计算可用模型签名以检测配置变化；使用范围：模型选项刷新；解耦评估：签名计算为纯函数，保持模块内引用即可。 */
import {getUsableModelSignature} from "./AgentChat.modelSignature";
/** 用途：转义插入 HTML 的用户输入；使用范围：模型与推理强度选项渲染；解耦评估：HTML 转义为通用工具，保留共享工具引用。 */
import {escapeHtml} from "./imports";
/** 用途：读取当前界面语言资源；使用范围：推理强度标签与模型占位文案；解耦评估：语言资源由全局环境提供，难以注入。 */
import {getAgentChatLanguages} from "./imports";
/** 用途：读取当前 AI 配置；使用范围：模型选项构建；解耦评估：配置来自全局环境，难以注入。 */
import {requireSiyuanConfig} from "./imports";

/** 推理强度选项值列表的序列化形式，标签在初始化时结合当前语言资源生成。 */
const REASONING_EFFORT_VALUES = "|low|medium|high|max|ultra";

/** 统计展示名和模型 ID 冲突，用于决定选项是否附带供应商。 */
const collectModelCollisions = (aiConfig: Config.IAI) => {
    const modelProviders = new Map<string, Set<string>>();
    const modelIDs = new Map<string, number>();
    for (const provider of aiConfig.providers || []) {
        if (!provider.enabled) {
            continue;
        }
        for (const model of provider.models) {
            const displayName = model.displayName || model.name;
            if (!model.enabled || !displayName) {
                continue;
            }
            const modelID = model.id || model.name;
            const providers = modelProviders.get(displayName) || new Set<string>();
            providers.add(provider.id);
            modelProviders.set(displayName, providers);
            modelIDs.set(modelID, (modelIDs.get(modelID) || 0) + 1);
        }
    }
    return {modelProviders, modelIDs};
};

/** 构建并排序当前配置中可选的模型条目。 */
const buildModelOptions = (aiConfig: Config.IAI) => {
    const {modelProviders, modelIDs} = collectModelCollisions(aiConfig);
    const entries: Array<{ id: string; name: string; providerName: string; modelDisplayName: string }> = [];
    for (const provider of aiConfig.providers || []) {
        if (!provider.enabled || !provider.apiKey) {
            continue;
        }
        const providerName = provider.displayName || provider.baseURL;
        for (const model of provider.models) {
            const displayName = model.displayName || model.name;
            if (!model.enabled || !displayName) {
                continue;
            }
            const modelID = model.id || model.name;
            const duplicated = (modelProviders.get(displayName)?.size || 0) > 1 || (modelIDs.get(modelID) || 0) > 1;
            entries.push({
                id: duplicated ? `${provider.id}:${modelID}` : modelID,
                name: duplicated ? `${displayName}（${providerName}）` : displayName,
                providerName,
                modelDisplayName: displayName,
            });
        }
    }
    entries.sort((left, right) => left.providerName.localeCompare(right.providerName) ||
        left.modelDisplayName.localeCompare(right.modelDisplayName));
    return entries.map(({id, name}) => ({id, name}));
};

/** 从当前 AI 配置重建可用模型列表。 */
/** @同步豁免: UI构建 */
export function refreshModelOptions(runtime: AgentChatRuntime) {
    const aiConfig = requireSiyuanConfig().ai;
    const newOptions = buildModelOptions(aiConfig);
    runtime.modelOptions = newOptions;
    runtime.modelOptionsSignature = getUsableModelSignature(aiConfig);
    const stillValid = runtime.selectedModel && newOptions.some((option) => option.id === runtime.selectedModel);
    if (!stillValid) {
        const firstOption = newOptions[0];
        const fallbackModel = firstOption ? firstOption.id : "";
        runtime.selectedModel = fallbackModel;
    }
    updateModelLabel(runtime);
    runtime.sessionPorts.presentation.updateSendButton(runtime);
}

/** 重建模型下拉框的选项与选择状态。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export function updateModelLabel(runtime: AgentChatRuntime) {
    let html = "";
    // 未配置可用模型时显示占位选项并禁用下拉框，避免用户选择空模型。
    if (runtime.modelOptions.length === 0) {
        const placeholder = getAgentChatLanguages().noModelConfigured || "No model configured";
        html = '<option value="" selected>' + escapeHtml(placeholder) + "</option>";
        runtime.modelSelect.innerHTML = html;
        runtime.modelSelect.disabled = true;
        return;
    }
    runtime.modelSelect.disabled = false;
    for (const option of runtime.modelOptions) {
        html += '<option value="' + escapeHtml(option.id) + '">' + escapeHtml(option.name) + "</option>";
    }
    runtime.modelSelect.innerHTML = html;
    runtime.modelSelect.value = runtime.selectedModel;
}

/** 读取当前模型选择。 */
/** @同步豁免: 类型守卫 */
export function getSelectedModel(runtime: AgentChatRuntime) {
    return runtime.selectedModel;
}

/** 初始化推理强度选项并同步选择变化。 */
/** @同步豁免: UI构建 */
export function initReasoningEffortSelect(runtime: AgentChatRuntime) {
    const languages = getAgentChatLanguages();
    const labels: Record<string, string> = {
        "": languages.reasoningEffortDefault || "Default",
        low: languages.reasoningEffortLow || "Low",
        medium: languages.reasoningEffortMedium || "Medium",
        high: languages.reasoningEffortHigh || "High",
        max: languages.reasoningEffortMax || "Max",
        ultra: languages.reasoningEffortUltra || "Ultra",
    };
    const optionValues = REASONING_EFFORT_VALUES.split("|");
    const options: Array<{ value: string; label: string }> =
        optionValues.map((value) => ({value, label: labels[value] || value}));
    runtime.reasoningEffortSelect.innerHTML = options
        .map((option) => '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + "</option>")
        .join("");
    runtime.reasoningEffortSelect.value = runtime.selectedReasoningEffort;
    runtime.reasoningEffortSelect.addEventListener("change", () => {
        runtime.selectedReasoningEffort = runtime.reasoningEffortSelect.value;
    });
}

/** 应用仍存在于当前配置的会话模型。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export function applySessionModelIfValid(runtime: AgentChatRuntime, modelID?: string) {
    // 仅当会话记录的模型仍出现在当前可用选项中时才恢复选择，避免选中已失效模型。
    if (modelID && runtime.modelOptions.some((option) => option.id === modelID)) {
        runtime.selectedModel = modelID;
    }
    updateModelLabel(runtime);
}
