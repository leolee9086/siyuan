import type { WrappedSeel } from "../useMagi.types";
import type { 二元决策, 审议上下文 } from "./realVote.types";
import { 是二元决策, 是记录 } from "./realVote.guard";

/**
 * 创建评审系统提示词
 *
 * 作用：约束评审侧面的输出格式和判定目标。
 * 意图：让模型稳定返回可解析的二元投票 JSON。
 * 调用时机：`获取真实投票决策` 发起请求前调用。
 */
function 创建评审系统提示词(displayName: string): string {
    return `你是 ${displayName}，正在参与审慎决策复核。
任务：根据“用户原始输入 + Melchior判断 + 当前提案”给出二元投票。
输出要求（必须遵守）：
1. 仅输出 JSON：{"decision":"批准|否决","reason":"一句话理由"}
2. decision 只能是 批准 或 否决
3. reason 必须简短，不超过 30 字`;
}

/**
 * 创建评审用户输入
 *
 * 作用：将本轮审议材料拼装成结构化文本。
 * 意图：确保 Balthazar/Casper 在同一上下文上做裁决。
 * 调用时机：`获取真实投票决策` 发起请求前调用。
 */
function 创建评审用户输入(proposedAction: string, context: 审议上下文): string {
    return `用户原始输入：
${context.userMessage}

Melchior 关键判断：
${context.melchiorConclusion}

待审议提案：
${proposedAction}`;
}

/**
 * 解析模型响应正文
 *
 * 作用：从 OpenAI 兼容响应中读取首条 message.content。
 * 意图：屏蔽弱类型 JSON 结构细节，集中处理空值兜底。
 * 调用时机：收到投票模型响应后调用。
 */
function 解析响应正文(raw: unknown): string {
    // 根节点不是对象时无法继续读取 OpenAI 兼容字段。
    if (!是记录(raw)) {
        return "";
    }
    const choicesValue = Reflect.get(raw, "choices");
    // choices 缺失或结构异常时直接按空正文处理。
    if (!Array.isArray(choicesValue)) {
        return "";
    }
    const firstChoice = choicesValue[0];
    // 首个候选不是对象时说明响应格式不完整。
    if (!是记录(firstChoice)) {
        return "";
    }
    const messageValue = Reflect.get(firstChoice, "message");
    // message 缺失时无法提取 content。
    if (!是记录(messageValue)) {
        return "";
    }
    const contentValue = Reflect.get(messageValue, "content");
    return typeof contentValue === "string" ? contentValue : "";
}

/**
 * 安全解析 JSON
 *
 * 作用：尝试将模型输出按 JSON 解析。
 * 意图：兼容模型偶发的纯文本输出，避免抛错中断流程。
 * 调用时机：提取 decision 前调用。
 */
function 安全解析JSON(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * 提取 JSON 决策字段
 *
 * 作用：从已解析 JSON 中读取 decision 并做合法性校验。
 * 意图：拆平分支结构，避免在解析主流程出现嵌套 if。
 * 调用时机：`解析决策` 优先读取结构化输出时调用。
 */
function 提取JSON决策(parsed: unknown): 二元决策 | null {
    // 非对象输入不可能包含 decision 字段。
    if (!是记录(parsed)) {
        return null;
    }
    const decisionValue = Reflect.get(parsed, "decision");
    return 是二元决策(decisionValue) ? decisionValue : null;
}

/**
 * 解析二元决策
 *
 * 作用：优先从 JSON decision 读取，失败后回退到文本关键词匹配。
 * 意图：在真实模型输出不稳定时仍能得到确定性结果。
 * 调用时机：拿到模型正文后调用。
 */
function 解析决策(content: string): 二元决策 {
    const jsonDecision = 提取JSON决策(安全解析JSON(content));
    // JSON 中给出合法 decision 时优先采用。
    if (jsonDecision) {
        return jsonDecision;
    }

    const matched = content.match(/批准|否决/);
    // 文本中未命中任何合法关键词时保守否决。
    if (!matched) {
        return "否决";
    }
    return 是二元决策(matched[0]) ? matched[0] : "否决";
}

/**
 * 获取真实投票决策
 *
 * 作用：调用模型对提案进行真实审议并返回二元裁决。
 * 意图：替换原先随机投票，确保其余两个侧面基于提案上下文做判断。
 * 调用时机：`processVoting` 在遍历 Balthazar/Casper 时调用。
 */
export async function 获取真实投票决策(
    seel: WrappedSeel,
    proposedAction: string,
    context: 审议上下文,
): Promise<二元决策> {
    const openAI = seel._originalAI.config.openAIConfig;
    const baseURL = String(openAI.base_url ?? "").trim();
    const apiKey = String(openAI.apiKey ?? "").trim();
    const model = String(openAI.model ?? "").trim();
    // 关键配置缺失时无法发起真实投票请求，安全降级为否决。
    if (!baseURL || !apiKey || !model) {
        return "否决";
    }

    const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 120,
            messages: [
                { role: "system", content: 创建评审系统提示词(seel.config.displayName) },
                { role: "user", content: 创建评审用户输入(proposedAction, context) },
            ],
        }),
    });
    // 接口非 2xx 代表本轮审议不可用，避免误放行直接否决。
    if (!response.ok) {
        return "否决";
    }

    const raw: unknown = await response.json();
    const content = 解析响应正文(raw);
    return 解析决策(content);
}
