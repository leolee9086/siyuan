import type { IpipNeo120Item } from "../../ipip-neo-120.types";
import { getSafeSiyuanConfig } from "../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isRecord } from "../persona-seed-convergence-llm.guard";
import { parseQuestionnaireToDescriptionSuggestionContent } from "./persona-seed-convergence-q2d-llm-parser";
import {
    resolveShortestSideDescriptionField,
    toSideDescriptionSnapshot,
} from "./persona-seed-convergence-q2d-policy";
import type {
    PersonaDescriptionField,
    QuestionnaireToDescriptionSuggestionInput,
} from "./persona-seed-convergence-q2d-llm.types";
import type { PersonaConvergenceSuggestion } from "../persona-seed-convergence.types";

const COMPLETION_TEMPERATURE = 0.3;
const COMPLETION_MAX_TOKENS = 1200;
const MAX_RETRY = 2;

/**
 * 作用：读取运行时 OpenAI 兼容配置。
 * 意图：复用思源配置入口，不和回答链路耦合。
 * 调用时机：每次发起问卷->描述建议请求前调用。
 * 问题/改进：后续可抽取 convergence 专用配置适配层。
 */
function readOpenAIConfig(): { apiBaseURL: string; apiKey: string; apiModel: string; apiTimeout: number } {
    const config = getSafeSiyuanConfig();
    const openAI = config?.ai?.openAI;
    return {
        apiBaseURL: String(openAI?.apiBaseURL ?? "").trim(),
        apiKey: String(openAI?.apiKey ?? "").trim(),
        apiModel: String(openAI?.apiModel ?? "").trim(),
        apiTimeout: Number(openAI?.apiTimeout ?? 120),
    };
}

/**
 * 作用：构建题号到题目对象的索引。
 * 意图：将作答列表扩展为可读问卷上下文文本。
 * 调用时机：构建用户提示词时调用。
 * 问题/改进：后续可缓存索引减少重复构建。
 */
function createQuestionIndex(questionBank: readonly IpipNeo120Item[]): Readonly<Record<number, IpipNeo120Item>> {
    const index: Record<number, IpipNeo120Item> = {};
    for (const item of questionBank) {
        index[item.q] = item;
    }
    return index;
}

/**
 * 作用：格式化问卷作答明细文本。
 * 意图：把“问卷内容”完整传入模型，满足建议生成上下文要求。
 * 调用时机：构建用户提示词时调用。
 * 问题/改进：后续可按维度聚合，减少 token 占用。
 */
function buildAnswerDetailsText(input: QuestionnaireToDescriptionSuggestionInput): string {
    if (input.answers.length === 0) {
        return "无作答记录";
    }
    const index = createQuestionIndex(input.questionBank);
    const lines: string[] = [];
    const sortedAnswers = [...input.answers].sort((a, b) => a.q - b.q);
    for (const answer of sortedAnswers) {
        const item = index[answer.q];
        // 题目存在时输出完整语义标签，缺失时保留最小回退格式。
        if (item) {
            lines.push(
                `Q${answer.q} score=${answer.score} [${item.domain}${item.facet}/${item.keyed}] ${item.text}`,
            );
            continue;
        }
        lines.push(`Q${answer.q} score=${answer.score}`);
    }
    return lines.join("\n");
}

/**
 * 作用：构建问卷->描述建议任务的系统提示词。
 * 意图：明确“简历辅助”语气与目标字段约束，避免角色扮演输出。
 * 调用时机：请求 chat/completions 时调用。
 * 问题/改进：后续可按模型能力拆分更细粒度模板。
 */
function buildSystemPrompt(
    preferredField: PersonaDescriptionField,
    allowedFields: readonly PersonaDescriptionField[],
): string {
    return `你是专业的简历内容辅助写作顾问。
任务：基于问卷作答，生成“一个侧面描述”的补充建议，用于提升职业画像表达清晰度。
你必须遵守：
1. 输出只允许一个 suggestion，不得同时更新多个侧面描述。
2. field 只允许：${allowedFields.join(" | ")}。必须命中 ${preferredField}。
3. text 必须是可直接追加到原描述中的专业叙述，不得角色扮演，不得使用“作为某人格/我是某角色”等暗示。
4. 不得虚构经历，不得输出与输入冲突的夸张结论。
输出必须是严格 JSON：
{"suggestion":{"field":"professionalDescription|lifeDescription|instinctNeedsDescription|integratedDescription","text":"补充段落","confidence":0-1,"reason":"不超过30字"}}`;
}

