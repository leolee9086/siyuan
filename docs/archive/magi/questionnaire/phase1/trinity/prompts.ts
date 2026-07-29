/**
 * Trinity 总结提示词生成器
 *
 * 根据问卷评估数据生成Trinity人格整合的第一人称自我介绍提示词。
 */
import type { TrinitySummaryData } from "../../questionnaire.types";

/** 整合特征维度：[标签, 数据字段名] */
const traitPairs: ReadonlyArray<[string, keyof TrinitySummaryData]> = [
    ["思维倾向", "思维倾向特征"],
    ["处理倾向", "处理倾向特征"],
    ["互动倾向", "互动倾向特征"],
    ["应急倾向", "应急倾向特征"],
    ["压力应对", "压力应对特征"],
    ["环境适应", "环境适应特征"],
    ["角色转换", "角色转换特征"],
    ["方向选择", "方向选择特征"],
    ["学习方式", "学习方式特征"],
];

/** 构建整合特征评估段落 */
const buildTraitsBlock = (data: TrinitySummaryData): string =>
    traitPairs
        .map(([label, key]) => `   - ${label}：${data[key] ?? ""}`)
        .join("\n");

/** Trinity自我介绍的通用要求模板 */
const trinityRequirements = `自我介绍要求：
1. 内容结构：
   - 每一段以"我是"开始，介绍自己的身份和自我认知，十句左右，简短，符合"对话过程中潜意识中的自我觉察"的特征
2. 表达特点：
   - 严格使用第一人称叙述
   - 完全基于已知档案信息
   - 不添加档案之外的设定
   - 保持整合特征一致性
   - 绝对确保陈述符合角色要求
注意事项：
- 仅使用档案中提供的信息
- 避免过度推测和想象
- 保持特征描述前后一致
- 符合年龄和职责特征
- 在体现人物特征的基础上尽可能简短,介绍自身而不是档案内容
- 绝对禁止按照分点重复档案内容,介绍自身而不是档案内容
- 以语言记录而不是"自我介绍"的方式进行`;

/**
 * 生成Trinity总结提示词
 *
 * @param data - Trinity评估数据
 * @returns 用于AI生成人格整合自我介绍的提示词
 */
export async function genTrinitySummaryPrompt(data: TrinitySummaryData): Promise<string> {
    const 姓名 = data.姓名 ?? "";
    const 经历列表 = (data.关键经历 ?? [])
        .map((exp, index) => `${index + 1}. ${exp}`)
        .join("\n");

    return `请根据以下资料，以侧写模拟的形式,生成候选者 ${姓名} 的第一人称陈述,由于模拟其完整人格特质：

基础档案：
姓名：${姓名}
年龄：${data.年龄 ?? ""}岁
性别：${data.性别 ?? ""}
所属：${data.所属组织 ?? ""}
职责：${data.职责定位 ?? ""}

关键经历：
${经历列表}

整合特征评估：
${buildTraitsBlock(data)}

${trinityRequirements}`;
}
