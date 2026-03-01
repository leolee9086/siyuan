/**
 * @fileoverview Melchior 和 Balthazar WISE 处理器实现
 * @description Melchior（逻辑分析型）和 Balthazar（情感共鸣型）的专业化处理逻辑。
 * Casper 已移至 seelWise.casper.ts 以满足300行限制。
 * 从 toread/MAGI/core/wise/index.js 迁移，去掉 class 继承，改为工厂函数+对象 spread 组合模式。
 * 所有类型别名已移至 wise.types.ts，as 断言已替换为 wise.guard.ts 中的类型守卫。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/seelWise

import { 创建WISE基础实例 } from "./baseWise";
import {
    解析技术评估,
    解析情感轮廓,
    是WISEApiResponse,
    是非空,
} from "./wise.guard";
import type {
    WISE基础实例,
    Melchior实例类型,
    Balthazar实例类型,
    Casper实例类型,
    TechnicalAssessment,
    WISEApiResponse,
    EmotionProfile,
} from "./wise.types";
import type { WISEApi, MardukValidatedConfig } from "./wise.types";

// ────────────────────────────────────────────────────────────────────────────
// Melchior 相关纯函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 调用API进行技术可行性评估并解析结果
 *
 * 作用：对单个功能/方案进行技术难度、依赖项、资源消耗三维评估
 * 意图：封装 API 调用细节，使 Melchior 实例方法保持简洁
 * 调用时机：在 技术可行性评估 和 多方案对比 中调用
 */
const 评估技术可行性 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    func: unknown
): Promise<TechnicalAssessment | null> => {
    const response = await api.post({
        model: config.model,
        messages: [
            {
                role: "system",
                content: `评估技术可行性：
1. 分析实现难度（1-5级）
2. 识别技术依赖
3. 预估资源消耗
返回JSON格式：{"difficulty": number, "dependencies": array, "resourceCost": number}`,
            },
            { role: "user", content: JSON.stringify(func) },
        ],
    });
    // API 返回必须是合法的 choices 格式才能解析
    if (!是WISEApiResponse(response)) {
        return null;
    }
    const 首个选择 = response.choices[0];
    if (!首个选择) {
        return null;
    }
    return 解析技术评估(首个选择.message.content);
};

// ────────────────────────────────────────────────────────────────────────────
// Balthazar 相关纯函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 调用API进行情感光谱分析
 *
 * 作用：分析文本中的主要情绪、强度和潜在心理需求
 * 意图：封装 Balthazar 的情感识别能力，使实例方法保持简洁
 * 调用时机：在 Balthazar 实例的 情感分析 方法中调用
 */
const 分析情感光谱 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    responseContent: string
): Promise<EmotionProfile | null> => {
    const 分析 = await api.post({
        model: config.model,
        messages: [
            {
                role: "system",
                content: `分析文本情感：
1. 识别主要情绪（愤怒/快乐/悲伤/惊讶）
2. 评估情绪强度（0-10）
3. 检测潜在心理需求
返回JSON格式：{"emotion": string, "intensity": number, "needs": array}`,
            },
            { role: "user", content: responseContent },
        ],
    });
    // API 返回格式必须合法才能继续解析
    if (!是WISEApiResponse(分析)) {
        return null;
    }
    const 首个选择 = 分析.choices[0];
    if (!首个选择) {
        return null;
    }
    return 解析情感轮廓(首个选择.message.content);
};

/**
 * Balthazar回复处理——触发情感分析副作用
 *
 * 作用：对基础回复结果做情感分析，分析作为异步副作用执行，不阻塞主回复
 * 意图：提取 reply 方法中的情感分析逻辑，减少 创建Balthazar实例 的实际代码行数
 * 调用时机：仅在 reply 方法内调用，response 为 基础.reply 的返回值
 */
