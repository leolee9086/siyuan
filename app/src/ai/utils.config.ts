import { AIConfig, validateAIConfig } from "./types";

/**
 * 从思源配置中获取AI配置
 */

export const getAIConfigFromSiyuan = (): AIConfig => {
    const siyuanConfig = window.siyuan?.config?.ai?.openAI;
    if (!siyuanConfig) {
        throw new Error("未找到思源AI配置，请检查配置文件");
    }

    // 思源配置中的超时时间是秒，需要转换为毫秒
    const configWithConvertedTimeout = {
        ...siyuanConfig,
        apiTimeout: siyuanConfig.apiTimeout * 1000
    };

    return validateAIConfig(configWithConvertedTimeout);
};
