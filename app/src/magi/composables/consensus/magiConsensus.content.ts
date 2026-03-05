import type { SageResponse } from "../../utils/messageFactory.types";

const MELCHIOR_META_PATTERN =
    /\[MELCHIOR_META\]\s*requires_deliberation\s*[:=]\s*(?<flag>true|false)\s*\[\/MELCHIOR_META\]/i;
const PLAIN_DELIBERATION_PATTERN = /requires_deliberation\s*[:=]\s*(?<flag>true|false)/i;

/** 清理 Melchior 输出中的元标记，避免渲染到聊天界面。 */
function sanitizeMelchiorResponse(content: string): string {
    return content
        .replace(MELCHIOR_META_PATTERN, "")
        .replace(/^\s*requires_deliberation\s*[:=]\s*(true|false)\s*$/gim, "")
        .trim();
}

/** @同步豁免: 性能考虑 - 纯文本解析，不涉及异步副作用。 */
export function parseMelchiorResponseContent(content: string): {
    content: string;
    requiresDeliberation: boolean;
} {
    const metaMatch = content.match(MELCHIOR_META_PATTERN);
    if (metaMatch) {
        return {
            content: sanitizeMelchiorResponse(content),
            requiresDeliberation: metaMatch.groups?.flag?.toLowerCase() === "true",
        };
    }
    const plainMatch = content.match(PLAIN_DELIBERATION_PATTERN);
    return {
        content: sanitizeMelchiorResponse(content),
        requiresDeliberation: plainMatch?.groups?.flag?.toLowerCase() === "true",
    };
}

/** 按贤者名称获取对应响应内容。 */
function findSageContent(
    validResponses: SageResponse[],
    seelName: string,
    fallback: string,
): string {
    return validResponses.find((response) => response.seel.includes(seelName))?.content ?? fallback;
}

/** @同步豁免: 性能考虑 - 纯字符串拼接，无I/O或状态竞争。 */
export function buildTrinityIntrospectionInput(
    validResponses: SageResponse[],
    requestSourceBrief: string = "",
): string {
    const melchior = findSageContent(validResponses, "MELCHIOR", "我还在整理逻辑线索。");
    const balthazar = findSageContent(validResponses, "BALTHASAR", "我还在感受这件事的情绪波动。");
    const casper = findSageContent(validResponses, "CASPER", "我暂时没有明确的本能倾向。");

    return `逻辑告诉我：${melchior}

情绪告诉我：${balthazar}

直觉告诉我：${casper}
${requestSourceBrief ? `\n\n${requestSourceBrief}` : ""}`;
}