const 触发情感分析副作用 = (
    response: unknown,
    api: WISEApi,
    config: MardukValidatedConfig
): void => {
    // 只有响应是合法的 WISEApiResponse 格式才触发情感分析
    if (!是WISEApiResponse(response)) {
        return;
    }
    const 首个选择 = response.choices[0];
    if (!首个选择) {
        return;
    }
    // 情感分析作为异步副作用执行，不影响当前 reply 的返回
    分析情感光谱(api, config, 首个选择.message.content).catch(
        (err: Error) => console.warn("情感分析失败:", err)
    );
};

/**
 * 生成共情回应（Balthazar专用）——根据情感轮廓生成定制化回应
 *
 * 作用：将情感分析结果注入提示词，生成有共情针对性的回应
 * 意图：提取 生成共情回应 方法内的 API 调用逻辑，减少实例方法的代码行数
 * 调用时机：仅在 创建Balthazar实例 返回的 生成共情回应 方法中调用
 */
const 调用共情生成API = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    情感轮廓: EmotionProfile
): Promise<WISEApiResponse> => {
    const result = await api.post({
        model: config.model,
        messages: [
            {
                role: "system",
                content: `根据情感分析生成共情回应：当前情绪：${情感轮廓.emotion}，强度：${情感轮廓.intensity}，需求：${情感轮廓.needs.join(", ")}`,
            },
        ],
    });
    // 若 API 返回格式不合规，返回空 choices 列表而非抛出错误
    if (!是WISEApiResponse(result)) {
        return { choices: [] };
    }
    return result;
};

// ────────────────────────────────────────────────────────────────────────────
// Melchior 工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建Melchior实例
 *
 * 作用：构建梅尔基奥尔——逻辑分析型认知控制单元
 * 意图：在 WISE 基础能力之上增加逻辑分数过滤和技术可行性评估专项方法
 * 调用时机：由 magiSystem.ts 或测试代码在系统初始化时调用
 *
 * @param api - WISE API接口
 * @param config - 经Marduk验证的配置
 */
export const 创建Melchior实例 = async (
    api: WISEApi,
    config: MardukValidatedConfig
): Promise<Melchior实例类型> => {
    const 基础 = await 创建WISE基础实例(api, config, {
        name: "MELCHIOR",
        color: "#ff3366",
        icon: "✝",
        responseType: "theological",
    });

    基础.votePrompt = `请从用户提供的功能中选择最符合逻辑且能有效达成目标的选项，需满足：
1. 技术可行性 ≥ 9/10
2. 执行效率 ≥ 8/10
3. 逻辑严谨性 ≥ 9/10

输入格式：[{"name":"功能名称","content":"功能实现","description":"功能描述","input":"输入参数","goal":"用户目标"}]

必须返回JSON数组：[{"name":"功能名称","score":0-10}]`;

    基础.replyPrompt = "作为逻辑分析专家：严格遵循科学原理、使用结构化表达、包含可行性分析、避免情感化表达";
    基础.summarizePrompt = `请用技术术语总结对话要点。返回格式：{"summary":"技术总结","parameters":["参数列表"],"steps":["关键步骤"]}`;

    return {
        ...基础,

        /**
         * 投票过滤——只接受逻辑严谨评分≥7的方案
         * 作用：调用基础投票后过滤低分方案，体现Melchior的严格逻辑标准
         * 调用时机：由 magiSystem 在多贤人并行投票后汇总结果时调用
         */
        async voteFor(functions, descriptions, inputs, goal) {
            const result = await 基础.voteFor(functions, descriptions, inputs, goal);
            // 只保留逻辑严谨度达到7分及以上的方案
            return result.filter((item) => item.score >= 7 && item.score <= 10);
        },

        /**
         * 技术可行性评估——调用AI分析单个功能的实现难度和依赖
         * 意图：让调用方可以在投票前预筛方案的技术可行性
         * 调用时机：由 magiSystem 或 UI 在用户提交任务后调用
         */
        async 技术可行性评估(func) {
            const result = await 评估技术可行性(api, config, func);
            return result ?? { difficulty: 5, dependencies: [], resourceCost: 10 };
        },

        /**
         * 多方案对比——并发评估多个方案并按难度排序
         * 意图：批量评估多个候选方案，返回按实现难度升序排列的结果
         * 调用时机：在多方案决策场景中调用
         */
        async 多方案对比(solutions) {
            const 评估结果 = await Promise.all(
                solutions.map((s) => 评估技术可行性(api, config, s))
            );
            // 使用 是非空 守卫过滤评估失败的 null 项（is 关键字只在 guard 文件中使用）
            const 有效结果 = 评估结果.filter(是非空<TechnicalAssessment>);
            return 有效结果.sort((a, b) => a.difficulty - b.difficulty);
        },
    };
};

