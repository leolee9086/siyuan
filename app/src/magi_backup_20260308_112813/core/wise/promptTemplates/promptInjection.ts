/**
 * @fileoverview MockWISE 人格注入工具函数
 * @description 从 mockWise.prompts.ts 拆分，避免单文件超长。
 */

import type { MagiPromptSet, MockWISE实例 } from "../wise.types";

const SEEL_NAME_TO_PROMPT_KEY: Readonly<Record<string, keyof MagiPromptSet>> = {
    "MELCHIOR-01": "melchior",
    "BALTHASAR-02": "balthazar",
    "CASPER-03": "casper",
    "TRINITY-00": "trinity",
};

/** @同步豁免: 纯映射查表，无异步依赖 */
function getPromptInjectionBySeelName(
    seelName: string,
    promptInjections?: MagiPromptSet,
): string | null {
    if (!promptInjections) {
        return null;
    }
    const key = SEEL_NAME_TO_PROMPT_KEY[seelName];
    if (!key) {
        return null;
    }
    const text = promptInjections[key];
    if (!text || !text.trim()) {
        return null;
    }
    return text;
}

/** @同步豁免: 纯字符串拼接，无异步依赖 */
function mergeSystemPrompt(basePrompt: string, injection: string): string {
    return `${basePrompt}

[PERSONA_SEED_INJECTION]
${injection}`;
}

/**
 * 作用：对单个 MockWISE 实例应用人格提示词注入。
 * 意图：不覆盖原始提示词，只追加人格层文本。
 * 调用时机：`initMagi` 创建实例并应用全局配置时调用。
 */
export async function 应用人格提示词注入(
    instance: MockWISE实例,
    promptInjections?: MagiPromptSet,
): Promise<void> {
    const injection = getPromptInjectionBySeelName(instance.config.name, promptInjections);
    if (!injection) {
        return;
    }
    const nextSystemPrompt = mergeSystemPrompt(instance.config.systemPromptForChat, injection);
    instance.updateConfig({ systemPromptForChat: nextSystemPrompt });
}
