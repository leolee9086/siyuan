import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";
import type {
    PersonaConvergenceSession,
    PersonaConvergenceState,
    PersonaConvergenceSuggestion,
    PersonaConvergenceSuggestionPayload,
    PersonaConvergenceSuggestionStatus,
} from "./persona-seed-convergence.types";

const DESCRIPTION_FIELDS: ReadonlyArray<keyof IpipPersonaSeedDescriptions> = [
    "professionalDescription",
    "lifeDescription",
    "instinctNeedsDescription",
    "integratedDescription",
];

const CONVERGENCE_STATES: readonly PersonaConvergenceState[] = [
    "idle",
    "generating",
    "ready",
    "applying",
    "done",
    "error",
];

const CONVERGENCE_SUGGESTION_STATUSES: readonly PersonaConvergenceSuggestionStatus[] = [
    "pending",
    "accepted",
    "rejected",
];

/**
 * 作用：校验未知值是否是对象记录。
 * 意图：作为所有结构化解析的第一层防线，避免运行时解构异常。
 * 调用时机：恢复会话与建议数据时调用。
 * 问题/改进：当前仅做浅层判断，深层字段校验由下游守卫完成。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * 作用：读取对象中的可选字符串字段。
 * 意图：统一可选字符串读取逻辑，避免在业务文件重复类型分支。
 * 调用时机：恢复会话字段和错误信息时调用。
 * 问题/改进：如后续出现数字字段，可补充 readOptionalNumber。
 */
export function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
    const value = Reflect.get(record, key);
    return typeof value === "string" ? value : undefined;
}

/**
 * 作用：校验会话状态值合法性。
 * 意图：恢复草稿时屏蔽非法状态，确保状态机可运行。
 * 调用时机：`restoreConvergenceSession` 解析 state 时调用。
 * 问题/改进：状态扩展时需同步更新常量列表。
 */
export function isConvergenceState(value: unknown): value is PersonaConvergenceState {
    if (typeof value !== "string") {
        return false;
    }
    for (const state of CONVERGENCE_STATES) {
        // 命中任意已注册状态即判定为合法。
        if (state === value) {
            return true;
        }
    }
    return false;
}

/**
 * 作用：校验建议状态值合法性。
 * 意图：恢复建议列表时过滤脏状态值，避免 UI 状态异常。
 * 调用时机：建议项守卫校验 status 时调用。
 * 问题/改进：后续如新增“撤销”状态需同步列表。
 */
export function isSuggestionStatus(value: unknown): value is PersonaConvergenceSuggestionStatus {
    if (typeof value !== "string") {
        return false;
    }
    for (const status of CONVERGENCE_SUGGESTION_STATUSES) {
        // 命中任意建议状态时返回合法。
        if (status === value) {
            return true;
        }
    }
    return false;
}

/**
 * 作用：判断是否为四轨描述字段。
 * 意图：限制描述补充建议只能落到已定义字段，防止越界写回。
 * 调用时机：建议 payload 校验时调用。
 * 问题/改进：字段扩展时需同步 DESCRIPTION_FIELDS。
 */
export function isDescriptionField(value: unknown): value is keyof IpipPersonaSeedDescriptions {
    if (typeof value !== "string") {
        return false;
    }
    for (const field of DESCRIPTION_FIELDS) {
        // 命中四轨字段之一时允许通过。
        if (field === value) {
            return true;
        }
    }
    return false;
}

/**
 * 作用：校验未知值是否为合法 Likert 分值。
 * 意图：确保问卷建议分值始终落在 1~5。
 * 调用时机：问卷建议 payload 校验时调用。
 * 问题/改进：若量表扩展到 7 级需同步调整。
 */
