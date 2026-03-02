import { isRecord } from "../persona-seed-convergence-llm.guard";
import type {
    PersonaSideDescriptionField,
    QuestionnaireToDescriptionLLMItem,
    QuestionnaireToDescriptionLLMResponse,
} from "./persona-seed-convergence-q2d-llm.types";

const SIDE_DESCRIPTION_FIELDS: readonly PersonaSideDescriptionField[] = [
    "professionalDescription",
    "lifeDescription",
    "instinctNeedsDescription",
];

/**
 * 作用：校验是否为三侧描述字段。
 * 意图：限制模型输出只更新一个“侧面描述”，避免越界到综合描述。
 * 调用时机：校验 LLM suggestion.field 时调用。
 * 问题/改进：后续若扩展字段需同步常量列表。
 */
export function isPersonaSideDescriptionField(value: unknown): value is PersonaSideDescriptionField {
    if (typeof value !== "string") {
        return false;
    }
    for (const field of SIDE_DESCRIPTION_FIELDS) {
        // 命中三侧字段之一即视为合法。
        if (field === value) {
            return true;
        }
    }
    return false;
}

/**
 * 作用：校验单条问卷->描述建议结构。
 * 意图：过滤字段缺失和类型异常，保证回写安全。
 * 调用时机：校验 LLM suggestion 对象时调用。
 * 问题/改进：后续可加入 text 最小长度约束。
 */
export function isQuestionnaireToDescriptionLLMItem(value: unknown): value is QuestionnaireToDescriptionLLMItem {
    if (!isRecord(value)) {
        return false;
    }
    const field = Reflect.get(value, "field");
    const text = Reflect.get(value, "text");
    const confidence = Reflect.get(value, "confidence");
    const reason = Reflect.get(value, "reason");
    return (
        isPersonaSideDescriptionField(field)
        && typeof text === "string"
        && typeof confidence === "number"
        && Number.isFinite(confidence)
        && typeof reason === "string"
    );
}

/**
 * 作用：校验问卷->描述建议响应结构。
 * 意图：统一入口保障解析层只处理合法 suggestion。
 * 调用时机：模型响应 JSON.parse 后调用。
 * 问题/改进：后续可增加 schemaVersion 字段提升可演进性。
 */
export function isQuestionnaireToDescriptionLLMResponse(value: unknown): value is QuestionnaireToDescriptionLLMResponse {
    if (!isRecord(value)) {
        return false;
    }
    const suggestion = Reflect.get(value, "suggestion");
    return isQuestionnaireToDescriptionLLMItem(suggestion);
}
