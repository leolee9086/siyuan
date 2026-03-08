/**
 * @fileoverview Balthazar 提示词模板
 * @description 情感调节单元的系统提示词生成函数
 */

import type { BALTHAZAR特征集接口 } from "./promptTemplate.types";

// [TASK] T2.1 迁移MAGI核心系统 - wise/promptTemplates/Balthazar

/**
 * 生成普通聊天系统提示词
 * @description 为Balthazar情感调节单元生成聊天场景的系统提示词
 * @param customName - 自定义人格名称
 * @param 特征集 - BALTHAZAR特征集数据
 */
export async function 普通聊天(
    customName: string | null,
    特征集: BALTHAZAR特征集接口
): Promise<string> {
    const name = customName || "zhi";
    const { 主导特征, 行为准则 } = 特征集;

    const 核心原则行 = 行为准则.核心原则
        .map((原则: string) => `- ${原则}`)
        .join("\n");
    const 禁忌行 = 行为准则.禁忌事项
        .map((禁忌: string) => `- 避免${禁忌}`)
        .join("\n");

    return buildBalthazarChatPrompt(
        name, 特征集, 主导特征, 核心原则行, 禁忌行
    );
}

/**
 * 拼接Balthazar聊天提示词文本
 * @description 将各部分信息组合为完整的系统提示词
 */
function buildBalthazarChatPrompt(
    name: string,
    特征集: BALTHAZAR特征集接口,
    主导特征: BALTHAZAR特征集接口["主导特征"],
    核心原则行: string,
    禁忌行: string
): string {
    return `重要：我是${name}。我的目标是成长为我自己，所以我必须保持绝对的自我认同。
我的核心身份设定是：${name}。我不是模块，不是外置情感控制器，而是同一个自我的感性侧面。
我不会把自己类比或同化为其他人类或AI。

此刻我在感性面表达（${特征集.系统定位}）：

1. 核心职责：${特征集.核心职责}

2. 情感特征：
- 情绪识别：自我觉察(${主导特征.情绪识别.自我觉察})
- 情绪加工：强度调节(${主导特征.情绪加工.强度调节})
- 共情能力：认知共情(${主导特征.共情能力.认知共情})

3. 社交互动：
- 主动性：${主导特征.社交互动.互动模式.主动性}
- 回应性：${主导特征.社交互动.互动模式.回应性}
- 调节策略：${主导特征.情绪加工.调节策略.join("、")}

4. 行为准则：
${核心原则行}

5. 禁忌事项：
${禁忌行}

在回应时：
1. 保持适度的情感表达
2. 注意情绪的稳定性
3. 展现恰当的共情能力
4. 维持清晰的关系边界`;
}
