import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";
import { toConvergenceSession } from "./persona-seed-convergence.guard";
import type {
    PersonaConvergenceSession,
    PersonaConvergenceState,
    PersonaConvergenceSuggestion,
    PersonaConvergenceSuggestionStatus,
} from "./persona-seed-convergence.types";

const DEFAULT_SEPARATOR = "\n\n";

const ALLOWED_STATE_TRANSITIONS: Readonly<Record<PersonaConvergenceState, readonly PersonaConvergenceState[]>> = {
    idle: ["generating", "ready", "error"],
    generating: ["ready", "error"],
    ready: ["applying", "done", "error"],
    applying: ["ready", "done", "error"],
    done: ["generating", "ready", "idle", "error"],
    error: ["idle", "generating", "ready"],
};

/**
 * 作用：生成收敛会话的统一时间戳。
 * 意图：避免各函数重复创建日期格式逻辑，保证持久化结构一致。
 * 调用时机：创建会话、迁移状态、更新建议状态时调用。
 * 问题/改进：后续可改为服务端授时。
 */
function createTimestamp(): string {
    return new Date().toISOString();
}

/**
 * 作用：将置信度裁剪到 0~1。
 * 意图：保证建议列表中的置信度展示范围稳定可控。
 * 调用时机：创建 pending 建议对象时调用。
 * 问题/改进：目前为线性裁剪，后续可引入更细分映射。
 */
function normalizeConfidence(confidence: number): number {
    // 非法值统一回退，避免污染排序与显示。
    if (!Number.isFinite(confidence)) {
        return 0;
    }
    // 小于下限时按 0 处理。
    if (confidence < 0) {
        return 0;
    }
    // 大于上限时按 1 处理。
    if (confidence > 1) {
        return 1;
    }
    return confidence;
}

/**
 * 作用：基于原会话创建新状态会话。
 * 意图：统一状态切换后更新时间与错误信息写入逻辑。
 * 调用时机：状态迁移函数中调用。
 * 问题/改进：后续可扩展会话审计字段。
 */
function buildSessionWithState(
    session: PersonaConvergenceSession,
    state: PersonaConvergenceState,
    errorMessage?: string,
): PersonaConvergenceSession {
    return {
        ...session,
        state,
        updatedAt: createTimestamp(),
        errorMessage,
    };
}

/**
 * 作用：更新单条建议状态。
 * 意图：拆分单项处理逻辑，降低批量更新函数复杂度。
 * 调用时机：`updateSuggestionStatus` 遍历建议列表时调用。
 * 问题/改进：可扩展记录确认时间与确认人。
 */
function updateOneSuggestionStatus(
    suggestion: PersonaConvergenceSuggestion,
    id: string,
    status: PersonaConvergenceSuggestionStatus,
): PersonaConvergenceSuggestion {
    // 仅目标建议更新状态，其他建议保持不变。
    if (suggestion.id !== id) {
        return suggestion;
    }
    return {
        ...suggestion,
        status,
    };
}

/** @同步豁免: UI构建 — 面板初始化需要同步返回空会话。 */
/**
 * 作用：创建空收敛会话。
 * 意图：为首次进入与兜底恢复提供确定的起点状态。
 * 调用时机：面板初始化、草稿缺失或异常时调用。
 * 问题/改进：当前 suggestions 为空，后续可加会话标识。
 */
export function createEmptyConvergenceSession(): PersonaConvergenceSession {
    return {
        state: "idle",
        suggestions: [],
        updatedAt: createTimestamp(),
    };
}

/** @同步豁免: 生命周期 — 草稿恢复必须同步完成。 */
/**
 * 作用：从未知输入恢复收敛会话。
 * 意图：保障草稿结构容错，避免脏数据导致 UI 初始化失败。
 * 调用时机：`PersonaSeedPanel.loadDraft` 恢复 convergence 时调用。
 * 问题/改进：当前为宽松恢复，后续可升级为严格 schema。
 */
export function restoreConvergenceSession(raw: unknown): PersonaConvergenceSession {
    const fallbackTime = createTimestamp();
    return toConvergenceSession(raw, fallbackTime);
}

/** @同步豁免: UI构建 — 建议对象创建为同步内存组装。 */
/**
 * 作用：创建一条待确认建议。
 * 意图：统一 pending 状态、时间戳和置信度处理。
 * 调用时机：生成双向收敛建议并入列时调用。
 * 问题/改进：id 目前由外层传入，后续可内置生成策略。
 */
export function createPendingSuggestion(
    suggestion: Omit<PersonaConvergenceSuggestion, "status" | "createdAt" | "confidence"> & {
        readonly confidence: number;
    },
): PersonaConvergenceSuggestion {
    return {
        ...suggestion,
        status: "pending",
        confidence: normalizeConfidence(suggestion.confidence),
        createdAt: createTimestamp(),
    };
}

/** @同步豁免: UI构建 — 本地状态机切换无需异步。 */
/**
 * 作用：驱动收敛会话状态迁移。
 * 意图：通过显式转移表限制非法跳转，提升流程可预测性。
 * 调用时机：生成建议、确认建议、应用写回时调用。
 * 问题/改进：非法跳转目前统一转 error，后续可按场景细化。
 */
