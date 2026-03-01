/**
 * @fileoverview WISE 基础处理器工厂函数
 * @description 三贤人的共享逻辑基础实现。
 * 从 toread/MAGI/core/wise/baseWise.js 迁移，去掉 EventEmitter 继承改为工厂函数+回调模式。
 * as 断言已替换为 wise.guard.ts 中的类型守卫。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/baseWise

import { 解析投票结果, 是WISEApiResponse } from "./wise.guard";
import type {
    WISEApi,
    WISEPersona,
    MardukValidatedConfig,
    VoteScore,
    FunctionInfoEntry,
    WISE事件回调,
    WISE基础实例,
} from "./wise.types";

// ────────────────────────────────────────────────────────────────────────────
// 纯函数工具（无副作用，便于测试）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 将函数元数据转换为投票用的结构化条目
 *
 * 作用：将分散的 functions/descriptions/inputs/goal 参数整合为统一的条目数组
 * 意图：让投票提示词构建逻辑与参数格式解耦
 * 调用时机：在 执行投票请求 调用 API 前调用
 */
const 构建函数条目 = (
    func: { name: string; action: { toString: () => string } },
    description: string,
    input: unknown,
    goal: string
): FunctionInfoEntry => ({
    name: func.name,
    content: func.action.toString(),
    description: description ?? "",
    input: JSON.stringify(input),
    goal,
});

/**
 * 计算同步率（百分比）
 *
 * 作用：综合 API 成功率和平均延迟计算 WISE 单元的同步率
 * 意图：量化智能单元的运行质量，用于 Marduk 协调决策
 * 调用时机：在 checkSync 中调用
 * 公式：成功率×70% + (1-归一化延迟)×30%，以百分制表示
 */
const 计算同步率 = (api: WISEApi): number => {
    const 成功率 = api.successRate ?? 1.0;
    const 延迟系数 = 1 - Math.min((api.averageLatency ?? 0) / 1000, 1.0);
    return (成功率 * 0.7 + 延迟系数 * 0.3) * 100;
};

// ────────────────────────────────────────────────────────────────────────────
// 内部方法提取（避免 创建WISE基础实例 超过50实际代码行）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 执行投票请求并解析结果
 *
 * 作用：向 API 发送投票请求，使用类型守卫解析返回的 JSON 分数数组
 * 意图：将 API 调用与解析逻辑封装，让 voteFor 方法保持简洁
 * 调用时机：在 voteFor 内部调用，处理单次投票请求
 */
const 执行投票请求 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    votePrompt: string,
    functions: Array<{ name: string; action: { toString: () => string } }>,
    descriptions: string[],
    inputs: unknown[],
    goal: string,
    personaName: string,
    回调?: WISE事件回调
): Promise<VoteScore[]> => {
    const 条目列表 = functions.map((func, index) =>
        构建函数条目(func, descriptions[index] ?? "", inputs[index], goal)
    );
    const response = await api.post({
        model: config.model,
        messages: [
            { role: "system", content: votePrompt },
            { role: "user", content: JSON.stringify(条目列表) },
        ],
    });
    if (!是WISEApiResponse(response)) {
        return [];
    }
    const 首个选择 = response.choices[0];
    if (!首个选择) {
        return [];
    }
    try {
        const result = 解析投票结果(首个选择.message.content);
        return result ?? [];
    } catch (解析错误) {
        console.error(`${personaName}投票解析失败:`, 解析错误);
        // 仅 Error 实例才有 message，确保类型安全后触发回调
        if (解析错误 instanceof Error) {
            回调?.onParseError?.(解析错误);
        }
        return [];
    }
};

/**
 * 执行总结请求并解析结果
 *
 * 作用：向 API 发送总结请求，解析并返回结构化总结对象
 * 意图：将 API 调用与解析逻辑封装，让 summarize 方法保持简洁
 * 调用时机：在 summarize 内部调用
 */
const 执行总结请求 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    summarizePrompt: string,
    conversation: Array<{ role: string; content: string }>,
    personaName: string
): Promise<unknown> => {
    const response = await api.post({
        model: config.model,
        messages: [
            { role: "system", content: summarizePrompt },
            { role: "user", content: JSON.stringify(conversation) },
        ],
    });
    if (!是WISEApiResponse(response)) {
        return [];
    }
    const 首个选择 = response.choices[0];
    if (!首个选择) {
        return [];
    }
    try {
        return JSON.parse(首个选择.message.content);
    } catch (解析错误) {
        console.error(`${personaName}总结解析失败:`, 解析错误);
        return [];
    }
};

