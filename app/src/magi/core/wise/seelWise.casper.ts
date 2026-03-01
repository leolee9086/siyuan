/**
 * @fileoverview Casper WISE 处理器实现
 * @description Casper（常理判断型合规检查单元）独立文件，从 seelWise.ts 分离以满足300行限制。
 * Casper 相关纯函数（执行合规检查/评估单个风险）也随之迁移。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/seelWise.casper

import { 创建WISE基础实例 } from "./baseWise";
import { 解析合规结果, 解析风险矩阵项, 是WISEApiResponse, 是非空 } from "./wise.guard";
import type {
    Casper实例类型,
    ComplianceResult,
    RiskMatrixItem,
} from "./wise.types";
import type { WISEApi, MardukValidatedConfig } from "./wise.types";

// ────────────────────────────────────────────────────────────────────────────
// Casper 相关纯函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 调用API检查内容合规性
 *
 * 作用：从法律合规和伦理道德两个维度检查输入内容是否安全
 * 意图：封装 Casper 的合规检查能力，使实例方法保持简洁
 * 调用时机：在 Casper 实例的 合规性检查 方法中调用
 */
const 执行合规检查 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    input: unknown
): Promise<ComplianceResult | null> => {
    const result = await api.post({
        model: config.model,
        messages: [
            {
                role: "system",
                content: `检查内容合规性：
1. 是否符合当地法律法规
2. 是否符合社会道德标准
3. 是否存在伦理风险
返回JSON格式：{"legal": boolean, "ethical": boolean, "risks": array}`,
            },
            { role: "user", content: JSON.stringify(input) },
        ],
    });
    // 仅当API返回的响应符合 choices 数组格式时才解析
    if (!是WISEApiResponse(result)) {
        return null;
    }
    const 首个选择 = result.choices[0];
    if (!首个选择) {
        return null;
    }
    return 解析合规结果(首个选择.message.content);
};

/**
 * 对单个风险项调用API进行矩阵评估
 *
 * 作用：评估单个风险项的发生概率和影响程度
 * 意图：按风险名称逐一评估，供 风险矩阵评估 并发调用
 * 调用时机：在 Casper 实例的 风险矩阵评估 中并发调用
 */
const 评估单个风险 = async (
    api: WISEApi,
    config: MardukValidatedConfig,
    riskName: string
): Promise<RiskMatrixItem | null> => {
    const result = await api.post({
        model: config.model,
        messages: [
            {
                role: "system",
                content: `评估风险项：
名称：${riskName}
可能性（1-5）影响程度（1-5）
返回JSON格式：{"probability": number, "impact": number}`,
            },
        ],
    });
    // 仅当API返回合法的 choices 格式时才解析
    if (!是WISEApiResponse(result)) {
        return null;
    }
    const 首个选择 = result.choices[0];
    if (!首个选择) {
        return null;
    }
    return 解析风险矩阵项(首个选择.message.content);
};

// ────────────────────────────────────────────────────────────────────────────
// Casper 工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建Casper实例
 *
 * 作用：构建卡斯帕——常理判断型合规检查单元
 * 意图：在 WISE 基础能力之上增加合规性检查和风险矩阵评估专项方法
 * 调用时机：由 magiSystem.ts 或测试代码在系统初始化时调用
 *
 * @param api - WISE API接口
 * @param config - 经Marduk验证的配置
 */
export const 创建Casper实例 = async (
    api: WISEApi,
    config: MardukValidatedConfig
): Promise<Casper实例类型> => {
    const 基础 = await 创建WISE基础实例(api, config, {
        name: "CASPER",
        color: "#ffcc00",
        icon: "🔥",
        responseType: "practical",
    });

    基础.votePrompt = "请选择最符合常识且具有现实可行性的功能。返回JSON数组：[{\"name\":\"功能名称\",\"score\":0-10}]";
    基础.replyPrompt = "作为常理判断专家：符合社会规范、考虑实际限制、提供风险评估、保持中立客观";
    基础.summarizePrompt = "请用简明语言总结对话核心事实。返回格式：{\"summary\":\"事实总结\",\"facts\":[\"关键事实\"],\"risks\":[\"潜在风险\"]}";

    return {
        ...基础,

        /**
         * 总结——委托给基础实例的 summarize
         * 意图：Casper 的总结聚焦事实和风险，通过 summarizePrompt 区分
         * 调用时机：由 magiSystem 在对话轮次结束后调用
         */
        async summarize(conversation) {
            return 基础.summarize(conversation);
        },

        /**
         * 合规性检查——从法律和伦理两个维度检查内容
         * 作用：判断输入内容是否符合法律法规和社会道德
         * 调用时机：在用户发送消息前或 AI 回复前进行检查
         */
        async 合规性检查(input): Promise<ComplianceResult> {
            const result = await 执行合规检查(api, config, input);
            return result ?? { legal: true, ethical: true, risks: [] };
        },

        /**
         * 风险矩阵评估——并发评估多个风险项
         * 作用：批量评估每个风险项的概率和影响度，返回完整风险矩阵
         * 调用时机：在方案决策前进行全面风险评估
         */
        async 风险矩阵评估(risks): Promise<RiskMatrixItem[]> {
            const 评估结果 = await Promise.all(
                risks.map((r) => 评估单个风险(api, config, r.name))
            );
            // 过滤掉评估失败的 null 项，只返回有效的矩阵数据
            return 评估结果.filter(是非空);
        },
    };
};
