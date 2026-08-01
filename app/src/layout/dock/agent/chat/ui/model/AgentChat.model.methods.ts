import type {AgentChatRuntime} from "./imports";
import {getUsableModelSignature} from "./AgentChat.modelSignature";
import {escapeHtml} from "./imports";
import {getAgentChatLanguages} from "./imports";
import {requireSiyuanConfig} from "./imports";

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
export function refreshModelOptions(runtime: AgentChatRuntime) {
    const aiConfig = requireSiyuanConfig().ai;
    const newOptions = buildModelOptions(aiConfig);
    runtime.modelOptions = newOptions;
    runtime.modelOptionsSignature = getUsableModelSignature(aiConfig);
    const stillValid = runtime.selectedModel && newOptions.some((option) => option.id === runtime.selectedModel);
    if (!stillValid) {
        runtime.selectedModel = newOptions[0]?.id || "";
    }
    updateModelLabel(runtime);
    runtime.sessionPorts.presentation.updateSendButton(runtime);
}

/** 重建模型下拉框的选项与选择状态。 */
export function updateModelLabel(runtime: AgentChatRuntime) {
    let html = "";
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
export function getSelectedModel(runtime: AgentChatRuntime) {
    return runtime.selectedModel;
}

/** 初始化推理强度选项并同步选择变化。 */
export function initReasoningEffortSelect(runtime: AgentChatRuntime) {
    const languages = getAgentChatLanguages();
    const options: Array<{ value: string; label: string }> = [
        {value: "", label: languages.reasoningEffortDefault || "Default"},
        {value: "low", label: languages.reasoningEffortLow || "Low"},
        {value: "medium", label: languages.reasoningEffortMedium || "Medium"},
        {value: "high", label: languages.reasoningEffortHigh || "High"},
    ];
    runtime.reasoningEffortSelect.innerHTML = options
        .map((option) => '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + "</option>")
        .join("");
    runtime.reasoningEffortSelect.value = runtime.selectedReasoningEffort;
    runtime.reasoningEffortSelect.addEventListener("change", () => {
        runtime.selectedReasoningEffort = runtime.reasoningEffortSelect.value;
    });
}

/** 应用仍存在于当前配置的会话模型。 */
export function applySessionModelIfValid(runtime: AgentChatRuntime, modelID?: string) {
    if (modelID && runtime.modelOptions.some((option) => option.id === modelID)) {
        runtime.selectedModel = modelID;
    }
    updateModelLabel(runtime);
}