// ────────────────────────────────────────────────────────────────────────────
// 工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建WISE基础实例
 *
 * 作用：提供三贤人共用的 voteFor/reply/summarize/checkSync 基础能力
 * 意图：替代 class WISE extends EventEmitter（lint 禁止 extends）。
 *   所有状态通过闭包封装，事件通过回调参数替代 emit。
 *   子工厂函数（Melchior/Balthazar/Casper）通过对象展开+覆盖方法的方式在此基础上扩展。
 * 调用时机：在 seelWise.ts 中的 创建Melchior实例 等函数内调用，作为基础层
 *
 * @param api - WISE API接口（封装了与AI服务的通信）
 * @param config - 经Marduk验证的配置
 * @param persona - WISE人格配置（名称/颜色/图标等）
 * @param 回调 - 事件回调（可选，替代EventEmitter事件）
 */
export const 创建WISE基础实例 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    persona: WISEPersona,
    回调?: WISE事件回调
): Promise<WISE基础实例> => {
    const 状态 = {
        votePrompt: "",
        replyPrompt: "",
        summarizePrompt: "",
    };

    return {
        /** @同步豁免: 性能考虑 - getter必须同步返回以供即时读取 */
        get api() {
            return api;
        },
        /** @同步豁免: 性能考虑 - getter必须同步返回以供即时读取 */
        get config() {
            return config;
        },
        /** @同步豁免: 性能考虑 - getter必须同步返回以供即时读取 */
        get persona() {
            return persona;
        },
        /** @同步豁免: 性能考虑 - getter/setter必须同步以供子工厂函数即时赋值 */
        get votePrompt() {
            return 状态.votePrompt;
        },
        /** @同步豁免: 性能考虑 - setter必须同步以供子工厂函数即时赋值 */
        set votePrompt(v: string) {
            状态.votePrompt = v;
        },
        /** @同步豁免: 性能考虑 - getter/setter必须同步以供子工厂函数即时赋值 */
        get replyPrompt() {
            return 状态.replyPrompt;
        },
        /** @同步豁免: 性能考虑 - setter必须同步以供子工厂函数即时赋值 */
        set replyPrompt(v: string) {
            状态.replyPrompt = v;
        },
        /** @同步豁免: 性能考虑 - getter/setter必须同步以供子工厂函数即时赋值 */
        get summarizePrompt() {
            return 状态.summarizePrompt;
        },
        /** @同步豁免: 性能考虑 - setter必须同步以供子工厂函数即时赋值 */
        set summarizePrompt(v: string) {
            状态.summarizePrompt = v;
        },

        /**
         * 投票评分——对给定函数集进行逻辑/情感/常识多维度评分
         * 作用：向 API 发送投票请求，使用类型守卫解析并返回评分列表
         * 调用时机：由 magiSystem 在并行获取各贤人评分时调用
         */
        async voteFor(functions, descriptions, inputs, goal) {
            try {
                return await 执行投票请求(
                    api, config, 状态.votePrompt,
                    functions, descriptions, inputs, goal,
                    persona.name, 回调
                );
            } catch (error) {
                console.error(`${persona.name}投票失败:`, error);
                // 仅 Error 实例才有 message，确保类型安全后触发回调
                if (error instanceof Error) {
                    回调?.onError?.(error);
                }
                return [];
            }
        },

        /**
         * 回复用户输入——调用 AI API 并通过回调通知完成
         * 作用：向 API 发送对话请求，通过 onResponse 回调通知调用方
         * 调用时机：由 magiSystem 或 UI 层在用户发送消息时调用
         */
        async reply(userInput) {
            try {
                const response = await api.post({
                    model: config.model,
                    messages: [
                        { role: "system", content: 状态.replyPrompt },
                        { role: "user", content: JSON.stringify(userInput) },
                    ],
                });
                回调?.onResponse?.(response);
                return response;
            } catch (error) {
                console.error(`${persona.name}回复失败:`, error);
                // 仅 Error 实例才有 message，确保类型安全后触发回调
                if (error instanceof Error) {
                    回调?.onError?.(error);
                }
                return null;
            }
        },

        /**
         * 对话总结——将对话历史压缩为结构化摘要
         * 作用：向 API 发送总结请求，返回按贤人角色定制的摘要格式
         * 调用时机：由 magiSystem 在对话轮次结束或上下文即将超限时调用
         */
        async summarize(conversation) {
            try {
                return await 执行总结请求(
                    api, config, 状态.summarizePrompt, conversation, persona.name
                );
            } catch (error) {
                console.error(`${persona.name}总结失败:`, error);
                return [];
            }
        },

        /**
         * 检查同步率——判断该 WISE 单元是否达到 Marduk 的同步阈值
         * 作用：计算当前 API 成功率和延迟的综合同步率，与 baseWeight×0.8 对比
         * 意图：让 Marduk 决策层知道某个 WISE 单元是否可信任
         * 调用时机：由 Marduk 协调层在每次决策前调用
         */
        checkSync(getSEELConfig) {
            const { baseWeight } = getSEELConfig(persona.name.toLowerCase());
            const 当前同步率 = 计算同步率(api);
            return {
                status: 当前同步率 >= baseWeight * 0.8 ? "synced" : "desynced",
                ratio: 当前同步率,
                threshold: baseWeight * 0.8,
            };
        },
    };
};
