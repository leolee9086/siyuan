import { describe, expect, it } from "vitest";
import {
    applySuggestionToAnswers,
    applySuggestionToDescriptions,
    countSuggestionsByStatus,
    createEmptyConvergenceSession,
    createPendingSuggestion,
    restoreConvergenceSession,
    setConvergenceSuggestions,
    transitionConvergenceState,
    updateSuggestionStatus,
} from "./persona-seed-convergence";
import type { PersonaConvergenceSession, PersonaConvergenceSuggestion } from "./persona-seed-convergence.types";
import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";

const INITIAL_DESCRIPTIONS: IpipPersonaSeedDescriptions = {
    professionalDescription: "我在职业场景中偏好结构化决策。",
    lifeDescription: "我在关系中重视稳定和信任。",
    instinctNeedsDescription: "我需要明确边界和可控风险。",
    integratedDescription: "我是一个在理性与情感间追求平衡的人。",
};

/**
 * 作用：创建问卷建议样本。
 * 意图：统一测试中的问卷建议构造逻辑，减少重复字面量。
 * 调用时机：问卷建议相关测试用例中调用。
 * 问题/改进：后续可按题号参数化多样样本。
 */
function createQuestionnaireSuggestion(params?: {
    readonly id?: string;
    readonly score?: 1 | 2 | 3 | 4 | 5;
    readonly onlyWhenUnanswered?: boolean;
}): PersonaConvergenceSuggestion {
    const id = params?.id ?? "qa_1";
    const score = params?.score ?? 4;
    const onlyWhenUnanswered = params?.onlyWhenUnanswered ?? true;
    return {
        id,
        source: "description_to_questionnaire",
        target: "questionnaire_answer",
        status: "pending",
        confidence: 0.88,
        reason: "描述中体现出较高计划性。",
        payload: {
            kind: "questionnaire_answer",
            q: 5,
            score,
            onlyWhenUnanswered,
        },
        createdAt: "2026-03-02T00:00:00.000Z",
    };
}

/**
 * 作用：创建描述补充建议样本。
 * 意图：复用描述建议构造逻辑，便于测试追加策略。
 * 调用时机：描述建议相关测试用例中调用。
 * 问题/改进：后续可扩展不同字段的样本集。
 */
function createDescriptionSuggestion(text: string): PersonaConvergenceSuggestion {
    return {
        id: "desc_1",
        source: "questionnaire_to_description",
        target: "professionalDescription",
        status: "pending",
        confidence: 0.73,
        reason: "C 维度偏高，建议补充执行风格。",
        payload: {
            kind: "description_append",
            field: "professionalDescription",
            text,
        },
        createdAt: "2026-03-02T00:00:00.000Z",
    };
}

/**
 * 作用：验证空会话初始化状态。
 * 意图：确保恢复失败时有可预测兜底状态。
 * 调用时机：会话基础用例执行时调用。
 * 问题/改进：后续可补充时间字段格式断言。
 */
function shouldCreateEmptySessionInIdleState(): void {
    const session = createEmptyConvergenceSession();
    expect(session.state).toBe("idle");
    expect(session.suggestions).toHaveLength(0);
}

/**
 * 作用：验证 createPendingSuggestion 的默认字段。
 * 意图：确保建议构造函数可稳定生成 pending 建议。
 * 调用时机：建议创建行为测试中调用。
 * 问题/改进：后续可补充置信度裁剪边界值断言。
 */
function shouldCreatePendingSuggestionWithNormalizedConfidence(): void {
    const suggestion = createPendingSuggestion({
        id: "pending_1",
        source: "description_to_questionnaire",
        target: "questionnaire_answer",
        confidence: 1.4,
        reason: "测试建议",
        payload: {
            kind: "questionnaire_answer",
            q: 11,
            score: 5,
            onlyWhenUnanswered: true,
        },
    });
    expect(suggestion.status).toBe("pending");
    expect(suggestion.confidence).toBe(1);
}

/**
 * 作用：验证建议设置后会话进入 ready。
 * 意图：确保建议生成完成后 UI 可进入可确认阶段。
 * 调用时机：建议入列流程测试中调用。
 * 问题/改进：后续可补充空建议转 done 的覆盖。
 */
function shouldMoveToReadyAfterSettingSuggestions(): void {
    const session = createEmptyConvergenceSession();
    const suggestion = createQuestionnaireSuggestion();
    const nextSession = setConvergenceSuggestions(session, [suggestion]);
    expect(nextSession.state).toBe("ready");
    expect(nextSession.suggestions).toHaveLength(1);
}

/**
 * 作用：验证非法状态迁移会落入 error。
 * 意图：防止 UI 误操作导致状态机进入不可解释状态。
 * 调用时机：状态机守卫测试中调用。
 * 问题/改进：后续可增加更多状态对的覆盖。
 */
function shouldFailOnInvalidStateTransition(): void {
    const readySession: PersonaConvergenceSession = {
        ...createEmptyConvergenceSession(),
        state: "ready",
    };
    const nextSession = transitionConvergenceState(readySession, "generating");
    expect(nextSession.state).toBe("error");
    expect(nextSession.errorMessage).toContain("非法状态迁移");
}