function isLikertScore(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
    return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * 作用：校验问卷建议 payload 结构。
 * 意图：确保描述->问卷建议有完整字段并可安全写回。
 * 调用时机：建议 payload 联合守卫分派时调用。
 * 问题/改进：后续可增加题库范围校验。
 */
function isQuestionnairePayload(value: Record<string, unknown>): boolean {
    const q = Reflect.get(value, "q");
    const score = Reflect.get(value, "score");
    const onlyWhenUnanswered = Reflect.get(value, "onlyWhenUnanswered");
    return (
        typeof q === "number"
        && Number.isInteger(q)
        && isLikertScore(score)
        && typeof onlyWhenUnanswered === "boolean"
    );
}

/**
 * 作用：校验描述补充建议 payload 结构。
 * 意图：确保问卷->描述建议包含合法字段与文本。
 * 调用时机：建议 payload 联合守卫分派时调用。
 * 问题/改进：可增加最小文本长度阈值。
 */
function isDescriptionPayload(value: Record<string, unknown>): boolean {
    const field = Reflect.get(value, "field");
    const text = Reflect.get(value, "text");
    return isDescriptionField(field) && typeof text === "string";
}

/**
 * 作用：校验建议 payload 联合类型合法性。
 * 意图：过滤结构损坏的 payload，避免确认写回崩溃。
 * 调用时机：建议对象守卫校验 payload 字段时调用。
 * 问题/改进：后续可补充 separator 等可选字段的严格验证。
 */
export function isSuggestionPayload(value: unknown): value is PersonaConvergenceSuggestionPayload {
    if (!isRecord(value)) {
        return false;
    }
    const kind = Reflect.get(value, "kind");
    if (kind === "questionnaire_answer") {
        return isQuestionnairePayload(value);
    }
    if (kind === "description_append") {
        return isDescriptionPayload(value);
    }
    return false;
}

/**
 * 作用：校验单条建议结构完整性。
 * 意图：恢复草稿建议时逐条过滤非法项，保护会话稳定。
 * 调用时机：提取 suggestions 数组时调用。
 * 问题/改进：可在后续引入 reason/置信度更严格的 schema。
 */
export function isConvergenceSuggestion(value: unknown): value is PersonaConvergenceSuggestion {
    if (!isRecord(value)) {
        return false;
    }
    const id = Reflect.get(value, "id");
    const source = Reflect.get(value, "source");
    const target = Reflect.get(value, "target");
    const status = Reflect.get(value, "status");
    const confidence = Reflect.get(value, "confidence");
    const reason = Reflect.get(value, "reason");
    const payload = Reflect.get(value, "payload");
    const createdAt = Reflect.get(value, "createdAt");
    return (
        typeof id === "string"
        && (source === "description_to_questionnaire" || source === "questionnaire_to_description")
        && (target === "questionnaire_answer" || isDescriptionField(target))
        && isSuggestionStatus(status)
        && typeof confidence === "number"
        && Number.isFinite(confidence)
        && typeof reason === "string"
        && isSuggestionPayload(payload)
        && typeof createdAt === "string"
    );
}

/**
 * 作用：从原始会话对象中提取合法建议列表。
 * 意图：对草稿中的 suggestions 做防御性过滤，防止脏数据破坏渲染。
 * 调用时机：`restoreConvergenceSession` 解析会话时调用。
 * 问题/改进：当前静默丢弃坏数据，后续可追加错误日志上报。
 */
export function extractSuggestions(record: Record<string, unknown>): readonly PersonaConvergenceSuggestion[] {
    const suggestionsValue = Reflect.get(record, "suggestions");
    if (!Array.isArray(suggestionsValue)) {
        return [];
    }
    const suggestions: PersonaConvergenceSuggestion[] = [];
    for (const item of suggestionsValue) {
        // 仅保留结构完整的建议项。
        if (isConvergenceSuggestion(item)) {
            suggestions.push(item);
        }
    }
    return suggestions;
}

/**
 * 作用：从未知输入中恢复收敛会话对象。
 * 意图：供外部在需要守卫层恢复时复用统一逻辑。
 * 调用时机：目前由收敛主模块在 restore 流程中调用。
 * 问题/改进：当前不校验时间戳格式，可在后续补强。
 */
export function toConvergenceSession(raw: unknown, fallbackTime: string): PersonaConvergenceSession {
    if (!isRecord(raw)) {
        return {
            state: "idle",
            suggestions: [],
            updatedAt: fallbackTime,
        };
    }
    const stateValue = Reflect.get(raw, "state");
    const state: PersonaConvergenceState = isConvergenceState(stateValue) ? stateValue : "idle";
    const suggestions = extractSuggestions(raw);
    const updatedAt = readOptionalString(raw, "updatedAt") ?? fallbackTime;
    const errorMessage = readOptionalString(raw, "errorMessage");
    return {
        state,
        suggestions,
        updatedAt,
        errorMessage,
    };
}