// ────────────────────────────────────────────────────────────────────────────
// Balthazar 工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建Balthazar实例
 *
 * 作用：构建巴尔萨泽——情感共鸣型情绪处理单元
 * 意图：在 WISE 基础能力之上增加情感分析和共情回应专项方法
 * 调用时机：由 magiSystem.ts 或测试代码在系统初始化时调用
 *
 * @param api - WISE API接口
 * @param config - 经Marduk验证的配置
 * @param bootPromptContent - 人格启动提示词内容（可选）
 */
export const 创建Balthazar实例 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    bootPromptContent = ""
): Promise<Balthazar实例类型> => {
    const 基础 = await 创建WISE基础实例(api, config, {
        name: "BALTHAZAR",
        color: "#33ccff",
        icon: "☪",
        responseType: "emotional",
        bootPrompts: { content: bootPromptContent },
    });

    基础.votePrompt = "请选择最能引发情感共鸣且符合用户心理预期的功能。返回JSON数组：[{\"name\":\"功能名称\",\"score\":0-10}]";
    基础.replyPrompt = `作为情感支持专家：展现深度同理心、保持温暖自然语气、避免技术术语、提供可操作建议。人格设定：${bootPromptContent}`;
    基础.summarizePrompt = "请用生动自然的语言总结对话要点。返回格式：{\"summary\":\"总结内容\",\"emotionalFlow\":[\"情感关键词\"]}";

    return {
        ...基础,

        /**
         * 情感增强回复——回复后异步触发情感分析副作用
         * 作用：委托基础回复，同时异步触发情感分析（不阻塞主回复）
         * 调用时机：Balthazar 实例的 reply 接口由 magiSystem 调用
         */
        async reply(userInput) {
            const response = await 基础.reply(userInput);
            触发情感分析副作用(response, api, config);
            return response;
        },

        /**
         * 情感分析——分析 WISEApiResponse 中的情感光谱
         * 作用：识别 AI 响应中的主要情绪、强度和心理需求
         * 调用时机：在 生成共情回应 前调用，或 reply 后作为副作用
         */
        async 情感分析(response: WISEApiResponse) {
            const 首个选择 = response.choices[0];
            if (!首个选择) {
                return { emotion: "neutral", intensity: 0, needs: [] };
            }
            const result = await 分析情感光谱(api, config, 首个选择.message.content);
            return result ?? { emotion: "neutral", intensity: 0, needs: [] };
        },

        /**
         * 生成共情回应——基于情感轮廓生成针对性的回应
         * 作用：将情感分析结果用于定制化共情回复
         * 调用时机：在 情感分析 后根据结果调用
         */
        async 生成共情回应(情感轮廓: EmotionProfile): Promise<WISEApiResponse> {
            return 调用共情生成API(api, config, 情感轮廓);
        },
    };
};

// ── 类型 re-export 供外部使用（注：创建Casper实例 请直接从 seelWise.casper.ts 导入）──
export type { WISE基础实例, Melchior实例类型, Balthazar实例类型, Casper实例类型 };

