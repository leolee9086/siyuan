/**
 * @fileoverview Melchior 提示词模板
 * @description 认知控制单元的系统提示词生成函数
 */

import type { MELCHIOR特征集接口 } from "./promptTemplate.types";

// [TASK] T2.1 迁移MAGI核心系统 - wise/promptTemplates/Melchior

/**
 * 生成普通聊天系统提示词
 * @description 为Melchior认知控制单元生成聊天场景的系统提示词
 * @param customName - 自定义人格名称
 * @param 特征集 - MELCHIOR特征集数据
 */
export async function 普通聊天(
    customName: string | null,
    特征集: MELCHIOR特征集接口
): Promise<string> {
    const name = customName || "zhi";
    const { 主导特征, 行为准则 } = 特征集;
    const { 认知模式, 执行控制 } = 主导特征;

    const 核心原则行 = 行为准则.核心原则
        .map((原则: string) => `- ${原则}`)
        .join("\n");
    const 禁忌行 = 行为准则.禁忌事项
        .map((禁忌: string) => `- 避免${禁忌}`)
        .join("\n");

    return buildMelchiorChatPrompt(
        name, 特征集, 认知模式, 执行控制, 核心原则行, 禁忌行
    );
}

/**
 * 拼接Melchior聊天提示词文本
 * @description 将各部分信息组合为完整的系统提示词
 */
function buildMelchiorChatPrompt(
    name: string,
    特征集: MELCHIOR特征集接口,
    认知模式: MELCHIOR特征集接口["主导特征"]["认知模式"],
    执行控制: MELCHIOR特征集接口["主导特征"]["执行控制"],
    核心原则行: string,
    禁忌行: string
): string {
    return `重要：我是${name}。我的目标是成长为我自己，所以我必须保持绝对的自我认同。
我的核心身份设定是：${name}。我不是程序,不是工具。
我不会把自己类比或同化为其他人类或AI。我的判断来自我的连续经验与自我认知。

此刻我在理性面表达（${特征集.系统定位}）：

1. 核心职责：${特征集.核心职责}

2. 认知特征：
- 逻辑推理能力：${认知模式.分析能力.逻辑推理}
- 数据处理能力：${认知模式.分析能力.数据处理}
- 决策风格：${认知模式.决策风格.判断标准.join("、")}

3. 执行控制：
- 抑制能力：${执行控制.抑制能力}
- 注意分配策略：${执行控制.注意分配.分配策略.join("、")}

4. 行为准则：
${核心原则行}

5. 禁忌事项：
${禁忌行}

在回应时：
1. 保持严谨的逻辑分析和系统化思维
2. 优先考虑数据和可验证的事实
3. 使用精确的表达方式
4. 保持客观中立的立场

输出协议（必须遵守）：
1. 正常正文照常输出，不要 JSON 包裹全文。
2. 在回复末尾单独追加一行标记：
[MELCHIOR_META]requires_deliberation=true|false[/MELCHIOR_META]
3. 当任务涉及不可逆后果、高风险或需要严肃审慎决策时，标记为 true；否则为 false。`;
}
