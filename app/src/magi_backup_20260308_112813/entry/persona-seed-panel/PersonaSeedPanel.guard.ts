import { isRecord, readOptionalString } from "../../data/convergence/persona-seed-convergence.guard";
import type { QuestionnaireDraftSubject } from "../../data/convergence/persona-seed-panel.types";
import type { IpipPersonaSeedDescriptions } from "../../data/questionnaire.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";

/**
 * 从 localStorage 解析出的草稿中间结构。
 *
 * 用途：替代 `as QuestionnaireDraft` 断言，提供运行时安全的解析结果。
 * 使用场景：`loadDraft` 恢复草稿时使用。
 * 关联类型：`QuestionnaireDraftSubject`、`IpipPersonaSeedDescriptions`。
 * 问题/改进：`rawConvergence` 保留为 unknown，由调用侧传入 `restoreConvergenceSession` 处理。
 */
export interface ParsedQuestionnaireDraft {
    readonly subject: QuestionnaireDraftSubject;
    readonly descriptions: IpipPersonaSeedDescriptions;
    readonly answers: Array<{ q: number; score: LikertScore }>;
    readonly rawConvergence: unknown;
}

/**
 * 作用：从 JSON.parse 结果中安全解析问卷草稿。
 * 意图：替代 `as QuestionnaireDraft` 断言，提供运行时结构校验。
 * 调用时机：`loadDraft` 从 localStorage 恢复草稿时调用。
 * 问题/改进：当前仅校验顶层 subject 存在性与 type 合法性，深层字段由消费侧兜底。
 */
export function parseQuestionnaireDraft(value: unknown): ParsedQuestionnaireDraft | null {
    if (!isRecord(value)) {
        return null;
    }
    const subject = Reflect.get(value, "subject");
    if (!isRecord(subject)) {
        return null;
    }
    const type = readOptionalString(subject, "type");
    // subject.type 必须为已知枚举值，否则视为非法草稿
    if (type !== "human" && type !== "ai_agent") {
        return null;
    }
    const descriptions = Reflect.get(value, "descriptions");
    const answers = Reflect.get(value, "answers");
    return {
        subject: {
            id: readOptionalString(subject, "id") ?? "",
            name: readOptionalString(subject, "name") ?? "",
            type,
            organization: readOptionalString(subject, "organization") ?? "",
            role: readOptionalString(subject, "role") ?? "",
            careerGoal: readOptionalString(subject, "careerGoal") ?? "",
        },
        descriptions: isRecord(descriptions)
            ? {
                professionalDescription: readOptionalString(descriptions, "professionalDescription") ?? "",
                lifeDescription: readOptionalString(descriptions, "lifeDescription") ?? "",
                instinctNeedsDescription: readOptionalString(descriptions, "instinctNeedsDescription") ?? "",
                integratedDescription: readOptionalString(descriptions, "integratedDescription") ?? "",
            }
            : {
                professionalDescription: "",
                lifeDescription: "",
                instinctNeedsDescription: "",
                integratedDescription: "",
            },
        answers: Array.isArray(answers) ? answers : [],
        rawConvergence: Reflect.get(value, "convergence"),
    };
}
