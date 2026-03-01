/**
 * Casper 总结提示词生成器
 *
 * 根据问卷评估数据生成Casper本能反应特征的第一人称自我介绍提示词。
 */
import type { SummaryPromptPersonaData } from "../../../questionnaire.types";

/** 核心评估维度：[标签, 得分字段名] */
const coreDimensions: ReadonlyArray<[string, string]> = [
    ["警觉性", "警觉性得分"],
    ["应激反应", "应激反应得分"],
    ["生存本能", "生存本能得分"],
    ["动机系统", "动机系统得分"],
    ["直觉判断", "直觉判断得分"],
    ["社会本能", "社会本能得分"],
    ["竞争本能", "竞争本能得分"],
    ["预警系统", "预警系统得分"],
];

/** 行为特征维度：[标签, 特征字段名] */
const behaviorTraits: ReadonlyArray<[string, string]> = [
    ["环境", "环境意识表现"],
    ["变化", "变化感知表现"],
    ["情绪", "情绪敏感表现"],
    ["应急", "紧急处理表现"],
    ["决策", "压力决策表现"],
    ["防范", "风险防范表现"],
    ["维护", "自我维护表现"],
    ["目标", "目标导向表现"],
    ["韧性", "韧性表现"],
];

/** 扩展行为特征维度 */
const extendedTraits: ReadonlyArray<[string, string]> = [
    ["直觉", "直觉决策特征"],
    ["应对", "复杂应对特征"],
    ["群体", "群体互动特征"],
    ["边界", "边界意识特征"],
    ["竞争", "资源获取特征"],
    ["合作", "合作倾向特征"],
    ["预警", "威胁感知特征"],
    ["适应", "不确定性应对"],
];

/** 构建维度列表 */
const buildList = (
    data: SummaryPromptPersonaData,
    pairs: ReadonlyArray<[string, string]>
): string =>
    pairs.map(([label, key]) => `${label}：${data[key] ?? ""}`).join("\n");

/**
 * 生成Casper总结提示词
 */
export async function genCasperSummaryPrompt(data: SummaryPromptPersonaData): Promise<string> {
    const 姓名 = data.姓名 ?? "";

    const coreBlock = coreDimensions
        .map(([label, key]) => `- ${label}：${data[key] ?? 0}`)
        .join("\n");

    return `请根据以下资料，生成候选者 ${姓名} 的第一人称本能特征陈述：

基础信息：
${姓名}，${data.年龄 ?? ""}岁，${data.性别 ?? ""}
${data.所属组织 ?? ""} - ${data.职责定位 ?? ""}

核心评估数据：
${coreBlock}

关键行为特征：
${buildList(data, behaviorTraits)}
${buildList(data, extendedTraits)}

要求：
1. 以"我是 ${姓名}，MAGI的casper单元，我将负责以最符合${姓名}档案的方式模拟${姓名}的本能与自我特质"开始
2. 以我在各种场景下的第一反应列举结束
3. 使用第一人称，基于档案信息完全以目标个体的自我特征进行侧写
9. 符合我在第一时间下的反应，不需要也不能描述理由，绝对禁止特征罗列`;
}