/**
 * 作用：构建问卷->描述建议任务的用户提示词。
 * 意图：把基础资料、旧描述和问卷答案完整注入模型。
 * 调用时机：每次请求 LLM 前调用。
 * 问题/改进：当前为文本 prompt，后续可升级为结构化 JSON prompt。
 */
function buildUserPrompt(
    input: QuestionnaireToDescriptionSuggestionInput,
    preferredField: PersonaDescriptionField,
): string {
    return `基础资料:
id: ${input.subject.id}
name: ${input.subject.name}
type: ${input.subject.type}
organization: ${input.subject.organization}
role: ${input.subject.role}
careerGoal: ${input.subject.careerGoal}

旧的三侧描述:
professionalDescription:
${input.descriptions.professionalDescription || "(空)"}
lifeDescription:
${input.descriptions.lifeDescription || "(空)"}
instinctNeedsDescription:
${input.descriptions.instinctNeedsDescription || "(空)"}

综合描述(Trinity):
integratedDescription:
${input.descriptions.integratedDescription || "(空)"}

问卷作答内容:
${buildAnswerDetailsText(input)}

本轮必须更新字段: ${preferredField}
请基于以上信息返回一条最优先补充建议。`;
}

/**
 * 作用：读取 OpenAI 兼容响应中的首条 content。
 * 意图：统一解析路径，隔离弱类型响应结构。
 * 调用时机：chat/completions 返回后调用。
 * 问题/改进：后续可支持多候选聚合策略。
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
 * 作用：执行一次问卷->描述建议的模型请求。
 * 意图：封装网络调用细节供主流程重试复用。
 * 调用时机：生成建议主流程中调用。
 * 问题/改进：后续可加请求超时和 token 审计日志。
 */
async function requestSuggestionCompletion(
    input: QuestionnaireToDescriptionSuggestionInput,
    preferredField: PersonaDescriptionField,
    allowedFields: readonly PersonaDescriptionField[],
): Promise<string> {
    const openAI = readOpenAIConfig();
    // 缺失关键配置时直接失败，提示先完成环境配置。
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
                { role: "system", content: buildSystemPrompt(preferredField, allowedFields) },
                { role: "user", content: buildUserPrompt(input, preferredField) },
            ],
        }),
    });
    // 非 2xx 响应视为请求失败。
    if (!response.ok) {
        throw new Error(`LLM 请求失败: ${response.status}`);
    }
    const raw: unknown = await response.json();
    const content = readMessageContent(raw);
    // 空内容不能进入解析流程，触发重试。
    if (!content.trim()) {
        throw new Error("LLM 返回为空");
    }
    return content;
}

/** @同步豁免: UI构建 — 纯字段选择为同步分支逻辑。 */
/**
 * 作用：确定本轮建议应命中的目标描述字段。
 * 意图：支持“指定维度更新”与“默认最短侧更新”两种入口。
 * 调用时机：发起问卷->描述建议生成前调用。
 * 问题/改进：后续可引入用户偏好权重。
 */
function resolvePreferredField(input: QuestionnaireToDescriptionSuggestionInput): PersonaDescriptionField {
    // 指定维度模式下直接采用传入目标。
    if (input.preferredField) {
        return input.preferredField;
    }
    const sideDescriptions = toSideDescriptionSnapshot(input.descriptions);
    return resolveShortestSideDescriptionField(sideDescriptions);
}

/**
 * 作用：基于问卷答案生成“问卷 -> 描述”单条补充建议。
 * 意图：实现逆向收敛入口，并支持按维度定向更新。
 * 调用时机：用户点击“问卷 -> 描述建议”按钮时调用。
 * 问题/改进：当前固定返回最多 1 条建议，后续可按产品策略开放批量模式。
 */
export async function generateQuestionnaireToDescriptionSuggestions(
    input: QuestionnaireToDescriptionSuggestionInput,
): Promise<readonly PersonaConvergenceSuggestion[]> {
    // 无问卷作答时不调用模型，直接返回空建议。
    if (input.answers.length === 0) {
        return [];
    }
    const preferredField = resolvePreferredField(input);
    // 综合描述建议仅在显式允许时可生成。
    if (preferredField === "integratedDescription" && !input.allowIntegratedSuggestion) {
        return [];
    }
    const allowedFields: readonly PersonaDescriptionField[] = [preferredField];
    let lastErrorMessage = "LLM 未返回合法建议";
    for (let attempt = 1; attempt <= MAX_RETRY; attempt += 1) {
        try {
            const content = await requestSuggestionCompletion(input, preferredField, allowedFields);
            const suggestions = await parseQuestionnaireToDescriptionSuggestionContent(content, {
                ...input,
                preferredField,
            });
            // 解析到可用建议时直接返回。
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
