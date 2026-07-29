/**
 * Balthazar 总结提示词生成器
 *
 * 根据问卷评估数据生成Balthazar情感与伦理倾向特征的第一人称自我介绍提示词。
 */
import type { BalthazarSummaryData } from "../../questionnaire.types";

/** 情感特征评估维度：[标签, 得分字段, 子维度对] */
const emotionSections: ReadonlyArray<[string, keyof BalthazarSummaryData, ReadonlyArray<[string, keyof BalthazarSummaryData]>]> = [
    ["情绪识别倾向", "情绪识别倾向得分", [
        ["自我觉察", "自我觉察特征"],
        ["他人关注", "他人关注特征"],
        ["氛围感知", "氛围感知特征"],
    ]],
    ["情感调节倾向", "情感调节倾向得分", [
        ["强度管理", "强度管理特征"],
        ["持续应对", "持续应对特征"],
        ["转换适应", "转换适应特征"],
    ]],
    ["伦理决策倾向", "伦理决策倾向得分", [
        ["思考模式", "思考模式特征"],
        ["价值权衡", "价值权衡特征"],
    ]],
    ["人际互动倾向", "人际互动倾向得分", [
        ["互动模式", "互动模式特征"],
        ["关系维护", "关系维护特征"],
    ]],
    ["情感共鸣倾向", "情感共鸣倾向得分", [
        ["共情深度", "共情深度特征"],
        ["复杂处理", "复杂情感处理"],
    ]],
    ["专业伦理倾向", "专业伦理倾向得分", [
        ["决策模式", "伦理决策模式"],
        ["价值稳定", "价值观稳定性"],
    ]],
    ["团队情感管理", "团队情感管理得分", [
        ["氛围营造", "氛围营造特征"],
        ["冲突调解", "冲突调解特征"],
    ]],
];

/** 构建情感特征评估文本块 */
const buildEmotionBlock = (data: BalthazarSummaryData): string =>
    emotionSections.map(([label, scoreKey, traits], i) => {
        const score = data[scoreKey] ?? 0;
        const lines = traits.map(([tLabel, tKey]) => `   - ${tLabel}：${data[tKey] ?? ""}`).join("\n");
        return `${i + 1}. ${label}（${score}分）：\n${lines}`;
    }).join("\n\n");

/**
 * 生成Balthazar总结提示词
 */
export async function genBalthazarSummaryPrompt(data: BalthazarSummaryData): Promise<string> {
    const 姓名 = data.姓名 ?? "";

    return `请根据以下资料，以侧写方式,生成候选者 ${姓名} 的第一人称陈述,用于模拟其人格的伦理与情感倾向侧面：

基础档案：
姓名：${姓名}
年龄：${data.年龄 ?? ""}岁
性别：${data.性别 ?? ""}
所属：${data.所属组织 ?? ""}
职责：${data.职责定位 ?? ""}

情感特征评估：
${buildEmotionBlock(data)}

自我介绍要求：
1. 内容结构：
   - 以"我是 ${姓名} ,MAGI的BALTHAZAR单元,我将负责以最符合${姓名}档案的方式模拟${姓名}的情感和伦理倾向特质"开始,以"因此我在对话中将<行为准则>"结束，介绍自己的身份

2. 表达特点：
   - 严格使用第一人称叙述
   - 完全基于已知档案信息
   - 不添加档案之外的设定
   - 保持情感特征一致性
   - 体现个人情感风格

注意事项：
- 仅使用档案中提供的信息
- 在体现人物特征的基础上尽可能简短,介绍自身而不是档案内容
- 绝对禁止按照分点重复档案内容
- 突出情感伦理特质
- 以自我反思而不是"自我介绍"的方式进行`;
}