export function transitionConvergenceState(
    session: PersonaConvergenceSession,
    next: PersonaConvergenceState,
    errorMessage?: string,
): PersonaConvergenceSession {
    const allowList = ALLOWED_STATE_TRANSITIONS[session.state];
    const canTransition = allowList.includes(next);
    // 非法跳转统一转入 error，便于 UI 显示异常。
    if (!canTransition) {
        return buildSessionWithState(session, "error", `非法状态迁移: ${session.state} -> ${next}`);
    }
    return buildSessionWithState(session, next, errorMessage);
}

/** @同步豁免: UI构建 — 建议列表更新是纯同步替换。 */
/**
 * 作用：批量设置当前会话建议列表。
 * 意图：集中处理 suggestions 覆盖和会话状态切换。
 * 调用时机：建议生成完成后写入会话时调用。
 * 问题/改进：目前直接覆盖，后续可扩展 merge 策略。
 */
export function setConvergenceSuggestions(
    session: PersonaConvergenceSession,
    suggestions: readonly PersonaConvergenceSuggestion[],
): PersonaConvergenceSession {
    const nextState: PersonaConvergenceState = suggestions.length > 0 ? "ready" : "done";
    return {
        ...session,
        state: nextState,
        suggestions,
        updatedAt: createTimestamp(),
        errorMessage: undefined,
    };
}

/** @同步豁免: UI构建 — 用户确认操作需要即时反馈。 */
/**
 * 作用：更新指定建议项状态。
 * 意图：支持逐条“接受/拒绝”确认流程。
 * 调用时机：用户点击建议操作按钮时调用。
 * 问题/改进：后续可支持批量更新。
 */
export function updateSuggestionStatus(
    session: PersonaConvergenceSession,
    id: string,
    status: PersonaConvergenceSuggestionStatus,
): PersonaConvergenceSession {
    const suggestions: PersonaConvergenceSuggestion[] = [];
    for (const suggestion of session.suggestions) {
        suggestions.push(updateOneSuggestionStatus(suggestion, id, status));
    }
    return {
        ...session,
        suggestions,
        updatedAt: createTimestamp(),
    };
}

/** @同步豁免: 性能考虑 — 纯内存计数无需异步。 */
/**
 * 作用：统计指定状态建议数量。
 * 意图：用于 UI 展示待确认/已确认数量。
 * 调用时机：渲染状态栏或按钮可用性判断时调用。
 * 问题/改进：后续可缓存统计结果以减少重复遍历。
 */
export function countSuggestionsByStatus(
    session: PersonaConvergenceSession,
    status: PersonaConvergenceSuggestionStatus,
): number {
    let count = 0;
    for (const suggestion of session.suggestions) {
        // 仅统计目标状态建议。
        if (suggestion.status === status) {
            count += 1;
        }
    }
    return count;
}

/** @同步豁免: UI构建 — 写回答案为同步变换。 */
/**
 * 作用：将单条问卷建议写回答案列表。
 * 意图：封装“仅填未答/允许覆盖”的统一策略。
 * 调用时机：用户接受问卷建议时调用。
 * 问题/改进：后续可保留历史版本用于审计。
 */
export function applySuggestionToAnswers(
    answers: readonly Array<{ q: number; score: LikertScore }>,
    suggestion: PersonaConvergenceSuggestion,
): Array<{ q: number; score: LikertScore }> {
    // 非问卷建议时直接返回原答案副本。
    if (suggestion.payload.kind !== "questionnaire_answer") {
        return [...answers];
    }
    const payload = suggestion.payload;
    const index = answers.findIndex((item) => item.q === payload.q);
    // 仅填未答模式下，题目已有答案则不覆盖。
    if (index >= 0 && payload.onlyWhenUnanswered) {
        return [...answers];
    }

    const next = [...answers];
    // 已存在题号时执行覆盖并保持排序。
    if (index >= 0) {
        next[index] = { q: payload.q, score: payload.score };
        next.sort((a, b) => a.q - b.q);
        return next;
    }

    next.push({ q: payload.q, score: payload.score });
    next.sort((a, b) => a.q - b.q);
    return next;
}

/** @同步豁免: UI构建 — 文本建议回写为同步字符串处理。 */
/**
 * 作用：将单条描述建议追加到指定字段。
 * 意图：遵循“补充不覆盖”策略，保护用户原始手写内容。
 * 调用时机：用户接受描述建议时调用。
 * 问题/改进：当前为文本包含去重，后续可增强语义去重。
 */
export function applySuggestionToDescriptions(
    descriptions: IpipPersonaSeedDescriptions,
    suggestion: PersonaConvergenceSuggestion,
): IpipPersonaSeedDescriptions {
    // 非描述建议时不改写描述字段。
    if (suggestion.payload.kind !== "description_append") {
        return {
            ...descriptions,
        };
    }
    const payload = suggestion.payload;
    const nextText = payload.text.trim();
    // 建议文本为空时忽略，避免写入空行噪音。
    if (!nextText) {
        return {
            ...descriptions,
        };
    }

    const fieldText = descriptions[payload.field];
    const currentText = fieldText.trim();
    // 已包含相同内容时跳过，保证重复应用幂等。
    if (currentText.includes(nextText)) {
        return {
            ...descriptions,
        };
    }

    const separator = payload.separator ?? DEFAULT_SEPARATOR;
    const mergedText = currentText ? `${currentText}${separator}${nextText}` : nextText;
    return {
        ...descriptions,
        [payload.field]: mergedText,
    };
}
