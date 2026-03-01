/**
 * @fileoverview MockWISE 四贤人子类工厂函数及 initMagi 入口
 * @description 基于 创建MockWISE实例 构建 Melchior/Balthazar/Casper/Trinity 实例。
 * 子类与核心工厂函数分离，以满足300行限制。
 * Trinity 的 reply 逻辑（动态提示词注入）提取到模块顶层函数 创建Trinity回复函数。
 * 提示词构建函数已移至 mockWise.prompts.ts。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/mockWise.subclass

import { 创建MockWISE实例 } from "./mockWise";
import { 构建Balthazar提示词, 构建Casper提示词, 构建Trinity提示词 } from "./mockWise.prompts";
import type { MockWISE实例, ReplyOptions, InitMagiOptions } from "./wise.types";
import { MELCHIOR特征集 } from "../dummySys/rei";
import * as MELCHIOR提示词模板集 from "./promptTemplates/Melchior";



// ────────────────────────────────────────────────────────────────────────────
// Trinity 辅助函数（模块顶层，不在工厂函数内部定义命名函数）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 将其他SEEL响应映射为标签化文本
 *
 * 作用：将 MELCHIOR/BALTHASAR/其他贤人的响应内容格式化为可读的多行文本
 * 意图：Trinity 需要参考其他贤人的意见，需要将不同角色的响应区分展示
 * 调用时机：仅在 创建Trinity回复函数 生成的 reply 函数内调用
 */
const 格式化其他SEEL响应 = (otherResponses: Array<{ seel: string; content: string }>): string =>
    // @内联回调
    otherResponses.map((r) => {
        const type = r.seel.includes("MELCHIOR") ? "纯理性分析"
            : r.seel.includes("BALTHASAR") ? "情感考虑"
                : "直觉反应";
        return `${type}：${r.content}`;
    }).join("\n\n");

/**
 * 创建Trinity回复函数
 *
 * 作用：生成具有动态提示词注入能力的 reply 函数，用于替换基础实例的 reply
 * 意图：Trinity 需要参考其他 SEEL 的响应来调整提示词，此逻辑必须每次 reply 动态执行。
 *   提取为顶层函数以避免「禁止在函数内部定义命名函数」lint 规则
 * 调用时机：仅在 创建MockTrinity实例 内调用一次
 *
 * @param 基础实例 - 已创建的 MockWISE 基础实例
 */
const 创建Trinity回复函数 = (基础实例: MockWISE实例) =>
    async (
        userInput: string,
        options: ReplyOptions = {}
    ): Promise<string | AsyncGenerator<string>> => {
        const 原始提示词 = 基础实例.config.systemPromptForChat;
        const otherResponses = options?.context?.responses ?? [];
        const Casper响应 = otherResponses.find((r) => r.seel === "CASPER-03")?.content;
        const 响应映射 = 格式化其他SEEL响应(otherResponses);

        const 动态提示词 = `我刚才思考了一下这个问题...
${otherResponses.length > 0 ? `\n${响应映射}\n\n${原始提示词}\n` : ""}
记住：用自然的方式表达，绝对禁止暴露MAGI结构。${Casper响应 ? `我的第一反应接近:${Casper响应}` : ""}`;

        基础实例.updateConfig({ systemPromptForChat: 动态提示词 });
        try {
            // SSE 模式使用流式响应，否则使用普通 reply
            if (基础实例.config.responseType === "sse") {
                return 基础实例.streamResponse(userInput, 动态提示词);
            }
            return 基础实例.reply(userInput);
        } finally {
            基础实例.updateConfig({ systemPromptForChat: 原始提示词 });
        }
    };

// ────────────────────────────────────────────────────────────────────────────
// 四贤人子类工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建 MockMelchior 实例
 *
 * 作用：构建 MELCHIOR-01，超我——逻辑分析型认知控制单元
 * 意图：使用 DeepSeek-V3（低温度0.3），在创建后异步加载完整的 MELCHIOR 提示词模板
 * 调用时机：由 initMagi 或直接测试调用
 *
 * @param customName - 自定义人格名称（默认 "rei"）
 * @param customPrompt - 自定义系统提示词（不传则异步加载提示词模板）
 */
export const 创建MockMelchior实例 = async (
    customName: string | null = null,
    customPrompt: string | null = null
): Promise<MockWISE实例> => {
    const name = customName ?? "rei";
    const 实例 = await 创建MockWISE实例({
        magiInstanceName: name,
        name: "MELCHIOR-01",
        displayName: "MELCHIOR",
        color: "red",
        icon: "✝",
        responseType: "sse",
        persona: "REI AS SUPEREGO",
        sseConfig: { eventTypes: ["theo_init", "scripture", "benediction"], chunkInterval: 200 },
        openAIConfig: {
            temperature: 0.3,
        },
        systemPromptForChat: customPrompt ?? `[Melchior:${name}]`,
        memorySize: 7,
    });
    // 若未提供自定义提示词，则异步加载 MELCHIOR 提示词模板并注入
    if (!customPrompt) {
        const 提示词 = await MELCHIOR提示词模板集.普通聊天(name, MELCHIOR特征集);
        实例.updateConfig({ systemPromptForChat: 提示词 });
    }
    return 实例;
};

