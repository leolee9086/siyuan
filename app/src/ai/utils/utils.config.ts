/** 用途：复用 AI 配置校验与全局读取；使用范围：旧请求控制器适配层；解耦评估：经同层 imports.ts 集中转发，不加载界面。 */
/** 用途：读取当前 providers/模型选择；使用范围：旧 MAGI 请求控制器配置转换；解耦评估：通过同层入口集中读取，避免调用方复制配置解析逻辑。 */
import {getSiyuanConfig} from "./imports";
/** 用途：校验兼容请求契约；使用范围：返回旧控制器前的边界检查；解耦评估：校验规则必须与 AI 类型定义共用，参数注入会产生漂移。 */
import {validateAIConfig} from "./imports";

/**
 * 从思源配置中获取AI配置
 */

const findConfiguredProviderModel = (providers: Config.IProvider[], modelID: string) => {
    for (const provider of providers) {
        if (!provider.enabled) {
            continue;
        }
        const model = provider.models.find(item => item.enabled &&
            (item.id === modelID || item.name === modelID));
        if (model) {
            return {provider, model};
        }
    }
    return {provider: undefined, model: undefined};
};

/** 将新 providers 配置投影为旧流式请求控制器所需的兼容契约。 */
/** @同步豁免: 遗留代码 */
export const getAIConfigFromSiyuan = () => {
    const aiConfig = getSiyuanConfig().ai;
    const configuredModelID = aiConfig.editing?.modelId || aiConfig.agent?.modelId || "";
    const providerAndModel = findConfiguredProviderModel(aiConfig.providers, configuredModelID);
    const provider = providerAndModel.provider || aiConfig.providers.find(item => item.enabled);
    const model = providerAndModel.model || provider?.models.find(item => item.enabled);
    if (!provider || !model || !provider.baseURL) {
        throw new Error("未找到可用 AI 模型，请检查提供商和模型配置");
    }

    const editing = aiConfig.editing;
    const agent = aiConfig.agent;
    return validateAIConfig({
        apiBaseURL: provider.baseURL.trim().replace(/\/+$/, ""),
        apiKey: provider.apiKey || "",
        apiMaxContexts: Math.max(1, editing?.maxHistoryMessages || 7),
        apiMaxTokens: Math.max(0, editing?.maxCompletionTokens ?? agent?.maxCompletionTokens ?? 0),
        apiModel: model.id || model.name,
        apiProvider: provider.protocol || provider.id || "OpenAI",
        apiProxy: "",
        apiTemperature: editing?.temperature ?? agent?.temperature ?? 0.7,
        apiTimeout: Math.max(1, provider.requestTimeout * 1000),
        apiUserAgent: "SiYuan/3.8.0",
    });
};
