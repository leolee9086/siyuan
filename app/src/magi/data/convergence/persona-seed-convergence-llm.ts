import type { IpipNeo120Item } from "../ipip-neo-120.types";
import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";
import { getSafeSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isRecord } from "./persona-seed-convergence-llm.guard";
import { parseDescriptionToQuestionnaireSuggestionContent } from "./persona-seed-convergence-llm-parser";
import type { DescriptionToQuestionnaireSuggestionInput, PersonaSeedAnswerScore } from "./persona-seed-convergence-llm.types";
import type { PersonaConvergenceSuggestion } from "./persona-seed-convergence.types";

const MAX_SUGGESTIONS = 16;
const COMPLETION_TEMPERATURE = 0.2;
const COMPLETION_MAX_TOKENS = 1600;

/**
 * 作用：判断四轨描述是否至少存在一条有效文本。
 * 意图：避免在无输入语义时触发无意义的 LLM 请求。
 * 调用时机：发起描述->问卷建议生成前调用。
 * 问题/改进：当前只判断非空，后续可加最小字数阈值。
 */
function hasAnyDescriptionText(descriptions: IpipPersonaSeedDescriptions): boolean {
    if (descriptions.professionalDescription.trim()) {
        return true;
    }
    if (descriptions.lifeDescription.trim()) {
        return true;
    }
    if (descriptions.instinctNeedsDescription.trim()) {
        return true;
    }
    return Boolean(descriptions.integratedDescription.trim());
}

/**
 * 作用：读取运行时 OpenAI 兼容配置。
 * 意图：复用思源配置入口，避免和回答链路耦合。
 * 调用时机：每次发起 LLM 生成前调用。
 * 问题/改进：后续可抽取为 convergence 专用配置提供器。
 */
function readOpenAIConfig(): { apiBaseURL: string; apiKey: string; apiModel: string; apiTimeout: number } {
    const aiConf = getSafeSiyuanConfig()?.ai;
    const agentModelId = aiConf?.agent?.modelId;
    const provider = aiConf?.providers?.find((p) => p.models?.some((m) => m.id === agentModelId));
    const model = provider?.models?.find((m) => m.id === agentModelId);
    return {
        apiBaseURL: provider?.baseURL ?? "",
        apiKey: provider?.apiKey ?? "",
        apiModel: model?.name ?? "",
        apiTimeout: provider?.requestTimeout ?? 120,
    };
}

/**
 * 作用：将题库压缩为模型可消费的题号与题面列表。
 * 意图：让模型在可读约束下选择具体题号，而不是只输出抽象 trait。
 * 调用时机：构建用户提示词时调用。
 * 问题/改进：当前传全量题面，后续可按未作答题裁剪长度。
 */
function buildQuestionListText(questionBank: readonly IpipNeo120Item[]): string {
    return questionBank
        .map((item) => `${item.q}. ${item.text} [${item.domain}${item.facet}/${item.keyed}]`)
        .join("\n");
}

/**
 * 作用：提取已作答题号列表文本。
 * 意图：提示模型优先建议未作答题并减少冲突。
 * 调用时机：构建用户提示词时调用。
 * 问题/改进：后续可补充已作答分值供模型判断冲突程度。
 */
function buildAnsweredQuestionText(answers: readonly PersonaSeedAnswerScore[]): string {
    if (answers.length === 0) {
        return "无";
    }
    return answers
        .map((answer) => `${answer.q}:${answer.score}`)
        .sort()
        .join(", ");
}

/**
 * 作用：生成描述->问卷建议任务的系统提示词。
 * 意图：约束模型返回严格 JSON，减少解析不稳定性。
 * 调用时机：请求 chat/completions 前组装 messages 时调用。
 * 问题/改进：后续可按模型能力分版本提示词。
 */
function buildSystemPrompt(): string {
    return `你是人格测评问卷建议助手。
任务：基于用户四轨描述，为 IPIP-NEO-120 生成“建议作答”。
输出必须是 JSON 对象，格式为：
{"suggestions":[{"q":题号,"score":1-5整数,"confidence":0-1浮点,"reason":"简短理由"}]}
限制：suggestions 最多 ${MAX_SUGGESTIONS} 条，reason 不超过 30 字。
禁止输出 markdown、解释文本或多余字段。`;
}

/**
 * 作用：构建描述->问卷建议的用户提示词。
 * 意图：把主体、描述、题库与已作答上下文一次性注入模型。
 * 调用时机：每次请求 LLM 前调用。
 * 问题/改进：当前使用纯文本拼接，后续可升级为结构化 JSON prompt。
 */
