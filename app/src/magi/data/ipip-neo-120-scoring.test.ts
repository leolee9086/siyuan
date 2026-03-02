import { describe, expect, it } from "vitest";
import type { IpipNeo120RawAnswer, IpipSubjectProfile, PersonaBase } from "./questionnaire.types";
import { ipipNeo120QuestionBank } from "./ipip-neo-120";
import {
    buildIpipPersonaProfile,
    buildIpipPersonaProfileFromRawAnswers,
    ipipNeo120ScoringStats,
    scoreIpipNeo120PersonaBase,
    validateIpipNeo120ScoringInvariant,
} from "./ipip-neo-120-scoring";

const TRAIT_KEYS: readonly (keyof PersonaBase["traits"])[] = ["O", "C", "E", "A", "N"];

const BASE_SUBJECT: IpipSubjectProfile = {
    id: "zhi",
    name: "织",
    organization: "NERV",
    role: "Pilot",
    careerGoal: "Protect human civilization",
};

const NEUTRAL_NORMALIZED_SCORE = 0.5;
const PLUS_N1_FACET_EXPECTED = 0.625;
const PLUS_N_TRAIT_EXPECTED = 0.5208333333;
const MINUS_A2_FACET_EXPECTED = 0.375;
const MINUS_A_TRAIT_EXPECTED = 0.4791666667;

/**
 * 作用：基于题库生成“全 3 分”的中性答案样本。
 * 意图：构造一个可预测的对照组，便于验证归一化后的中位值。
 * 调用时机：各测试用例创建 baseline 输入时调用。
 * 问题/改进：当前固定 score=3，后续可增加随机样本生成器。
 */
function buildNeutralAnswers(questionBank: readonly { q: number; text: string }[]): readonly IpipNeo120RawAnswer[] {
    const answers: IpipNeo120RawAnswer[] = [];
    for (const item of questionBank) {
        answers.push({
            q: item.q,
            text: item.text,
            score: 3,
        });
    }
    return answers;
}

/**
 * 作用：替换指定题号的作答分值，返回新答案数组。
 * 意图：在保持其余 119 题不变时，单点观测 plus/minus 计分影响。
 * 调用时机：方向性计分测试用例中调用。
 * 问题/改进：当前按 q 精确替换，后续可扩展批量替换能力。
 */
function replaceAnswerScore(
    answers: readonly IpipNeo120RawAnswer[],
    q: number,
    score: 1 | 2 | 3 | 4 | 5,
): readonly IpipNeo120RawAnswer[] {
    const next: IpipNeo120RawAnswer[] = [];
    for (const answer of answers) {
        next.push(
            answer.q === q
                ? {
                    ...answer,
                    score,
                }
                : answer,
        );
    }
    return next;
}

const NEUTRAL_ANSWERS = buildNeutralAnswers(ipipNeo120QuestionBank);


/**
 * 作用：验证中性答案可稳定映射到 0.5 的归一化中位值。
 * 意图：确保基础归一化公式 `(mean - 1) / 4` 在全量维度上生效。
 * 调用时机：计分模块测试的基线用例。
 * 问题/改进：后续可补充更多随机样本做统计验证。
 */
function shouldScoreNeutralAnswersToMidpoint(): void {
    const personaBase = scoreIpipNeo120PersonaBase(NEUTRAL_ANSWERS, ipipNeo120QuestionBank);
    for (const traitKey of TRAIT_KEYS) {
        expect(personaBase.traits[traitKey]).toBeCloseTo(NEUTRAL_NORMALIZED_SCORE, 10);
    }
    expect(Object.keys(personaBase.facets)).toHaveLength(30);
    expect(personaBase.facets.N1_Anxiety).toBeCloseTo(NEUTRAL_NORMALIZED_SCORE, 10);
    expect(personaBase.facets.A2_Morality).toBeCloseTo(NEUTRAL_NORMALIZED_SCORE, 10);
}

/**
 * 作用：验证 plus/minus 题在方向性计分上的行为差异。
 * 意图：确保 minus 题按 `6-score` 反向转换，而非直接累加原始分值。
 * 调用时机：计分模块核心逻辑用例。
 * 问题/改进：当前验证单题扰动，后续可增加多题组合扰动测试。
 */
function shouldApplyPlusAndMinusDirectionCorrectly(): void {
    const boostedPlus = replaceAnswerScore(NEUTRAL_ANSWERS, 1, 5);
    const boostedMinus = replaceAnswerScore(NEUTRAL_ANSWERS, 9, 5);

    const plusPersonaBase = scoreIpipNeo120PersonaBase(boostedPlus, ipipNeo120QuestionBank);
    const minusPersonaBase = scoreIpipNeo120PersonaBase(boostedMinus, ipipNeo120QuestionBank);

    expect(plusPersonaBase.facets.N1_Anxiety).toBeCloseTo(PLUS_N1_FACET_EXPECTED, 10);
    expect(plusPersonaBase.traits.N).toBeCloseTo(PLUS_N_TRAIT_EXPECTED, 10);
    expect(minusPersonaBase.facets.A2_Morality).toBeCloseTo(MINUS_A2_FACET_EXPECTED, 10);
    expect(minusPersonaBase.traits.A).toBeCloseTo(MINUS_A_TRAIT_EXPECTED, 10);
}