/**
 * 创建 MockBalthazar 实例
 *
 * 作用：构建 BALTHASAR-02，自我——情感调节型处理单元
 * 意图：使用中等温度（0.7），提示词基于 BALTHAZAR 特征集动态生成，偏向情感丰富输出
 * 调用时机：由 initMagi 或直接测试调用
 *
 * @param customName - 自定义人格名称（默认 "rei"）
 * @param customPrompt - 自定义系统提示词（默认使用BALTHAZAR特征集构建）
 */
export const 创建MockBalthazar实例 = async (
    customName: string | null = null,
    customPrompt: string | null = null
): Promise<MockWISE实例> => {
    const name = customName ?? "rei";
    return 创建MockWISE实例({
        magiInstanceName: name,
        name: "BALTHASAR-02",
        displayName: "BALTHASAR",
        color: "blue",
        icon: "☪",
        responseType: "sse",
        persona: "REI AS EGO",
        sseConfig: { eventTypes: ["quantum_start", "analysis", "complete"], chunkInterval: 150 },
        openAIConfig: {
            temperature: 0.7,
        },
        systemPromptForChat: customPrompt ?? 构建Balthazar提示词(name),
        memorySize: 7,
    });
};

/**
 * 创建 MockCasper 实例
 *
 * 作用：构建 CASPER-03，本我——自然反应型直觉单元
 * 意图：使用极低 max_tokens（30），模拟直觉式简短回复，提示词基于 CASPER 特征集生成
 * 调用时机：由 initMagi 或直接测试调用
 *
 * @param customName - 自定义人格名称（默认 "rei"）
 * @param customPrompt - 自定义系统提示词（默认使用CASPER特征集构建）
 */
export const 创建MockCasper实例 = async (
    customName: string | null = null,
    customPrompt: string | null = null
): Promise<MockWISE实例> => {
    const name = customName ?? "rei";
    return 创建MockWISE实例({
        magiInstanceName: name,
        name: "CASPER-03",
        displayName: "CASPER",
        color: "yellow",
        icon: "🌙",
        responseType: "sse",
        persona: "REI AS SELF",
        sseConfig: { eventTypes: ["natural_start", "response", "complete"], chunkInterval: 200 },
        openAIConfig: {
            temperature: 0.7,
            max_tokens: 30,
        },
        systemPromptForChat: customPrompt ?? 构建Casper提示词(name),
        memorySize: 7,
    });
};

/**
 * 创建 MockTrinity 实例
 *
 * 作用：构建 TRINITY-00，整合——完整人格综合单元
 * 意图：Trinity 的 reply 会参考其他 SEEL 的响应动态调整系统提示词，需大上下文窗口（16000）
 * 调用时机：由 initMagi 或直接测试调用
 *
 * @param customName - 自定义人格名称（默认 "rei"）
 * @param customPrompt - 自定义系统提示词（默认使用完整人格数据构建）
 */
export const 创建MockTrinity实例 = async (
    customName: string | null = null,
    customPrompt: string | null = null
): Promise<MockWISE实例> => {
    const name = customName ?? "rei";
    const 基础实例 = await 创建MockWISE实例({
        magiInstanceName: name,
        name: "TRINITY-00",
        displayName: "TRINITY",
        color: "purple",
        icon: "⚕",
        responseType: "sse",
        persona: "REI AS WHOLE",
        sseConfig: { eventTypes: ["sync_init", "synthesis", "complete"], chunkInterval: 250 },
        openAIConfig: {
            temperature: 0.5,
        },
        systemPromptForChat: customPrompt ?? 构建Trinity提示词(name),
        memorySize: 7,
    });
    // Trinity 的 reply 需要动态注入其他 SEEL 的响应，覆盖基础实例的默认 reply
    return { ...基础实例, reply: 创建Trinity回复函数(基础实例) };
};

// ────────────────────────────────────────────────────────────────────────────
// initMagi 入口函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 应用全局配置到单个实例
 *
 * 作用：将 initMagi options 中的延迟/记忆/openAI配置应用到单个实例
 * 意图：从 initMagi 中提取配置应用逻辑，使 initMagi 保持简洁
 * 调用时机：仅在 initMagi 的批量实例初始化过程中调用
 */
const 应用全局配置到实例 = (实例: MockWISE实例, options: InitMagiOptions): void => {
    实例.responseDelay = options.delay ?? 500;
    实例.updateConfig({
        memorySize: options.memorySize ?? 7,
        ...(options.openAIConfig ? { openAIConfig: options.openAIConfig } : {}),
    });
};

/**
 * 初始化MAGI系统（三贤人）
 *
 * 作用：并发创建三贤人实例组，统一应用延迟/记忆/openAI配置，可选自动连接
 * 意图：提供一个简洁的"一行初始化"入口，简化调用方的配置工作
 * 调用时机：由前端 useMagi composable 或测试代码在系统启动时调用
 *
 * @param options - 初始化选项（提示词/延迟/记忆大小/AI配置/是否自动连接）
 */
export const initMagi = async (options: InitMagiOptions = {}): Promise<MockWISE实例[]> => {
    const 实例列表 = await Promise.all([
        创建MockMelchior实例(null, options.prompts?.melchior),
        创建MockBalthazar实例(null, options.prompts?.balthazar),
        创建MockCasper实例(null, options.prompts?.casper),
    ]);

    // 使用 for...of 代替 forEach（forEach 无法等待异步操作且无法中断）
    for (const 实例 of 实例列表) {
        应用全局配置到实例(实例, options);
    }

    if (options.autoConnect) {
        await Promise.all(实例列表.map((实例) => 实例.connect()));
    }

    return 实例列表;
};