function buildUserPrompt(input: DescriptionToQuestionnaireSuggestionInput): string {
    return `主体ID: ${input.subjectId}
主体名: ${input.subjectName}
职业描述:
${input.descriptions.professionalDescription || "(空)"}
生活描述:
${input.descriptions.lifeDescription || "(空)"}
本能需求描述:
${input.descriptions.instinctNeedsDescription || "(空)"}
综合自我描述:
${input.descriptions.integratedDescription || "(空)"}
已作答题号与分值:
${buildAnsweredQuestionText(input.answers)}
题库列表:
${buildQuestionListText(input.questionBank)}
请输出最多 ${MAX_SUGGESTIONS} 条建议。优先未作答题。`;
}

/**
 * 作用：从 OpenAI 兼容响应中读取首条 content。
 * 意图：统一响应解析入口，屏蔽弱类型结构细节。
 * 调用时机：chat/completions 返回后调用。
 * 问题/改进：后续可补充多候选合并策略。
 */
function readMessageContent(raw: unknown): string {
    if (!isRecord(raw)) {
        return "";
    }
    const choices = Reflect.get(raw, "choices");
    if (!Array.isArray(choices) || choices.length === 0) {
        return "";
    }
    const first = choices[0];
    if (!isRecord(first)) {
        return "";
    }
    const message = Reflect.get(first, "message");
    if (!isRecord(message)) {
        return "";
    }
    const content = Reflect.get(message, "content");
    return typeof content === "string" ? content : "";
}

/**
 * 作用：向 OpenAI 兼容接口请求一次建议生成。
 * 意图：封装网络层细节，供重试逻辑复用。
 * 调用时机：描述->问卷建议生成主流程中调用。
 * 问题/改进：当前只请求单轮 completion，后续可加入工具调用模式。
 */
async function requestSuggestionCompletion(input: DescriptionToQuestionnaireSuggestionInput): Promise<string> {
    const openAI = readOpenAIConfig();
    // 缺失关键配置时直接失败，提示用户先完成 AI 配置。
    if (!openAI.apiBaseURL || !openAI.apiKey || !openAI.apiModel) {
        throw new Error("AI 配置缺失，请先在思源设置中配置 ai.openAI");
    }
    if (openAI.apiTimeout < 150) {
        console.warn(`apiTimeout=${openAI.apiTimeout}s < 150s，对于现代 LLM 可能过短，请在 AI 配置中增加超时时间`);
    }
    const response = await fetch("/api/s-forge/ai/proxy/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: openAI.apiModel,
            temperature: COMPLETION_TEMPERATURE,
            max_tokens: COMPLETION_MAX_TOKENS,
            messages: [
                { role: "system", content: buildSystemPrompt() },
                { role: "user", content: buildUserPrompt(input) },
            ],
        }),
    });
    // 非 2xx 响应说明模型调用失败。
    if (!response.ok) {
        throw new Error(`LLM 请求失败: ${response.status}`);
    }
    const raw: unknown = await response.json();
    const content = readMessageContent(raw);
    // 模型返回空内容时视为失败，触发重试。
    if (!content.trim()) {
        throw new Error("LLM 返回为空");
    }
    return content;
}

/**
 * 作用：基于四轨描述生成“描述->问卷”待确认建议。
 * 意图：提供 PersonaSeedPanel 可直接触发的可用业务能力。
 * 调用时机：用户点击“描述->问卷建议”按钮时调用。
 * 问题/改进：当前仅处理单向建议，后续会补充问卷->描述方向。
 */
export async function generateDescriptionToQuestionnaireSuggestions(
    input: DescriptionToQuestionnaireSuggestionInput,
): Promise<readonly PersonaConvergenceSuggestion[]> {
    // 四轨描述全空时不调用模型，直接返回空建议。
    if (!hasAnyDescriptionText(input.descriptions)) {
        return [];
    }
    let lastErrorMessage = "LLM 未返回合法建议";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const content = await requestSuggestionCompletion(input);
            const suggestions = await parseDescriptionToQuestionnaireSuggestionContent(content, input);
            if (suggestions.length > 0) {
                return suggestions;
            }
            lastErrorMessage = "LLM 返回结构有效但无可用建议";
        } catch (error) {
            lastErrorMessage = error instanceof Error ? error.message : String(error);
        }
    }
    throw new Error(lastErrorMessage);
}