/**
 * 作用：验证档案构造函数可输出规范的 schema 与时间戳字段。
 * 意图：确保 `buildIpipPersonaProfile` 是稳定可复用的对象构造器。
 * 调用时机：档案构建路径测试中调用。
 * 问题/改进：目前仅覆盖显式 generatedAt，后续可补默认时间格式断言。
 */
function shouldBuildProfileFromPersonaBase(): void {
    const personaBase = scoreIpipNeo120PersonaBase(NEUTRAL_ANSWERS, ipipNeo120QuestionBank);
    const profile = buildIpipPersonaProfile({
        subject: BASE_SUBJECT,
        personaBase,
        generatedAt: "2026-03-02T00:00:00.000Z",
    });

    expect(profile.schemaVersion).toBe("IPIP-NEO-120-v1");
    expect(profile.generatedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(profile.subject).toEqual(BASE_SUBJECT);
    expect(profile.personaBase.traits.O).toBeCloseTo(NEUTRAL_NORMALIZED_SCORE, 10);
}

/**
 * 作用：验证一体化入口可直接从原始答案构建人格档案。
 * 意图：保障调用方可以减少样板代码，仍得到与两段式一致的结果。
 * 调用时机：便捷 API 行为测试中调用。
 * 问题/改进：可增加与两段式输出对象深比较。
 */
function shouldBuildProfileFromRawAnswersDirectly(): void {
    const profile = buildIpipPersonaProfileFromRawAnswers({
        subject: BASE_SUBJECT,
        answers: NEUTRAL_ANSWERS,
        items: ipipNeo120QuestionBank,
        generatedAt: "2026-03-02T08:00:00.000Z",
    });

    expect(profile.schemaVersion).toBe("IPIP-NEO-120-v1");
    expect(profile.generatedAt).toBe("2026-03-02T08:00:00.000Z");
    expect(profile.personaBase.facets.C6_Cautiousness).toBeCloseTo(NEUTRAL_NORMALIZED_SCORE, 10);
}

/**
 * 作用：验证计分入口对不完整答案和异常题号有防御性报错。
 * 意图：在提交落盘前尽早阻断脏数据，确保 personaBase 可解释性。
 * 调用时机：异常路径测试中调用。
 * 问题/改进：当前只校验三类典型异常，后续可扩展到非法分值场景。
 */
function shouldRejectInvalidAnswerCoverage(): void {
    const firstAnswer = NEUTRAL_ANSWERS[0];
    if (firstAnswer === undefined) {
        throw new Error("NEUTRAL_ANSWERS is empty");
    }

    const incompleteAnswers = NEUTRAL_ANSWERS.slice(0, 119);
    const duplicatedQuestionAnswers: readonly IpipNeo120RawAnswer[] = [...NEUTRAL_ANSWERS.slice(0, 119), firstAnswer];
    const unknownQuestionAnswer: IpipNeo120RawAnswer = {
        ...firstAnswer,
        q: 999,
    };
    const unknownQuestionAnswers = NEUTRAL_ANSWERS.map((answer, i) => i === 0 ? unknownQuestionAnswer : answer);

    expect(() => {
        scoreIpipNeo120PersonaBase(incompleteAnswers, ipipNeo120QuestionBank);
    }).toThrow();

    expect(() => {
        scoreIpipNeo120PersonaBase(duplicatedQuestionAnswers, ipipNeo120QuestionBank);
    }).toThrow();

    expect(() => {
        scoreIpipNeo120PersonaBase(unknownQuestionAnswers, ipipNeo120QuestionBank);
    }).toThrow();
}

/**
 * 作用：验证题库反向题数量 invariant 与统计常量一致。
 * 意图：为运行时 guard 提供最小回归保障。
 * 调用时机：计分模块守卫测试中调用。
 * 问题/改进：后续可补每个 domain 的 plus/minus 分布断言。
 */
function shouldKeepMinusItemInvariantStable(): void {
    expect(ipipNeo120ScoringStats.EXPECTED_MINUS_ITEMS).toBe(55);
    expect(() => {
        validateIpipNeo120ScoringInvariant(ipipNeo120QuestionBank);
    }).not.toThrow();
}

/**
 * 作用：注册 ipip-neo-120 计分模块测试用例。
 * 意图：用命名函数替代超长内联回调，提升可读性并满足 lint 约束。
 * 调用时机：传入 describe 时执行。
 * 问题/改进：后续随着 Phase 3/4 接线可继续分拆子 suite。
 */
function runIpipNeo120ScoringSuite(): void {
    it("中性答案应归一化到 0.5", shouldScoreNeutralAnswersToMidpoint);
    it("应正确处理 plus/minus 方向性计分", shouldApplyPlusAndMinusDirectionCorrectly);
    it("应从 personaBase 构建标准档案", shouldBuildProfileFromPersonaBase);
    it("应支持从原始答案直接构建档案", shouldBuildProfileFromRawAnswersDirectly);
    it("应拒绝不完整、重复或未知题号的答案", shouldRejectInvalidAnswerCoverage);
    it("应满足反向题数量 invariant", shouldKeepMinusItemInvariantStable);
}

describe("ipip-neo-120-scoring", runIpipNeo120ScoringSuite);
