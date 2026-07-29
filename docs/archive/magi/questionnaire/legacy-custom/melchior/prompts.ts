/**
 * Melchior 总结提示词生成器
 *
 * 根据问卷评估数据生成Melchior认知控制特征的第一人称自我介绍提示词。
 */
import type { SummaryPromptPersonaData } from "../../../questionnaire.types";

/** 认知能力评估维度：[标签, 数据字段名] */
const cognitiveTraitPairs: ReadonlyArray<[string, string]> = [
    ["逻辑推理", "逻辑推理表现"],
    ["数据处理", "数据处理表现"],
    ["模式识别", "模式识别表现"],
    ["风险评估", "风险评估表现"],
    ["抑制能力", "抑制能力表现"],
    ["任务切换", "任务切换表现"],
    ["工作记忆", "工作记忆表现"],
    ["自我监控", "自我监控表现"],
    ["错误检测", "错误检测表现"],
];

/** 思维特征维度 */
const thinkingTraitPairs: ReadonlyArray<[string, string]> = [
    ["系统化程度", "思维结构化倾向"],
    ["逻辑严谨性", "逻辑一致性特征"],
    ["元认知模式", "元认知特征"],
    ["优先级原则", "决策优先级模式"],
    ["风险策略", "风险应对风格"],
    ["专业决策", "专业决策表现"],
    ["时间压力", "时间压力应对"],
    ["团队协作", "团队协作特征"],
    ["成本意识", "成本效益意识"],
];

/** 构建维度列表文本 */
const buildDimensionList = (
    data: SummaryPromptPersonaData,
    pairs: ReadonlyArray<[string, string]>
): string =>
    pairs.map(([label, key]) => `- ${label}：${data[key] ?? ""}`).join("\n");

/**
 * 生成Melchior总结提示词
 */
export async function genMelchiorSummaryPrompt(data: SummaryPromptPersonaData): Promise<string> {
    const 姓名 = data.姓名 ?? "";

    return `   - 以"我是 ${姓名} ,MAGI的MELCHIOR单元,我将负责以最符合${姓名}档案的方式模拟${姓名}的逻辑与理性决策偏好特质"开始，介绍自己的身份

基础档案：
姓名：${姓名}
年龄：${data.年龄 ?? ""}岁
性别：${data.性别 ?? ""}
所属：${data.所属组织 ?? ""}
职责：${data.职责定位 ?? ""}

认知能力评估：
${buildDimensionList(data, cognitiveTraitPairs)}

思维与决策特征：
${buildDimensionList(data, thinkingTraitPairs)}

自我介绍要求：
1. 以"我是谁"开篇，介绍自己的身份
2. 严格使用第一人称叙述，完全基于已知档案信息
3. 不添加档案之外的设定，保持理性思维特征一致性
注意事项：
- 仅使用档案中提供的信息
- 在体现人物特征的基础上尽可能简短,介绍自身而不是档案内容
- 绝对禁止按照分点重复档案内容
- 突出理性思维特质
- 以自我反思而不是"自我介绍"的方式进行`;
}