/**
 * 作用：验证问卷建议在仅填未答模式下不会覆盖现有答案。
 * 意图：保证“建议层不强覆盖用户输入”的核心约束。
 * 调用时机：问卷建议写回测试中调用。
 * 问题/改进：可补充覆盖模式下替换行为断言。
 */
function shouldRespectOnlyWhenUnansweredForQuestionnaireSuggestion(): void {
    const suggestion = createQuestionnaireSuggestion({ onlyWhenUnanswered: true, score: 5 });
    const originalAnswers = [{ q: 5, score: 2 as const }];
    const nextAnswers = applySuggestionToAnswers(originalAnswers, suggestion);
    expect(nextAnswers).toEqual(originalAnswers);
}

/**
 * 作用：验证问卷建议可追加未作答题目。
 * 意图：确保“描述->问卷建议”能补齐空白题项。
 * 调用时机：问卷建议写回测试中调用。
 * 问题/改进：后续可补充排序稳定性测试。
 */
function shouldAppendAnswerForUnansweredQuestion(): void {
    const suggestion = createQuestionnaireSuggestion({ onlyWhenUnanswered: true, score: 5 });
    const originalAnswers = [{ q: 4, score: 3 as const }];
    const nextAnswers = applySuggestionToAnswers(originalAnswers, suggestion);
    expect(nextAnswers).toHaveLength(2);
    expect(nextAnswers[1]).toEqual({ q: 5, score: 5 });
}

/**
 * 作用：验证描述建议采用追加策略且保持原文不丢失。
 * 意图：落实“问卷->描述补充建议不覆盖手写原文”原则。
 * 调用时机：描述建议写回测试中调用。
 * 问题/改进：后续可增加自定义分隔符场景。
 */
function shouldAppendDescriptionInsteadOfReplacing(): void {
    const suggestion = createDescriptionSuggestion("我会先完成关键路径任务再扩展优化。");
    const nextDescriptions = applySuggestionToDescriptions(INITIAL_DESCRIPTIONS, suggestion);
    expect(nextDescriptions.professionalDescription).toContain(INITIAL_DESCRIPTIONS.professionalDescription);
    expect(nextDescriptions.professionalDescription).toContain("关键路径任务");
}

/**
 * 作用：验证建议状态更新与统计可用。
 * 意图：保证确认式写入流程中的“待确认数量”显示准确。
 * 调用时机：建议状态机测试中调用。
 * 问题/改进：后续可增加 rejected 数量统计覆盖。
 */
function shouldUpdateSuggestionStatusAndCountPending(): void {
    const session = setConvergenceSuggestions(createEmptyConvergenceSession(), [
        createQuestionnaireSuggestion({ id: "qa_a" }),
        createQuestionnaireSuggestion({ id: "qa_b" }),
    ]);
    const updatedSession = updateSuggestionStatus(session, "qa_a", "accepted");
    expect(countSuggestionsByStatus(updatedSession, "pending")).toBe(1);
    expect(countSuggestionsByStatus(updatedSession, "accepted")).toBe(1);
}

/**
 * 作用：验证恢复函数在异常输入下能回退到空会话。
 * 意图：避免草稿结构损坏导致面板初始化失败。
 * 调用时机：恢复链路测试中调用。
 * 问题/改进：后续可补充半合法结构的细粒度断言。
 */
function shouldFallbackToEmptySessionOnInvalidRestoreInput(): void {
    const restored = restoreConvergenceSession("invalid");
    expect(restored.state).toBe("idle");
    expect(restored.suggestions).toHaveLength(0);
}

/**
 * 作用：注册收敛状态机与写回逻辑测试套件。
 * 意图：统一管理 Phase A 的基础行为回归用例。
 * 调用时机：测试模块加载时调用。
 * 问题/改进：随着 LLM 生成链路落地可进一步拆分子 suite。
 */
function runPersonaConvergenceSuite(): void {
    it("应创建 idle 空会话", shouldCreateEmptySessionInIdleState);
    it("应创建 pending 建议并裁剪置信度", shouldCreatePendingSuggestionWithNormalizedConfidence);
    it("设置建议后应进入 ready", shouldMoveToReadyAfterSettingSuggestions);
    it("非法状态迁移应进入 error", shouldFailOnInvalidStateTransition);
    it("仅填未答模式不应覆盖已有答案", shouldRespectOnlyWhenUnansweredForQuestionnaireSuggestion);
    it("应为未作答题追加建议分值", shouldAppendAnswerForUnansweredQuestion);
    it("描述建议应采用追加策略", shouldAppendDescriptionInsteadOfReplacing);
    it("应支持建议状态更新与待确认计数", shouldUpdateSuggestionStatusAndCountPending);
    it("恢复异常输入应回退空会话", shouldFallbackToEmptySessionOnInvalidRestoreInput);
}

describe("persona-seed-convergence", runPersonaConvergenceSuite);
